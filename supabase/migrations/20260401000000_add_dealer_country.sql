-- Migration: Add country field to dealer_applications for EU-wide registration
-- 
-- Changes:
-- 1. Add country column (ISO 3166-1 alpha-2) to dealer_applications, default 'DE'
-- 2. Update handle_new_user() trigger to store country from registration metadata
-- 3. Add index on country for filtering

-- Step 1: Add country column
ALTER TABLE public.dealer_applications 
ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'DE';

COMMENT ON COLUMN public.dealer_applications.country IS 'ISO 3166-1 alpha-2 country code of the dealer (e.g. DE, AT, NL, FR)';

-- Step 2: Create index for country-based queries
CREATE INDEX IF NOT EXISTS idx_dealer_applications_country ON public.dealer_applications(country);

-- Step 3: Update handle_new_user trigger to include country
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_type TEXT;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, first_name, last_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'phone'
  );
  
  -- Check user_type from registration metadata
  _user_type := NEW.raw_user_meta_data->>'user_type';
  
  -- IMPORTANT: ALL new users start as 'seller'.
  -- Dealers only get the 'dealer' role AFTER admin approval via approve_dealer_application().
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'seller');
  
  -- If dealer registration, create dealer_application with status 'pending'
  IF _user_type = 'dealer' THEN
    INSERT INTO public.dealer_applications (
      user_id,
      company_name,
      company_address,
      company_postal_code,
      company_city,
      country,
      contact_person_name,
      contact_person_position,
      phone,
      website,
      legal_form,
      founded_year,
      status
    ) VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'company_name', 'Unbekannt'),
      COALESCE(NEW.raw_user_meta_data->>'company_address', '-'),
      COALESCE(NEW.raw_user_meta_data->>'company_postal_code', '00000'),
      COALESCE(NEW.raw_user_meta_data->>'company_city', '-'),
      COALESCE(NEW.raw_user_meta_data->>'country', 'DE'),
      COALESCE(NEW.raw_user_meta_data->>'contact_person_name',
               CONCAT_WS(' ', NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'last_name')),
      NEW.raw_user_meta_data->>'contact_person_position',
      COALESCE(NEW.raw_user_meta_data->>'phone', '-'),
      NEW.raw_user_meta_data->>'website',
      NEW.raw_user_meta_data->>'legal_form',
      CASE 
        WHEN NEW.raw_user_meta_data->>'founded_year' IS NOT NULL 
             AND NEW.raw_user_meta_data->>'founded_year' ~ '^\d+$'
        THEN (NEW.raw_user_meta_data->>'founded_year')::integer
        ELSE NULL
      END,
      'pending'
    );
  END IF;
  
  RETURN NEW;
END;
$$;
