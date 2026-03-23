-- Migration: Enforce one role per user + correct dealer registration flow
-- 
-- Changes:
-- 1. Update handle_new_user() to ALWAYS assign 'seller' role (even for dealer registrations)
--    Dealers only get the 'dealer' role AFTER admin approval via approve_dealer_application()
-- 2. If user_type = 'dealer', also create a dealer_application with status 'pending'
-- 3. Clean up existing users with multiple roles (keep the highest-priority role)
-- 4. Add unique constraint on user_roles(user_id) to enforce one role per user
-- 5. Fix approve_dealer_application() to use ON CONFLICT (user_id) instead of (user_id, role)

-- Step 1: Update handle_new_user trigger to support dealer registration
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

-- Step 2: Clean up users with multiple roles
-- For users with both 'seller' and 'dealer', remove 'seller' (dealer is higher priority)
DELETE FROM public.user_roles
WHERE user_id IN (
  SELECT user_id 
  FROM public.user_roles 
  GROUP BY user_id 
  HAVING COUNT(*) > 1
)
AND role = 'seller';

-- Step 3: Add unique constraint to enforce one role per user
-- First drop the old unique constraint that allowed multiple roles per user
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;

-- Add new constraint: only ONE role per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_one_per_user ON public.user_roles(user_id);

-- Step 4: Fix approve_dealer_application to work with the new unique constraint
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
  
  UPDATE public.dealer_applications
  SET 
    status = 'approved',
    reviewed_at = now(),
    reviewed_by = auth.uid()
  WHERE id = application_id_param;
  
  -- Remove existing role and insert dealer role
  -- Uses ON CONFLICT (user_id) to match the new unique index
  DELETE FROM public.user_roles
  WHERE user_id = app_record.user_id;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (app_record.user_id, 'dealer')
  ON CONFLICT (user_id) DO UPDATE SET role = 'dealer';
END;
$$;
