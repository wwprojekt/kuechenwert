-- Migration: Fix Invoice & Commission Bugs
-- Date: 2026-04-07
-- Issues fixed:
--   1. invoices table missing payment_terms_days column
--   2. calculate_commission: SELECT INTO sets variable to NULL when no rows found
--   3. create_auction_invoice: Wrong column names, wrong status value

-- ============================================================
-- FIX 1: Add payment_terms_days column to invoices
-- ============================================================
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER DEFAULT 14;

-- ============================================================
-- FIX 2: Fix calculate_commission NULL bug
-- When SELECT INTO finds no rows, PostgreSQL sets the variable to NULL
-- even if it was initialized with a default value.
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_commission(
  sale_amount numeric,
  dealer_id_param uuid DEFAULT NULL
)
RETURNS TABLE(base_rate numeric, volume_discount numeric, final_rate numeric, commission_amount numeric, tier_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  tier_record RECORD;
  v_discount_rate NUMERIC := 0;
  base_commission NUMERIC;
  final_commission NUMERIC;
BEGIN
  SELECT * INTO tier_record
  FROM public.commission_tiers
  WHERE sale_amount >= min_amount 
    AND sale_amount < max_amount
    AND is_active = true
  ORDER BY min_amount DESC
  LIMIT 1;

  IF tier_record IS NULL THEN
    SELECT * INTO tier_record
    FROM public.commission_tiers
    WHERE is_active = true
    ORDER BY min_amount DESC
    LIMIT 1;
  END IF;

  IF tier_record.rate_type = 'percentage' THEN
    base_commission := sale_amount * (tier_record.rate_value / 100);
    base_commission := GREATEST(base_commission, COALESCE(tier_record.min_commission, 0));
  ELSE
    base_commission := tier_record.rate_value;
  END IF;

  IF dealer_id_param IS NOT NULL THEN
    SELECT COALESCE(dvd.discount_rate, 0) INTO v_discount_rate
    FROM public.dealer_volume_discounts dvd
    WHERE dvd.dealer_id = dealer_id_param 
      AND dvd.is_active = true
      AND (dvd.active_until IS NULL OR dvd.active_until > NOW())
    ORDER BY dvd.discount_rate DESC
    LIMIT 1;
    
    -- FIX: When no row is found, SELECT INTO sets variable to NULL
    v_discount_rate := COALESCE(v_discount_rate, 0);
  END IF;

  final_commission := base_commission * (1 - v_discount_rate / 100);

  RETURN QUERY SELECT
    tier_record.rate_value as base_rate,
    v_discount_rate as volume_discount,
    (final_commission / sale_amount * 100) as final_rate,
    final_commission as commission_amount,
    tier_record.id as tier_id;
END;
$func$;

-- ============================================================
-- FIX 3: Fix create_auction_invoice
-- - Uses correct column names (manufacturer/model instead of brand)
-- - Uses correct status 'draft' (not 'pending')
-- - Uses bidder_id from bids table
-- - Uses ROUND for exact amounts
-- ============================================================
DROP FUNCTION IF EXISTS public.create_auction_invoice(uuid, uuid);

CREATE OR REPLACE FUNCTION public.create_auction_invoice(
  auction_id_param UUID,
  winner_id_param UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  invoice_id UUID;
  commission_calc RECORD;
  auction_record RECORD;
  motorhome_record RECORD;
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

  SELECT COALESCE(
    (SELECT b.amount FROM public.bids b 
     WHERE b.auction_id = auction_id_param AND b.bidder_id = winner_id_param 
     ORDER BY b.amount DESC LIMIT 1),
    auction_record.current_bid
  ) INTO sale_amount;

  SELECT * INTO commission_calc
  FROM public.calculate_commission(sale_amount, winner_id_param);

  net_commission := ROUND(commission_calc.commission_amount, 2);
  v_tax_amount := ROUND(net_commission * 0.19, 2);
  gross_commission := net_commission + v_tax_amount;

  INSERT INTO public.invoices (
    invoice_number, dealer_id, auction_id,
    status, net_amount, tax_rate, tax_amount, gross_amount,
    payment_terms_days, due_date, invoice_date, notes
  ) VALUES (
    public.generate_invoice_number(),
    winner_id_param, auction_id_param,
    'draft', net_commission, 19.00, v_tax_amount, gross_commission,
    14, NOW() + INTERVAL '14 days', CURRENT_DATE,
    'Provision fuer Auktion: ' || COALESCE(motorhome_record.manufacturer, '') || ' ' || COALESCE(motorhome_record.model, '') || ' (' || COALESCE(motorhome_record.year::text, '') || ')'
  )
  RETURNING id INTO invoice_id;

  INSERT INTO public.invoice_items (
    invoice_id, description, quantity, unit_price,
    net_amount, tax_rate, tax_amount, gross_amount
  ) VALUES (
    invoice_id,
    'Vermittlungsprovision - ' || COALESCE(motorhome_record.manufacturer, '') || ' ' || COALESCE(motorhome_record.model, ''),
    1, net_commission, net_commission, 19.00, v_tax_amount, gross_commission
  );

  RETURN invoice_id;
END;
$func$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
