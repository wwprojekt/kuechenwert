-- Update site_settings to use the beautiful orange gradient
UPDATE public.site_settings
SET 
  primary_color = '25 95 53',  -- Beautiful orange HSL: hsl(25, 95%, 53%) = #FF6B35
  secondary_color = '210 40 98'  -- Keep the blue secondary
WHERE id = '00000000-0000-0000-0000-000000000000';