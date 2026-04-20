-- =====================================================================
-- Phase 4 / Hardening: REVOKE strategy-relevant columns + owner RPC
-- =====================================================================
-- Behebt Bugs aus Audit Round 3:
--   #14  auctions_public View leakt Strategie-Felder an Käufer
--   #15  auctions Table-RLS ist USING(true) → Käufer kann sensitive
--        Spalten direkt von public.auctions lesen
--
-- Geschützte Spalten (warum):
--   * dynamic_pricing            → Käufer wartet bewusst auf nächste Senkung
--   * auto_relist                → Käufer wartet auf Wiedereinstellung
--   * marketing_phase_max_until  → Käufer kennt Hard-Cap-Datum, kann floor reverse-engineeren
--   * agb_version_at_start       → Legal-Snapshot, kein Käufer-Use-Case
--
-- Bewusst NICHT geschützt (benigne Felder):
--   * marketing_phase_started_at → StablePriceBadge braucht den Anker
--   * last_price_reduction_at    → StablePriceBadge braucht den Anker; ohne
--                                  dynamic_pricing/cadence kann Käufer nichts
--                                  reverse-engineeren
--   * soft_close_extension_minutes → öffentliches Auktionsfeature (5min)
--   * auction_round              → Käufer darf Runde wissen (Inserat-Historie)
--
-- Pattern wie 20260420260000_phase4_revoke_seller_initial_columns.sql:
--   1) Tabellen-SELECT komplett raus, dann Spalten EINZELN granten (außer
--      den jetzt geschützten)
--   2) SECURITY DEFINER RPC für Owner/Admin-Lesepfad
--   3) auctions_public View neu definieren ohne sensitive Spalten
-- =====================================================================

-- ─── 1) Owner/Admin RPC: get_auction_owner_meta ───────────────────────
-- Liefert ALLE owner-only Felder in EINEM Call.
-- Zugriff: Verkäufer (motorhome.seller_id) ODER Admin (has_role).
CREATE OR REPLACE FUNCTION public.get_auction_owner_meta(
  p_auction_id uuid
)
RETURNS TABLE (
  auction_id uuid,
  dynamic_pricing boolean,
  auto_relist boolean,
  marketing_phase_max_until timestamptz,
  agb_version_at_start text,
  seller_initial_reserve numeric,
  seller_initial_instant_price numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller   uuid := auth.uid();
  v_seller   uuid;
  v_is_admin boolean := false;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Anmeldung erforderlich' USING ERRCODE = '42501';
  END IF;

  SELECT m.seller_id INTO v_seller
    FROM public.auctions a
    JOIN public.motorhomes m ON m.id = a.motorhome_id
   WHERE a.id = p_auction_id;

  IF v_seller IS NULL THEN
    RAISE EXCEPTION 'Auktion nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  v_is_admin := public.has_role(v_caller, 'admin'::public.app_role);

  IF NOT v_is_admin AND v_seller <> v_caller THEN
    RAISE EXCEPTION 'Sie haben keinen Zugriff auf die Marketing-Felder dieser Auktion'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT a.id,
         a.dynamic_pricing,
         a.auto_relist,
         a.marketing_phase_max_until,
         a.agb_version_at_start,
         a.seller_initial_reserve,
         a.seller_initial_instant_price
    FROM public.auctions a
   WHERE a.id = p_auction_id;
END;
$$;

COMMENT ON FUNCTION public.get_auction_owner_meta(uuid) IS
'Sicherer Lesepfad für owner-only Marketing-Felder einer einzelnen Auktion (dynamic_pricing, auto_relist, marketing_phase_max_until, agb_version_at_start, seller_initial_*). Nur Verkäufer (Owner) oder Admin haben Zugriff.';

REVOKE ALL ON FUNCTION public.get_auction_owner_meta(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_auction_owner_meta(uuid) TO authenticated;


-- ─── 1b) Bulk-Variante für Listing-Übersichten (MyListings/AdminAuctions) ──
-- Spart einen Roundtrip pro Inserat. Liefert nur Auktionen, die der
-- Caller einsehen darf (Owner ODER Admin). Andere werden stillschweigend
-- ausgeblendet (kein 42501, weil das in Listen den UX bricht).
CREATE OR REPLACE FUNCTION public.get_auctions_owner_meta_bulk(
  p_auction_ids uuid[]
)
RETURNS TABLE (
  auction_id uuid,
  dynamic_pricing boolean,
  auto_relist boolean,
  marketing_phase_max_until timestamptz,
  agb_version_at_start text,
  seller_initial_reserve numeric,
  seller_initial_instant_price numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller   uuid := auth.uid();
  v_is_admin boolean := false;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Anmeldung erforderlich' USING ERRCODE = '42501';
  END IF;

  IF p_auction_ids IS NULL OR array_length(p_auction_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  v_is_admin := public.has_role(v_caller, 'admin'::public.app_role);

  RETURN QUERY
  SELECT a.id,
         a.dynamic_pricing,
         a.auto_relist,
         a.marketing_phase_max_until,
         a.agb_version_at_start,
         a.seller_initial_reserve,
         a.seller_initial_instant_price
    FROM public.auctions a
    JOIN public.motorhomes m ON m.id = a.motorhome_id
   WHERE a.id = ANY(p_auction_ids)
     AND (v_is_admin OR m.seller_id = v_caller);
END;
$$;

COMMENT ON FUNCTION public.get_auctions_owner_meta_bulk(uuid[]) IS
'Bulk-Variante von get_auction_owner_meta für Listen-Views (MyListings, AdminAuctions). Liefert nur Auktionen, die der Caller einsehen darf. Andere werden stillschweigend ausgeblendet (kein Error in Listen-UX).';

REVOKE ALL ON FUNCTION public.get_auctions_owner_meta_bulk(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.get_auctions_owner_meta_bulk(uuid[]) TO authenticated;


-- ─── 2) Column-SELECT REVOKE (mit Tabellen-Reset) ─────────────────────
-- Wir machen das gleiche Pattern wie bei seller_initial_*:
--   * Tabellen-SELECT von authenticated/anon entfernen
--   * Alle Spalten EINZELN wieder granten — außer den jetzt geschützten
DO $$
DECLARE
  v_col text;
  v_protected text[] := ARRAY[
    'seller_initial_reserve',
    'seller_initial_instant_price',
    'dynamic_pricing',
    'auto_relist',
    'marketing_phase_max_until',
    'agb_version_at_start'
  ];
BEGIN
  -- 2a) Komplettes Tabellen-SELECT von authenticated/anon entfernen
  REVOKE SELECT ON public.auctions FROM authenticated, anon;

  -- 2b) Pro Spalte einzeln wieder granten — außer den geschützten
  FOR v_col IN
    SELECT column_name
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'auctions'
       AND NOT (column_name = ANY(v_protected))
     ORDER BY ordinal_position
  LOOP
    EXECUTE format(
      'GRANT SELECT (%I) ON public.auctions TO authenticated, anon',
      v_col
    );
  END LOOP;

  -- 2c) Service-Role explizit Vollzugriff (Defensiv-Grant)
  GRANT SELECT ON public.auctions TO service_role;
END $$;


-- ─── 3) auctions_public View neu — ohne sensitive Spalten ─────────────
-- View war: id, motorhome_id, status, starting_bid, current_bid,
--   reserve_price, start_time, end_time, kaufchance_expires_at,
--   kaufchance_min_price, auto_relist, auction_round, dynamic_pricing,
--   marketing_phase_started_at, marketing_phase_max_until,
--   last_price_reduction_at, soft_close_extension_minutes,
--   created_at, updated_at
--
-- Neu: ohne auto_relist, dynamic_pricing, marketing_phase_max_until.
DROP VIEW IF EXISTS public.auctions_public;

CREATE VIEW public.auctions_public AS
SELECT
  id,
  motorhome_id,
  status,
  starting_bid,
  current_bid,
  reserve_price,
  start_time,
  end_time,
  kaufchance_expires_at,
  kaufchance_min_price,
  auction_round,
  marketing_phase_started_at,   -- StablePriceBadge braucht das (positives Signal)
  last_price_reduction_at,      -- StablePriceBadge braucht das (positives Signal)
  soft_close_extension_minutes, -- öffentliches Auction-Feature
  created_at,
  updated_at
FROM public.auctions;

COMMENT ON VIEW public.auctions_public IS
'Käufer-sichere Sicht auf public.auctions. Strategie-Felder (auto_relist, dynamic_pricing, marketing_phase_max_until, agb_version_at_start, seller_initial_*) sind absichtlich NICHT enthalten — Käufer könnten daraus Bid-Strategien ableiten. Owner/Admin lesen über RPC get_auction_owner_meta.';

GRANT SELECT ON public.auctions_public TO anon, authenticated, service_role;


-- ─── 4) Smoke-Test ────────────────────────────────────────────────────
DO $$
DECLARE
  v_protected_count int;
  v_visible_count   int;
  v_view_cols text[];
BEGIN
  -- 4a) Alle 6 geschützten Spalten haben KEIN authenticated/anon SELECT mehr
  SELECT COUNT(*) INTO v_protected_count
    FROM information_schema.column_privileges
   WHERE table_schema='public'
     AND table_name='auctions'
     AND column_name IN (
       'seller_initial_reserve','seller_initial_instant_price',
       'dynamic_pricing','auto_relist',
       'marketing_phase_max_until','agb_version_at_start'
     )
     AND grantee     IN ('authenticated','anon')
     AND privilege_type = 'SELECT';
  IF v_protected_count > 0 THEN
    RAISE EXCEPTION 'REVOKE incomplete: % column-SELECT grants remain on protected columns',
      v_protected_count;
  END IF;

  -- 4b) Sicher dass mindestens 'id' für authenticated weiter sichtbar ist
  SELECT COUNT(*) INTO v_visible_count
    FROM information_schema.column_privileges
   WHERE table_schema='public'
     AND table_name='auctions'
     AND column_name = 'id'
     AND grantee     = 'authenticated'
     AND privilege_type = 'SELECT';
  IF v_visible_count = 0 THEN
    RAISE EXCEPTION 'GRANT regression: id is no longer visible to authenticated';
  END IF;

  -- 4c) auctions_public hat KEINE sensitive Spalten
  SELECT array_agg(column_name) INTO v_view_cols
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='auctions_public';
  IF 'dynamic_pricing' = ANY(v_view_cols)
     OR 'auto_relist' = ANY(v_view_cols)
     OR 'marketing_phase_max_until' = ANY(v_view_cols)
     OR 'agb_version_at_start' = ANY(v_view_cols)
     OR 'seller_initial_reserve' = ANY(v_view_cols)
     OR 'seller_initial_instant_price' = ANY(v_view_cols) THEN
    RAISE EXCEPTION 'auctions_public View leakt noch sensitive Spalten: %',
      v_view_cols;
  END IF;

  -- 4d) RPCs existieren
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='get_auction_owner_meta') THEN
    RAISE EXCEPTION 'RPC get_auction_owner_meta wurde NICHT angelegt';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='get_auctions_owner_meta_bulk') THEN
    RAISE EXCEPTION 'RPC get_auctions_owner_meta_bulk wurde NICHT angelegt';
  END IF;

  RAISE NOTICE 'OK: 6 Strategie-Spalten geblockt, auctions_public View bereinigt, 2 Owner-RPCs aktiv.';
END $$;
