-- Phase 3 Database Migration
-- Adds country field, additional vehicle fields, equipment fields, and known defects

-- Issue 3.1: Country field for location filtering
ALTER TABLE motorhomes ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'DE';

-- Issue 3.5: Additional vehicle fields
ALTER TABLE motorhomes ADD COLUMN IF NOT EXISTS engine_displacement_ccm INTEGER;
ALTER TABLE motorhomes ADD COLUMN IF NOT EXISTS main_tires TEXT;
ALTER TABLE motorhomes ADD COLUMN IF NOT EXISTS second_tires TEXT;

-- Issue 3.6: Equipment fields for base vehicle
ALTER TABLE motorhomes ADD COLUMN IF NOT EXISTS has_airbag BOOLEAN DEFAULT FALSE;
ALTER TABLE motorhomes ADD COLUMN IF NOT EXISTS has_alarm BOOLEAN DEFAULT FALSE;
ALTER TABLE motorhomes ADD COLUMN IF NOT EXISTS has_swivel_seats BOOLEAN DEFAULT FALSE;
ALTER TABLE motorhomes ADD COLUMN IF NOT EXISTS has_esp BOOLEAN DEFAULT FALSE;

-- Issue 3.7: Known defects fields
ALTER TABLE motorhomes ADD COLUMN IF NOT EXISTS known_defects TEXT;
ALTER TABLE motorhomes ADD COLUMN IF NOT EXISTS no_known_defects BOOLEAN DEFAULT FALSE;

-- Create index on country for faster filtering
CREATE INDEX IF NOT EXISTS idx_motorhomes_country ON motorhomes(country);
