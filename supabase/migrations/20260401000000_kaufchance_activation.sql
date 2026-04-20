-- ============================================
-- Kaufchance Feature Activation Migration
-- Adds kaufchance_min_price to auctions,
-- adds invited_bidders tracking, and fixes RLS policies
-- ============================================

-- 1. Add kaufchance_min_price to auctions
-- This allows admin/seller to set a new minimum price during Kaufchance negotiations
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS kaufchance_min_price DECIMAL(10,2);

-- 2. Add responded_at column to post_auction_offers if missing
-- (Already exists in migration but may not be in types)
-- No-op if already exists
ALTER TABLE post_auction_offers ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

-- 3. Add updated_at column to post_auction_offers if missing
ALTER TABLE post_auction_offers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Add counter_offer_amount column to post_auction_offers if missing
ALTER TABLE post_auction_offers ADD COLUMN IF NOT EXISTS counter_offer_amount DECIMAL(10,2);

-- 5. Add is_invited column to post_auction_offers
-- Tracks whether this buyer was one of the top-2 invited bidders
ALTER TABLE post_auction_offers ADD COLUMN IF NOT EXISTS is_invited BOOLEAN DEFAULT FALSE;

-- 6. Create kaufchance_invitations table to track which bidders were invited
-- This is separate from offers - a bidder can be invited but not yet have made an offer
CREATE TABLE IF NOT EXISTS kaufchance_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID REFERENCES auctions(id) ON DELETE CASCADE NOT NULL,
  bidder_id UUID REFERENCES auth.users(id) NOT NULL,
  highest_bid DECIMAL(10,2) NOT NULL,
  rank INTEGER NOT NULL, -- 1 = highest bidder, 2 = second highest
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(auction_id, bidder_id)
);

-- RLS for kaufchance_invitations
ALTER TABLE kaufchance_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own invitations" ON kaufchance_invitations;
CREATE POLICY "Users can view their own invitations" ON kaufchance_invitations
  FOR SELECT USING (
    bidder_id = auth.uid() OR
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Only service_role (Edge Functions) can insert invitations
-- No INSERT policy for regular users - only service_role can insert

-- 7. Fix RLS: Allow buyers to UPDATE their own offers (for accepting counter-offers)
-- Drop existing update policy first (if exists), then recreate with buyer access
DO $$
BEGIN
  -- Try to drop the existing policy
  BEGIN
    DROP POLICY "Sellers and admins can update offers" ON post_auction_offers;
  EXCEPTION WHEN undefined_object THEN
    -- Policy doesn't exist, that's fine
    NULL;
  END;
END $$;

DROP POLICY IF EXISTS "Sellers buyers and admins can update offers" ON post_auction_offers;
CREATE POLICY "Sellers buyers and admins can update offers" ON post_auction_offers
  FOR UPDATE USING (
    -- Buyer can update their own offer (e.g., accept counter-offer)
    buyer_id = auth.uid() OR
    -- Seller can update offers on their auctions
    EXISTS (
      SELECT 1 FROM auctions a
      JOIN motorhomes m ON a.motorhome_id = m.id
      WHERE a.id = post_auction_offers.auction_id AND m.seller_id = auth.uid()
    ) OR
    -- Admin can update any offer
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 8. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_kaufchance_invitations_auction ON kaufchance_invitations(auction_id);
CREATE INDEX IF NOT EXISTS idx_kaufchance_invitations_bidder ON kaufchance_invitations(bidder_id);
CREATE INDEX IF NOT EXISTS idx_post_auction_offers_status ON post_auction_offers(status);
