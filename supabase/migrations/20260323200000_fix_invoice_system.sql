-- ============================================================================
-- Migration: Fix Invoice System
-- Date: 2026-03-23
-- Description: 
--   1. Add missing columns to invoices table (invoice_date, payment_method, etc.)
--   2. Add missing columns to site_settings table (bank details, company info)
--   3. Add missing columns to payment_reminders table (for dunning process)
--   4. Fix create_auction_invoice RPC to work with service_role calls
--   5. Create invoices storage bucket for PDF files
-- ============================================================================

-- ─── 1. Add missing columns to invoices table ────────────────────────────────

-- invoice_date: Referenced by MyInvoices.tsx, send-invoice-email, process-dunning
ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS invoice_date date NOT NULL DEFAULT CURRENT_DATE;

-- payment_method: Referenced by RecordPaymentDialog, invoiceGenerator.ts
ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS payment_method text;

-- payment_reference: Referenced by RecordPaymentDialog, invoiceGenerator.ts
ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS payment_reference text;

-- ─── 2. Add missing columns to site_settings table ──────────────────────────

-- Bank details for invoice PDF and email
ALTER TABLE public.site_settings 
  ADD COLUMN IF NOT EXISTS bank_iban text;

ALTER TABLE public.site_settings 
  ADD COLUMN IF NOT EXISTS bank_bic text;

ALTER TABLE public.site_settings 
  ADD COLUMN IF NOT EXISTS bank_name text;

-- Company legal info for invoice footer
ALTER TABLE public.site_settings 
  ADD COLUMN IF NOT EXISTS ust_id text;

ALTER TABLE public.site_settings 
  ADD COLUMN IF NOT EXISTS tax_number text;

ALTER TABLE public.site_settings 
  ADD COLUMN IF NOT EXISTS managing_director text;

-- ─── 3. Add missing columns to payment_reminders table ──────────────────────

-- process-dunning inserts these fields but they don't exist
ALTER TABLE public.payment_reminders 
  ADD COLUMN IF NOT EXISTS original_amount numeric;

ALTER TABLE public.payment_reminders 
  ADD COLUMN IF NOT EXISTS reminder_fee numeric DEFAULT 0;

ALTER TABLE public.payment_reminders 
  ADD COLUMN IF NOT EXISTS total_amount numeric;

ALTER TABLE public.payment_reminders 
  ADD COLUMN IF NOT EXISTS subject text;

ALTER TABLE public.payment_reminders 
  ADD COLUMN IF NOT EXISTS message_body text;

-- process-dunning reads reminder_date but table has sent_at
-- Add reminder_date as alias (keep sent_at for backwards compat)
ALTER TABLE public.payment_reminders 
  ADD COLUMN IF NOT EXISTS reminder_date date;

-- ─── 4. Create invoices storage bucket ───────────────────────────────────────

-- Bucket for invoice PDFs (private - only accessible via signed URLs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices', 
  'invoices', 
  false,
  10485760, -- 10MB max
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Admins can upload/manage invoice PDFs
CREATE POLICY "Admins can manage invoice files"
ON storage.objects FOR ALL
USING (bucket_id = 'invoices' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'invoices' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Storage policy: Dealers can read their own invoice PDFs
-- (PDF URL contains dealer_id in path: invoices/{dealer_id}/...)
CREATE POLICY "Dealers can view own invoice files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'invoices' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage policy: Service role can manage all invoice files
CREATE POLICY "Service role can manage all invoice files"
ON storage.objects FOR ALL
USING (bucket_id = 'invoices' AND auth.role() = 'service_role')
WITH CHECK (bucket_id = 'invoices' AND auth.role() = 'service_role');

-- ─── 5. Fix create_auction_invoice RPC ───────────────────────────────────────
-- Problem: The function checks has_role(auth.uid(), 'admin') but is called
-- from close-auction with service_role key where auth.uid() is NULL.
-- Fix: Allow service_role calls (auth.role() = 'service_role') OR admin calls.
-- Also: Set invoice_date and include sale_amount for reference.

CREATE OR REPLACE FUNCTION public.create_auction_invoice(
  auction_id_param uuid, 
  dealer_id_param uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  invoice_id UUID;
  commission_calc RECORD;
  auction_record RECORD;
  net_commission NUMERIC;
  tax_amount NUMERIC;
  gross_commission NUMERIC;
  sale_amount NUMERIC;
BEGIN
  -- Allow service_role (from Edge Functions) OR admin users
  IF auth.role() != 'service_role' AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Unauthorized: service_role or admin role required';
  END IF;

  -- Fetch auction with motorhome details
  SELECT a.id, a.current_bid, a.reserve_price, a.status,
         m.manufacturer, m.model, m.seller_id, m.instant_price
  INTO auction_record
  FROM public.auctions a
  JOIN public.motorhomes m ON a.motorhome_id = m.id
  WHERE a.id = auction_id_param;
  
  IF auction_record IS NULL THEN
    RAISE EXCEPTION 'Auction not found';
  END IF;

  -- Determine sale amount (current_bid for auctions)
  sale_amount := auction_record.current_bid;
  
  IF sale_amount IS NULL OR sale_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid sale amount';
  END IF;
  
  -- Calculate commission based on sale amount and dealer tier
  SELECT * INTO commission_calc
  FROM public.calculate_commission(sale_amount, dealer_id_param);
  
  -- Split commission into net + tax (commission_amount is gross incl. 19% MwSt)
  net_commission := ROUND(commission_calc.commission_amount / 1.19, 2);
  tax_amount := ROUND(commission_calc.commission_amount - net_commission, 2);
  gross_commission := ROUND(commission_calc.commission_amount, 2);
  
  -- Create invoice
  INSERT INTO public.invoices (
    invoice_number, dealer_id, auction_id, invoice_date, due_date,
    net_amount, tax_rate, tax_amount, gross_amount, status, payment_status
  ) VALUES (
    public.generate_invoice_number(), 
    dealer_id_param, 
    auction_id_param,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '14 days',
    net_commission, 19.00, tax_amount, gross_commission, 
    'sent', 'pending'
  )
  RETURNING id INTO invoice_id;
  
  -- Create invoice line item
  INSERT INTO public.invoice_items (
    invoice_id, description, quantity, unit_price, net_amount,
    tax_rate, tax_amount, gross_amount, item_type, reference_id
  ) VALUES (
    invoice_id,
    'Vermittlungsprovision für: ' || auction_record.manufacturer || ' ' || auction_record.model 
      || ' (Verkaufspreis: €' || TO_CHAR(sale_amount, 'FM999,999,990.00') || ')',
    1, net_commission, net_commission, 19.00, tax_amount, gross_commission,
    'commission', auction_id_param
  );
  
  -- Log the invoice creation
  INSERT INTO public.audit_log (
    user_id, action, entity_type, entity_id, details
  ) VALUES (
    COALESCE(auth.uid(), dealer_id_param),
    'invoice_created',
    'invoice',
    invoice_id,
    jsonb_build_object(
      'invoice_number', (SELECT invoice_number FROM public.invoices WHERE id = invoice_id),
      'auction_id', auction_id_param,
      'dealer_id', dealer_id_param,
      'gross_amount', gross_commission,
      'sale_amount', sale_amount
    )
  );
  
  RETURN invoice_id;
END;
$function$;

-- ─── 6. Create function for instant-buy invoice creation ─────────────────────

CREATE OR REPLACE FUNCTION public.create_instant_buy_invoice(
  auction_id_param uuid, 
  dealer_id_param uuid,
  instant_price_param numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  invoice_id UUID;
  commission_calc RECORD;
  motorhome_record RECORD;
  net_commission NUMERIC;
  tax_amount NUMERIC;
  gross_commission NUMERIC;
BEGIN
  -- Allow service_role (from Edge Functions) OR admin users
  IF auth.role() != 'service_role' AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Unauthorized: service_role or admin role required';
  END IF;

  -- Fetch motorhome details via auction
  SELECT m.manufacturer, m.model
  INTO motorhome_record
  FROM public.auctions a
  JOIN public.motorhomes m ON a.motorhome_id = m.id
  WHERE a.id = auction_id_param;
  
  IF motorhome_record IS NULL THEN
    RAISE EXCEPTION 'Auction/Motorhome not found';
  END IF;
  
  -- Calculate commission based on instant buy price
  SELECT * INTO commission_calc
  FROM public.calculate_commission(instant_price_param, dealer_id_param);
  
  net_commission := ROUND(commission_calc.commission_amount / 1.19, 2);
  tax_amount := ROUND(commission_calc.commission_amount - net_commission, 2);
  gross_commission := ROUND(commission_calc.commission_amount, 2);
  
  -- Create invoice
  INSERT INTO public.invoices (
    invoice_number, dealer_id, auction_id, invoice_date, due_date,
    net_amount, tax_rate, tax_amount, gross_amount, status, payment_status
  ) VALUES (
    public.generate_invoice_number(), 
    dealer_id_param, 
    auction_id_param,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '14 days',
    net_commission, 19.00, tax_amount, gross_commission, 
    'sent', 'pending'
  )
  RETURNING id INTO invoice_id;
  
  -- Create invoice line item
  INSERT INTO public.invoice_items (
    invoice_id, description, quantity, unit_price, net_amount,
    tax_rate, tax_amount, gross_amount, item_type, reference_id
  ) VALUES (
    invoice_id,
    'Vermittlungsprovision für Sofortkauf: ' || motorhome_record.manufacturer || ' ' || motorhome_record.model 
      || ' (Kaufpreis: €' || TO_CHAR(instant_price_param, 'FM999,999,990.00') || ')',
    1, net_commission, net_commission, 19.00, tax_amount, gross_commission,
    'commission', auction_id_param
  );
  
  -- Log the invoice creation
  INSERT INTO public.audit_log (
    user_id, action, entity_type, entity_id, details
  ) VALUES (
    COALESCE(auth.uid(), dealer_id_param),
    'invoice_created',
    'invoice',
    invoice_id,
    jsonb_build_object(
      'invoice_number', (SELECT invoice_number FROM public.invoices WHERE id = invoice_id),
      'auction_id', auction_id_param,
      'dealer_id', dealer_id_param,
      'gross_amount', gross_commission,
      'sale_amount', instant_price_param,
      'sale_type', 'instant_buy'
    )
  );
  
  RETURN invoice_id;
END;
$function$;

-- ─── 7. Grant execute permissions ────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.create_auction_invoice(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_auction_invoice(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_instant_buy_invoice(uuid, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_instant_buy_invoice(uuid, uuid, numeric) TO service_role;
