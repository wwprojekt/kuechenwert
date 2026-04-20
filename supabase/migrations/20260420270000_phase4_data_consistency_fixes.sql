-- =====================================================================
-- Phase 4 / Data-Consistency: BUG3 + BUG4 Backfill
-- =====================================================================
-- Aus dem P4-Audit (siehe Conversation-Log):
--
-- BUG3: Es gibt new-system-Auktionen (dynamic_pricing=true,
--   seller_initial_reserve gesetzt) mit starting_bid = 50€. Diese wurden
--   vor dem Phase-3-Deploy angelegt, in dem die Random-Startbid-Logik
--   live ging. Buyer könnte das Reserve grob ablesen ("starting=50 →
--   sehr niedriges Reserve unwahrscheinlich, also Anker irgendwo höher")
--   was wir gerade in Phase 4 zu blocken versuchen.
--
-- BUG4: Für dieselben (oder ähnliche) Auktionen ist
--   motorhomes.reserve_price = NULL, während auctions.reserve_price
--   gesetzt ist. Das ist eine Daten-Inkonsistenz, die durch alten
--   Aktivierungscode entstanden ist. activate-auction.ts schreibt
--   inzwischen beides, aber Bestand muss gesynced werden.
--
-- Beide Fixes sind idempotent (WHERE-Filter prüft Symptom):
--   * BUG3: nur Auktionen mit starting_bid = 50 UND seller_initial_reserve
--     gesetzt (= sicher new-system, sicher unrandomisiert)
--   * BUG4: nur Auktionen wo motorhomes.reserve_price IS NULL aber
--     auctions.reserve_price IS NOT NULL
--
-- Wir nutzen `compute_random_starting_bid(auctions.reserve_price)` als
-- Quelle der Wahrheit (= 40-60% von reserve_price, gerundet auf 50€).
-- =====================================================================

-- ─── BUG3: Random Starting-Bid für betroffene aktive Auktionen ─────────
DO $$
DECLARE
  v_row RECORD;
  v_new_starting_bid integer;
  v_count int := 0;
BEGIN
  FOR v_row IN
    SELECT a.id, a.reserve_price
      FROM public.auctions a
      JOIN public.motorhomes m ON m.id = a.motorhome_id
     WHERE a.status IN ('active', 'kaufchance')
       AND a.starting_bid = 50
       AND a.seller_initial_reserve IS NOT NULL
       AND m.sale_channel <> 'instant_price'
       AND a.reserve_price IS NOT NULL
       AND a.reserve_price > 100
  LOOP
    SELECT public.compute_random_starting_bid(v_row.reserve_price::numeric)
      INTO v_new_starting_bid;

    -- Sanity-Check: 40 ≤ pct ≤ 60 vom Reserve
    IF v_new_starting_bid IS NOT NULL
       AND v_new_starting_bid >= 50
       AND v_new_starting_bid < v_row.reserve_price::integer
    THEN
      UPDATE public.auctions
         SET starting_bid = v_new_starting_bid,
             updated_at   = now()
       WHERE id = v_row.id
         AND (current_bid IS NULL OR current_bid < v_new_starting_bid);
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'BUG3 fix: Random starting_bid set for % auction(s)', v_count;
END $$;

-- ─── BUG4: motorhomes.reserve_price ← auctions.reserve_price ──────────
WITH affected AS (
  UPDATE public.motorhomes m
     SET reserve_price = a.reserve_price,
         updated_at    = now()
    FROM public.auctions a
   WHERE a.motorhome_id = m.id
     AND a.status IN ('active', 'kaufchance')
     AND m.reserve_price IS NULL
     AND a.reserve_price IS NOT NULL
     AND m.sale_channel <> 'instant_price'
   RETURNING m.id
)
SELECT 'BUG4 fix: motorhomes.reserve_price synced for ' || count(*)::text || ' row(s)' AS result
  FROM affected;

-- ─── Smoke-Test: Symptome sollten weg sein ────────────────────────────
DO $$
DECLARE
  v_remaining_bug3 int;
  v_remaining_bug4 int;
BEGIN
  SELECT COUNT(*) INTO v_remaining_bug3
    FROM public.auctions a
    JOIN public.motorhomes m ON m.id = a.motorhome_id
   WHERE a.status IN ('active', 'kaufchance')
     AND a.starting_bid = 50
     AND a.seller_initial_reserve IS NOT NULL
     AND m.sale_channel <> 'instant_price'
     AND a.reserve_price > 100;

  SELECT COUNT(*) INTO v_remaining_bug4
    FROM public.auctions a
    JOIN public.motorhomes m ON m.id = a.motorhome_id
   WHERE a.status IN ('active', 'kaufchance')
     AND m.reserve_price IS NULL
     AND a.reserve_price IS NOT NULL
     AND m.sale_channel <> 'instant_price';

  RAISE NOTICE 'BUG3 remaining: %', v_remaining_bug3;
  RAISE NOTICE 'BUG4 remaining: %', v_remaining_bug4;

  IF v_remaining_bug3 > 0 OR v_remaining_bug4 > 0 THEN
    RAISE WARNING 'Some symptoms remain — manual investigation needed';
  END IF;
END $$;
