-- Fix remaining functions with missing search_path
-- These functions need SECURITY DEFINER and search_path set

-- Fix update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix generate_release_pin
CREATE OR REPLACE FUNCTION public.generate_release_pin()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  pin TEXT;
BEGIN
  pin := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  RETURN pin;
END;
$$;