-- Fix profiles_salutation_check to allow NULL and empty string
-- Previously only 'Herr', 'Frau', 'Divers' were allowed, causing errors
-- when users save their profile without selecting a salutation.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_salutation_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_salutation_check 
  CHECK (salutation IS NULL OR salutation = '' OR salutation = ANY (ARRAY['Herr'::text, 'Frau'::text, 'Divers'::text]));
