
-- FIX BUG-1: create_instant_buy_invoice referenziert 'audit_log' (Singular)
-- aber die Tabelle heißt 'audit_logs' (Plural).
-- Das führt dazu, dass die gesamte Transaktion fehlschlägt und
-- keine Rechnung beim Sofortkauf erstellt wird.

CREATE OR REPLACE FUNCTION public.create_instant_buy_invoice(
  auction_id_param uuid,
  dealer_id_param uuid,
  sale_price_param numeric
)
RETURNS uuid
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

  -- FIX: audit_log → audit_logs (Tabelle heißt audit_logs, nicht audit_log)
  INSERT INTO public.audit_logs (action, entity_type, entity_id, details)
  VALUES ('invoice_created', 'invoice', v_invoice_id::text, jsonb_build_object(
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
