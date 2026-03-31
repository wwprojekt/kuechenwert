-- Add vehicle_type column to value_assessment_leads
-- Allows distinguishing between "Wohnmobil" and "Wohnwagen" leads
ALTER TABLE value_assessment_leads
  ADD COLUMN IF NOT EXISTS vehicle_type text DEFAULT NULL;

-- Drop constraint if it already exists (idempotent re-run safety)
ALTER TABLE value_assessment_leads
  DROP CONSTRAINT IF EXISTS value_assessment_leads_vehicle_type_check;

-- Add a check constraint to ensure only valid values
ALTER TABLE value_assessment_leads
  ADD CONSTRAINT value_assessment_leads_vehicle_type_check
  CHECK (vehicle_type IS NULL OR vehicle_type IN ('Wohnmobil', 'Wohnwagen'));

-- Comment for documentation
COMMENT ON COLUMN value_assessment_leads.vehicle_type IS 'Fahrzeugkategorie: Wohnmobil oder Wohnwagen';
