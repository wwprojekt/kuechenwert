-- ============================================================================
-- Post-Auction Offer Integrity – Race-Condition-Prevention, Status-Enum, Performance-Index
-- ============================================================================
-- 1. UNIQUE partial index: at most one accepted offer per auction
-- 2. CHECK constraint: status must be one of the known values
-- 3. Composite index: (auction_id, status) for dashboard filters

-- ---------------------------------------------------------------------------
-- 1) UNIQUE partial index – "one winner per auction"
-- ---------------------------------------------------------------------------
-- Prevents race condition where two offers could be set to 'accepted' in
-- parallel (e.g. admin + seller accepting concurrently).
CREATE UNIQUE INDEX IF NOT EXISTS idx_post_auction_offers_one_accepted_per_auction
  ON public.post_auction_offers (auction_id)
  WHERE status = 'accepted';

-- ---------------------------------------------------------------------------
-- 2) CHECK constraint on status – known values only
-- ---------------------------------------------------------------------------
-- Known / used values across app + migrations:
--   pending      – initial offer waiting for seller action
--   countered    – seller posted counter offer, buyer must react
--   accepted     – offer accepted → sale
--   rejected     – seller rejected offer
--   expired      – listing ended / kaufchance expired / instant-buy
--   withdrawn    – UI filter in AdminPostAuctionOffers; reserved for future buyer self-withdraw
DO $$
BEGIN
  -- Drop existing CHECK if present (defensive)
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'post_auction_offers_status_check'
      AND conrelid = 'public.post_auction_offers'::regclass
  ) THEN
    ALTER TABLE public.post_auction_offers
      DROP CONSTRAINT post_auction_offers_status_check;
  END IF;

  ALTER TABLE public.post_auction_offers
    ADD CONSTRAINT post_auction_offers_status_check
    CHECK (status IN ('pending', 'countered', 'accepted', 'rejected', 'expired', 'withdrawn'));
END $$;

-- ---------------------------------------------------------------------------
-- 3) Composite index on (auction_id, status) – for dashboard filters
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_post_auction_offers_auction_status
  ON public.post_auction_offers (auction_id, status);

COMMENT ON INDEX public.idx_post_auction_offers_one_accepted_per_auction IS
  'Enforces at most one accepted offer per auction; prevents concurrent accept race conditions.';
