-- ════════════════════════════════════════════════════════════════════
-- PHASE 4 DEEP-AUDIT-FIXES (12 issues uncovered in deep audit)
-- ════════════════════════════════════════════════════════════════════
--
-- Diese Migration konsolidiert mehrere Data- und Schema-Korrekturen
-- die im Deep-Audit der Phase-3/Phase-4 Implementierung gefunden wurden:
--
--   #1 dynamic_pricing wurde durch buggy backfill für ALLE Bestand-
--      Auktionen auf FALSE gesetzt — auch für die NEU-Inserate, die
--      zwischen Phase-3-Deploy (2026-04-19) und Migration-Run (2026-04-20)
--      mit dynamic_pricing=true erstellt wurden. Wir flippen NEU-Inserate
--      (created_at >= 2026-04-19, sale_channel='auction') zurück auf TRUE.
--      Bestand-Inserate (created_at < 2026-04-19) bleiben FALSE — der
--      Opt-in-Flow (separate Edge Function send-existing-listings-opt-in)
--      gibt Sellern die Möglichkeit, in Phase-4 zu wechseln.
--      Festpreis-Inserate (sale_channel='instant_price') bleiben FALSE
--      gemäß MARKETING_CONFIG.INSTANT_PRICE_DYNAMIC_PRICING_DEFAULT.
--
--   #2 starting_bid=50€ Backfill aus 20260420270000 hatte zu enge
--      Filter und übersprang ~16 Auktionen. Re-Run ohne die fehlerhafte
--      `current_bid IS NULL` Restriction.
--
--   #3 motorhomes.reserve_price ↔ auctions.reserve_price Drift:
--      Backfill + neuer Trigger der bei UPDATE auf auctions.reserve_price
--      automatisch motorhomes.reserve_price synchronisiert.
--
--   #5 motorhomes.status Drift (motorhomes.status='available' während
--      auctions.status='active'/'kaufchance'): Backfill + neuer Trigger
--      der status-Übergänge zwischen auctions und motorhomes synchronisiert.
--
--   #9 instant_price-Inserate mit starting_bid > 0 (sollte 0 sein, da
--      Festpreis nicht über starting_bid funktioniert): Backfill auf 0.
--
-- Idempotent: alle UPDATEs sind no-op wenn die Daten bereits korrekt sind,
-- alle CREATE TRIGGER nutzen DROP IF EXISTS davor.

BEGIN;

-- ────────────────────────────────────────────────────────────────────
-- FIX #1: dynamic_pricing für NEU-Auktionen (created_at >= 2026-04-19)
-- ────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  flipped_count int;
BEGIN
  WITH updated AS (
    UPDATE public.auctions a
       SET dynamic_pricing = TRUE,
           updated_at      = now()
      FROM public.motorhomes m
     WHERE a.motorhome_id            = m.id
       AND a.status                  IN ('active', 'kaufchance')
       AND a.created_at              >= TIMESTAMPTZ '2026-04-19 00:00:00+00'
       AND a.dynamic_pricing         = FALSE
       AND a.seller_initial_reserve IS NOT NULL
       AND m.sale_channel            = 'auction'
       AND a.auto_relist             = TRUE
    RETURNING a.id
  )
  SELECT count(*) INTO flipped_count FROM updated;

  RAISE NOTICE '[fix-1] flipped dynamic_pricing=TRUE on % new-system auction listings', flipped_count;
END $$;

-- ────────────────────────────────────────────────────────────────────
-- FIX #2: starting_bid Randomisierung Re-Run für NEU-Auktionen mit
--         starting_bid = 50€ (Default-Fallback nach failed RPC-Call)
-- ────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  rec RECORD;
  new_bid numeric;
  fixed_count int := 0;
  err_count int := 0;
BEGIN
  FOR rec IN (
    SELECT a.id, a.reserve_price, a.starting_bid, a.current_bid
      FROM public.auctions a
      JOIN public.motorhomes m ON m.id = a.motorhome_id
     WHERE a.status                  IN ('active', 'kaufchance')
       AND a.starting_bid            = 50
       AND a.seller_initial_reserve IS NOT NULL
       AND a.reserve_price          IS NOT NULL
       AND a.reserve_price          >  100
       AND m.sale_channel            = 'auction'
       AND (a.current_bid IS NULL OR a.current_bid = 0)
  ) LOOP
    BEGIN
      SELECT public.compute_random_starting_bid(rec.reserve_price::numeric)
        INTO new_bid;

      IF new_bid IS NOT NULL AND new_bid > 0 AND new_bid < rec.reserve_price THEN
        UPDATE public.auctions
           SET starting_bid = new_bid,
               updated_at   = now()
         WHERE id = rec.id;
        fixed_count := fixed_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      err_count := err_count + 1;
      RAISE NOTICE '[fix-2] failed for auction %: %', rec.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '[fix-2] randomized starting_bid on % auctions (% errors)', fixed_count, err_count;
END $$;

-- ────────────────────────────────────────────────────────────────────
-- FIX #9: instant_price-Inserate mit starting_bid > 0 → auf 0 setzen
--         (Festpreis hat kein Startgebot — nur instant_price aus
--          motorhomes wird gezeigt)
-- ────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  fixed_count int;
BEGIN
  WITH updated AS (
    UPDATE public.auctions a
       SET starting_bid = 0,
           updated_at   = now()
      FROM public.motorhomes m
     WHERE a.motorhome_id      = m.id
       AND m.sale_channel      = 'instant_price'
       AND a.starting_bid      > 0
       AND a.status            IN ('active', 'kaufchance', 'draft')
       AND (a.current_bid IS NULL OR a.current_bid = 0)
    RETURNING a.id
  )
  SELECT count(*) INTO fixed_count FROM updated;

  RAISE NOTICE '[fix-9] reset starting_bid=0 on % instant_price auctions', fixed_count;
END $$;

-- ────────────────────────────────────────────────────────────────────
-- FIX #3a: motorhomes.reserve_price Backfill aus auctions.reserve_price
--          (für aktive Auktionen wo die Werte auseinanderlaufen)
-- ────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  fixed_count int;
BEGIN
  WITH updated AS (
    UPDATE public.motorhomes m
       SET reserve_price = a.reserve_price,
           updated_at    = now()
      FROM public.auctions a
     WHERE a.motorhome_id        = m.id
       AND a.status              IN ('active', 'kaufchance')
       AND a.reserve_price      IS NOT NULL
       AND ( m.reserve_price IS NULL
          OR m.reserve_price    <> a.reserve_price )
       -- Skip rows that would violate motorhomes_instant_price_positive
       -- (legacy Festpreis-Inserate ohne instant_price; werden via
       -- admin_festpreis_needs_price Alert separat behandelt)
       AND NOT (
         m.sale_channel = 'instant_price'
         AND (m.instant_price IS NULL OR m.instant_price <= 0)
       )
    RETURNING m.id
  )
  SELECT count(*) INTO fixed_count FROM updated;

  RAISE NOTICE '[fix-3a] synced motorhomes.reserve_price from auctions on % rows', fixed_count;
END $$;

-- ────────────────────────────────────────────────────────────────────
-- FIX #3b: Trigger der bei UPDATE auf auctions.reserve_price
--          motorhomes.reserve_price automatisch synchronisiert.
--          Verhindert künftige Drifts (z.B. wenn dynamic_pricing den
--          reserve_price reduziert aber motorhome ungesynced bleibt).
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_motorhome_reserve_from_auction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND COALESCE(NEW.reserve_price, -1) IS DISTINCT FROM COALESCE(OLD.reserve_price, -1)
     AND NEW.motorhome_id IS NOT NULL
     AND NEW.reserve_price IS NOT NULL THEN
    -- Defensive guard: skip rows that would break the
    -- motorhomes_instant_price_positive check (legacy Festpreis ohne instant_price).
    UPDATE public.motorhomes
       SET reserve_price = NEW.reserve_price,
           updated_at    = now()
     WHERE id = NEW.motorhome_id
       AND ( reserve_price IS NULL OR reserve_price <> NEW.reserve_price )
       AND NOT (
         sale_channel = 'instant_price'
         AND (instant_price IS NULL OR instant_price <= 0)
       );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_motorhome_reserve ON public.auctions;
CREATE TRIGGER trg_sync_motorhome_reserve
AFTER UPDATE OF reserve_price ON public.auctions
FOR EACH ROW
EXECUTE FUNCTION public.sync_motorhome_reserve_from_auction();

-- ────────────────────────────────────────────────────────────────────
-- FIX #5a: motorhomes.status Backfill für aktive Auktionen
--          motorhomes.status muss 'active' sein, wenn auctions.status
--          IN ('active', 'kaufchance')
-- ────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  fixed_count int;
BEGIN
  WITH updated AS (
    UPDATE public.motorhomes m
       SET status     = 'active',
           updated_at = now()
      FROM public.auctions a
     WHERE a.motorhome_id = m.id
       AND a.status       IN ('active', 'kaufchance')
       AND m.status       <> 'active'
       AND m.status       NOT IN ('sold', 'reserved', 'pending')  -- diese sind valid finalstates
       -- Skip rows that would violate motorhomes_instant_price_positive
       AND NOT (
         m.sale_channel = 'instant_price'
         AND (m.instant_price IS NULL OR m.instant_price <= 0)
       )
    RETURNING m.id
  )
  SELECT count(*) INTO fixed_count FROM updated;

  RAISE NOTICE '[fix-5a] synced motorhomes.status=active on % rows', fixed_count;
END $$;

-- ────────────────────────────────────────────────────────────────────
-- FIX #5b: Trigger der bei UPDATE auf auctions.status
--          motorhomes.status automatisch synchronisiert.
--          Mapping:
--            auctions.status='active'      → motorhomes.status='active'
--            auctions.status='kaufchance'  → motorhomes.status='active'
--            auctions.status='sold'        → motorhomes.status='sold'
--            auctions.status='ended'       → motorhomes.status='not_sold'
--            auctions.status='cancelled'   → motorhomes.status='not_sold'
--          Andere Übergänge: kein Sync (z.B. draft → wird vom Wizard gesetzt)
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_motorhome_status_from_auction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_status text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.motorhome_id IS NOT NULL THEN

    target_status := CASE NEW.status
      WHEN 'active'     THEN 'active'
      WHEN 'kaufchance' THEN 'active'
      WHEN 'sold'       THEN 'sold'
      WHEN 'ended'      THEN 'not_sold'
      WHEN 'cancelled'  THEN 'not_sold'
      ELSE NULL
    END;

    IF target_status IS NOT NULL THEN
      UPDATE public.motorhomes
         SET status     = target_status,
             updated_at = now()
       WHERE id = NEW.motorhome_id
         AND status <> target_status
         -- Defensive: 'sold'/'reserved' sind manuell-final gesetzt und
         -- dürfen nicht versehentlich überschrieben werden, außer wir
         -- wechseln gerade aktiv in 'sold' rein.
         AND ( status NOT IN ('sold', 'reserved')
            OR target_status = 'sold' )
         -- Defensive guard: skip rows that would break the
         -- motorhomes_instant_price_positive check.
         AND NOT (
           sale_channel = 'instant_price'
           AND (instant_price IS NULL OR instant_price <= 0)
         );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_motorhome_status ON public.auctions;
CREATE TRIGGER trg_sync_motorhome_status
AFTER UPDATE OF status ON public.auctions
FOR EACH ROW
EXECUTE FUNCTION public.sync_motorhome_status_from_auction();

-- ────────────────────────────────────────────────────────────────────
-- DOKUMENTATIONS-COMMENTS
-- ────────────────────────────────────────────────────────────────────
COMMENT ON FUNCTION public.sync_motorhome_reserve_from_auction() IS
  'Phase-4 Audit-Fix #3: Sync motorhomes.reserve_price ← auctions.reserve_price bei UPDATE.';

COMMENT ON FUNCTION public.sync_motorhome_status_from_auction() IS
  'Phase-4 Audit-Fix #5: Sync motorhomes.status ← auctions.status bei UPDATE (mapping siehe Fn-Body).';

COMMIT;
