
-- CRITICAL FIX: Parameter name mismatch between close-auction and create_auction_invoice
DROP FUNCTION IF EXISTS public.create_auction_invoice(UUID, UUID);

CREATE FUNCTION public.create_auction_invoice(
  auction_id_param UUID,
  dealer_id_param UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invoice_id UUID;
  commission_calc RECORD;
  auction_record RECORD;
  motorhome_record RECORD;
  tax_info RECORD;
  net_commission NUMERIC;
  v_tax_amount NUMERIC;
  gross_commission NUMERIC;
  sale_amount NUMERIC;
BEGIN
  IF auth.role() != 'service_role' AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: service_role or admin role required';
  END IF;

  SELECT * INTO auction_record FROM public.auctions WHERE id = auction_id_param;
  IF auction_record IS NULL THEN
    RAISE EXCEPTION 'Auction not found: %', auction_id_param;
  END IF;

  SELECT * INTO motorhome_record FROM public.motorhomes WHERE id = auction_record.motorhome_id;

  SELECT COALESCE(
    (SELECT b.amount FROM public.bids b
     WHERE b.auction_id = auction_id_param AND b.bidder_id = dealer_id_param
     ORDER BY b.amount DESC LIMIT 1),
    auction_record.current_bid
  ) INTO sale_amount;

  SELECT * INTO commission_calc FROM public.calculate_commission(sale_amount, dealer_id_param);
  net_commission := ROUND(commission_calc.commission_amount, 2);

  SELECT * INTO tax_info FROM public.get_dealer_tax_info(dealer_id_param);

  v_tax_amount := ROUND(net_commission * (tax_info.tax_rate / 100), 2);
  gross_commission := net_commission + v_tax_amount;

  INSERT INTO public.invoices (
    invoice_number, dealer_id, auction_id,
    status, net_amount, tax_rate, tax_amount, gross_amount,
    payment_terms_days, due_date, invoice_date, notes,
    reverse_charge, dealer_country
  ) VALUES (
    public.generate_invoice_number(),
    dealer_id_param, auction_id_param,
    'draft', net_commission, tax_info.tax_rate, v_tax_amount, gross_commission,
    14, NOW() + INTERVAL '14 days', CURRENT_DATE,
    CASE
      WHEN tax_info.is_reverse_charge THEN
        'Reverse Charge (§13b UStG): ' ||
        COALESCE(motorhome_record.manufacturer, '') || ' ' || COALESCE(motorhome_record.model, '')
      ELSE
        'Provision: ' ||
        COALESCE(motorhome_record.manufacturer, '') || ' ' || COALESCE(motorhome_record.model, '')
    END,
    tax_info.is_reverse_charge,
    tax_info.dealer_country
  )
  RETURNING id INTO invoice_id;

  INSERT INTO public.invoice_items (
    invoice_id, description, quantity, unit_price,
    net_amount, tax_rate, tax_amount, gross_amount
  ) VALUES (
    invoice_id,
    'Vermittlungsprovision - ' || COALESCE(motorhome_record.manufacturer, '') || ' ' || COALESCE(motorhome_record.model, ''),
    1, net_commission, net_commission, tax_info.tax_rate, v_tax_amount, gross_commission
  );

  RETURN invoice_id;
END;
$$;
