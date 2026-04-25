-- =============================================================================
-- Migration: Preisaenderungen durch Verkaeufer nur nach UNTEN
--
-- Bisher konnte ein Verkaeufer ueber
--   * update_listing_prices_in_draft (Draft-Phase)
--   * seller_restart_listing (Restart nach abgelaufener Marketing-Phase)
--   * request-price-change Edge Function + price_change_requests
-- seinen Mindestpreis (reserve_price) und Sofortpreis (instant_price) auch
-- ERHOEHEN. Das widerspricht dem AGB-Konzept der Reduktionsboden-Logik und
-- hat in 2 Faellen (siehe audit_logs 2026-04-24) zu verwirrten Bietern
-- gefuehrt, die zwischen zwei Seitenaufrufen einen hoeheren Mindestpreis
-- gesehen haben.
--
-- Neue Regel (ueberall einheitlich durchgesetzt):
--   * Neuer reserve_price  <= alter reserve_price   (senken oder gleich)
--   * Neuer instant_price  <= alter instant_price  (senken oder gleich)
--
-- Gleichheit bleibt erlaubt, damit der Verkaeufer ein Inserat speichern/
-- neustarten kann ohne zwingend den Preis zu aendern. Erhoehungen werden
-- mit ERRCODE 23514 (check_violation) und einer klaren Meldung abgelehnt.
--
-- Die dritte Stelle (Edge Function request-price-change) erzwingt die
-- gleiche Regel zusaetzlich im TypeScript-Code; beide Layer sind
-- defense-in-depth, da die Edge Function per Service-Role-Key
-- direkt in price_change_requests inserted und damit RLS umgeht.
--
-- Die bestehenden Pflicht-Checks (reserve_price > 0 fuer Auktion,
-- instant_price > 0 fuer Festpreis) bleiben unveraendert.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) update_listing_prices_in_draft: Preis-Hoehung ablehnen
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

  SELECT id, seller_id, sale_channel, reserve_price, instant_price
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

  -- Pflicht-Checks je sale_channel.
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

  -- Neue Regel: Preise duerfen nur GESENKT oder gleich bleiben.
  -- Vergleich erfolgt gegen motorhomes.reserve_price/instant_price (der
  -- zuletzt vom Verkaeufer bestaetigte Wert). NULL auf der alten Seite
  -- heisst "kein Vergleichswert" -> neuer Wert darf gesetzt werden.
  IF p_new_reserve IS NOT NULL
     AND v_motorhome.reserve_price IS NOT NULL
     AND p_new_reserve > v_motorhome.reserve_price THEN
    RAISE EXCEPTION 'Mindestpreis kann nur gesenkt, nicht erhoeht werden (alt: %, neu: %).',
      v_motorhome.reserve_price, p_new_reserve
      USING ERRCODE = '23514';
  END IF;
  IF p_new_instant IS NOT NULL
     AND v_motorhome.instant_price IS NOT NULL
     AND p_new_instant > v_motorhome.instant_price THEN
    RAISE EXCEPTION 'Sofortpreis kann nur gesenkt, nicht erhoeht werden (alt: %, neu: %).',
      v_motorhome.instant_price, p_new_instant
      USING ERRCODE = '23514';
  END IF;

  -- Wenn die Reserve sich geaendert hat, neuen starting_bid wuerfeln.
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
      'old_reserve', v_motorhome.reserve_price,
      'old_instant', v_motorhome.instant_price,
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

COMMENT ON FUNCTION public.update_listing_prices_in_draft(uuid, numeric, numeric) IS
  'Self-Service-RPC fuer Verkaeufer: Mindestpreis/Sofortpreis aendern, solange Auktion=draft. Preise duerfen NUR gesenkt oder gleich bleiben (23514 bei Hoehung). Synchronisiert atomar motorhomes + auctions inkl. starting_bid Recompute.';

-- -----------------------------------------------------------------------------
-- 2) seller_restart_listing: Preis-Hoehung ablehnen
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seller_restart_listing(
  p_motorhome_id UUID,
  p_new_reserve  NUMERIC DEFAULT NULL,
  p_new_instant  NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid              UUID := auth.uid();
  v_is_admin         BOOLEAN;
  v_motorhome        RECORD;
  v_auction          RECORD;
  v_has_auction      BOOLEAN;
  v_is_instant_only  BOOLEAN;
  v_effective_reserve NUMERIC;
  v_new_starting_bid NUMERIC;
  v_now              TIMESTAMPTZ := NOW();
  v_duration_days    INT;
  v_end_time         TIMESTAMPTZ;
  v_max_until        TIMESTAMPTZ;
  v_audit_id         UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Nicht authentifiziert' USING ERRCODE = '42501';
  END IF;

  v_is_admin := public.has_role(v_uid, 'admin'::public.app_role);

  SELECT id, seller_id, sale_channel, reserve_price, instant_price,
         status, is_archived, manufacturer, model
    INTO v_motorhome
    FROM public.motorhomes
   WHERE id = p_motorhome_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inserat nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  IF v_motorhome.seller_id <> v_uid AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Keine Berechtigung fuer dieses Inserat' USING ERRCODE = '42501';
  END IF;

  IF v_motorhome.status IN ('sold', 'reserved') THEN
    RAISE EXCEPTION 'Inserat ist bereits verkauft oder reserviert (Status: %). Restart nicht moeglich.', v_motorhome.status
      USING ERRCODE = '22023';
  END IF;

  v_is_instant_only := v_motorhome.sale_channel = 'instant_price';

  SELECT id, status, starting_bid, auction_round,
         seller_initial_reserve, seller_initial_instant_price,
         dynamic_pricing, auto_relist
    INTO v_auction
    FROM public.auctions
   WHERE motorhome_id = p_motorhome_id
   ORDER BY created_at DESC
   LIMIT 1;
  v_has_auction := FOUND;

  IF v_has_auction AND v_auction.status IN ('active', 'kaufchance', 'draft') THEN
    RAISE EXCEPTION 'Inserat hat eine laufende Auktion (Status: %). Restart nicht moeglich.', v_auction.status
      USING ERRCODE = '22023';
  END IF;

  -- Neue Regel: Preise duerfen nur GESENKT oder gleich bleiben.
  -- Bei Admin (as-admin-Call) wird der Check uebersprungen, damit Support-
  -- Faelle (Fehlangaben, Neubewertung nach Reparatur etc.) weiterhin
  -- zentral ueber Admin-UI bearbeitet werden koennen.
  IF NOT v_is_admin THEN
    IF p_new_reserve IS NOT NULL
       AND v_motorhome.reserve_price IS NOT NULL
       AND p_new_reserve > v_motorhome.reserve_price THEN
      RAISE EXCEPTION 'Mindestpreis kann nur gesenkt, nicht erhoeht werden (alt: %, neu: %).',
        v_motorhome.reserve_price, p_new_reserve
        USING ERRCODE = '23514';
    END IF;
    IF p_new_instant IS NOT NULL
       AND v_motorhome.instant_price IS NOT NULL
       AND p_new_instant > v_motorhome.instant_price THEN
      RAISE EXCEPTION 'Sofortpreis kann nur gesenkt, nicht erhoeht werden (alt: %, neu: %).',
        v_motorhome.instant_price, p_new_instant
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Preis-Update-Logik
  IF p_new_instant IS NOT NULL THEN
    IF p_new_instant <= 0 THEN
      RAISE EXCEPTION 'Sofortpreis muss groesser 0 sein' USING ERRCODE = '23514';
    END IF;
    v_effective_reserve := p_new_instant;
  ELSIF p_new_reserve IS NOT NULL THEN
    IF p_new_reserve <= 0 THEN
      RAISE EXCEPTION 'Mindestpreis muss groesser 0 sein' USING ERRCODE = '23514';
    END IF;
    v_effective_reserve := p_new_reserve;
  ELSE
    v_effective_reserve := CASE
      WHEN v_is_instant_only THEN v_motorhome.instant_price
      ELSE v_motorhome.reserve_price
    END;
  END IF;

  IF v_effective_reserve IS NULL OR v_effective_reserve <= 0 THEN
    RAISE EXCEPTION 'Reserve/Sofortpreis fehlt oder ungueltig (%)', v_effective_reserve
      USING ERRCODE = '23514';
  END IF;

  v_new_starting_bid := CASE
    WHEN v_is_instant_only THEN 0
    ELSE public.compute_random_starting_bid(v_effective_reserve)
  END;

  v_duration_days := CASE WHEN v_is_instant_only THEN 3 ELSE 3 END;
  v_end_time := v_now + (v_duration_days || ' days')::INTERVAL;
  v_max_until := CASE
    WHEN v_is_instant_only THEN v_now + INTERVAL '30 days'
    ELSE v_now + INTERVAL '16 days'
  END;

  UPDATE public.motorhomes
     SET reserve_price = CASE
           WHEN p_new_reserve IS NOT NULL OR p_new_instant IS NOT NULL
             THEN v_effective_reserve
           ELSE reserve_price
         END,
         instant_price = CASE
           WHEN p_new_instant IS NOT NULL THEN p_new_instant
           WHEN p_new_reserve IS NOT NULL AND v_is_instant_only THEN v_effective_reserve
           ELSE instant_price
         END,
         status        = 'active',
         is_archived   = FALSE,
         updated_at    = v_now
   WHERE id = p_motorhome_id;

  IF v_has_auction THEN
    DELETE FROM public.bids                WHERE auction_id = v_auction.id;
    DELETE FROM public.kaufchance_invitations WHERE auction_id = v_auction.id;
    DELETE FROM public.post_auction_offers WHERE auction_id = v_auction.id;

    UPDATE public.auctions
       SET status                       = 'active',
           starting_bid                 = v_new_starting_bid,
           current_bid                  = NULL,
           reserve_price                = v_effective_reserve,
           seller_initial_reserve       = CASE WHEN v_is_instant_only THEN NULL ELSE v_effective_reserve END,
           seller_initial_instant_price = CASE WHEN v_is_instant_only THEN v_effective_reserve ELSE NULL END,
           start_time                   = v_now,
           end_time                     = v_end_time,
           kaufchance_expires_at        = NULL,
           kaufchance_min_price         = NULL,
           auction_round                = 1,
           auto_relist                  = TRUE,
           dynamic_pricing              = CASE WHEN v_is_instant_only THEN FALSE ELSE TRUE END,
           marketing_phase_started_at   = v_now,
           marketing_phase_max_until    = v_max_until,
           last_price_reduction_at      = NULL,
           festpreis_admin_notified_at  = NULL,
           updated_at                   = v_now
     WHERE id = v_auction.id;
  ELSE
    INSERT INTO public.auctions (
      motorhome_id, status, starting_bid, reserve_price,
      seller_initial_reserve, seller_initial_instant_price,
      start_time, end_time, auction_round,
      auto_relist, dynamic_pricing,
      marketing_phase_started_at, marketing_phase_max_until
    ) VALUES (
      p_motorhome_id, 'active', v_new_starting_bid, v_effective_reserve,
      CASE WHEN v_is_instant_only THEN NULL ELSE v_effective_reserve END,
      CASE WHEN v_is_instant_only THEN v_effective_reserve ELSE NULL END,
      v_now, v_end_time, 1,
      TRUE,
      CASE WHEN v_is_instant_only THEN FALSE ELSE TRUE END,
      v_now, v_max_until
    )
    RETURNING id INTO v_auction.id;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    v_uid,
    CASE WHEN v_is_admin AND v_motorhome.seller_id <> v_uid THEN 'admin_restart_listing' ELSE 'seller_restart_listing' END,
    'motorhomes',
    p_motorhome_id::TEXT,
    JSONB_BUILD_OBJECT(
      'auction_id',            v_auction.id,
      'new_reserve',           CASE WHEN v_is_instant_only THEN NULL ELSE v_effective_reserve END,
      'new_instant',           CASE WHEN v_is_instant_only THEN v_effective_reserve ELSE p_new_instant END,
      'old_reserve',           v_motorhome.reserve_price,
      'old_instant',           v_motorhome.instant_price,
      'new_starting_bid',      v_new_starting_bid,
      'new_end_time',          v_end_time,
      'new_marketing_max',     v_max_until,
      'previous_round',        COALESCE(v_auction.auction_round, 0),
      'previous_status',       COALESCE(v_auction.status::TEXT, '<none>'),
      'price_changed',         (p_new_reserve IS NOT NULL OR p_new_instant IS NOT NULL),
      'sale_channel',          v_motorhome.sale_channel,
      'as_admin',              (v_is_admin AND v_motorhome.seller_id <> v_uid),
      'manufacturer_model',    v_motorhome.manufacturer || ' ' || v_motorhome.model
    )
  ) RETURNING id INTO v_audit_id;

  RETURN JSONB_BUILD_OBJECT(
    'ok', TRUE,
    'auction_id',        v_auction.id,
    'motorhome_id',      p_motorhome_id,
    'end_time',          v_end_time,
    'marketing_max',     v_max_until,
    'reserve_price',     v_effective_reserve,
    'starting_bid',      v_new_starting_bid,
    'sale_channel',      v_motorhome.sale_channel,
    'audit_id',          v_audit_id
  );
END
$function$;

COMMENT ON FUNCTION public.seller_restart_listing(UUID, NUMERIC, NUMERIC) IS
  'Soft-Brake-Reaktivierung: recycelt die bestehende Auktion mit frischer Marketing-Phase. '
  'Optional mit neuem Reserve/Instant-Preis als neuem seller_initial_* Anker. '
  'Preise duerfen NUR gesenkt oder gleich bleiben (23514 bei Hoehung), ausser der Aufrufer ist Admin. '
  'Called vom Frontend Dialog in /dashboard/listings/:id?action=restart oder ?action=adjust-price.';

-- -----------------------------------------------------------------------------
-- Audit
-- -----------------------------------------------------------------------------
INSERT INTO public.audit_logs (action, entity_type, entity_id, details)
VALUES (
  'feature_hardened',
  'system',
  NULL,
  jsonb_build_object(
    'feature', 'seller_price_lower_only',
    'rpcs', jsonb_build_array(
      'update_listing_prices_in_draft',
      'seller_restart_listing'
    ),
    'rule', 'Verkaeufer duerfen Mindest-/Sofortpreis nur senken oder gleich belassen; Erhoehungen werden mit 23514 abgewiesen. Admin-Ueberschreibung bleibt via admin-direct-update moeglich.',
    'migration', '20260425100000_seller_price_lower_only.sql'
  )
);
