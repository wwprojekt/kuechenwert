
-- Add base_vehicle column to store chassis/platform info (e.g., "Fiat Ducato", "Mercedes Sprinter")
ALTER TABLE public.motorhomes ADD COLUMN IF NOT EXISTS base_vehicle text;

-- Add comment for documentation
COMMENT ON COLUMN public.motorhomes.base_vehicle IS 'Base vehicle / chassis platform (e.g., Fiat Ducato, Mercedes Sprinter, VW Crafter)';
