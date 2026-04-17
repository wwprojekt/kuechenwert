-- Bug 4 fix: atomic DB transition for Kaufchance / Festpreis acceptance.
--
-- Before: the Edge Function did 4 sequential UPDATEs (offer, other offers,
-- auction, motorhome). If the motorhome update failed, the auction was
-- already 'sold' but the motorhome stayed 'available' → split-brain state
-- requiring manual cleanup.
--
-- After: this RPC performs all four updates in a single transaction. Any
-- error rolls back the whole change atomically; the function returns the
-- final salePrice + buyer_id so the Edge Function can run the side effects
-- (invoice, contract, notifications) afterwards.
--
-- Race-condition safe: includes the same status guards as the previous
-- inline code (offer must still be open; auction must still be in the
-- expected status; motorhome must not already be sold).
--
-- NOTE: motorhomes.sale_type is plain TEXT (no enum), so we set v_sale_type
-- without a cast.

CREATE OR REPLACE FUNCTION public.accept_kaufchance_offer_atomic(
  p_offer_id uuid,
  p_expected_auction_status auction_status,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_offer       record;
  v_auction     record;
  v_motorhome   record;
  v_sale_price  numeric;
  v_sale_type   text;
  v_offer_rows  integer;
  v_auction_rows integer;
  v_motorhome_rows integer;
BEGIN
  SELECT * INTO v_offer
  FROM post_auction_offers
  WHERE id = p_offer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'offer_not_found');
  END IF;

  IF v_offer.status NOT IN ('pending', 'countered') THEN
    RETURN jsonb_build_object('success', false, 'error', 'offer_not_open',
                              'offer_status', v_offer.status);
  END IF;

  SELECT * INTO v_auction
  FROM auctions
  WHERE id = v_offer.auction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'auction_not_found');
  END IF;

  IF v_auction.status <> p_expected_auction_status THEN
    RETURN jsonb_build_object('success', false, 'error', 'auction_status_mismatch',
                              'auction_status', v_auction.status);
  END IF;

  SELECT * INTO v_motorhome
  FROM motorhomes
  WHERE id = v_auction.motorhome_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'motorhome_not_found');
  END IF;

  IF v_motorhome.status = 'sold' THEN
    RETURN jsonb_build_object('success', false, 'error', 'motorhome_already_sold');
  END IF;

  v_sale_price := CASE
    WHEN v_offer.status = 'countered' AND v_offer.counter_offer_amount IS NOT NULL
      THEN v_offer.counter_offer_amount
    ELSE v_offer.offer_amount
  END;

  v_sale_type := CASE
    WHEN p_expected_auction_status = 'active'
      THEN 'price_proposal'
    ELSE 'kaufchance'
  END;

  UPDATE post_auction_offers
     SET status       = 'accepted',
         responded_at = now(),
         updated_at   = now()
   WHERE id = p_offer_id;
  GET DIAGNOSTICS v_offer_rows = ROW_COUNT;
  IF v_offer_rows = 0 THEN
    RAISE EXCEPTION 'offer_update_failed';
  END IF;

  UPDATE post_auction_offers
     SET status         = 'rejected',
         seller_response = COALESCE(seller_response, 'Ein anderes Angebot wurde angenommen.'),
         responded_at    = now(),
         updated_at      = now()
   WHERE auction_id = v_offer.auction_id
     AND id <> p_offer_id
     AND status IN ('pending', 'countered');

  UPDATE auctions
     SET status      = 'sold',
         current_bid = v_sale_price
   WHERE id = v_auction.id
     AND status = p_expected_auction_status;
  GET DIAGNOSTICS v_auction_rows = ROW_COUNT;
  IF v_auction_rows = 0 THEN
    RAISE EXCEPTION 'auction_update_failed';
  END IF;

  UPDATE motorhomes
     SET status    = 'sold',
         sold_to   = v_offer.buyer_id,
         sold_at   = now(),
         sale_type = v_sale_type
   WHERE id = v_auction.motorhome_id;
  GET DIAGNOSTICS v_motorhome_rows = ROW_COUNT;
  IF v_motorhome_rows = 0 THEN
    RAISE EXCEPTION 'motorhome_update_failed';
  END IF;

  RETURN jsonb_build_object(
    'success',     true,
    'sale_price',  v_sale_price,
    'buyer_id',    v_offer.buyer_id,
    'auction_id',  v_auction.id,
    'motorhome_id', v_auction.motorhome_id,
    'sale_type',   v_sale_type,
    'caller',      p_user_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success',  false,
      'error',    SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION public.accept_kaufchance_offer_atomic IS
'Atomic DB transition for Kaufchance/Festpreis offer acceptance. Performs four
sequential locks + updates in one transaction so a partial failure cannot leave
the auction sold while the motorhome stays available.';
