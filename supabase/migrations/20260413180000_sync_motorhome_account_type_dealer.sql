-- Keep motorhomes.account_type aligned with seller's platform role so listing badges
-- (Händler vs. Privat) stay correct. Fixes race where DealerListingCreate used
-- primaryRole === null before useUserRole finished loading → wrong "private" rows.

-- 1) Backfill existing rows
UPDATE public.motorhomes m
SET account_type = 'dealer'
FROM public.user_roles ur
WHERE ur.user_id = m.seller_id
  AND ur.role = 'dealer'::public.app_role
  AND (m.account_type IS DISTINCT FROM 'dealer');

-- 2) On insert / seller change: set dealer badge when seller has dealer role
CREATE OR REPLACE FUNCTION public.trg_sync_motorhome_account_type_from_seller()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.seller_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = NEW.seller_id
      AND ur.role = 'dealer'::public.app_role
  ) THEN
    NEW.account_type := 'dealer';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_motorhome_account_type_from_seller ON public.motorhomes;
CREATE TRIGGER trg_sync_motorhome_account_type_from_seller
  BEFORE INSERT OR UPDATE OF seller_id ON public.motorhomes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_motorhome_account_type_from_seller();

-- 3) When a user becomes a dealer, fix listings created earlier with wrong account_type
CREATE OR REPLACE FUNCTION public.trg_sync_motorhomes_when_dealer_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'dealer'::public.app_role THEN
    UPDATE public.motorhomes
    SET account_type = 'dealer'
    WHERE seller_id = NEW.user_id
      AND (account_type IS DISTINCT FROM 'dealer');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_motorhomes_when_dealer_role ON public.user_roles;
CREATE TRIGGER trg_sync_motorhomes_when_dealer_role
  AFTER INSERT OR UPDATE OF role ON public.user_roles FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_motorhomes_when_dealer_role();
