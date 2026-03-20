-- Phase 4 Database Migration
-- Adds vehicle questions, favorites, support messages, post-auction offers, and location fields

-- ============================================
-- Issue 4.3: Vehicle Questions Table
-- ============================================
CREATE TABLE IF NOT EXISTS vehicle_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  motorhome_id UUID REFERENCES motorhomes(id) ON DELETE CASCADE,
  questioner_id UUID REFERENCES auth.users(id),
  questioner_name TEXT,
  questioner_email TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  answered_by UUID REFERENCES auth.users(id),
  answered_at TIMESTAMPTZ,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for vehicle_questions
ALTER TABLE vehicle_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit questions" ON vehicle_questions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their own questions" ON vehicle_questions
  FOR SELECT USING (
    questioner_id = auth.uid() OR
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update questions" ON vehicle_questions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- Issue 4.2a: User Favorites Table
-- ============================================
CREATE TABLE IF NOT EXISTS user_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  motorhome_id UUID REFERENCES motorhomes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, motorhome_id)
);

-- RLS for user_favorites
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own favorites" ON user_favorites
  FOR ALL USING (user_id = auth.uid());

-- ============================================
-- Issue 4.2b: Support Messages Table
-- ============================================
CREATE TABLE IF NOT EXISTS support_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open', -- open, in_progress, resolved
  admin_response TEXT,
  responded_by UUID REFERENCES auth.users(id),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for support_messages
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages" ON support_messages
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can create messages" ON support_messages
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update messages" ON support_messages
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- Issue 4.1: Kaufchance / Post-Auction Offers
-- ============================================

-- Add kaufchance_expires_at to auctions
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS kaufchance_expires_at TIMESTAMPTZ;

-- Create post-auction offers table
CREATE TABLE IF NOT EXISTS post_auction_offers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID REFERENCES auctions(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES auth.users(id),
  offer_amount DECIMAL(10,2) NOT NULL,
  counter_offer_amount DECIMAL(10,2),
  status TEXT DEFAULT 'pending', -- pending, countered, accepted, rejected, expired
  message TEXT,
  seller_response TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for post_auction_offers
ALTER TABLE post_auction_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own offers" ON post_auction_offers
  FOR SELECT USING (
    buyer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM auctions a
      JOIN motorhomes m ON a.motorhome_id = m.id
      WHERE a.id = post_auction_offers.auction_id AND m.seller_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated users can create offers" ON post_auction_offers
  FOR INSERT WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Sellers and admins can update offers" ON post_auction_offers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auctions a
      JOIN motorhomes m ON a.motorhome_id = m.id
      WHERE a.id = post_auction_offers.auction_id AND m.seller_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- Issue 4.5: Location Fields
-- ============================================

-- Add lat/lng to motorhomes
ALTER TABLE motorhomes ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE motorhomes ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Add lat/lng to profiles for user location preferences
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- ============================================
-- Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_vehicle_questions_motorhome ON vehicle_questions(motorhome_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_motorhome ON user_favorites(motorhome_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_user ON support_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_status ON support_messages(status);
CREATE INDEX IF NOT EXISTS idx_post_auction_offers_auction ON post_auction_offers(auction_id);
CREATE INDEX IF NOT EXISTS idx_post_auction_offers_buyer ON post_auction_offers(buyer_id);
