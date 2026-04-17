-- Sync auction.reserve_price down whenever the seller offers a counter
-- under the current reserve. Keeps Admin overview in sync with the
-- realistic minimum the seller would accept and feeds the auto-relist
-- (check-expired-auctions) with the correct value automatically.

CREATE OR REPLACE FUNCTION public.sync_auction_reserve_to_lowest_counter_offer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_reserve numeric;
BEGIN
  -- Nur reagieren wenn ein Verkäufer-Gegenangebot vorliegt
  IF NEW.counter_offer_amount IS NULL THEN
    RETURN NEW;
  END IF;

  -- Bei UPDATE: nur reagieren, wenn sich der Wert tatsächlich geändert hat
  IF TG_OP = 'UPDATE' AND (OLD.counter_offer_amount IS NOT DISTINCT FROM NEW.counter_offer_amount) THEN
    RETURN NEW;
  END IF;

  SELECT reserve_price INTO current_reserve
  FROM public.auctions
  WHERE id = NEW.auction_id;

  -- Wenn das Gegenangebot niedriger ist (oder gar keine Reserve gesetzt), anpassen
  IF current_reserve IS NULL OR NEW.counter_offer_amount < current_reserve THEN
    UPDATE public.auctions
    SET reserve_price = NEW.counter_offer_amount,
        updated_at = NOW()
    WHERE id = NEW.auction_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_auction_reserve_on_counter_offer ON public.post_auction_offers;

CREATE TRIGGER sync_auction_reserve_on_counter_offer
AFTER INSERT OR UPDATE OF counter_offer_amount
ON public.post_auction_offers
FOR EACH ROW
EXECUTE FUNCTION public.sync_auction_reserve_to_lowest_counter_offer();

-- Backfill für bestehende Auktionen mit Verkäufer-Gegenangeboten
WITH lowest_offers AS (
  SELECT auction_id, MIN(counter_offer_amount) AS min_counter
  FROM public.post_auction_offers
  WHERE counter_offer_amount IS NOT NULL
  GROUP BY auction_id
)
UPDATE public.auctions a
SET reserve_price = lo.min_counter,
    updated_at = NOW()
FROM lowest_offers lo
WHERE a.id = lo.auction_id
  AND a.status IN ('active', 'kaufchance', 'ended')
  AND (a.reserve_price IS NULL OR lo.min_counter < a.reserve_price);
