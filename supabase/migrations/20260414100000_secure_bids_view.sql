-- ============================================================================
-- Migration: Secure max_autobid_amount from public access
--
-- Problem: RLS policy "Users can view all bids" uses USING(true), exposing
-- max_autobid_amount to everyone. Competing dealers can see each other's
-- autobid limits and bid exactly above them.
--
-- Solution (Defense-in-depth):
-- 1. Column-level REVOKE: Remove max_autobid_amount from table-level SELECT
--    so .select("*") on the bids table never returns it.
-- 2. Secure view: bids_public shows max_autobid_amount only to bid owner
--    or admin, so the frontend can still display own autobid status.
-- ============================================================================

-- Step 1: Restrict column-level access on the bids table.
-- After this, any direct query to the bids table (including SELECT *)
-- will NOT include max_autobid_amount.
REVOKE SELECT ON public.bids FROM anon, authenticated;
GRANT SELECT (id, auction_id, bidder_id, amount, is_autobid, created_at)
  ON public.bids TO anon, authenticated;

-- Step 2: Create a secure view that conditionally exposes max_autobid_amount.
-- Uses SECURITY INVOKER so auth.uid() resolves to the calling user.
CREATE OR REPLACE VIEW public.bids_public
  WITH (security_invoker = true)
AS
SELECT
  id,
  auction_id,
  bidder_id,
  amount,
  is_autobid,
  created_at,
  CASE
    WHEN bidder_id = auth.uid() THEN max_autobid_amount
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    ) THEN max_autobid_amount
    ELSE NULL
  END AS max_autobid_amount
FROM public.bids;

COMMENT ON VIEW public.bids_public IS
  'Public-safe view of bids. max_autobid_amount visible only to bid owner or admin.';

GRANT SELECT ON public.bids_public TO anon;
GRANT SELECT ON public.bids_public TO authenticated;
