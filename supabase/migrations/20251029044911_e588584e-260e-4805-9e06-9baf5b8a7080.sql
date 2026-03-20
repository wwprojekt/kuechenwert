-- Create dealer_applications table for company verification
CREATE TABLE IF NOT EXISTS public.dealer_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  company_address TEXT NOT NULL,
  company_postal_code TEXT NOT NULL,
  company_city TEXT NOT NULL,
  tax_id TEXT NOT NULL,
  trade_license_number TEXT NOT NULL,
  contact_person_name TEXT NOT NULL,
  contact_person_position TEXT,
  phone TEXT NOT NULL,
  website TEXT,
  business_description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.dealer_applications ENABLE ROW LEVEL SECURITY;

-- Users can view their own applications
CREATE POLICY "Users can view own dealer applications"
ON public.dealer_applications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own application (only once)
CREATE POLICY "Users can submit dealer application"
ON public.dealer_applications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all applications
CREATE POLICY "Admins can view all dealer applications"
ON public.dealer_applications
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_dealer_applications_updated_at
BEFORE UPDATE ON public.dealer_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add dealer role to app_role enum if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t 
                 JOIN pg_enum e ON t.oid = e.enumtypid  
                 WHERE t.typname = 'app_role' AND e.enumlabel = 'dealer') THEN
    ALTER TYPE app_role ADD VALUE 'dealer';
  END IF;
END $$;