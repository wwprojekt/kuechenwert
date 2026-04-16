-- ============================================================================
-- Auction Invoice: use site_settings.invoice_payment_terms_days + customer_number
-- Approve Dealer Application: status-transition guard (prevent duplicate approve)
-- ============================================================================
-- Fixes:
--   F2: create_auction_invoice now reads payment_terms_days from site_settings
--       (was hardcoded 14) — matches create_instant_buy_invoice behaviour.
--   F3: create_auction_invoice now writes customer_number from profiles
--       (was NULL) — matches create_instant_buy_invoice behaviour.
--   F7: approve_dealer_application only transitions pending -> approved,
--       using UPDATE ... WHERE status='pending' + row count check to prevent
--       two concurrent admin approvals from each firing a welcome email.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- F2 + F3: Rewrite create_auction_invoice
-- ---------------------------------------------------------------------------
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
  v_payment_terms INTEGER := 14;
  v_customer_number TEXT;
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

  -- F2: read payment terms from site_settings (fallback 14)
  SELECT invoice_payment_terms_days INTO v_payment_terms
  FROM public.site_settings
  LIMIT 1;
  IF v_payment_terms IS NULL OR v_payment_terms <= 0 THEN
    v_payment_terms := 14;
  END IF;

  -- F3: read customer_number from profiles (parity with instant-buy invoice)
  SELECT customer_number INTO v_customer_number
  FROM public.profiles
  WHERE id = dealer_id_param;

  INSERT INTO public.invoices (
    invoice_number, dealer_id, auction_id, customer_number,
    status, net_amount, tax_rate, tax_amount, gross_amount,
    payment_terms_days, due_date, invoice_date, notes,
    reverse_charge, dealer_country
  ) VALUES (
    public.generate_invoice_number(),
    dealer_id_param, auction_id_param, v_customer_number,
    'draft', net_commission, tax_info.tax_rate, v_tax_amount, gross_commission,
    v_payment_terms, NOW() + (v_payment_terms || ' days')::INTERVAL, CURRENT_DATE,
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

COMMENT ON FUNCTION public.create_auction_invoice(UUID, UUID) IS
  'Creates an auction invoice. Reads payment_terms_days from site_settings and customer_number from profiles (parity with create_instant_buy_invoice).';

-- ---------------------------------------------------------------------------
-- F7: approve_dealer_application — status transition guard
-- ---------------------------------------------------------------------------
-- Current behaviour: two concurrent admin clicks can both pass the client-side
-- pending check, both call the RPC, both set status='approved' (no-op on
-- second), and both invoke send-dealer-notification -> 2 welcome emails.
--
-- Fix: use UPDATE ... WHERE status='pending' and GET DIAGNOSTICS to detect
-- whether THIS call actually performed the transition. If not, RAISE
-- EXCEPTION 'ALREADY_PROCESSED' so the client skips the email path.
CREATE OR REPLACE FUNCTION public.approve_dealer_application(application_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app_record RECORD;
  v_updated_rows INTEGER;
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

  -- Atomic status transition: only one admin "wins" the approval.
  UPDATE public.dealer_applications
  SET status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
  WHERE id = application_id_param
    AND status = 'pending';

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

  IF v_updated_rows = 0 THEN
    -- Already approved (or not pending); refuse so the caller does NOT send
    -- a duplicate welcome email.
    RAISE EXCEPTION 'ALREADY_PROCESSED: dealer application % is not in pending state (current: %)',
      application_id_param, app_record.status
      USING ERRCODE = 'P0002';
  END IF;

  -- Reload the record to get fresh values (reviewed_at/reviewed_by) for downstream logic.
  SELECT * INTO app_record
  FROM public.dealer_applications
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

COMMENT ON FUNCTION public.approve_dealer_application(UUID) IS
  'Approves a dealer application atomically. Only the first caller wins; duplicate approves raise ALREADY_PROCESSED to prevent duplicate welcome emails.';
