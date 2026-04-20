-- Backfill für 8 Auktionen die zwischen 2026-04-19 und Phase-2-Deploy 2026-04-20
-- ohne seller_initial_reserve / dynamic_pricing / marketing_phase_started_at
-- aktiviert wurden. Diese Rows hängen sonst dauerhaft an starting_bid=50 fest
-- und ihre Marketing-Phase greift nie.
--
-- Strategy:
--   1) auctions.reserve_price aus motorhomes.reserve_price nachziehen
--   2) seller_initial_reserve = reserve_price
--   3) starting_bid via compute_random_starting_bid (nur wenn current_bid leer)
--   4) dynamic_pricing=TRUE, auto_relist=TRUE für Auktionen
--   5) marketing_phase_started_at = COALESCE(start_time, created_at)
--   6) marketing_phase_max_until = +16 Tage (Auktion) bzw. +30 Tage (Festpreis)
--
-- Idempotent: alle Updates haben WHERE-Filter die nach Erfolg nicht mehr matchen.

BEGIN;

-- 1) reserve_price + seller_initial_reserve nachziehen (nur wo Anker fehlt)
DO $$
DECLARE fixed_count int;
BEGIN
  WITH updated AS (
    UPDATE public.auctions a
       SET reserve_price = m.reserve_price,
           seller_initial_reserve = m.reserve_price,
           updated_at = now()
      FROM public.motorhomes m
     WHERE a.motorhome_id = m.id
       AND a.status IN ('active','kaufchance')
       AND a.created_at >= TIMESTAMPTZ '2026-04-19 00:00:00+00'
       AND a.reserve_price IS NULL
       AND a.seller_initial_reserve IS NULL
       AND m.reserve_price IS NOT NULL
       AND m.reserve_price > 0
       AND m.sale_channel = 'auction'
    RETURNING a.id
  ) SELECT count(*) INTO fixed_count FROM updated;
  RAISE NOTICE '[backfill-1] reserve_price + seller_initial_reserve set on % auctions', fixed_count;
END $$;

-- 2) starting_bid randomisieren (nur wenn noch keiner geboten hat)
DO $$
DECLARE rec RECORD; new_bid numeric; fixed_count int := 0; err_count int := 0;
BEGIN
  FOR rec IN (
    SELECT a.id, a.reserve_price
      FROM public.auctions a
      JOIN public.motorhomes m ON m.id = a.motorhome_id
     WHERE a.status IN ('active','kaufchance')
       AND a.created_at >= TIMESTAMPTZ '2026-04-19 00:00:00+00'
       AND a.starting_bid = 50
       AND a.reserve_price IS NOT NULL
       AND a.reserve_price > 100
       AND a.seller_initial_reserve IS NOT NULL
       AND m.sale_channel = 'auction'
       AND (a.current_bid IS NULL OR a.current_bid = 0)
  ) LOOP
    BEGIN
      SELECT public.compute_random_starting_bid(rec.reserve_price::numeric) INTO new_bid;
      IF new_bid IS NOT NULL AND new_bid > 0 AND new_bid < rec.reserve_price THEN
        UPDATE public.auctions SET starting_bid = new_bid, updated_at = now() WHERE id = rec.id;
        fixed_count := fixed_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      err_count := err_count + 1;
      RAISE NOTICE '[backfill-2] failed for auction %: %', rec.id, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE '[backfill-2] randomized starting_bid on % auctions (% errors)', fixed_count, err_count;
END $$;

-- 3) dynamic_pricing + auto_relist Defaults nachziehen
DO $$
DECLARE fixed_count int;
BEGIN
  WITH updated AS (
    UPDATE public.auctions a
       SET dynamic_pricing = TRUE,
           auto_relist = TRUE,
           updated_at = now()
      FROM public.motorhomes m
     WHERE a.motorhome_id = m.id
       AND a.status IN ('active','kaufchance')
       AND a.created_at >= TIMESTAMPTZ '2026-04-19 00:00:00+00'
       AND a.seller_initial_reserve IS NOT NULL
       AND m.sale_channel = 'auction'
       AND (a.dynamic_pricing = FALSE OR a.auto_relist = FALSE)
    RETURNING a.id
  ) SELECT count(*) INTO fixed_count FROM updated;
  RAISE NOTICE '[backfill-3] dynamic_pricing+auto_relist on % auctions', fixed_count;
END $$;

-- 4) marketing_phase_started_at + max_until nachziehen
DO $$
DECLARE fixed_count int;
BEGIN
  WITH updated AS (
    UPDATE public.auctions a
       SET marketing_phase_started_at = COALESCE(a.start_time, a.created_at),
           marketing_phase_max_until = COALESCE(a.start_time, a.created_at)
             + CASE
                 WHEN a.seller_initial_instant_price IS NOT NULL THEN INTERVAL '30 days'
                 ELSE INTERVAL '16 days'
               END,
           updated_at = now()
      FROM public.motorhomes m
     WHERE a.motorhome_id = m.id
       AND a.status IN ('active','kaufchance')
       AND a.created_at >= TIMESTAMPTZ '2026-04-19 00:00:00+00'
       AND a.seller_initial_reserve IS NOT NULL
       AND a.marketing_phase_started_at IS NULL
    RETURNING a.id
  ) SELECT count(*) INTO fixed_count FROM updated;
  RAISE NOTICE '[backfill-4] marketing_phase_started_at on % auctions', fixed_count;
END $$;

-- 5) Auch motorhomes.reserve_price ↔ auctions.reserve_price re-syncen
--    (jetzt wo wir auctions.reserve_price nachgezogen haben).
DO $$
DECLARE fixed_count int;
BEGIN
  WITH updated AS (
    UPDATE public.motorhomes m
       SET reserve_price = a.reserve_price, updated_at = now()
      FROM public.auctions a
     WHERE a.motorhome_id = m.id
       AND a.status IN ('active','kaufchance')
       AND a.reserve_price IS NOT NULL
       AND (m.reserve_price IS NULL OR m.reserve_price <> a.reserve_price)
       AND NOT (m.sale_channel = 'instant_price' AND (m.instant_price IS NULL OR m.instant_price <= 0))
    RETURNING m.id
  ) SELECT count(*) INTO fixed_count FROM updated;
  RAISE NOTICE '[backfill-5] motorhomes.reserve_price re-sync on % rows', fixed_count;
END $$;

COMMIT;
