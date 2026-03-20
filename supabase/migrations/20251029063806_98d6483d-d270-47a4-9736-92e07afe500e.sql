-- Fix profiles table RLS policy to prevent public data exposure
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create table to track PIN verification attempts for rate limiting
CREATE TABLE IF NOT EXISTS public.pin_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  attempt_count integer NOT NULL DEFAULT 1,
  last_attempt_at timestamp with time zone NOT NULL DEFAULT now(),
  locked_until timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on pin_attempts
ALTER TABLE public.pin_attempts ENABLE ROW LEVEL SECURITY;

-- Only admins can manage PIN attempts
CREATE POLICY "Admins can manage PIN attempts"
  ON public.pin_attempts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for efficient lookups
CREATE INDEX idx_pin_attempts_appointment_id ON public.pin_attempts(appointment_id);

-- Create index for cleanup queries
CREATE INDEX idx_pin_attempts_created_at ON public.pin_attempts(created_at);

-- Verify handle_new_user function has correct search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  
  -- Assign default 'seller' role to new users
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'seller');
  
  RETURN NEW;
END;
$$;