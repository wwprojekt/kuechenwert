-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: admin_delete_bid was unusable since 10.04.2026
-- ─────────────────────────────────────────────────────────────────────────────
-- Root cause: a later out-of-band patch added an `auth.uid()` admin check at
-- the top of the function. The Edge Function `admin-delete-bid` calls the RPC
-- with the service-role key, where `auth.uid()` is NULL → check always failed
-- → every call returned `{success:false, error:'Nur Admins können Gebote
-- löschen'}` → Edge Function returned HTTP 400 → admin saw a generic
-- "Fehler beim Löschen des Gebots" toast.
--
-- Evidence (2026-04-23): zero `bid_deleted` rows in audit_logs since the
-- function was first deployed on 2026-04-10.
--
-- This migration:
--   1. Restores the function to a version that works under both auth contexts
--      (service-role from Edge Function, or future direct call with admin JWT).
--      Authorisation is enforced via GRANTs + the Edge Function's own
--      `user_roles` check; no in-function `auth.uid()` gate that breaks the
--      service-role path.
--   2. Adds a notification cleanup so the deleted bid leaves no traces in
--      `dealer_notifications` (bid_confirmed for the bidder + outbid for
--      other bidders inside a ±5 s window around bid.created_at).
--   3. Hardens GRANTs: only service_role may execute. The Edge Function is
--      the single canonical caller. `authenticated` is revoked so a leaked
--      JWT cannot delete bids directly via PostgREST.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_delete_bid(p_bid_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
-- Why DEFINER: needs to bypass RLS on bids/auctions/dealer_notifications
-- and update dealer_levels for the affected bidder. Caller authorisation is
-- enforced by GRANT (service_role only) and by the Edge Function's own
-- admin role check before invoking this RPC.
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_bid_amount      NUMERIC;
  v_bid_bidder_id   UUID;
  v_bid_created_at  TIMESTAMPTZ;
  v_auction_id      UUID;
  v_auction_status  TEXT;
  v_current_bid     NUMERIC;
  v_starting_bid    NUMERIC;
  v_new_highest     NUMERIC;
  v_was_highest     BOOLEAN;
  v_lock_key        BIGINT;
  v_window_start    TIMESTAMPTZ;
  v_window_end      TIMESTAMPTZ;
  v_notif_removed   INTEGER := 0;
BEGIN
  -- 1. Load bid + auction (explicit columns, no SELECT * to avoid the
  --    duplicate `auction_id` column shadowing that the previous version had).
  SELECT b.amount, b.bidder_id, b.created_at,
         a.id, a.status, a.current_bid, a.starting_bid
    INTO v_bid_amount, v_bid_bidder_id, v_bid_created_at,
         v_auction_id, v_auction_status, v_current_bid, v_starting_bid
    FROM bids b
    JOIN auctions a ON a.id = b.auction_id
   WHERE b.id = p_bid_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code',    'NOT_FOUND',
      'error',   'Gebot nicht gefunden'
    );
  END IF;

  -- 2. Status guard: only active or draft auctions are safe to mutate.
  --    For ended/sold/kaufchance/cancelled the auction has downstream
  --    artefacts (invoices, contracts, kaufchance_invitations) that this
  --    function does not (and must not) touch.
  IF v_auction_status NOT IN ('active', 'draft') THEN
    RETURN jsonb_build_object(
      'success', false,
      'code',    'WRONG_STATUS',
      'status',  v_auction_status,
      'error',   'Gebote können nur bei aktiven oder Entwurfs-Auktionen gelöscht werden'
    );
  END IF;

  -- 3. Per-auction advisory lock (same pattern as place_bid_atomic) to
  --    prevent races against concurrent place-bid / autobid.
  v_lock_key := hashtext(v_auction_id::TEXT)::BIGINT;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  v_was_highest := (v_bid_amount = v_current_bid);

  -- 4. Delete the bid.
  DELETE FROM bids WHERE id = p_bid_id;

  -- 5. Recalculate current_bid only when needed.
  IF v_was_highest THEN
    SELECT MAX(amount) INTO v_new_highest
      FROM bids
     WHERE auction_id = v_auction_id;

    UPDATE auctions
       SET current_bid = v_new_highest  -- NULL if no bids remain
     WHERE id = v_auction_id;
  END IF;

  -- 6. Notification cleanup ─ make the deletion invisible to all parties.
  --    We delete the `bid_confirmed` row for the bidder and `outbid` rows
  --    for OTHER bidders that were generated alongside this bid. The
  --    place_bid edge function inserts both within ~150 ms of the bid
  --    timestamp, so a ±5 s window is safe and surgical.
  v_window_start := v_bid_created_at - INTERVAL '5 seconds';
  v_window_end   := v_bid_created_at + INTERVAL '5 seconds';

  WITH removed AS (
    DELETE FROM dealer_notifications
     WHERE auction_id = v_auction_id
       AND created_at BETWEEN v_window_start AND v_window_end
       AND (
         (type = 'bid_confirmed' AND user_id = v_bid_bidder_id)
         OR
         (type = 'outbid' AND user_id <> v_bid_bidder_id)
       )
     RETURNING 1
  )
  SELECT count(*) INTO v_notif_removed FROM removed;

  -- 7. Recompute dealer-level points for the affected bidder.
  PERFORM update_dealer_level(v_bid_bidder_id);

  -- 8. Audit-log entry. user_id is auth.uid() when called via authenticated
  --    JWT, NULL when called via service-role from the Edge Function. The
  --    Edge Function adds a richer entry with the resolved admin user_id.
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'bid_deleted',
    'bid',
    p_bid_id::TEXT,
    jsonb_build_object(
      'auction_id',          v_auction_id,
      'bidder_id',           v_bid_bidder_id,
      'amount',              v_bid_amount,
      'was_highest',         v_was_highest,
      'new_highest',         v_new_highest,
      'notifications_removed', v_notif_removed
    )
  );

  RETURN jsonb_build_object(
    'success',                true,
    'deleted_amount',         v_bid_amount,
    'was_highest',            v_was_highest,
    'new_current_bid',        COALESCE(v_new_highest, v_starting_bid),
    'bidder_id',              v_bid_bidder_id,
    'notifications_removed',  v_notif_removed
  );
END;
$$;

COMMENT ON FUNCTION public.admin_delete_bid(UUID) IS
  'Atomic admin delete of a bid (active/draft auctions only). Recomputes auction.current_bid and dealer_levels, removes the matching bid_confirmed + outbid dealer_notifications inside a ±5s window so the deletion is invisible to other bidders. Caller authorisation is enforced by GRANT (service_role only) + the admin-delete-bid Edge Function. Replaces the broken 2026-04-10 version that had an auth.uid() check incompatible with service-role calls.';

-- 9. Lock down execute privileges. The Edge Function uses the service_role
--    key; no other caller is expected. Revoking from authenticated/anon
--    closes a hole where a leaked JWT could call the RPC directly via
--    PostgREST and bypass the Edge Function's admin-role check.
REVOKE EXECUTE ON FUNCTION public.admin_delete_bid(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_delete_bid(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_bid(UUID) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_delete_bid(UUID) TO   service_role;
