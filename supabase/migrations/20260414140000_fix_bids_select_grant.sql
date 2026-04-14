-- ============================================================================
-- Fix: Restore table-level SELECT on bids for anon + authenticated
--
-- The previous migration (20260414100000_secure_bids_view) revoked table-level
-- SELECT and replaced it with column-level SELECT to hide max_autobid_amount.
-- However, column-level SELECT breaks PostgREST aggregate embeds like
-- bids(count) because count(*) requires table-level SELECT permission.
-- This broke the admin auctions page and any query using bids(count).
--
-- Fix: Restore table-level SELECT. The bids_public view (created in the
-- previous migration) remains the recommended way to query bids when
-- max_autobid_amount redaction is needed.
-- ============================================================================

GRANT SELECT ON public.bids TO anon, authenticated;
