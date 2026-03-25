-- ============================================================================
-- Migration: Create purchase_contracts table with sequential contract numbers
-- Date: 2026-03-25
-- Description:
--   1. Create purchase_contracts table to track all generated contracts
--   2. Create a sequence for sequential contract numbers (KV-YYYY-NNNNN)
--   3. Create a function to generate the next contract number
--   4. Add contract_number column to motorhomes (if not exists)
--   5. RLS policies for admin access
--   6. Indexes for performance
-- ============================================================================

-- 1. Create sequence for contract numbers (starting at 1)
CREATE SEQUENCE IF NOT EXISTS public.contract_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MAXVALUE
  NO CYCLE;

-- 2. Function to generate contract number in format KV-YYYY-NNNNN
CREATE OR REPLACE FUNCTION public.generate_contract_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year TEXT;
  v_seq INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM NOW())::TEXT;
  v_seq := nextval('public.contract_number_seq');
  RETURN 'KV-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');
END;
$$;

-- 3. Create purchase_contracts table
CREATE TABLE IF NOT EXISTS public.purchase_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number TEXT NOT NULL UNIQUE,
  auction_id UUID REFERENCES public.auctions(id) ON DELETE SET NULL,
  motorhome_id UUID REFERENCES public.motorhomes(id) ON DELETE SET NULL,
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  seller_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sale_price NUMERIC(12, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'amended')),
  contract_url TEXT,
  buyer_contract_url TEXT,
  storage_path TEXT,
  buyer_storage_path TEXT,
  buyer_customer_number TEXT,
  seller_name TEXT,
  buyer_name TEXT,
  vehicle_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  notes TEXT
);

-- 4. Add contract_number to motorhomes if not exists
ALTER TABLE public.motorhomes
ADD COLUMN IF NOT EXISTS contract_url TEXT;

ALTER TABLE public.motorhomes
ADD COLUMN IF NOT EXISTS contract_number TEXT;

-- 5. Enable RLS
ALTER TABLE public.purchase_contracts ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
-- Admin full access
CREATE POLICY "Admin full access to purchase_contracts"
  ON public.purchase_contracts FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Buyers can read their own contracts
CREATE POLICY "Buyers can read own purchase_contracts"
  ON public.purchase_contracts FOR SELECT
  USING (buyer_id = auth.uid());

-- Sellers can read their own contracts
CREATE POLICY "Sellers can read own purchase_contracts"
  ON public.purchase_contracts FOR SELECT
  USING (seller_id = auth.uid());

-- Service role full access (for Edge Functions)
CREATE POLICY "Service role full access to purchase_contracts"
  ON public.purchase_contracts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_purchase_contracts_auction_id ON public.purchase_contracts(auction_id);
CREATE INDEX IF NOT EXISTS idx_purchase_contracts_motorhome_id ON public.purchase_contracts(motorhome_id);
CREATE INDEX IF NOT EXISTS idx_purchase_contracts_buyer_id ON public.purchase_contracts(buyer_id);
CREATE INDEX IF NOT EXISTS idx_purchase_contracts_seller_id ON public.purchase_contracts(seller_id);
CREATE INDEX IF NOT EXISTS idx_purchase_contracts_status ON public.purchase_contracts(status);
CREATE INDEX IF NOT EXISTS idx_purchase_contracts_created_at ON public.purchase_contracts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_contracts_contract_number ON public.purchase_contracts(contract_number);

-- 8. Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_purchase_contracts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_purchase_contracts_updated_at ON public.purchase_contracts;
CREATE TRIGGER trg_update_purchase_contracts_updated_at
  BEFORE UPDATE ON public.purchase_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_purchase_contracts_updated_at();

-- 9. Grant permissions
GRANT EXECUTE ON FUNCTION public.generate_contract_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_contract_number() TO service_role;
GRANT USAGE ON SEQUENCE public.contract_number_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.contract_number_seq TO service_role;
GRANT ALL ON TABLE public.purchase_contracts TO authenticated;
GRANT ALL ON TABLE public.purchase_contracts TO service_role;
