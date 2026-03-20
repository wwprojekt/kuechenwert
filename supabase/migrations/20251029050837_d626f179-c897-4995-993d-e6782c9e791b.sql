-- Add status column to motorhomes table to track sold items
ALTER TABLE public.motorhomes ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold', 'pending'));

-- Add sold_to column to track buyer
ALTER TABLE public.motorhomes ADD COLUMN IF NOT EXISTS sold_to UUID REFERENCES auth.users(id);

-- Add sold_at column to track sale date
ALTER TABLE public.motorhomes ADD COLUMN IF NOT EXISTS sold_at TIMESTAMP WITH TIME ZONE;

-- Add sale_type column to track if it was instant or auction
ALTER TABLE public.motorhomes ADD COLUMN IF NOT EXISTS sale_type TEXT CHECK (sale_type IN ('instant', 'auction'));

-- Update existing RLS policies to respect status
DROP POLICY IF EXISTS "Anyone can view motorhomes" ON public.motorhomes;
CREATE POLICY "Anyone can view motorhomes" 
ON public.motorhomes 
FOR SELECT 
USING (true);