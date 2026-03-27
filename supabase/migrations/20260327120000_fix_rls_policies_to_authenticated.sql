-- ============================================================================
-- Migration: Fix RLS UPDATE policies to use TO authenticated
-- Date: 2026-03-27
-- Description: Several UPDATE policies were created without an explicit
--              TO clause, which in PostgreSQL defaults to the 'public' role.
--              This means unauthenticated users could potentially bypass
--              the USING clause. This migration recreates these policies
--              with an explicit TO authenticated clause.
-- ============================================================================

-- 1. analytics_sessions: UPDATE policy uses USING(true) without role restriction
--    This is the most critical fix - anyone could update analytics sessions
DROP POLICY IF EXISTS "Users can update their own sessions" ON analytics_sessions;
CREATE POLICY "Users can update their own sessions" ON analytics_sessions
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. bids: UPDATE policy for dealers
DROP POLICY IF EXISTS "Dealers can update own bids" ON bids;
CREATE POLICY "Dealers can update own bids" ON bids
  FOR UPDATE TO authenticated
  USING (dealer_id = auth.uid());

-- 3. motorhomes: UPDATE policy for sellers
DROP POLICY IF EXISTS "Sellers can update own motorhomes" ON motorhomes;
CREATE POLICY "Sellers can update own motorhomes" ON motorhomes
  FOR UPDATE TO authenticated
  USING (seller_id = auth.uid());

-- 4. motorhome_photos: UPDATE policy for photo owners
DROP POLICY IF EXISTS "Users can update own photos" ON motorhome_photos;
CREATE POLICY "Users can update own photos" ON motorhome_photos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM motorhomes m
      WHERE m.id = motorhome_photos.motorhome_id AND m.seller_id = auth.uid()
    )
  );

-- 5. post_auction_offers: UPDATE policy for sellers and admins
DROP POLICY IF EXISTS "Sellers and admins can update offers" ON post_auction_offers;
CREATE POLICY "Sellers and admins can update offers" ON post_auction_offers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auctions a
      JOIN motorhomes m ON a.motorhome_id = m.id
      WHERE a.id = post_auction_offers.auction_id AND m.seller_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 6. support_messages: UPDATE policy for admins
DROP POLICY IF EXISTS "Admins can update messages" ON support_messages;
CREATE POLICY "Admins can update messages" ON support_messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 7. vehicle_questions: UPDATE policy for admins
DROP POLICY IF EXISTS "Admins can update questions" ON vehicle_questions;
CREATE POLICY "Admins can update questions" ON vehicle_questions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 8. profiles: UPDATE policy for own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 9. wizard_sessions: UPDATE policy for own sessions
DROP POLICY IF EXISTS "wizard_sessions_user_update" ON wizard_sessions;
CREATE POLICY "wizard_sessions_user_update" ON wizard_sessions
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid() OR session_token = current_setting('request.headers', true)::json->>'x-session-token'
  )
  WITH CHECK (
    user_id = auth.uid() OR session_token = current_setting('request.headers', true)::json->>'x-session-token'
  );
