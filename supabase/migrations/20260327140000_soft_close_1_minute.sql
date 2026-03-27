-- ============================================================
-- Migration: Soft-Close auf 1 Minute umstellen
-- Datum: 2026-03-27
-- Beschreibung:
--   1. Default-Wert von soft_close_extension_minutes von 5 auf 1 ändern
--   2. Bestehende Auktionen auf 1 Minute aktualisieren
--   3. Soft-Close-Fenster in place_bid_atomic von 5 auf 1 Minute ändern
-- ============================================================

-- 1. Default-Wert der Spalte auf 1 Minute setzen
ALTER TABLE auctions
  ALTER COLUMN soft_close_extension_minutes SET DEFAULT 1;

-- 2. Alle bestehenden Auktionen auf 1 Minute aktualisieren
UPDATE auctions
   SET soft_close_extension_minutes = 1
 WHERE soft_close_extension_minutes = 5;

-- 3. place_bid_atomic Funktion aktualisieren: Soft-Close-Fenster von 5 auf 1 Minute
CREATE OR REPLACE FUNCTION place_bid_atomic(
  p_auction_id UUID,
  p_bidder_id UUID,
  p_bid_amount NUMERIC,
  p_is_autobid BOOLEAN DEFAULT FALSE,
  p_max_autobid_amount NUMERIC DEFAULT NULL,
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
  v_minimum_bid NUMERIC;
  v_time_left INTERVAL;
  v_new_end_time TIMESTAMPTZ;
  v_auction_extended BOOLEAN := FALSE;
  v_new_bid_id UUID;
BEGIN
  -- Generate a stable lock key from the auction UUID.
  v_lock_key := hashtext(p_auction_id::TEXT)::BIGINT;
  -- Acquire transaction-scoped advisory lock.
  -- This blocks concurrent bid calls for the SAME auction
  -- but allows bids for different auctions to proceed in parallel.
  PERFORM pg_advisory_xact_lock(v_lock_key);
  -- Re-read the auction with a FOR UPDATE lock to prevent concurrent modifications
  SELECT a.*, m.seller_id AS motorhome_seller_id, m.status AS motorhome_status
    INTO v_auction
    FROM auctions a
    JOIN motorhomes m ON m.id = a.motorhome_id
   WHERE a.id = p_auction_id
     FOR UPDATE OF a;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Auktion nicht gefunden'
    );
  END IF;
  -- Validate auction is active
  IF v_auction.status <> 'active' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Auktion ist nicht aktiv'
    );
  END IF;
  -- Check auction has not ended
  IF NOW() > v_auction.end_time THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Auktion ist bereits beendet'
    );
  END IF;
  -- Check motorhome is not already sold
  IF v_auction.motorhome_status = 'sold' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Wohnmobil wurde bereits verkauft'
    );
  END IF;
  -- Check bidder is not the seller
  IF v_auction.motorhome_seller_id = p_bidder_id THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Sie können nicht auf Ihre eigene Auktion bieten'
    );
  END IF;
  -- Calculate the actual minimum bid from the database state (not client data)
  v_current_bid := COALESCE(v_auction.current_bid, v_auction.starting_bid);
  v_minimum_bid := v_current_bid + p_min_increment;
  -- Validate bid amount against actual current state
  IF p_bid_amount < v_minimum_bid THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', format('Gebot muss mindestens €%s betragen', v_minimum_bid),
      'minimum_bid', v_minimum_bid,
      'current_bid', v_current_bid
    );
  END IF;
  -- Validate autobid parameters
  IF p_is_autobid AND (p_max_autobid_amount IS NULL OR p_max_autobid_amount <= p_bid_amount) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Max. Autobid-Betrag muss höher als aktuelles Gebot sein'
    );
  END IF;
  -- Place the bid atomically
  INSERT INTO bids (auction_id, bidder_id, amount, is_autobid, max_autobid_amount)
  VALUES (
    p_auction_id,
    p_bidder_id,
    p_bid_amount,
    COALESCE(p_is_autobid, FALSE),
    CASE WHEN p_is_autobid THEN p_max_autobid_amount ELSE NULL END
  )
  RETURNING id INTO v_new_bid_id;
  -- Update auction current_bid atomically
  UPDATE auctions
     SET current_bid = p_bid_amount
   WHERE id = p_auction_id;
  -- Check soft-close extension (within last 1 minute of auction end)
  -- Changed from 5 minutes to 1 minute per user requirement
  v_time_left := v_auction.end_time - NOW();
  IF v_time_left > INTERVAL '0 seconds'
     AND v_time_left < INTERVAL '1 minute' THEN
    v_new_end_time := v_auction.end_time
      + (COALESCE(v_auction.soft_close_extension_minutes, 1) * INTERVAL '1 minute');
    UPDATE auctions
       SET end_time = v_new_end_time
     WHERE id = p_auction_id;
    v_auction_extended := TRUE;
  END IF;
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'Gebot erfolgreich platziert',
    'bid_id', v_new_bid_id,
    'amount', p_bid_amount,
    'auction_extended', v_auction_extended,
    'new_end_time', CASE WHEN v_auction_extended THEN v_new_end_time ELSE v_auction.end_time END,
    'current_bid', v_current_bid,
    'motorhome_seller_id', v_auction.motorhome_seller_id,
    'motorhome_id', v_auction.motorhome_id
  );
END;
$$;
