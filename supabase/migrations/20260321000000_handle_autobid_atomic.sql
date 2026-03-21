-- Migration: Create handle_autobid_atomic RPC function
-- Purpose: Prevent race conditions in autobid processing by using
--          pg_advisory_xact_lock to serialize concurrent autobid calls
--          for the same auction.
--
-- The function:
-- 1. Acquires a transaction-scoped advisory lock keyed on the auction UUID
-- 2. Re-reads the current highest bid from the auctions table (not from params)
-- 3. Finds the top autobidder who can outbid the current amount
-- 4. Places the counter-bid and updates the auction atomically
-- 5. Extends the auction if within the soft-close window
-- 6. Releases the lock automatically when the transaction commits

CREATE OR REPLACE FUNCTION handle_autobid_atomic(
  p_auction_id UUID,
  p_new_bid_amount NUMERIC,
  p_new_bidder_id UUID,
  p_min_increment NUMERIC DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_key BIGINT;
  v_auction RECORD;
  v_current_bid NUMERIC;
  v_top_autobid RECORD;
  v_counter_bid NUMERIC;
  v_new_end_time TIMESTAMPTZ;
  v_time_left INTERVAL;
  v_auction_extended BOOLEAN := FALSE;
BEGIN
  -- Generate a stable lock key from the auction UUID.
  -- We use hashtext() which returns a 32-bit integer, safe for advisory locks.
  v_lock_key := hashtext(p_auction_id::TEXT)::BIGINT;

  -- Acquire transaction-scoped advisory lock.
  -- This blocks concurrent autobid calls for the SAME auction
  -- but allows autobids for different auctions to proceed in parallel.
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Re-read the auction with a FOR UPDATE lock to prevent concurrent modifications
  SELECT a.*, m.seller_id
    INTO v_auction
    FROM auctions a
    JOIN motorhomes m ON m.id = a.motorhome_id
   WHERE a.id = p_auction_id
     AND a.status = 'active'
     FOR UPDATE OF a;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'Auction not found or not active'
    );
  END IF;

  -- Use the actual current_bid from the database, not the parameter,
  -- because another autobid may have already incremented it.
  v_current_bid := GREATEST(
    COALESCE(v_auction.current_bid, v_auction.starting_bid),
    p_new_bid_amount
  );

  -- Find the top autobidder who:
  -- 1. Is not the bidder who just placed the triggering bid
  -- 2. Has max_autobid_amount > current_bid + increment
  -- 3. Has is_autobid = true
  SELECT b.*
    INTO v_top_autobid
    FROM bids b
   WHERE b.auction_id = p_auction_id
     AND b.is_autobid = TRUE
     AND b.bidder_id <> p_new_bidder_id
     AND b.max_autobid_amount > v_current_bid + p_min_increment
   ORDER BY b.max_autobid_amount DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'No autobids high enough to counter'
    );
  END IF;

  -- Calculate counter bid
  v_counter_bid := v_current_bid + p_min_increment;

  -- Safety check: counter bid must not exceed the autobidder's max
  IF v_counter_bid > v_top_autobid.max_autobid_amount THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'Max autobid amount reached'
    );
  END IF;

  -- Place the counter bid
  INSERT INTO bids (auction_id, bidder_id, amount, is_autobid, max_autobid_amount)
  VALUES (
    p_auction_id,
    v_top_autobid.bidder_id,
    v_counter_bid,
    TRUE,
    v_top_autobid.max_autobid_amount
  );

  -- Update auction current_bid atomically
  UPDATE auctions
     SET current_bid = v_counter_bid
   WHERE id = p_auction_id;

  -- Check soft-close extension (within 5 minutes of end)
  v_time_left := v_auction.end_time - NOW();

  IF v_time_left > INTERVAL '0 seconds'
     AND v_time_left < INTERVAL '5 minutes' THEN
    v_new_end_time := v_auction.end_time
      + (COALESCE(v_auction.soft_close_extension_minutes, 5) * INTERVAL '1 minute');

    UPDATE auctions
       SET end_time = v_new_end_time
     WHERE id = p_auction_id;

    v_auction_extended := TRUE;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'Autobid placed successfully',
    'counter_bid_amount', v_counter_bid,
    'bidder_id', v_top_autobid.bidder_id,
    'auction_extended', v_auction_extended
  );
END;
$$;

-- Grant execute permission to the service_role (Edge Functions use service_role)
GRANT EXECUTE ON FUNCTION handle_autobid_atomic(UUID, NUMERIC, UUID, NUMERIC) TO service_role;

-- Revoke from anon and authenticated to prevent direct client calls
REVOKE EXECUTE ON FUNCTION handle_autobid_atomic(UUID, NUMERIC, UUID, NUMERIC) FROM anon;
REVOKE EXECUTE ON FUNCTION handle_autobid_atomic(UUID, NUMERIC, UUID, NUMERIC) FROM authenticated;
