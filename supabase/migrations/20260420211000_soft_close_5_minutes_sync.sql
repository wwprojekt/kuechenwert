-- Migration: Soft-Close auf 5 Minuten synchronisieren
--
-- Phase 1.2 des Marketing-Phase-Rollouts.
--
-- Aktuelle Inkonsistenz (Stand vor dieser Migration):
--   * place_bid_atomic       (20260412120000): Window 1 Min, Default 1 Min
--   * handle_autobid_atomic  (20260321000000): Window 5 Min, Default 5 Min
--   * auctions.soft_close_extension_minutes Default = 1
--   → Manuelles Gebot in letzten 60 Sek = +1 Min;
--     Auto-Bot in letzten 60 Sek      = +5 Min.
--   Das führt zu unfairer Behandlung gleichartiger Bid-Typen.
--
-- Mit der reduzierten Auktionsdauer (3 Tage statt 7) gewinnen die letzten
-- Minuten an Bedeutung. Wir vereinheitlichen auf 5 Min Window + 5 Min
-- Extension. Beide RPCs werden komplett neu erzeugt – CREATE OR REPLACE
-- ist sicher, die Signatur ist identisch.

-- ─── 1. Default zurück auf 5 Minuten + Backfill bestehender Auktionen ──
ALTER TABLE public.auctions
  ALTER COLUMN soft_close_extension_minutes SET DEFAULT 5;

UPDATE public.auctions
   SET soft_close_extension_minutes = 5
 WHERE soft_close_extension_minutes IS NULL
    OR soft_close_extension_minutes = 1;

-- ─── 2. place_bid_atomic neu (Window 5 Min + Default 5) ────────────────
CREATE OR REPLACE FUNCTION public.place_bid_atomic(
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
  v_lock_key := hashtext(p_auction_id::TEXT)::BIGINT;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT a.*, m.seller_id AS motorhome_seller_id, m.status AS motorhome_status
    INTO v_auction
    FROM auctions a
    JOIN motorhomes m ON m.id = a.motorhome_id
   WHERE a.id = p_auction_id
     FOR UPDATE OF a;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Auktion nicht gefunden');
  END IF;

  IF v_auction.status <> 'active' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Auktion ist nicht aktiv');
  END IF;

  IF NOW() > v_auction.end_time THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Auktion ist bereits beendet');
  END IF;

  IF v_auction.motorhome_status = 'sold' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Wohnmobil wurde bereits verkauft');
  END IF;

  IF v_auction.motorhome_seller_id = p_bidder_id THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Sie können nicht auf Ihre eigene Auktion bieten');
  END IF;

  v_current_bid := COALESCE(v_auction.current_bid, v_auction.starting_bid);
  v_minimum_bid := v_current_bid + p_min_increment;

  IF p_bid_amount < v_minimum_bid THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', format('Gebot muss mindestens €%s betragen', v_minimum_bid),
      'minimum_bid', v_minimum_bid,
      'current_bid', v_current_bid
    );
  END IF;

  -- Bid-Vielfaches von €50 (Konsistenz mit handle_autobid_atomic)
  IF p_bid_amount % p_min_increment <> 0 THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', format('Gebot muss ein Vielfaches von €%s sein (z.B. €%s)',
                      p_min_increment,
                      (floor(p_bid_amount / p_min_increment) + 1) * p_min_increment),
      'minimum_bid', v_minimum_bid,
      'current_bid', v_current_bid
    );
  END IF;

  IF p_is_autobid AND (p_max_autobid_amount IS NULL OR p_max_autobid_amount <= p_bid_amount) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Max. Autobid-Betrag muss höher als aktuelles Gebot sein');
  END IF;

  IF p_is_autobid AND p_max_autobid_amount IS NOT NULL AND p_max_autobid_amount % p_min_increment <> 0 THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', format('Max. Autobid-Betrag muss ein Vielfaches von €%s sein', p_min_increment)
    );
  END IF;

  INSERT INTO bids (auction_id, bidder_id, amount, is_autobid, max_autobid_amount)
  VALUES (
    p_auction_id,
    p_bidder_id,
    p_bid_amount,
    COALESCE(p_is_autobid, FALSE),
    CASE WHEN p_is_autobid THEN p_max_autobid_amount ELSE NULL END
  )
  RETURNING id INTO v_new_bid_id;

  UPDATE auctions
     SET current_bid = p_bid_amount
   WHERE id = p_auction_id;

  -- ── Soft-Close: Window 5 Min, Extension 5 Min (synchron mit handle_autobid_atomic)
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
