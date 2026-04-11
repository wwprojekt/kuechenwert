
-- BUG 3: create_instant_buy_invoice ignoriert dealer_id bei calculate_commission
-- Fix: dealer_id_param an calculate_commission weitergeben
CREATE OR REPLACE FUNCTION public.create_instant_buy_invoice(
  auction_id_param UUID,
  dealer_id_param UUID,
  sale_price_param NUMERIC
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auction RECORD;
  v_commission NUMERIC;
  tax_info RECORD;
  v_tax_amount NUMERIC;
  v_gross_amount NUMERIC;
  v_invoice_id UUID;
  v_invoice_number TEXT;
  v_due_date TIMESTAMP;
  v_payment_terms INTEGER := 14;
  v_customer_number TEXT;
BEGIN
  -- Auth check
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

  -- Get customer number
  SELECT customer_number INTO v_customer_number
  FROM public.profiles
  WHERE id = dealer_id_param;

  -- Get payment terms
  SELECT invoice_payment_terms_days INTO v_payment_terms
  FROM public.site_settings
  LIMIT 1;
  IF v_payment_terms IS NULL THEN
    v_payment_terms := 14;
  END IF;

  -- Calculate commission WITH dealer_id for volume discounts (BUG 3 FIX)
  SELECT commission_amount INTO v_commission
  FROM public.calculate_commission(sale_price_param, dealer_id_param);

  -- Determine tax rate based on dealer country
  SELECT * INTO tax_info FROM public.get_dealer_tax_info(dealer_id_param);

  v_tax_amount := ROUND(v_commission * (tax_info.tax_rate / 100), 2);
  v_gross_amount := v_commission + v_tax_amount;

  v_invoice_number := public.generate_invoice_number();
  v_due_date := NOW() + (v_payment_terms || ' days')::INTERVAL;

  -- Create invoice
  INSERT INTO public.invoices (
    invoice_number, dealer_id, auction_id, customer_number,
    invoice_date, due_date, payment_terms_days,
    net_amount, tax_rate, tax_amount, gross_amount,
    status, payment_status, notes,
    reverse_charge, dealer_country
  ) VALUES (
    v_invoice_number, dealer_id_param, auction_id_param, v_customer_number,
    NOW(), v_due_date, v_payment_terms,
    v_commission, tax_info.tax_rate, v_tax_amount, v_gross_amount,
    'created', 'pending',
    CASE
      WHEN tax_info.is_reverse_charge THEN
        'Vermittlungsprovision Sofortkauf (Reverse Charge, §13b UStG): ' ||
        v_auction.manufacturer || ' ' || v_auction.model ||
        ' (Kaufpreis: ' || TO_CHAR(sale_price_param, 'FM999G999G999D00') || ' €)'
      ELSE
        'Vermittlungsprovision Sofortkauf: ' ||
        v_auction.manufacturer || ' ' || v_auction.model ||
        ' (Kaufpreis: ' || TO_CHAR(sale_price_param, 'FM999G999G999D00') || ' €)'
    END,
    tax_info.is_reverse_charge,
    tax_info.dealer_country
  )
  RETURNING id INTO v_invoice_id;

  -- Create invoice item
  INSERT INTO public.invoice_items (
    invoice_id, description, quantity, unit_price,
    net_amount, tax_rate, tax_amount, gross_amount
  ) VALUES (
    v_invoice_id,
    'Vermittlungsprovision (Sofortkauf): ' || v_auction.manufacturer || ' ' || v_auction.model ||
    ' (Kaufpreis: ' || TO_CHAR(sale_price_param, 'FM999G999G999D00') || ' €)',
    1, v_commission,
    v_commission, tax_info.tax_rate, v_tax_amount, v_gross_amount
  );

  -- Audit log
  INSERT INTO public.audit_logs (action, entity_type, entity_id, details)
  VALUES ('invoice_created', 'invoice', v_invoice_id::text, jsonb_build_object(
    'invoice_number', v_invoice_number,
    'customer_number', v_customer_number,
    'dealer_id', dealer_id_param,
    'auction_id', auction_id_param,
    'sale_price', sale_price_param,
    'gross_amount', v_gross_amount,
    'reverse_charge', tax_info.is_reverse_charge,
    'dealer_country', tax_info.dealer_country,
    'type', 'instant_buy'
  ));

  RETURN v_invoice_id;
END;
$$;

-- BUG 4: Top-Tier max_amount von 999.999 auf 99.999.999 erhöhen
UPDATE public.commission_tiers
SET max_amount = 99999999.00
WHERE min_amount = 40000.00 AND max_amount = 999999.00;
