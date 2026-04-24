-- ================================================================
-- Lock approved dealers from self-editing profile master data
-- ================================================================
--
-- Context: After an admin approves a dealer application, the dealer's
-- identity / address / company data in public.profiles is the legal
-- foundation for invoices, commissions, and KYC. Dealers must not
-- silently change this data after approval — any change has to go
-- through the support team (info@caravanwert.de).
--
-- Frontend (src/pages/dashboard/UserProfile.tsx) already shows a
-- read-only UI for approved dealers. This migration adds a defense-
-- in-depth guard at the database level so a technically-savvy dealer
-- cannot bypass the UI lock by calling the Supabase REST API directly.
--
-- Approach: BEFORE UPDATE trigger that rejects a dealer's self-update
-- if any of the locked columns changes. Admins and service-role
-- callers are explicitly exempted. Non-sensitive technical columns
-- (avatar_url, latitude, longitude, description, website) remain
-- editable so unrelated features like useUserLocation keep working.
-- ================================================================

CREATE OR REPLACE FUNCTION public.prevent_dealer_self_edit_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_dealer boolean;
  v_is_admin boolean;
BEGIN
  -- Service-role / trigger-internal updates (auth.uid() is NULL): pass through.
  -- Admin edits of other users' profiles also pass through here since the
  -- caller's uid != NEW.id, so the self-edit guard does not apply.
  IF v_caller IS NULL OR v_caller <> NEW.id THEN
    RETURN NEW;
  END IF;

  -- Admin-of-their-own-profile edits: allow (admin is trusted).
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_caller AND role = 'admin'::app_role
  ) INTO v_is_admin;

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_caller AND role = 'dealer'::app_role
  ) INTO v_is_dealer;

  -- Non-dealers (private sellers, pending applicants still on 'seller' role):
  -- no restriction.
  IF NOT v_is_dealer THEN
    RETURN NEW;
  END IF;

  -- Approved dealer: reject if any locked master-data column changed.
  IF NEW.first_name       IS DISTINCT FROM OLD.first_name
     OR NEW.last_name     IS DISTINCT FROM OLD.last_name
     OR NEW.salutation    IS DISTINCT FROM OLD.salutation
     OR NEW.phone         IS DISTINCT FROM OLD.phone
     OR NEW.email         IS DISTINCT FROM OLD.email
     OR NEW.company_name  IS DISTINCT FROM OLD.company_name
     OR NEW.account_type  IS DISTINCT FROM OLD.account_type
     OR NEW.address_street  IS DISTINCT FROM OLD.address_street
     OR NEW.address_zip     IS DISTINCT FROM OLD.address_zip
     OR NEW.address_city    IS DISTINCT FROM OLD.address_city
     OR NEW.address_country IS DISTINCT FROM OLD.address_country
     OR NEW.company_street  IS DISTINCT FROM OLD.company_street
     OR NEW.company_zip     IS DISTINCT FROM OLD.company_zip
     OR NEW.company_city    IS DISTINCT FROM OLD.company_city
     OR NEW.company_country IS DISTINCT FROM OLD.company_country
     OR NEW.tax_id          IS DISTINCT FROM OLD.tax_id
     OR NEW.vat_id          IS DISTINCT FROM OLD.vat_id
     OR NEW.trade_license   IS DISTINCT FROM OLD.trade_license
  THEN
    RAISE EXCEPTION 'DEALER_PROFILE_LOCKED: Haendler-Stammdaten koennen nur durch den Support geaendert werden (info@caravanwert.de).'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.prevent_dealer_self_edit_profile IS
  'Blocks approved dealers from self-editing identity, address, and company columns on their own profile row. Admins and service-role callers bypass the check. Frontend mirror: src/pages/dashboard/UserProfile.tsx (isLocked = isDealer).';

DROP TRIGGER IF EXISTS trg_prevent_dealer_self_edit_profile ON public.profiles;

CREATE TRIGGER trg_prevent_dealer_self_edit_profile
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_dealer_self_edit_profile();
