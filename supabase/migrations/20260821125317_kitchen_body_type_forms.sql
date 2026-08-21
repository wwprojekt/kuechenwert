-- Allow kitchens.body_type to store kitchen layouts used by /kaufen filters
-- and the dealer listing form. Existing caravan enum values stay for old rows.

ALTER TYPE public.kitchen_body_type ADD VALUE IF NOT EXISTS 'L-Form';
ALTER TYPE public.kitchen_body_type ADD VALUE IF NOT EXISTS 'U-Form';
ALTER TYPE public.kitchen_body_type ADD VALUE IF NOT EXISTS 'Kochinsel';
ALTER TYPE public.kitchen_body_type ADD VALUE IF NOT EXISTS 'Einzelzeile';
ALTER TYPE public.kitchen_body_type ADD VALUE IF NOT EXISTS 'Zweizeilig';
ALTER TYPE public.kitchen_body_type ADD VALUE IF NOT EXISTS 'G-Form';
