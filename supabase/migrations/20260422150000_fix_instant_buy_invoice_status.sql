-- BUGFIX: create_instant_buy_invoice fügt invoice mit status='created' ein,
-- aber der CHECK-Constraint invoices_status_check erlaubt nur:
--   'draft','sent','viewed','paid','overdue','cancelled'
-- → Constraint-Violation 23514, RPC schlägt fehl, KEINE Rechnung wird erstellt
-- (auch keine 'invoice_created' Audit-Spur).
-- Folge: instant-buy UND admin-sell-to-dealer haben seit Einführung des
-- Constraints stillschweigend keine Rechnungen mehr generiert. Die Auktion
-- wird zwar als sold markiert + Kaufvertrag erstellt, aber die
-- Provisionsrechnung an den Händler fehlt komplett.
--
-- Fix: 'created' → 'draft' (analog zu create_auction_invoice).

CREATE OR REPLACE FUNCTION public.create_instant_buy_invoice(
  auction_id_param UUID,
  dealer_id_param UUID,
  sale_price_param NUMERIC
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
  IF NOT (
    auth.role() = 'service_role' OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT a.*, m.manufacturer, m.model
  INTO v_auction
  FROM public.auctions a
  JOIN public.motorhomes m ON m.id = a.motorhome_id
  WHERE a.id = auction_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auction not found';
  END IF;

  SELECT customer_number INTO v_customer_number
  FROM public.profiles
  WHERE id = dealer_id_param;

  SELECT invoice_payment_terms_days INTO v_payment_terms
  FROM public.site_settings
  LIMIT 1;
  IF v_payment_terms IS NULL THEN
    v_payment_terms := 14;
  END IF;

  SELECT commission_amount INTO v_commission
  FROM public.calculate_commission(sale_price_param, dealer_id_param);

  SELECT * INTO tax_info FROM public.get_dealer_tax_info(dealer_id_param);

  v_tax_amount := ROUND(v_commission * (tax_info.tax_rate / 100), 2);
  v_gross_amount := v_commission + v_tax_amount;

  v_invoice_number := public.generate_invoice_number();
  v_due_date := NOW() + (v_payment_terms || ' days')::INTERVAL;

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
    'draft', 'pending',
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

COMMENT ON FUNCTION public.create_instant_buy_invoice(UUID, UUID, NUMERIC) IS
  'Creates a commission invoice for an instant-buy / admin-manual sale. '
  'Status starts at ''draft'' (was ''created'' which violated invoices_status_check). '
  'send-invoice-email transitions draft → sent.';
