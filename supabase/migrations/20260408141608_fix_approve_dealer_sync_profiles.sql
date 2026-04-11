
-- =============================================================================
-- FIX 1: approve_dealer_application() syncs company data to profiles
-- FIX 9: Backfill existing approved dealers' profiles from dealer_applications
-- =============================================================================

-- Step 1: Rewrite approve_dealer_application to copy company data to profiles
CREATE OR REPLACE FUNCTION public.approve_dealer_application(application_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app_record RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  SELECT * INTO app_record
  FROM public.dealer_applications
  WHERE id = application_id_param;

  IF app_record IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  -- Update application status
  UPDATE public.dealer_applications
  SET
    status = 'approved',
    reviewed_at = now(),
    reviewed_by = auth.uid()
  WHERE id = application_id_param;

  -- Promote role: seller → dealer
  DELETE FROM public.user_roles WHERE user_id = app_record.user_id;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (app_record.user_id, 'dealer')
  ON CONFLICT (user_id) DO UPDATE SET role = 'dealer';

  -- Sync company data from dealer_applications → profiles
  -- This is essential for invoices which read from profiles
  UPDATE public.profiles
  SET
    account_type    = 'business',
    company_name    = COALESCE(NULLIF(app_record.company_name, ''), company_name),
    company_street  = COALESCE(NULLIF(app_record.company_address, '-'), company_street),
    company_zip     = CASE
                        WHEN app_record.company_postal_code = '00000' THEN company_zip
                        ELSE COALESCE(NULLIF(app_record.company_postal_code, ''), company_zip)
                      END,
    company_city    = CASE
                        WHEN app_record.company_city LIKE '%Wird vom%' THEN company_city
                        ELSE COALESCE(NULLIF(app_record.company_city, '-'), company_city)
                      END,
    company_country = CASE
                        WHEN app_record.country IS NOT NULL AND app_record.country != '' 
                        THEN app_record.country
                        ELSE COALESCE(company_country, 'DE')
                      END
  WHERE id = app_record.user_id;

  -- Create dealer level (Bronze start)
  INSERT INTO public.dealer_levels (dealer_id, level, total_bids, won_auctions, total_volume, points)
  VALUES (app_record.user_id, 'bronze', 0, 0, 0, 0)
  ON CONFLICT (dealer_id) DO NOTHING;
END;
$$;

-- Step 2: Backfill ALL existing approved dealers' profiles
-- Skip dummy values ('00000', 'Wird vom Händler ergänzt', '-')
UPDATE public.profiles p
SET
  company_name    = COALESCE(NULLIF(p.company_name, ''), da.company_name),
  company_street  = CASE
                      WHEN p.company_street IS NOT NULL AND p.company_street != '' THEN p.company_street
                      WHEN da.company_address = '-' THEN NULL
                      ELSE da.company_address
                    END,
  company_zip     = CASE
                      WHEN p.company_zip IS NOT NULL AND p.company_zip != '' THEN p.company_zip
                      WHEN da.company_postal_code = '00000' THEN NULL
                      ELSE da.company_postal_code
                    END,
  company_city    = CASE
                      WHEN p.company_city IS NOT NULL AND p.company_city != '' THEN p.company_city
                      WHEN da.company_city LIKE '%Wird vom%' THEN NULL
                      ELSE da.company_city
                    END,
  company_country = CASE
                      WHEN da.country IS NOT NULL AND da.country != '' THEN da.country
                      ELSE COALESCE(p.company_country, 'DE')
                    END,
  account_type    = 'business'
FROM public.dealer_applications da
WHERE da.user_id = p.id
  AND da.status = 'approved';
