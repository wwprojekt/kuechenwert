-- Migration: Enforce one role per user
-- 
-- Changes:
-- 1. Update handle_new_user() to check user_type metadata and assign correct role
-- 2. Clean up existing users with multiple roles (keep the highest-priority role)
-- 3. Add unique constraint on user_roles(user_id) to enforce one role per user

-- Step 1: Update handle_new_user trigger to support dealer registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_type TEXT;
  _role app_role;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  
  -- Check user_type from registration metadata to assign correct role
  _user_type := NEW.raw_user_meta_data->>'user_type';
  
  IF _user_type = 'dealer' THEN
    _role := 'dealer';
  ELSE
    _role := 'seller';
  END IF;
  
  -- Assign single role to new user
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);
  
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
