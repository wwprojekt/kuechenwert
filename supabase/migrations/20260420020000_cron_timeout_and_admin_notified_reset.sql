-- Bug-fix #7: check-expired-auctions cron job had no timeout_milliseconds.
--   pg_net falls back to 5 s, but the function loops over every expired
--   auction + kaufchance + grace-window festpreis row, and the round-2+
--   soft-brake fan-out can easily exceed 30 s on a busy day. Without a
--   timeout we silently get partial results.
--
-- Bug-fix #9: festpreis_admin_notified_at must be reset to NULL the moment
--   an admin (or anybody) sets a positive instant_price on the underlying
--   motorhome — otherwise the cron's 24h grace window logic considers the
--   listing "still missing a price" and ends it on the next tick even
--   though the price is now valid.
--
-- This migration handles both.

-- ── 1) Re-schedule check-expired-auctions with explicit 60s timeout ──
SELECT cron.unschedule('check-expired-auctions');

SELECT cron.schedule(
  'check-expired-auctions',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zcrwqxsyptjwkuxfacvq.supabase.co/functions/v1/check-expired-auctions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := concat('{"time": "', now(), '"}')::jsonb,
    timeout_milliseconds := 60000
  ) AS request_id;
  $$
);

-- ── 2) Reset festpreis_admin_notified_at when motorhomes.instant_price
--       transitions to a positive value. We hook on motorhomes (not auctions)
--       because that's where the admin edit dialog writes; the auction row
--       inherits the price implicitly via sale_channel='instant_price'.
CREATE OR REPLACE FUNCTION public.reset_festpreis_admin_notified_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sale_channel = 'instant_price'
     AND NEW.instant_price IS NOT NULL
     AND NEW.instant_price > 0
     AND (
       OLD.instant_price IS DISTINCT FROM NEW.instant_price
       OR OLD.sale_channel IS DISTINCT FROM NEW.sale_channel
     )
  THEN
    UPDATE public.auctions
       SET festpreis_admin_notified_at = NULL,
           updated_at = now()
     WHERE motorhome_id = NEW.id
       AND festpreis_admin_notified_at IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_festpreis_admin_notified_at ON public.motorhomes;
CREATE TRIGGER trg_reset_festpreis_admin_notified_at
  AFTER UPDATE OF instant_price, sale_channel ON public.motorhomes
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_festpreis_admin_notified_at();

COMMENT ON FUNCTION public.reset_festpreis_admin_notified_at() IS
  'Bug-fix #9: bei jedem Admin-Update das instant_price > 0 setzt, wird der 24h-Gnaden-Marker auf der zugehörigen auction zurückgesetzt, damit check-expired-auctions die Listung nicht beim nächsten Tick beendet.';
