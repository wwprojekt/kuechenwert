-- =============================================================================
-- Hardening v2: NULL-Bypass der Lower-Only-Regel schliessen
--
-- Deep-Review der Migration 20260425170000 hat weitere Bypaesse gefunden:
--
--   A) NULL-Roundtrip (station/andere NULL-erlaubende Channels):
--        UPDATE motorhomes SET reserve_price = NULL WHERE id = ?;
--        UPDATE motorhomes SET reserve_price = 999999 WHERE id = ?;
--      Trigger 20260425170000 prueft nur NEW > OLD mit beiden non-null.
--      OLD=NULL nach Schritt 1 -> Schritt 2 passiert ungehindert.
--
--   B) Sale-Channel-Switch + NULL fuer auction-Listings:
--        UPDATE motorhomes SET sale_channel = 'station',
--               reserve_price = NULL WHERE id = ?;
--      CHECK-Constraint "motorhomes_auction_requires_reserve" ist NOT VALID
--      und laesst Channel-Wechsel mit NULL durch -> dann Raise wie (A).
--
-- Fix: Zwei persistente "Boden"-Spalten pro Preisfeld. Der Boden folgt dem
-- Minimum, das der Seller jemals gesetzt hat. Admin kann den Boden
-- explizit neu definieren (z.B. bei Support-Eskalation). Jede Update-
-- Operation durch einen regulaeren Seller wird gegen den Boden geprueft,
-- egal ob reserve_price vorher NULL war oder nicht.
--
-- Semantik:
--   - Service-Role / Migration (auth.uid() IS NULL): frei
--   - Admin (has_role='admin'): frei, Boden wird auf NEW.price zurueckgesetzt
--     (Support-Raise ist erlaubt und aendert die Baseline fuer den Seller)
--   - Seller: NEW.price darf nicht > OLD.floor sein; Boden wird nachgezogen
--     (LEAST). NEW.price=NULL belaesst den Boden, verhindert aber den spaeteren
--     Raise-Versuch ueber den Boden.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Schema: Floor-Spalten
-- -----------------------------------------------------------------------------
ALTER TABLE public.motorhomes
  ADD COLUMN IF NOT EXISTS reserve_price_floor NUMERIC,
  ADD COLUMN IF NOT EXISTS instant_price_floor NUMERIC;

COMMENT ON COLUMN public.motorhomes.reserve_price_floor IS
  'Niedrigster Mindestpreis, den der Verkaeufer seit Listing-Erstellung eingestellt hat. Trigger enforce_seller_price_lower_only blockt UPDATEs auf reserve_price, die > reserve_price_floor sind. Admin-UPDATEs aktualisieren den Boden auf NEW.reserve_price.';

COMMENT ON COLUMN public.motorhomes.instant_price_floor IS
  'Analog zu reserve_price_floor, aber fuer instant_price (Sofortkauf).';

-- Backfill: existierende Listings initial mit aktuellem Preis als Boden
UPDATE public.motorhomes
   SET reserve_price_floor = reserve_price
 WHERE reserve_price IS NOT NULL
   AND reserve_price_floor IS NULL;

UPDATE public.motorhomes
   SET instant_price_floor = instant_price
 WHERE instant_price IS NOT NULL
   AND instant_price_floor IS NULL;

-- -----------------------------------------------------------------------------
-- Trigger-Funktion neu schreiben
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_seller_price_lower_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
BEGIN
  -- Service-Role / kein JWT (Crons, Migrationen, Backfills).
  IF v_uid IS NULL THEN
    IF TG_OP = 'INSERT' THEN
      -- Boden nur setzen, wenn nicht explizit mitgegeben.
      IF NEW.reserve_price_floor IS NULL AND NEW.reserve_price IS NOT NULL THEN
        NEW.reserve_price_floor := NEW.reserve_price;
      END IF;
      IF NEW.instant_price_floor IS NULL AND NEW.instant_price IS NOT NULL THEN
        NEW.instant_price_floor := NEW.instant_price;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  BEGIN
    v_is_admin := public.has_role(v_uid, 'admin'::public.app_role);
  EXCEPTION WHEN OTHERS THEN
    v_is_admin := false;
  END;

  IF v_is_admin THEN
    -- Admin-Pfad: Boden an NEW.price ausrichten (Baseline-Reset bei Support-Raise),
    -- ausser Admin hat den Boden explizit geschrieben.
    IF TG_OP = 'INSERT' THEN
      IF NEW.reserve_price_floor IS NULL AND NEW.reserve_price IS NOT NULL THEN
        NEW.reserve_price_floor := NEW.reserve_price;
      END IF;
      IF NEW.instant_price_floor IS NULL AND NEW.instant_price IS NOT NULL THEN
        NEW.instant_price_floor := NEW.instant_price;
      END IF;
    ELSE
      -- UPDATE: wenn Admin die Floor-Spalten nicht selbst angefasst hat,
      -- Boden = NEW.price (Raise erlaubt, Seller sieht neuen Baseline).
      IF NEW.reserve_price_floor IS NOT DISTINCT FROM OLD.reserve_price_floor THEN
        NEW.reserve_price_floor := NEW.reserve_price;
      END IF;
      IF NEW.instant_price_floor IS NOT DISTINCT FROM OLD.instant_price_floor THEN
        NEW.instant_price_floor := NEW.instant_price;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Seller-Pfad -------------------------------------------------------------

  IF TG_OP = 'INSERT' THEN
    -- Seller legt neues Listing an: Boden = initialer Preis.
    NEW.reserve_price_floor := NEW.reserve_price;
    NEW.instant_price_floor := NEW.instant_price;
    RETURN NEW;
  END IF;

  -- UPDATE: Raise gegen Boden pruefen.
  IF NEW.reserve_price IS NOT NULL
     AND OLD.reserve_price_floor IS NOT NULL
     AND NEW.reserve_price > OLD.reserve_price_floor THEN
    RAISE EXCEPTION 'Mindestpreis kann nur gesenkt, nicht erhoeht werden (Boden: %, neu: %).',
      OLD.reserve_price_floor, NEW.reserve_price
      USING ERRCODE = '23514';
  END IF;

  IF NEW.instant_price IS NOT NULL
     AND OLD.instant_price_floor IS NOT NULL
     AND NEW.instant_price > OLD.instant_price_floor THEN
    RAISE EXCEPTION 'Sofortpreis kann nur gesenkt, nicht erhoeht werden (Boden: %, neu: %).',
      OLD.instant_price_floor, NEW.instant_price
      USING ERRCODE = '23514';
  END IF;

  -- Seller darf Floor-Spalten nicht selbst manipulieren.
  NEW.reserve_price_floor := OLD.reserve_price_floor;
  NEW.instant_price_floor := OLD.instant_price_floor;

  -- Boden nachziehen: Minimum aus altem Boden und (neuem Preis, falls gesetzt).
  IF NEW.reserve_price IS NOT NULL THEN
    NEW.reserve_price_floor := LEAST(
      COALESCE(OLD.reserve_price_floor, NEW.reserve_price),
      NEW.reserve_price
    );
  END IF;
  IF NEW.instant_price IS NOT NULL THEN
    NEW.instant_price_floor := LEAST(
      COALESCE(OLD.instant_price_floor, NEW.instant_price),
      NEW.instant_price
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_seller_price_lower_only() IS
  'BEFORE INSERT OR UPDATE Trigger: blockt Preiserhoehungen durch Nicht-Admin-Seller gegen motorhomes.reserve_price_floor / instant_price_floor. Schliesst NULL-Roundtrip- und sale_channel-Switch-Bypass. Service-Role/Admin frei.';

-- -----------------------------------------------------------------------------
-- Trigger ersetzen (BEFORE UPDATE -> BEFORE INSERT OR UPDATE)
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_enforce_seller_price_lower_only ON public.motorhomes;

CREATE TRIGGER trg_enforce_seller_price_lower_only
  BEFORE INSERT OR UPDATE ON public.motorhomes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_seller_price_lower_only();

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
    'layer', 'db_trigger_v2_floor',
    'closed_bypasses', jsonb_build_array(
      'null_roundtrip',
      'sale_channel_switch_with_null'
    ),
    'schema_changes', jsonb_build_array(
      'motorhomes.reserve_price_floor',
      'motorhomes.instant_price_floor'
    ),
    'migration', '20260425180000_seller_price_floor_hardening.sql'
  )
);
