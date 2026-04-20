-- =====================================================================
-- Phase 4 / Hardening: REVOKE seller_initial_* + Owner/Admin-RPC
-- =====================================================================
-- Auch wenn `auctions_public` bereits ohne `seller_initial_reserve` /
-- `seller_initial_instant_price` definiert ist, kann jeder authentifizierte
-- User diese Spalten weiterhin direkt von `public.auctions` lesen, weil:
--
--   * RLS-Policy "Anyone can view active auctions" ist USING(true)
--   * Tabellen-GRANT (`GRANT SELECT ON auctions TO authenticated`) gilt
--     für ALLE Spalten — column-level REVOKE wird durch den Tabellen-
--     Grant überlagert.
--
-- Deshalb das übliche `REVOKE SELECT (col) ... FROM authenticated` allein
-- WIRKT NICHT. Wir müssen:
--
--   1) den Tabellen-Level-SELECT-Grant entfernen
--   2) alle erlaubten Spalten EINZELN wieder granten (alle außer den 2
--      geschützten)
--
-- Konsequenz für die Zukunft:
--   * Wenn jemand neue Spalten zu `auctions` hinzufügt, muss er sie
--     explizit per `GRANT SELECT (neue_spalte) ON public.auctions TO
--     authenticated, anon` freigeben — sonst sind sie für Frontend NICHT
--     lesbar. Das ist by-design (deny-by-default für Anker-Daten).
--
-- Service-Role und Trigger-Owner laufen weiter mit Vollzugriff.
-- =====================================================================

-- ─── 1) Owner/Admin RPC ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_auction_marketing_anchors(
  p_motorhome_id uuid
)
RETURNS TABLE (
  auction_id uuid,
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

  SELECT seller_id INTO v_seller
    FROM public.motorhomes
   WHERE id = p_motorhome_id;

  IF v_seller IS NULL THEN
    RAISE EXCEPTION 'Wohnmobil nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  v_is_admin := public.has_role(v_caller, 'admin'::public.app_role);

  IF NOT v_is_admin AND v_seller <> v_caller THEN
    RAISE EXCEPTION 'Sie haben keinen Zugriff auf die Anker-Preise dieser Auktion'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT a.id, a.seller_initial_reserve, a.seller_initial_instant_price
    FROM public.auctions a
   WHERE a.motorhome_id = p_motorhome_id
   ORDER BY a.created_at DESC
   LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_auction_marketing_anchors(uuid) IS
'Sicherer Lesepfad für seller_initial_reserve + seller_initial_instant_price. Nur Verkäufer (Owner) oder Admin sehen die Anker-Preise. Käufer/Bots werden via Spalten-REVOKE geblockt.';

REVOKE ALL ON FUNCTION public.get_auction_marketing_anchors(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_auction_marketing_anchors(uuid) TO authenticated;

-- ─── 2) Column-SELECT REVOKE (mit Table-Level-Reset) ──────────────────
-- WICHTIG: Postgres column-REVOKE alleine wirkt nicht, wenn ein Table-
-- Level-GRANT existiert. Wir nehmen deshalb den Tabellen-Grant raus und
-- granten alle Spalten EINZELN wieder, außer den 2 geschützten.

DO $$
DECLARE
  v_col text;
BEGIN
  -- 2a) Komplettes Tabellen-SELECT von authenticated/anon entfernen
  REVOKE SELECT ON public.auctions FROM authenticated, anon;

  -- 2b) Pro Spalte einzeln wieder granten — außer den geschützten
  FOR v_col IN
    SELECT column_name
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'auctions'
       AND column_name NOT IN ('seller_initial_reserve', 'seller_initial_instant_price')
     ORDER BY ordinal_position
  LOOP
    EXECUTE format(
      'GRANT SELECT (%I) ON public.auctions TO authenticated, anon',
      v_col
    );
  END LOOP;

  -- 2c) service_role explizit Vollzugriff (sollte schon Owner sein,
  --     wir granten defensiv)
  GRANT SELECT ON public.auctions TO service_role;
END $$;

-- ─── 3) Smoke-Test ────────────────────────────────────────────────────
DO $$
DECLARE
  v_protected_count int;
  v_visible_count   int;
  v_function_exists boolean;
BEGIN
  -- 3a) Sicher dass die 2 geschützten Spalten KEIN SELECT mehr für authenticated/anon haben
  SELECT COUNT(*) INTO v_protected_count
    FROM information_schema.column_privileges
   WHERE table_schema='public'
     AND table_name='auctions'
     AND column_name IN ('seller_initial_reserve', 'seller_initial_instant_price')
     AND grantee     IN ('authenticated','anon')
     AND privilege_type = 'SELECT';

  IF v_protected_count > 0 THEN
    RAISE EXCEPTION
      'REVOKE incomplete: % column-SELECT grants remain on seller_initial_*',
      v_protected_count;
  END IF;

  -- 3b) Sicher dass mindestens 'id' für authenticated weiter sichtbar ist
  --     (sonst hätten wir den Frontend komplett geblockt)
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

  -- 3c) RPC existiert
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'get_auction_marketing_anchors'
  ) INTO v_function_exists;

  IF NOT v_function_exists THEN
    RAISE EXCEPTION 'RPC get_auction_marketing_anchors wurde NICHT angelegt';
  END IF;

  RAISE NOTICE 'OK: seller_initial_* sind für authenticated/anon geblockt; alle anderen Spalten weiter sichtbar; RPC steht.';
END $$;
