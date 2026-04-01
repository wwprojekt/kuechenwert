-- ============================================================================
-- Migration: Fix bids UPDATE RLS policy
-- Date: 2026-04-01
-- Description: The "Dealers can update own bids" policy references a
--              non-existent column 'dealer_id'. The correct column is
--              'bidder_id'. This migration drops and recreates the policy
--              with the correct column reference.
-- ============================================================================

DROP POLICY IF EXISTS "Dealers can update own bids" ON bids;
CREATE POLICY "Dealers can update own bids" ON bids
  FOR UPDATE TO authenticated
  USING (bidder_id = auth.uid());
