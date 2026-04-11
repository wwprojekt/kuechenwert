
-- Admin-only function to delete a bid and recalculate auction.current_bid
-- Also updates dealer_levels for the affected bidder
CREATE OR REPLACE FUNCTION admin_delete_bid(p_bid_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bid RECORD;
  v_auction RECORD;
  v_new_highest NUMERIC;
  v_lock_key BIGINT;
  v_was_highest BOOLEAN;
BEGIN
  -- 1. Load the bid
  SELECT b.*, a.id AS auction_id, a.status AS auction_status,
         a.current_bid, a.starting_bid
    INTO v_bid
    FROM bids b
    JOIN auctions a ON a.id = b.auction_id
   WHERE b.id = p_bid_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gebot nicht gefunden');
  END IF;

  -- 2. Only allow deletion on active or draft auctions
  IF v_bid.auction_status NOT IN ('active', 'draft') THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Gebote können nur bei aktiven oder Entwurfs-Auktionen gelöscht werden');
  END IF;

  -- 3. Acquire advisory lock for this auction (same pattern as place_bid_atomic)
  v_lock_key := hashtext(v_bid.auction_id::TEXT)::BIGINT;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- 4. Check if this was the highest bid
  v_was_highest := (v_bid.amount = v_bid.current_bid);

  -- 5. Delete the bid
  DELETE FROM bids WHERE id = p_bid_id;

  -- 6. Recalculate current_bid from remaining bids
  IF v_was_highest THEN
    SELECT MAX(amount) INTO v_new_highest
      FROM bids
     WHERE auction_id = v_bid.auction_id;

    UPDATE auctions
       SET current_bid = v_new_highest  -- NULL if no bids remain
     WHERE id = v_bid.auction_id;
  END IF;

  -- 7. Update dealer level for the affected bidder
  PERFORM update_dealer_level(v_bid.bidder_id);

  -- 8. Audit log
  INSERT INTO audit_logs (action, entity_type, entity_id, details)
  VALUES (
    'bid_deleted',
    'bid',
    p_bid_id::TEXT,
    jsonb_build_object(
      'auction_id', v_bid.auction_id,
      'bidder_id', v_bid.bidder_id,
      'amount', v_bid.amount,
      'was_highest', v_was_highest,
      'new_highest', v_new_highest
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_amount', v_bid.amount,
    'was_highest', v_was_highest,
    'new_current_bid', COALESCE(v_new_highest, v_bid.starting_bid),
    'bidder_id', v_bid.bidder_id
  );
END;
$$;

-- Only service_role and admin can call this
GRANT EXECUTE ON FUNCTION admin_delete_bid(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION admin_delete_bid(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION admin_delete_bid(UUID) FROM anon;
