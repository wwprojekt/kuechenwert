
-- =============================================================================
-- FIX 2: Reverse Charge for EU dealers (non-DE)
-- FIX 7: Add vat_id to dealer_applications for USt-ID
-- Also fixes: create_instant_buy_invoice referencing non-existent columns
-- =============================================================================

-- Step 1: Add reverse_charge + dealer_country to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS reverse_charge BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dealer_country TEXT DEFAULT 'DE';

COMMENT ON COLUMN public.invoices.reverse_charge IS 'True for EU B2B invoices outside Germany (0% VAT, §13b UStG)';
COMMENT ON COLUMN public.invoices.dealer_country IS 'Country code of the dealer at time of invoice creation';

-- Step 2: Add vat_id to dealer_applications for USt-ID storage
ALTER TABLE public.dealer_applications
  ADD COLUMN IF NOT EXISTS vat_id TEXT;

COMMENT ON COLUMN public.dealer_applications.vat_id IS 'EU VAT ID (USt-IdNr) for reverse charge invoicing, e.g. ATU12345678';

-- Step 3: Also add vat_id to profiles (synced on approval)
-- profiles.tax_id already exists but is used for Steuernummer, not USt-ID
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vat_id TEXT;

COMMENT ON COLUMN public.profiles.vat_id IS 'EU VAT ID (USt-IdNr) for reverse charge invoicing';

-- Step 4: Helper function to determine tax rate based on dealer country
CREATE OR REPLACE FUNCTION public.get_dealer_tax_info(p_dealer_id UUID)
RETURNS TABLE(tax_rate NUMERIC, is_reverse_charge BOOLEAN, dealer_country TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_country TEXT;
BEGIN
  -- Get country from profiles (synced from dealer_applications on approval)
  SELECT COALESCE(p.company_country, da.country, 'DE')
  INTO v_country
  FROM public.profiles p
  LEFT JOIN public.dealer_applications da ON da.user_id = p.id AND da.status = 'approved'
  WHERE p.id = p_dealer_id;

  IF v_country IS NULL THEN
    v_country := 'DE';
  END IF;

  -- Germany: standard 19% MwSt
  -- EU non-DE: 0% reverse charge (§13b UStG / Art. 196 MwStSystRL)
  IF v_country = 'DE' THEN
    RETURN QUERY SELECT 19::NUMERIC, false, v_country;
  ELSE
    RETURN QUERY SELECT 0::NUMERIC, true, v_country;
  END IF;
END;
$$;

-- Step 5: Rewrite create_auction_invoice with reverse charge support
CREATE OR REPLACE FUNCTION public.create_auction_invoice(
  auction_id_param UUID,
  winner_id_param UUID
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

  SELECT * INTO auction_record
  FROM public.auctions WHERE id = auction_id_param;

  IF auction_record IS NULL THEN
    RAISE EXCEPTION 'Auction not found: %', auction_id_param;
  END IF;

  SELECT * INTO motorhome_record
  FROM public.motorhomes WHERE id = auction_record.motorhome_id;

  -- Get sale amount from highest bid by this winner
  SELECT COALESCE(
    (SELECT b.amount FROM public.bids b
     WHERE b.auction_id = auction_id_param AND b.bidder_id = winner_id_param
     ORDER BY b.amount DESC LIMIT 1),
    auction_record.current_bid
  ) INTO sale_amount;

  -- Calculate commission
  SELECT * INTO commission_calc
  FROM public.calculate_commission(sale_amount, winner_id_param);

  net_commission := ROUND(commission_calc.commission_amount, 2);

  -- Determine tax rate based on dealer's country
  SELECT * INTO tax_info FROM public.get_dealer_tax_info(winner_id_param);

  v_tax_amount := ROUND(net_commission * (tax_info.tax_rate / 100), 2);
  gross_commission := net_commission + v_tax_amount;

  INSERT INTO public.invoices (
    invoice_number, dealer_id, auction_id,
    status, net_amount, tax_rate, tax_amount, gross_amount,
    payment_terms_days, due_date, invoice_date, notes,
    reverse_charge, dealer_country
  ) VALUES (
    public.generate_invoice_number(),
    winner_id_param, auction_id_param,
    'draft', net_commission, tax_info.tax_rate, v_tax_amount, gross_commission,
    14, NOW() + INTERVAL '14 days', CURRENT_DATE,
    CASE
      WHEN tax_info.is_reverse_charge THEN
        'Vermittlungsprovision (Reverse Charge, §13b UStG): ' ||
        COALESCE(motorhome_record.manufacturer, '') || ' ' ||
        COALESCE(motorhome_record.model, '') || ' (' ||
        COALESCE(motorhome_record.year::text, '') || ')'
      ELSE
        'Provision fuer Auktion: ' ||
        COALESCE(motorhome_record.manufacturer, '') || ' ' ||
        COALESCE(motorhome_record.model, '') || ' (' ||
        COALESCE(motorhome_record.year::text, '') || ')'
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

-- Step 6: Rewrite create_instant_buy_invoice 
-- (also fixes bug: referenced non-existent columns sale_price, commission_rate, ust_id_seller)
CREATE OR REPLACE FUNCTION public.create_instant_buy_invoice(
  auction_id_param UUID,
  dealer_id_param UUID,
  sale_price_param NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Calculate commission
  SELECT commission_amount INTO v_commission
  FROM public.calculate_commission(sale_price_param);

  -- Determine tax rate based on dealer country
  SELECT * INTO tax_info FROM public.get_dealer_tax_info(dealer_id_param);

  v_tax_amount := ROUND(v_commission * (tax_info.tax_rate / 100), 2);
  v_gross_amount := v_commission + v_tax_amount;

  v_invoice_number := generate_invoice_number();
  v_due_date := NOW() + (v_payment_terms || ' days')::INTERVAL;

  -- Create invoice (fixed: removed non-existent columns)
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

-- Step 7: Update approve_dealer_application to also sync vat_id
CREATE OR REPLACE FUNCTION public.approve_dealer_application(application_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app_record RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  SELECT * INTO app_record
  FROM public.dealer_applications
  WHERE id = application_id_param;

  IF app_record IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  UPDATE public.dealer_applications
  SET status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
  WHERE id = application_id_param;

  DELETE FROM public.user_roles WHERE user_id = app_record.user_id;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (app_record.user_id, 'dealer')
  ON CONFLICT (user_id) DO UPDATE SET role = 'dealer';

  -- Sync ALL company data from application → profiles
  UPDATE public.profiles
  SET
    account_type    = 'business',
    company_name    = COALESCE(NULLIF(app_record.company_name, ''), company_name),
    company_street  = COALESCE(NULLIF(app_record.company_address, '-'), company_street),
    company_zip     = CASE
                        WHEN app_record.company_postal_code = '00000' THEN company_zip
                        ELSE COALESCE(NULLIF(app_record.company_postal_code, ''), company_zip)
                      END,
    company_city    = CASE
                        WHEN app_record.company_city LIKE '%Wird vom%' THEN company_city
                        ELSE COALESCE(NULLIF(app_record.company_city, '-'), company_city)
                      END,
    company_country = CASE
                        WHEN app_record.country IS NOT NULL AND app_record.country != ''
                        THEN app_record.country
                        ELSE COALESCE(company_country, 'DE')
                      END,
    vat_id          = COALESCE(NULLIF(app_record.vat_id, ''), vat_id)
  WHERE id = app_record.user_id;

  INSERT INTO public.dealer_levels (dealer_id, level, total_bids, won_auctions, total_volume, points)
  VALUES (app_record.user_id, 'bronze', 0, 0, 0, 0)
  ON CONFLICT (dealer_id) DO NOTHING;
END;
$$;
