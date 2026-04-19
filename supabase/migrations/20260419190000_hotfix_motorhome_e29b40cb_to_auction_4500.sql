-- Hotfix: motorhome e29b40cb-24f2-498e-b9eb-b7bc633adcec
-- Listing was incorrectly flagged as sale_channel='instant_price' but
-- instant_price IS NULL and reserve_price IS NULL. Active auction has a
-- 1000 EUR bid. The seller's intended floor was 4500 EUR.
--
-- Resolution: convert the listing back to a regular auction with a 4500 EUR
-- reserve so the current 1000 EUR bid stays below the reserve. When the
-- auction expires the existing close-auction logic will correctly route it
-- into Kaufchance instead of selling for less than the floor.

DO $$
DECLARE
  v_motorhome_id constant uuid := 'e29b40cb-24f2-498e-b9eb-b7bc633adcec';
  v_auction_id   constant uuid := 'c0a7d83f-b89b-4112-8762-2be1ab065740';
BEGIN
  UPDATE motorhomes
     SET sale_channel  = 'auction',
         sale_type     = 'auction',
         instant_price = NULL,
         reserve_price = 4500,
         updated_at    = NOW()
   WHERE id = v_motorhome_id
     AND sale_channel = 'instant_price'
     AND instant_price IS NULL;

  UPDATE auctions
     SET reserve_price = 4500,
         updated_at    = NOW()
   WHERE id = v_auction_id
     AND motorhome_id = v_motorhome_id
     AND status = 'active';
END $$;
