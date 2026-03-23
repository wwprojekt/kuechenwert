-- ============================================================================
-- Migration: Add customer_number to profiles and invoices
-- Date: 2026-03-23
-- Description: 
--   1. Add customer_number column to profiles (unique, auto-generated)
--   2. Add customer_number column to invoices (copied from dealer at invoice time)
--   3. Create a sequence for customer numbers
--   4. Create a trigger to auto-assign customer numbers on profile creation
--   5. Backfill existing profiles with customer numbers
--   6. Update create_auction_invoice and create_instant_buy_invoice to include customer_number
-- ============================================================================

-- 1. Add customer_number to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS customer_number TEXT UNIQUE;

-- 2. Add customer_number to invoices (denormalized for historical accuracy)
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS customer_number TEXT;

-- 3. Create sequence for customer numbers (format: KD-100001, KD-100002, ...)
CREATE SEQUENCE IF NOT EXISTS public.customer_number_seq
  START WITH 100001
  INCREMENT BY 1
  NO MAXVALUE
  NO CYCLE;

-- 4. Function to generate customer number
CREATE OR REPLACE FUNCTION public.generate_customer_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN 'KD-' || nextval('public.customer_number_seq')::TEXT;
END;
$$;

-- 5. Trigger function: auto-assign customer_number on profile insert
CREATE OR REPLACE FUNCTION public.auto_assign_customer_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.customer_number IS NULL THEN
    NEW.customer_number := generate_customer_number();
  END IF;
  RETURN NEW;
END;
$$;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS trg_auto_customer_number ON public.profiles;
CREATE TRIGGER trg_auto_customer_number
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_customer_number();

-- 6. Backfill existing profiles that don't have a customer_number
UPDATE public.profiles
SET customer_number = generate_customer_number()
WHERE customer_number IS NULL;

-- 7. Update create_auction_invoice to include customer_number
CREATE OR REPLACE FUNCTION public.create_auction_invoice(
  auction_id_param UUID,
  dealer_id_param UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auction RECORD;
  v_commission NUMERIC;
  v_tax_rate NUMERIC := 19;
  v_tax_amount NUMERIC;
  v_gross_amount NUMERIC;
  v_invoice_id UUID;
  v_invoice_number TEXT;
  v_due_date TIMESTAMP;
  v_payment_terms INTEGER := 14;
  v_customer_number TEXT;
  v_settings RECORD;
BEGIN
  -- Auth check: allow service_role or admin
  IF NOT (
    auth.role() = 'service_role' OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get auction details
  SELECT a.*, m.manufacturer, m.model, m.seller_id
  INTO v_auction
  FROM public.auctions a
  JOIN public.motorhomes m ON m.id = a.motorhome_id
  WHERE a.id = auction_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auction not found';
  END IF;

  -- Get customer number from dealer profile
  SELECT customer_number INTO v_customer_number
  FROM public.profiles
  WHERE id = dealer_id_param;

  -- Get payment terms from settings
  SELECT invoice_payment_terms_days INTO v_payment_terms
  FROM public.site_settings
  LIMIT 1;
  
  IF v_payment_terms IS NULL THEN
    v_payment_terms := 14;
  END IF;

  -- Calculate commission
  SELECT commission_amount INTO v_commission
  FROM public.calculate_commission(v_auction.current_bid);

  -- Calculate tax
  v_tax_amount := ROUND(v_commission * (v_tax_rate / 100), 2);
  v_gross_amount := v_commission + v_tax_amount;

  -- Generate invoice number
  v_invoice_number := generate_invoice_number();

  -- Calculate due date
  v_due_date := NOW() + (v_payment_terms || ' days')::INTERVAL;

  -- Create invoice
  INSERT INTO public.invoices (
    invoice_number, dealer_id, auction_id, customer_number,
    invoice_date, due_date, payment_terms_days,
    net_amount, tax_rate, tax_amount, gross_amount,
    sale_price, commission_rate,
    status, payment_status,
    ust_id_seller
  ) VALUES (
    v_invoice_number, dealer_id_param, auction_id_param, v_customer_number,
    NOW(), v_due_date, v_payment_terms,
    v_commission, v_tax_rate, v_tax_amount, v_gross_amount,
    v_auction.current_bid, 
    CASE 
      WHEN v_auction.current_bid > 0 THEN ROUND((v_commission / v_auction.current_bid) * 100, 2)
      ELSE 0
    END,
    'created', 'pending',
    (SELECT ust_id FROM public.site_settings LIMIT 1)
  )
  RETURNING id INTO v_invoice_id;

  -- Create invoice item
  INSERT INTO public.invoice_items (
    invoice_id, description, quantity, unit_price,
    net_amount, tax_rate, tax_amount, gross_amount,
    item_type
  ) VALUES (
    v_invoice_id,
    'Vermittlungsprovision: ' || v_auction.manufacturer || ' ' || v_auction.model || 
    ' (Verkaufspreis: ' || TO_CHAR(v_auction.current_bid, 'FM999G999G999D00') || ' €)',
    1, v_commission,
    v_commission, v_tax_rate, v_tax_amount, v_gross_amount,
    'commission'
  );

  -- Log
  INSERT INTO public.audit_log (action, entity_type, entity_id, details)
  VALUES ('invoice_created', 'invoice', v_invoice_id, jsonb_build_object(
    'invoice_number', v_invoice_number,
    'customer_number', v_customer_number,
    'dealer_id', dealer_id_param,
    'auction_id', auction_id_param,
    'gross_amount', v_gross_amount
  ));

  RETURN v_invoice_id;
END;
$$;

-- 8. Update create_instant_buy_invoice to include customer_number
CREATE OR REPLACE FUNCTION public.create_instant_buy_invoice(
  auction_id_param UUID,
  dealer_id_param UUID,
  sale_price_param NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auction RECORD;
  v_commission NUMERIC;
  v_tax_rate NUMERIC := 19;
  v_tax_amount NUMERIC;
  v_gross_amount NUMERIC;
  v_invoice_id UUID;
  v_invoice_number TEXT;
  v_due_date TIMESTAMP;
  v_payment_terms INTEGER := 14;
  v_customer_number TEXT;
BEGIN
  -- Auth check: allow service_role or admin
  IF NOT (
    auth.role() = 'service_role' OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get auction details
  SELECT a.*, m.manufacturer, m.model
  INTO v_auction
  FROM public.auctions a
  JOIN public.motorhomes m ON m.id = a.motorhome_id
  WHERE a.id = auction_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auction not found';
  END IF;

  -- Get customer number from dealer profile
  SELECT customer_number INTO v_customer_number
  FROM public.profiles
  WHERE id = dealer_id_param;

  -- Get payment terms from settings
  SELECT invoice_payment_terms_days INTO v_payment_terms
  FROM public.site_settings
  LIMIT 1;
  
  IF v_payment_terms IS NULL THEN
    v_payment_terms := 14;
  END IF;

  -- Calculate commission
  SELECT commission_amount INTO v_commission
  FROM public.calculate_commission(sale_price_param);

  -- Calculate tax
  v_tax_amount := ROUND(v_commission * (v_tax_rate / 100), 2);
  v_gross_amount := v_commission + v_tax_amount;

  -- Generate invoice number
  v_invoice_number := generate_invoice_number();

  -- Calculate due date
  v_due_date := NOW() + (v_payment_terms || ' days')::INTERVAL;

  -- Create invoice
  INSERT INTO public.invoices (
    invoice_number, dealer_id, auction_id, customer_number,
    invoice_date, due_date, payment_terms_days,
    net_amount, tax_rate, tax_amount, gross_amount,
    sale_price, commission_rate,
    status, payment_status,
    ust_id_seller
  ) VALUES (
    v_invoice_number, dealer_id_param, auction_id_param, v_customer_number,
    NOW(), v_due_date, v_payment_terms,
    v_commission, v_tax_rate, v_tax_amount, v_gross_amount,
    sale_price_param,
    CASE 
      WHEN sale_price_param > 0 THEN ROUND((v_commission / sale_price_param) * 100, 2)
      ELSE 0
    END,
    'created', 'pending',
    (SELECT ust_id FROM public.site_settings LIMIT 1)
  )
  RETURNING id INTO v_invoice_id;

  -- Create invoice item
  INSERT INTO public.invoice_items (
    invoice_id, description, quantity, unit_price,
    net_amount, tax_rate, tax_amount, gross_amount,
    item_type
  ) VALUES (
    v_invoice_id,
    'Vermittlungsprovision (Sofortkauf): ' || v_auction.manufacturer || ' ' || v_auction.model ||
    ' (Kaufpreis: ' || TO_CHAR(sale_price_param, 'FM999G999G999D00') || ' €)',
    1, v_commission,
    v_commission, v_tax_rate, v_tax_amount, v_gross_amount,
    'commission'
  );

  -- Log
  INSERT INTO public.audit_log (action, entity_type, entity_id, details)
  VALUES ('invoice_created', 'invoice', v_invoice_id, jsonb_build_object(
    'invoice_number', v_invoice_number,
    'customer_number', v_customer_number,
    'dealer_id', dealer_id_param,
    'auction_id', auction_id_param,
    'sale_price', sale_price_param,
    'gross_amount', v_gross_amount,
    'type', 'instant_buy'
  ));

  RETURN v_invoice_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.generate_customer_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_customer_number() TO service_role;
GRANT USAGE ON SEQUENCE public.customer_number_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.customer_number_seq TO service_role;
