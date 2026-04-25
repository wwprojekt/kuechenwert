-- =============================================================================
-- Hardening v3: Cron-Reduktion muss Floor mit nach unten nehmen
--
-- Business-Logic-Bug in v2 (Migration 20260425180000):
--
--   Die dynamische Preisreduktion (AGB §6.4 c) laeuft als Service-Role
--   ueber einen Cron-Job, der auctions.reserve_price senkt. Der Trigger
--   sync_motorhome_reserve_from_auction propagiert die Reduktion auf
--   motorhomes.reserve_price. Der enforce_seller_price_lower_only-Trigger
--   laesst die Service-Role durch, updated aber den Floor NICHT.
--
--   Ergebnis: Nach einer Cron-Reduktion 50.000 -> 30.000 bleibt der Floor
--   bei 50.000. Der Seller kann dann auf 45.000 zurueckspringen (ueber
--   den cron-reduzierten Wert, aber unter dem alten Floor). Die Reduktion
--   nach AGB §6.4 c waere damit aushebelbar.
--
-- Fix: Service-Role-UPDATE zieht den Floor nach unten mit (LEAST), nie
-- nach oben. Admin-UPDATE darf die Baseline weiterhin bewusst neu setzen
-- (Support-Workflow). INSERT-Initialisierung bleibt wie gehabt.
-- =============================================================================

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
  -- Service-Role / kein JWT (Cron, Migrationen, Backfills, Admin-Scripts).
  IF v_uid IS NULL THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.reserve_price_floor IS NULL AND NEW.reserve_price IS NOT NULL THEN
        NEW.reserve_price_floor := NEW.reserve_price;
      END IF;
      IF NEW.instant_price_floor IS NULL AND NEW.instant_price IS NOT NULL THEN
        NEW.instant_price_floor := NEW.instant_price;
      END IF;
      RETURN NEW;
    END IF;

    -- UPDATE: Floor NUR nach unten mitziehen (Cron-Reduktion). Ein
    -- Service-Role-Raise aendert den Floor nicht automatisch; falls ein
    -- Admin-Script den Floor explizit anpassen will, kann es ihn direkt
    -- in der UPDATE-Anweisung setzen (dann uebernimmt der IS DISTINCT FROM
    -- Vergleich den gewuenschten Wert).
    IF NEW.reserve_price_floor IS NOT DISTINCT FROM OLD.reserve_price_floor THEN
      IF NEW.reserve_price IS NOT NULL THEN
        NEW.reserve_price_floor := LEAST(
          COALESCE(OLD.reserve_price_floor, NEW.reserve_price),
          NEW.reserve_price
        );
      ELSE
        NEW.reserve_price_floor := OLD.reserve_price_floor;
      END IF;
    END IF;
    IF NEW.instant_price_floor IS NOT DISTINCT FROM OLD.instant_price_floor THEN
      IF NEW.instant_price IS NOT NULL THEN
        NEW.instant_price_floor := LEAST(
          COALESCE(OLD.instant_price_floor, NEW.instant_price),
          NEW.instant_price
        );
      ELSE
        NEW.instant_price_floor := OLD.instant_price_floor;
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
    -- Admin-Pfad: Baseline darf neu gesetzt werden. Wenn Admin Floor nicht
    -- explizit anfasst, folgt er NEW.price (nach oben wie nach unten).
    IF TG_OP = 'INSERT' THEN
      IF NEW.reserve_price_floor IS NULL AND NEW.reserve_price IS NOT NULL THEN
        NEW.reserve_price_floor := NEW.reserve_price;
      END IF;
      IF NEW.instant_price_floor IS NULL AND NEW.instant_price IS NOT NULL THEN
        NEW.instant_price_floor := NEW.instant_price;
      END IF;
    ELSE
      IF NEW.reserve_price_floor IS NOT DISTINCT FROM OLD.reserve_price_floor THEN
        NEW.reserve_price_floor := NEW.reserve_price;
      END IF;
      IF NEW.instant_price_floor IS NOT DISTINCT FROM OLD.instant_price_floor THEN
        NEW.instant_price_floor := NEW.instant_price;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Seller-Pfad --------------------------------------------------------------

  IF TG_OP = 'INSERT' THEN
    NEW.reserve_price_floor := NEW.reserve_price;
    NEW.instant_price_floor := NEW.instant_price;
    RETURN NEW;
  END IF;

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

  -- Seller darf Floor nicht selbst manipulieren.
  NEW.reserve_price_floor := OLD.reserve_price_floor;
  NEW.instant_price_floor := OLD.instant_price_floor;

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
  'Lower-only Enforcement v3: Service-Role-Updates (Cron/AGB §6.4 c) ziehen den Floor nach unten mit, Admin darf Baseline neu setzen, Seller ist strikt auf Floor beschraenkt. Trigger: BEFORE INSERT OR UPDATE on motorhomes.';

-- Floor fuer bereits cron-reduzierte Listings re-syncen: falls der Floor
-- aktuell ueber dem tatsaechlichen reserve_price liegt (kann nur passieren,
-- wenn Migration v2 aktiv war und danach gesenkt wurde), Floor auf das
-- Minimum nachziehen.
UPDATE public.motorhomes
   SET reserve_price_floor = reserve_price
 WHERE reserve_price IS NOT NULL
   AND reserve_price_floor IS NOT NULL
   AND reserve_price < reserve_price_floor;

UPDATE public.motorhomes
   SET instant_price_floor = instant_price
 WHERE instant_price IS NOT NULL
   AND instant_price_floor IS NOT NULL
   AND instant_price < instant_price_floor;

INSERT INTO public.audit_logs (action, entity_type, entity_id, details)
VALUES (
  'feature_hardened',
  'system',
  NULL,
  jsonb_build_object(
    'feature', 'seller_price_lower_only',
    'layer', 'db_trigger_v3_cron_sync',
    'closed_bypasses', jsonb_build_array(
      'cron_reduction_rollback_by_seller'
    ),
    'migration', '20260425190000_seller_price_floor_track_cron_reduction.sql'
  )
);
