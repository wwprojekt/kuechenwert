-- =========================================================================
-- Fix: create_auction_invoice() berechnet die Provision falsch
--
-- Bug: Die Funktion benutzte als sale_amount das HÖCHSTE Gebot des Händlers
-- (`SELECT amount FROM bids WHERE bidder_id = dealer_id ORDER BY amount DESC LIMIT 1`)
-- bzw. fiel sonst auf `auctions.current_bid` zurück.
--
-- Problem bei Post-Auction-Verkäufen (Kaufchance / nachträgliches Angebot /
-- Instant-Buy nach Ablauf): Hat der Händler während der Auktion 39.600 €
-- geboten und nach Auktionsende ein Angebot über 52.000 € abgegeben, das
-- der Verkäufer akzeptiert hat, dann wurde die Provision auf 39.600 €
-- statt 52.000 € berechnet. Der Verkäufer / die Plattform verlieren so
-- bei jedem Post-Auction-Sale Provision.
--
-- Fix: Ermittlung des `sale_amount` strikt in dieser Reihenfolge:
--   1. Akzeptiertes `post_auction_offers.offer_amount` für diese Auktion +
--      diesen Käufer (höchstes wenn mehrere existieren – sollte praktisch
--      immer genau eines sein)
--   2. `auctions.current_bid` (regulärer Auktionsausgang oder Instant-Buy,
--      weil place-bid / instant-buy current_bid setzen)
--   3. Höchstes Gebot des Händlers (Fallback – sollte mit (2) übereinstimmen)
--
-- Konsequenz: Die Funktion ignoriert jetzt komplett, ob der Händler in der
-- Auktion mitgeboten hat. Der Verkaufspreis ist immer der tatsächliche
-- Verkaufspreis der Transaktion, nicht ein Auktionsgebot.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.create_auction_invoice(
  auction_id_param uuid,
  dealer_id_param uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
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
  v_post_auction_amount NUMERIC;
BEGIN
  IF auth.role() != 'service_role' AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: service_role or admin role required';
  END IF;

  SELECT * INTO auction_record FROM public.auctions WHERE id = auction_id_param;
  IF auction_record IS NULL THEN
    RAISE EXCEPTION 'Auction not found: %', auction_id_param;
  END IF;

  SELECT * INTO motorhome_record FROM public.motorhomes WHERE id = auction_record.motorhome_id;

  -- ─── 1. Akzeptiertes Post-Auction-Angebot (Kaufchance) ─────────────
  SELECT pao.offer_amount
    INTO v_post_auction_amount
  FROM public.post_auction_offers pao
  WHERE pao.auction_id = auction_id_param
    AND pao.buyer_id   = dealer_id_param
    AND pao.status     = 'accepted'
  ORDER BY pao.offer_amount DESC, pao.responded_at DESC NULLS LAST
  LIMIT 1;

  IF v_post_auction_amount IS NOT NULL THEN
    sale_amount := v_post_auction_amount;
  ELSE
    -- ─── 2./3. Auktionspreis (current_bid) → höchstes Händlergebot ────
    sale_amount := COALESCE(
      auction_record.current_bid,
      (SELECT b.amount FROM public.bids b
        WHERE b.auction_id = auction_id_param
          AND b.bidder_id  = dealer_id_param
        ORDER BY b.amount DESC LIMIT 1)
    );
  END IF;

  IF sale_amount IS NULL OR sale_amount <= 0 THEN
    RAISE EXCEPTION 'create_auction_invoice: konnte sale_amount nicht ermitteln (auction=%, dealer=%)',
      auction_id_param, dealer_id_param;
  END IF;

  SELECT * INTO commission_calc FROM public.calculate_commission(sale_amount, dealer_id_param);
  net_commission := ROUND(commission_calc.commission_amount, 2);

  SELECT * INTO tax_info FROM public.get_dealer_tax_info(dealer_id_param);

  v_tax_amount := ROUND(net_commission * (tax_info.tax_rate / 100), 2);
  gross_commission := net_commission + v_tax_amount;

  SELECT invoice_payment_terms_days INTO v_payment_terms
  FROM public.site_settings
  LIMIT 1;
  IF v_payment_terms IS NULL OR v_payment_terms <= 0 THEN
    v_payment_terms := 14;
  END IF;

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
$function$;

COMMENT ON FUNCTION public.create_auction_invoice(uuid, uuid) IS
  'Erstellt die Provisionsrechnung für einen Auktionsverkauf. sale_amount = '
  'akzeptiertes post_auction_offers.offer_amount (Kaufchance) > '
  'auctions.current_bid > höchstes Gebot des Händlers. '
  'Vor 2026-04-21 wurde fälschlich das höchste Auktionsgebot des Händlers verwendet, '
  'wodurch Provisionen bei Post-Auction-Verkäufen zu niedrig berechnet wurden.';
