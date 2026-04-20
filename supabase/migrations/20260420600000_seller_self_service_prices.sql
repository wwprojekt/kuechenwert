-- =============================================================================
-- Migration: Seller Self-Service für Preisänderungen
--
-- Bringt 2 Funktionen für die Preisbearbeitung nach Wizard-Submit:
--
-- A) RPC public.update_listing_prices_in_draft(motorhome_id, reserve, instant)
--    Erlaubt dem Verkäufer Preise selbst zu ändern, SOLANGE die zugehörige
--    Auktion noch im Status 'draft' steht (also vor Admin-Approval). Die
--    Auktion wird atomar mit den neuen Werten synchronisiert
--    (reserve_price, seller_initial_reserve, seller_initial_instant_price).
--    Wir gehen über eine SECURITY DEFINER RPC, weil auctions kein Update-Policy
--    für Verkäufer hat (nur Admin) und wir die strikte 'draft'-Bedingung im
--    Server erzwingen wollen.
--
-- B) Tabelle public.price_change_requests
--    Wenn die Auktion bereits live ist (active/kaufchance), kann der Verkäufer
--    eine Preisanpassung beim CaravanWert-Team beantragen. Die Anfrage wird
--    in dieser Tabelle gespeichert; eine begleitende Edge Function
--    (request-price-change) sendet eine Admin-E-Mail mit Direkt-Link.
--    Pro Inserat darf maximal 1 'pending' Anfrage gleichzeitig existieren.
--
-- Beide Funktionen sind defense-in-depth zur AGB §6.4 c) Reduktionsboden-Logik.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A) RPC update_listing_prices_in_draft
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
    RAISE EXCEPTION 'Keine Berechtigung für dieses Inserat' USING ERRCODE = '42501';
  END IF;

  SELECT id, status
    INTO v_auction
    FROM public.auctions
   WHERE motorhome_id = p_motorhome_id
   ORDER BY created_at DESC
   LIMIT 1;
  v_has_auction := FOUND;

  IF v_has_auction AND v_auction.status <> 'draft' THEN
    RAISE EXCEPTION 'Preisänderung nur im Entwurfs-Status möglich. Bitte stellen Sie eine Anfrage über das Dashboard.'
      USING ERRCODE = '42501';
  END IF;

  -- Effektiver Mindestpreis: bei Sofortkauf wird er auf instant_price gesetzt,
  -- sonst auf p_new_reserve (Auktion). Spiegelt die Wizard- und ListingEdit-Logik.
  v_effective_reserve := COALESCE(p_new_instant, p_new_reserve);

  IF v_motorhome.sale_channel = 'auction'
     AND (v_effective_reserve IS NULL OR v_effective_reserve <= 0) THEN
    RAISE EXCEPTION 'Mindestpreis ist Pflicht für Auktions-Inserate (AGB §6.4 c).'
      USING ERRCODE = '23514';
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
           seller_initial_instant_price = p_new_instant
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
      'sale_channel', v_motorhome.sale_channel,
      'auction_id', v_auction.id
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'effective_reserve', v_effective_reserve,
    'instant_price', p_new_instant,
    'auction_id', v_auction.id
  );
END
$$;

REVOKE ALL ON FUNCTION public.update_listing_prices_in_draft(uuid, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_listing_prices_in_draft(uuid, numeric, numeric) TO authenticated;

COMMENT ON FUNCTION public.update_listing_prices_in_draft(uuid, numeric, numeric) IS
  'Self-Service-RPC für Verkäufer: Mindestpreis/Sofortpreis ändern, solange Auktion=draft. Synchronisiert atomar motorhomes + auctions. SECURITY DEFINER weil auctions kein UPDATE-Policy für Verkäufer hat.';

-- -----------------------------------------------------------------------------
-- B) Tabelle price_change_requests
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.price_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  motorhome_id uuid NOT NULL REFERENCES public.motorhomes(id) ON DELETE CASCADE,
  auction_id uuid REFERENCES public.auctions(id) ON DELETE SET NULL,
  current_reserve numeric,
  current_instant numeric,
  requested_reserve numeric,
  requested_instant numeric,
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 1000),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'applied', 'rejected')),
  admin_note text,
  processed_at timestamptz,
  processed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT pcr_at_least_one_value
    CHECK (requested_reserve IS NOT NULL OR requested_instant IS NOT NULL),
  CONSTRAINT pcr_positive_values
    CHECK (
      (requested_reserve IS NULL OR requested_reserve > 0) AND
      (requested_instant IS NULL OR requested_instant > 0)
    )
);

ALTER TABLE public.price_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can read own price change requests"
  ON public.price_change_requests
  FOR SELECT
  USING (seller_id = (SELECT auth.uid()));

CREATE POLICY "Sellers can create own price change requests"
  ON public.price_change_requests
  FOR INSERT
  WITH CHECK (seller_id = (SELECT auth.uid()));

CREATE POLICY "Admins manage all price change requests"
  ON public.price_change_requests
  FOR ALL
  USING (public.has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::app_role));

-- Maximal 1 pending Anfrage pro Inserat – verhindert Spam und doppelte Bearbeitung.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pcr_motorhome_pending
  ON public.price_change_requests(motorhome_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_pcr_seller
  ON public.price_change_requests(seller_id, status);

CREATE INDEX IF NOT EXISTS idx_pcr_status_created
  ON public.price_change_requests(status, created_at DESC);

-- updated_at auto-update Trigger
CREATE OR REPLACE FUNCTION public.touch_price_change_requests_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_pcr_touch_updated_at ON public.price_change_requests;
CREATE TRIGGER trg_pcr_touch_updated_at
  BEFORE UPDATE ON public.price_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_price_change_requests_updated_at();

COMMENT ON TABLE public.price_change_requests IS
  'Verkäufer-Anfragen zur Preisänderung wenn das Inserat live ist (active/kaufchance). Verarbeitung manuell durch Admin per Dashboard/Email. Max. 1 pending pro Inserat (uniq_pcr_motorhome_pending).';

-- Audit-Eintrag.
INSERT INTO public.audit_logs (action, entity_type, entity_id, details)
VALUES (
  'feature_added',
  'system',
  NULL,
  jsonb_build_object(
    'feature', 'seller_self_service_prices',
    'components', jsonb_build_array(
      'rpc:update_listing_prices_in_draft',
      'table:price_change_requests',
      'edge_function:request-price-change'
    ),
    'reason', 'Verkaeufer-Self-Service nach AGB v7 Pflicht-Mindestpreis Hardening (UX-Recovery).'
  )
);
