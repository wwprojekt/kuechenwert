
-- Fix 1: sale_type CHECK constraint to include 'kaufchance'
ALTER TABLE motorhomes DROP CONSTRAINT IF EXISTS motorhomes_sale_type_check;
ALTER TABLE motorhomes ADD CONSTRAINT motorhomes_sale_type_check 
  CHECK (sale_type = ANY (ARRAY['instant'::text, 'auction'::text, 'kaufchance'::text]));

-- Fix 2: Update the Pössl Concord Compact motorhome to 'sold'
UPDATE motorhomes SET 
  status = 'sold',
  sold_to = 'fbd5a9be-465e-4a57-8e85-eee21ab96af5',
  sold_at = '2026-04-11 09:03:55.344+00',
  sale_type = 'kaufchance'
WHERE id = '82f503c2-92db-414f-adb4-addfc179fc20';
