-- =====================================================================
-- Drop duplicate CHECK constraint on public.motorhomes
-- =====================================================================
-- Bug:
--   Two CHECK constraints exist with identical predicates:
--     * motorhomes_instant_price_positive   (the canonical one)
--     * motorhomes_instant_price_required   (exact duplicate)
--   Both fire on the same INSERT/UPDATE so the user gets a confusing
--   "violates check constraint motorhomes_instant_price_required" error
--   even though the original/canonical name is _positive.
--
-- Fix:
--   Drop motorhomes_instant_price_required. The _positive constraint
--   stays and continues to enforce the same predicate:
--     CHECK (sale_channel <> 'instant_price' OR
--            (instant_price IS NOT NULL AND instant_price > 0))
--
-- Safety:
--   IF EXISTS guard so the migration is idempotent across environments
--   that may have only one of the two (e.g. fresh checkouts).
-- =====================================================================

ALTER TABLE public.motorhomes
  DROP CONSTRAINT IF EXISTS motorhomes_instant_price_required;

-- Smoke-test: only one of the two should remain.
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
   WHERE n.nspname = 'public'
     AND t.relname = 'motorhomes'
     AND c.contype = 'c'
     AND c.conname IN (
       'motorhomes_instant_price_positive',
       'motorhomes_instant_price_required'
     );

  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly 1 instant_price CHECK constraint to remain, found %',
      v_count;
  END IF;

  RAISE NOTICE 'OK: duplicate constraint dropped, motorhomes_instant_price_positive remains.';
END $$;
