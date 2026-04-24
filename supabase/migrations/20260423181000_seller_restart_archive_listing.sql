-- Phase 6 (Soft-Brake): Self-Service Restart / Adjust-Price / Archive
--
-- Ermöglicht dem Verkäufer nach einer abgelaufenen Marketing-Phase (Soft-Brake
-- oder Opt-out) ohne Admin-Eingriff wieder handlungsfähig zu werden. Bisher
-- hatten die 3 Buttons in der `seller_soft_brake`-Mail keine Frontend-Wirkung
-- (toter Query-Param ?action=restart|adjust-price|archive).
--
-- Neue Infrastruktur:
--   1. motorhomes.is_archived (BOOLEAN, default false) — orthogonaler Flag
--      zum bestehenden status-Feld. „Archiviert" heißt: vom Markt genommen,
--      aber nicht gelöscht (History bleibt). Reversibel via
--      seller_unarchive_listing.
--   2. seller_restart_listing(mh_id, new_reserve?, new_instant?) — recycelt
--      die bestehende Auktion: status='active', round=1, frische Laufzeit,
--      frisches marketing_phase_max_until, optional neuer Reserve-/Instant-
--      Preis als neuer seller_initial_* Anker, Bids/Kaufchance-Invitations/
--      Post-Auction-Offers werden gelöscht (History ist an auction_id
--      gekoppelt, die bleibt bestehen; nur Lifecycle-Daten werden geleert).
--   3. seller_archive_listing(mh_id) — setzt is_archived=true wenn keine
--      aktive Auktion läuft.
--   4. seller_unarchive_listing(mh_id) — Gegenteil (Reversibilität für UI).
--
-- Alle drei RPCs sind SECURITY DEFINER und prüfen Ownership via seller_id
-- oder Admin-Rolle (has_role). Audit-Log in jedem Pfad.
--
-- Ich habe das Pattern 1:1 von update_listing_prices_in_draft übernommen
-- (error codes 42501/23514/P0002, jsonb return, audit_logs insert am Ende).

-- ── 1) Spalte is_archived ──────────────────────────────────────────────────

ALTER TABLE public.motorhomes
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.motorhomes.is_archived IS
  'True = Inserat vom Verkäufer/Admin archiviert. Wird im Dashboard, Kaufen, '
  'Admin-Listen ausgeblendet, aber nicht gelöscht (Audit/History). Reversibel '
  'via seller_unarchive_listing oder Admin-UI.';

-- Partial index: die meisten Rows haben is_archived=FALSE, wir brauchen den
-- Index nur für die seltene „Archiv anzeigen"-Query im Dashboard.
CREATE INDEX IF NOT EXISTS motorhomes_is_archived_true_idx
  ON public.motorhomes (seller_id)
  WHERE is_archived = TRUE;

-- ── 2) seller_restart_listing RPC ──────────────────────────────────────────

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

  -- Motorhome laden
  SELECT id, seller_id, sale_channel, reserve_price, instant_price,
         status, is_archived, manufacturer, model
    INTO v_motorhome
    FROM public.motorhomes
   WHERE id = p_motorhome_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inserat nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  -- Ownership (Verkäufer selbst oder Admin)
  IF v_motorhome.seller_id <> v_uid AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Keine Berechtigung für dieses Inserat' USING ERRCODE = '42501';
  END IF;

  -- Restart sinnvoll? Nicht erlauben wenn bereits verkauft/reserviert
  IF v_motorhome.status IN ('sold', 'reserved') THEN
    RAISE EXCEPTION 'Inserat ist bereits verkauft oder reserviert (Status: %). Restart nicht möglich.', v_motorhome.status
      USING ERRCODE = '22023';
  END IF;

  v_is_instant_only := v_motorhome.sale_channel = 'instant_price';

  -- Bestehende Auktion laden (falls vorhanden)
  SELECT id, status, starting_bid, auction_round,
         seller_initial_reserve, seller_initial_instant_price,
         dynamic_pricing, auto_relist
    INTO v_auction
    FROM public.auctions
   WHERE motorhome_id = p_motorhome_id
   ORDER BY created_at DESC
   LIMIT 1;
  v_has_auction := FOUND;

  -- Wenn die Auktion noch aktiv/kaufchance/draft ist: blockieren (Restart nur
  -- nach Abschluss sinnvoll; sonst würden laufende Bids/Offers verloren gehen).
  IF v_has_auction AND v_auction.status IN ('active', 'kaufchance', 'draft') THEN
    RAISE EXCEPTION 'Inserat hat eine laufende Auktion (Status: %). Restart nicht möglich.', v_auction.status
      USING ERRCODE = '22023';
  END IF;

  -- Preis-Update-Logik: wenn p_new_reserve/p_new_instant gesetzt ist, den
  -- motorhomes-Wert aktualisieren. Sonst bleibt der bisherige stehen.
  IF p_new_instant IS NOT NULL THEN
    IF p_new_instant <= 0 THEN
      RAISE EXCEPTION 'Sofortpreis muss größer 0 sein' USING ERRCODE = '23514';
    END IF;
    -- Sofortpreis impliziert Reserve = Sofortpreis (gleiche Semantik wie Wizard)
    v_effective_reserve := p_new_instant;
  ELSIF p_new_reserve IS NOT NULL THEN
    IF p_new_reserve <= 0 THEN
      RAISE EXCEPTION 'Mindestpreis muss größer 0 sein' USING ERRCODE = '23514';
    END IF;
    v_effective_reserve := p_new_reserve;
  ELSE
    -- Keine neuen Preise → bisherigen Wert nehmen
    v_effective_reserve := CASE
      WHEN v_is_instant_only THEN v_motorhome.instant_price
      ELSE v_motorhome.reserve_price
    END;
  END IF;

  IF v_effective_reserve IS NULL OR v_effective_reserve <= 0 THEN
    RAISE EXCEPTION 'Reserve/Sofortpreis fehlt oder ungültig (%)', v_effective_reserve
      USING ERRCODE = '23514';
  END IF;

  -- Starting-Bid zufällig wählen (außer Festpreis-only)
  v_new_starting_bid := CASE
    WHEN v_is_instant_only THEN 0
    ELSE public.compute_random_starting_bid(v_effective_reserve)
  END;

  -- Marketing-Phase-Zeitfenster
  v_duration_days := CASE WHEN v_is_instant_only THEN 3 ELSE 3 END;  -- AUCTION_DURATION_DAYS / INSTANT_PRICE_DURATION_DAYS
  v_end_time := v_now + (v_duration_days || ' days')::INTERVAL;
  -- Cap: Auktion = 16 Tage (4 Runden × 3 + 4 Kaufchance-Tage = 16);
  -- Festpreis = 30 Tage (INSTANT_PRICE_MAX_TOTAL_DAYS).
  v_max_until := CASE
    WHEN v_is_instant_only THEN v_now + INTERVAL '30 days'
    ELSE v_now + INTERVAL '16 days'
  END;

  -- Motorhome-Update: Preise (optional), Status zurück auf active, entarchivieren
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

  -- Auktions-Row: recyceln oder neu anlegen
  IF v_has_auction THEN
    -- Lifecycle-Reset (analog activateAuctionForMotorhome Pfad A)
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
    -- Kein bestehender Auctions-Row (seltener Fall: Inserat ohne Auktion,
    -- jetzt als Restart neu). INSERT.
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

  -- Audit
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
  'Soft-Brake-Reaktivierung: recycelt die bestehende Auktion mit frischer '
  'Marketing-Phase (Runde 1, neue 3-Tage-Laufzeit, max 16/30 Tage Cap). '
  'Optional mit neuem Reserve/Instant-Preis als neuem seller_initial_* Anker. '
  'Called vom Frontend Dialog in /dashboard/listings/:id?action=restart oder '
  '?action=adjust-price. Verkäufer oder Admin.';

GRANT EXECUTE ON FUNCTION public.seller_restart_listing(UUID, NUMERIC, NUMERIC) TO authenticated;

-- ── 3) seller_archive_listing RPC ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.seller_archive_listing(
  p_motorhome_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid       UUID := auth.uid();
  v_is_admin  BOOLEAN;
  v_motorhome RECORD;
  v_auction   RECORD;
  v_audit_id  UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Nicht authentifiziert' USING ERRCODE = '42501';
  END IF;

  v_is_admin := public.has_role(v_uid, 'admin'::public.app_role);

  SELECT id, seller_id, status, is_archived, manufacturer, model
    INTO v_motorhome
    FROM public.motorhomes
   WHERE id = p_motorhome_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inserat nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  IF v_motorhome.seller_id <> v_uid AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Keine Berechtigung für dieses Inserat' USING ERRCODE = '42501';
  END IF;

  IF v_motorhome.is_archived THEN
    -- Idempotent: bereits archiviert
    RETURN JSONB_BUILD_OBJECT('ok', TRUE, 'already_archived', TRUE);
  END IF;

  -- Keine aktive Auktion erlauben
  SELECT id, status
    INTO v_auction
    FROM public.auctions
   WHERE motorhome_id = p_motorhome_id
   ORDER BY created_at DESC
   LIMIT 1;

  IF FOUND AND v_auction.status IN ('active', 'kaufchance', 'draft') THEN
    RAISE EXCEPTION 'Inserat hat eine laufende Auktion (Status: %). Archivierung nicht möglich.', v_auction.status
      USING ERRCODE = '22023';
  END IF;

  -- Motorhome archivieren (status bleibt wie er war)
  UPDATE public.motorhomes
     SET is_archived = TRUE,
         updated_at  = NOW()
   WHERE id = p_motorhome_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    v_uid,
    CASE WHEN v_is_admin AND v_motorhome.seller_id <> v_uid THEN 'admin_archive_listing' ELSE 'seller_archive_listing' END,
    'motorhomes',
    p_motorhome_id::TEXT,
    JSONB_BUILD_OBJECT(
      'previous_status', v_motorhome.status,
      'manufacturer_model', v_motorhome.manufacturer || ' ' || v_motorhome.model,
      'as_admin', (v_is_admin AND v_motorhome.seller_id <> v_uid)
    )
  ) RETURNING id INTO v_audit_id;

  RETURN JSONB_BUILD_OBJECT('ok', TRUE, 'motorhome_id', p_motorhome_id, 'audit_id', v_audit_id);
END
$function$;

COMMENT ON FUNCTION public.seller_archive_listing(UUID) IS
  'Archiviert ein Inserat (is_archived=TRUE). Nur wenn keine aktive Auktion '
  'läuft. Called vom Frontend Dialog in /dashboard/listings/:id?action=archive.';

GRANT EXECUTE ON FUNCTION public.seller_archive_listing(UUID) TO authenticated;

-- ── 4) seller_unarchive_listing RPC ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.seller_unarchive_listing(
  p_motorhome_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid       UUID := auth.uid();
  v_is_admin  BOOLEAN;
  v_motorhome RECORD;
  v_audit_id  UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Nicht authentifiziert' USING ERRCODE = '42501';
  END IF;

  v_is_admin := public.has_role(v_uid, 'admin'::public.app_role);

  SELECT id, seller_id, is_archived, manufacturer, model
    INTO v_motorhome
    FROM public.motorhomes
   WHERE id = p_motorhome_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inserat nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  IF v_motorhome.seller_id <> v_uid AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Keine Berechtigung für dieses Inserat' USING ERRCODE = '42501';
  END IF;

  IF NOT v_motorhome.is_archived THEN
    RETURN JSONB_BUILD_OBJECT('ok', TRUE, 'not_archived', TRUE);
  END IF;

  UPDATE public.motorhomes
     SET is_archived = FALSE,
         updated_at  = NOW()
   WHERE id = p_motorhome_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    v_uid,
    CASE WHEN v_is_admin AND v_motorhome.seller_id <> v_uid THEN 'admin_unarchive_listing' ELSE 'seller_unarchive_listing' END,
    'motorhomes',
    p_motorhome_id::TEXT,
    JSONB_BUILD_OBJECT(
      'manufacturer_model', v_motorhome.manufacturer || ' ' || v_motorhome.model,
      'as_admin', (v_is_admin AND v_motorhome.seller_id <> v_uid)
    )
  ) RETURNING id INTO v_audit_id;

  RETURN JSONB_BUILD_OBJECT('ok', TRUE, 'motorhome_id', p_motorhome_id, 'audit_id', v_audit_id);
END
$function$;

COMMENT ON FUNCTION public.seller_unarchive_listing(UUID) IS
  'Setzt is_archived=FALSE zurück. Für „Aus Archiv wiederherstellen"-UI.';

GRANT EXECUTE ON FUNCTION public.seller_unarchive_listing(UUID) TO authenticated;
