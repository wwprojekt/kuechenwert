-- =============================================================================
-- Fixes nach interner Review der Self-Service-Preisaenderung
-- (Migration 20260420600000_seller_self_service_prices.sql).
--
-- Behobene Bugs:
--   1) RPC update_listing_prices_in_draft hat starting_bid nicht
--      neu berechnet, wenn Reserve drastisch geaendert wurde. Ergebnis:
--      starting_bid kann groesser als neue Reserve sein -> Auktion startet
--      sofort ueber Reserve und Bid-Logik wird inkonsistent.
--
--   2) RPC erlaubte NULL-Preise fuer sale_channel='instant_price' wenn
--      bereits eine Auktions-Row existiert. 28 instant_price Inserate, 16
--      davon mit Auktion-Row -> potenziell 16 Listings ohne Preis.
--
--   5) trigger touch_price_change_requests_updated_at war ohne
--      SET search_path -> Linter WARN function_search_path_mutable und
--      verletzt AGENTS.md Pflicht-Regel.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Fix 1+2: RPC neu definieren mit
--   * starting_bid Recompute via compute_random_starting_bid
--   * NULL-Pflicht-Check auch fuer sale_channel='instant_price'
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_listing_prices_in_draft(
  p_motorhome_id uuid,
  p_new_reserve numeric,
  p_new_instant numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_motorhome record;
  v_auction record;
  v_has_auction boolean;
  v_effective_reserve numeric;
  v_new_starting_bid numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Nicht authentifiziert' USING ERRCODE = '42501';
  END IF;

  SELECT id, seller_id, sale_channel
    INTO v_motorhome
    FROM public.motorhomes
   WHERE id = p_motorhome_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inserat nicht gefunden' USING ERRCODE = 'P0002';
  END IF;
  IF v_motorhome.seller_id <> v_uid THEN
    RAISE EXCEPTION 'Keine Berechtigung fuer dieses Inserat' USING ERRCODE = '42501';
  END IF;

  SELECT id, status, starting_bid
    INTO v_auction
    FROM public.auctions
   WHERE motorhome_id = p_motorhome_id
   ORDER BY created_at DESC
   LIMIT 1;
  v_has_auction := FOUND;

  IF v_has_auction AND v_auction.status <> 'draft' THEN
    RAISE EXCEPTION 'Preisaenderung nur im Entwurfs-Status moeglich. Bitte stellen Sie eine Anfrage ueber das Dashboard.'
      USING ERRCODE = '42501';
  END IF;

  -- Effektiver Mindestpreis = Sofortpreis wenn gesetzt, sonst reserve.
  v_effective_reserve := COALESCE(p_new_instant, p_new_reserve);

  -- Pflicht-Check je sale_channel.
  -- (Fix 2) Sofortpreis-Listings mit Auktions-Row brauchen mindestens einen
  -- Sofortpreis ODER eine Reserve, sonst waere das Listing preislos.
  IF v_motorhome.sale_channel = 'auction'
     AND (v_effective_reserve IS NULL OR v_effective_reserve <= 0) THEN
    RAISE EXCEPTION 'Mindestpreis ist Pflicht fuer Auktions-Inserate (AGB 6.4 c).'
      USING ERRCODE = '23514';
  END IF;
  IF v_motorhome.sale_channel = 'instant_price'
     AND v_has_auction
     AND (v_effective_reserve IS NULL OR v_effective_reserve <= 0) THEN
    RAISE EXCEPTION 'Sofortkauf-Inserate brauchen einen Sofortpreis groesser 0.'
      USING ERRCODE = '23514';
  END IF;

  -- (Fix 1) Wenn die Reserve sich geaendert hat, neuen starting_bid wuerfeln.
  -- compute_random_starting_bid liefert 40-60% der Reserve, oder 50 fuer
  -- Reserve < 200 EUR (Edge Case). starting_bid ist NOT NULL.
  IF v_has_auction AND v_effective_reserve IS NOT NULL THEN
    v_new_starting_bid := public.compute_random_starting_bid(v_effective_reserve);
  END IF;

  UPDATE public.motorhomes
     SET reserve_price = v_effective_reserve,
         instant_price = p_new_instant,
         updated_at = NOW()
   WHERE id = p_motorhome_id;

  IF v_has_auction THEN
    UPDATE public.auctions
       SET reserve_price = v_effective_reserve,
           seller_initial_reserve = v_effective_reserve,
           seller_initial_instant_price = p_new_instant,
           starting_bid = COALESCE(v_new_starting_bid, starting_bid)
     WHERE id = v_auction.id;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    v_uid,
    'seller_price_update_draft',
    'motorhomes',
    p_motorhome_id::text,
    jsonb_build_object(
      'new_reserve', v_effective_reserve,
      'new_instant', p_new_instant,
      'new_starting_bid', v_new_starting_bid,
      'old_starting_bid', v_auction.starting_bid,
      'sale_channel', v_motorhome.sale_channel,
      'auction_id', v_auction.id
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'effective_reserve', v_effective_reserve,
    'instant_price', p_new_instant,
    'starting_bid', COALESCE(v_new_starting_bid, v_auction.starting_bid),
    'auction_id', v_auction.id
  );
END
$$;

REVOKE ALL ON FUNCTION public.update_listing_prices_in_draft(uuid, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_listing_prices_in_draft(uuid, numeric, numeric) TO authenticated;

COMMENT ON FUNCTION public.update_listing_prices_in_draft(uuid, numeric, numeric) IS
  'Self-Service-RPC fuer Verkaeufer: Mindestpreis/Sofortpreis aendern, solange Auktion=draft. Synchronisiert atomar motorhomes + auctions inkl. starting_bid Recompute. SECURITY DEFINER weil auctions kein UPDATE-Policy fuer Verkaeufer hat. Erzwingt Pflicht-Preis fuer auction- UND instant_price-Channel.';

-- -----------------------------------------------------------------------------
-- Fix 5: search_path fuer Trigger-Funktion
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_price_change_requests_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END
$$;

-- -----------------------------------------------------------------------------
-- Audit
-- -----------------------------------------------------------------------------
INSERT INTO public.audit_logs (action, entity_type, entity_id, details)
VALUES (
  'feature_fixed',
  'system',
  NULL,
  jsonb_build_object(
    'feature', 'seller_self_service_prices',
    'fixes', jsonb_build_array(
      'rpc_recompute_starting_bid',
      'rpc_null_guard_instant_price',
      'trigger_search_path_set'
    ),
    'migration', '20260420700000_seller_self_service_fixes.sql'
  )
);
