-- Extend sale_type CHECK constraint to include 'price_proposal' (Preisvorschlag accepted)
-- and 'handover' (complete-handover fallback when no prior sale_type exists).
ALTER TABLE motorhomes DROP CONSTRAINT IF EXISTS motorhomes_sale_type_check;
ALTER TABLE motorhomes ADD CONSTRAINT motorhomes_sale_type_check
  CHECK (sale_type = ANY (ARRAY['instant'::text, 'auction'::text, 'kaufchance'::text, 'price_proposal'::text, 'handover'::text]));
