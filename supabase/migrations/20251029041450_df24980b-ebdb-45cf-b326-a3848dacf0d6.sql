-- Add new enum types for extended motorhome specifications
CREATE TYPE public.fuel_type AS ENUM ('Diesel', 'Benzin', 'Elektro', 'Hybrid');
CREATE TYPE public.transmission_type AS ENUM ('Schaltgetriebe', 'Automatik');
CREATE TYPE public.emission_class AS ENUM ('Euro 3', 'Euro 4', 'Euro 5', 'Euro 6', 'Euro 6c', 'Euro 6d-TEMP', 'Euro 6d');
CREATE TYPE public.heating_type AS ENUM ('Gas', 'Diesel', 'Elektrisch', 'Kombiniert');
CREATE TYPE public.refrigerator_type AS ENUM ('Kompressor', 'Absorber', 'Thermoelektrisch');
CREATE TYPE public.air_conditioning_type AS ENUM ('Keine', 'Fahrerhaus', 'Wohnraum', 'Beides');

-- Add comprehensive fields to motorhomes table
ALTER TABLE public.motorhomes
ADD COLUMN IF NOT EXISTS fuel_type fuel_type,
ADD COLUMN IF NOT EXISTS power_kw INTEGER,
ADD COLUMN IF NOT EXISTS power_ps INTEGER,
ADD COLUMN IF NOT EXISTS transmission transmission_type,
ADD COLUMN IF NOT EXISTS emission_class emission_class,
ADD COLUMN IF NOT EXISTS first_registration DATE,
ADD COLUMN IF NOT EXISTS last_tuev_date DATE,
ADD COLUMN IF NOT EXISTS next_tuev_date DATE,
ADD COLUMN IF NOT EXISTS previous_owners INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS accident_free BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS non_smoker BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS service_history_available BOOLEAN DEFAULT false,

-- Dimensions and weight
ADD COLUMN IF NOT EXISTS length_cm INTEGER,
ADD COLUMN IF NOT EXISTS width_cm INTEGER,
ADD COLUMN IF NOT EXISTS height_cm INTEGER,
ADD COLUMN IF NOT EXISTS total_weight_kg INTEGER,
ADD COLUMN IF NOT EXISTS payload_kg INTEGER,
ADD COLUMN IF NOT EXISTS number_of_axles INTEGER DEFAULT 2,

-- Seating and sleeping
ADD COLUMN IF NOT EXISTS seats_with_seatbelts INTEGER,
ADD COLUMN IF NOT EXISTS beds_description TEXT,

-- Kitchen and interior
ADD COLUMN IF NOT EXISTS has_kitchen BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS refrigerator_type refrigerator_type,
ADD COLUMN IF NOT EXISTS heating_type heating_type,
ADD COLUMN IF NOT EXISTS air_conditioning air_conditioning_type DEFAULT 'Keine',
ADD COLUMN IF NOT EXISTS has_toilet BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_shower BOOLEAN DEFAULT false,

-- Water and electricity
ADD COLUMN IF NOT EXISTS fresh_water_capacity_liters INTEGER,
ADD COLUMN IF NOT EXISTS grey_water_capacity_liters INTEGER,
ADD COLUMN IF NOT EXISTS fuel_tank_capacity_liters INTEGER,
ADD COLUMN IF NOT EXISTS solar_power_watts INTEGER,
ADD COLUMN IF NOT EXISTS battery_capacity_ah INTEGER,
ADD COLUMN IF NOT EXISTS has_inverter BOOLEAN DEFAULT false,

-- Exterior and technical equipment
ADD COLUMN IF NOT EXISTS awning_length_cm INTEGER,
ADD COLUMN IF NOT EXISTS has_bike_rack BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_garage BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_tv_sat BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_reversing_camera BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_parking_sensors BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_cruise_control BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_central_locking BOOLEAN DEFAULT false,

-- Additional details
ADD COLUMN IF NOT EXISTS vehicle_identification_number TEXT,
ADD COLUMN IF NOT EXISTS license_plate TEXT,
ADD COLUMN IF NOT EXISTS additional_equipment TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.motorhomes.power_kw IS 'Engine power in kilowatts';
COMMENT ON COLUMN public.motorhomes.power_ps IS 'Engine power in PS (Pferdestärken)';
COMMENT ON COLUMN public.motorhomes.total_weight_kg IS 'Zulässiges Gesamtgewicht in kg';
COMMENT ON COLUMN public.motorhomes.payload_kg IS 'Zuladung in kg';
COMMENT ON COLUMN public.motorhomes.last_tuev_date IS 'Last TÜV/HU inspection date';
COMMENT ON COLUMN public.motorhomes.next_tuev_date IS 'Next TÜV/HU inspection due date';
COMMENT ON COLUMN public.motorhomes.vehicle_identification_number IS 'Last 7 digits of VIN for verification';
COMMENT ON COLUMN public.motorhomes.beds_description IS 'Description of bed configuration (e.g., Queensbett, Einzelbetten, Hubbett)';
COMMENT ON COLUMN public.motorhomes.additional_equipment IS 'Additional equipment and features not covered by standard fields';