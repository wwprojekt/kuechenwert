-- Prevent multiple active offers per buyer per auction at the DB level.
-- The frontend already checks, but this guards against race conditions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_post_auction_offers_one_active_per_buyer
  ON post_auction_offers (auction_id, buyer_id)
  WHERE status IN ('pending', 'countered');
