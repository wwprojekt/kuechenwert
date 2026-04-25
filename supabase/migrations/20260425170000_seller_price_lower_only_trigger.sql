-- =============================================================================
-- Hardening: BEFORE UPDATE Trigger auf public.motorhomes
--
-- Hintergrund:
--   Die RLS-Policy "Sellers can update own motorhomes" erlaubt Verkaeufern
--   ein direktes UPDATE auf ALLE Spalten ihres Inserats via PostgREST
--   (z.B. supabase.from('motorhomes').update({ reserve_price: 999999 })).
--   Die Guards in update_listing_prices_in_draft / seller_restart_listing
--   / request-price-change lassen sich dadurch komplett umgehen.
--
-- Fix:
--   BEFORE UPDATE OF reserve_price, instant_price auf motorhomes. Der
--   Trigger wirft 23514, wenn ein nicht-Admin-User (auth.uid() not null,
--   nicht has_role='admin') reserve_price oder instant_price strikt
--   erhoeht. Service-Role (auth.uid()=NULL) und Admins werden durchgelassen
--   -> Dynamic-Pricing-Cron, Admin-Edits, Migrationen bleiben frei.
--
-- AGB-Bezug: §6.4 c (Reduktionsboden-Logik).
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
  -- Service-Role (kein JWT) darf alles (Crons, Migrationen, Admin-RPCs).
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Admin via has_role darf alles (Support-Faelle, Admin-UI).
  BEGIN
    v_is_admin := public.has_role(v_uid, 'admin'::public.app_role);
  EXCEPTION WHEN OTHERS THEN
    v_is_admin := false;
  END;
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Regulaerer Verkaeufer: Preiserhoehung blockieren.
  IF NEW.reserve_price IS NOT NULL
     AND OLD.reserve_price IS NOT NULL
     AND NEW.reserve_price > OLD.reserve_price THEN
    RAISE EXCEPTION 'Mindestpreis kann nur gesenkt, nicht erhoeht werden (alt: %, neu: %).',
      OLD.reserve_price, NEW.reserve_price
      USING ERRCODE = '23514';
  END IF;

  IF NEW.instant_price IS NOT NULL
     AND OLD.instant_price IS NOT NULL
     AND NEW.instant_price > OLD.instant_price THEN
    RAISE EXCEPTION 'Sofortpreis kann nur gesenkt, nicht erhoeht werden (alt: %, neu: %).',
      OLD.instant_price, NEW.instant_price
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_seller_price_lower_only() IS
  'BEFORE-UPDATE-Trigger-Funktion: blockt Preiserhoehungen durch Nicht-Admin-User auf motorhomes.reserve_price / instant_price. Service-Role und Admins bleiben frei (Dynamic-Pricing-Cron, Admin-Edits, Support).';

DROP TRIGGER IF EXISTS trg_enforce_seller_price_lower_only ON public.motorhomes;

CREATE TRIGGER trg_enforce_seller_price_lower_only
  BEFORE UPDATE OF reserve_price, instant_price ON public.motorhomes
  FOR EACH ROW
  WHEN (
    NEW.reserve_price IS DISTINCT FROM OLD.reserve_price
    OR NEW.instant_price IS DISTINCT FROM OLD.instant_price
  )
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
    'layer', 'db_trigger',
    'reason', 'RLS Sellers-can-update policy erlaubte Direkt-UPDATE; Trigger schliesst Bypass.',
    'migration', '20260425170000_seller_price_lower_only_trigger.sql'
  )
);
