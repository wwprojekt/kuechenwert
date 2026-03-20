-- Update site_settings to use the exact beautiful orange gradient from the design
UPDATE public.site_settings
SET 
  primary_color = '16 100 60',  -- Beautiful orange HSL matching gradient-hero
  secondary_color = '210 24 16'  -- Dark blue secondary
WHERE id = '00000000-0000-0000-0000-000000000000';