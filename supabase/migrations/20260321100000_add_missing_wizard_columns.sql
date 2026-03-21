-- Add missing columns that are collected in the selling wizard but were not in the DB
ALTER TABLE public.motorhomes ADD COLUMN IF NOT EXISTS payload_kg integer;
ALTER TABLE public.motorhomes ADD COLUMN IF NOT EXISTS has_airbag boolean DEFAULT false;
ALTER TABLE public.motorhomes ADD COLUMN IF NOT EXISTS has_alarm boolean DEFAULT false;
ALTER TABLE public.motorhomes ADD COLUMN IF NOT EXISTS has_swivel_seats boolean DEFAULT false;
ALTER TABLE public.motorhomes ADD COLUMN IF NOT EXISTS has_esp boolean DEFAULT false;
ALTER TABLE public.motorhomes ADD COLUMN IF NOT EXISTS engine_displacement_ccm integer;
ALTER TABLE public.motorhomes ADD COLUMN IF NOT EXISTS main_tires text;
ALTER TABLE public.motorhomes ADD COLUMN IF NOT EXISTS second_tires text;
ALTER TABLE public.motorhomes ADD COLUMN IF NOT EXISTS first_registration text;
