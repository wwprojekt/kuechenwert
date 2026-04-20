-- Bug-fix #6: post_auction_offers carry no auction_round.
-- check-expired-auctions computes the new reserve_price from the lowest
-- counter_offer_amount across ALL offers on the auction_id, including
-- expired ones from previous rounds. After several relists this can pull
-- a stale 4 500 € counter from round 1 in front of a fresh 6 000 € counter
-- from round 3, undercutting the seller without their consent.
--
-- Long-term fix: stamp every offer with the auction round it was made in,
-- backfill historic rows from auctions.auction_round, and have a trigger
-- maintain the invariant on insert. Then check-expired-auctions can scope
-- the lowest-counter calculation to the round being closed.

ALTER TABLE public.post_auction_offers
  ADD COLUMN IF NOT EXISTS auction_round integer NOT NULL DEFAULT 1;

UPDATE public.post_auction_offers o
   SET auction_round = COALESCE(a.auction_round, 1)
  FROM public.auctions a
 WHERE o.auction_id = a.id
   AND o.auction_round = 1
   AND COALESCE(a.auction_round, 1) <> 1;

CREATE OR REPLACE FUNCTION public.set_post_auction_offer_round()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The auction_round column on auctions is NOT NULL DEFAULT 1, so we can
  -- safely fall back if for some reason the row is missing (shouldn't happen
  -- because of FK).
  SELECT COALESCE(a.auction_round, 1)
    INTO NEW.auction_round
    FROM public.auctions a
   WHERE a.id = NEW.auction_id;
  IF NEW.auction_round IS NULL THEN
    NEW.auction_round := 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_post_auction_offer_round ON public.post_auction_offers;
CREATE TRIGGER trg_set_post_auction_offer_round
  BEFORE INSERT ON public.post_auction_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_post_auction_offer_round();

CREATE INDEX IF NOT EXISTS idx_post_auction_offers_auction_round
  ON public.post_auction_offers (auction_id, auction_round);

COMMENT ON COLUMN public.post_auction_offers.auction_round IS
  'Snapshot der auctions.auction_round zum Insert-Zeitpunkt. Wird durch BEFORE INSERT Trigger gepflegt — Frontend muss/kann den Wert nicht setzen.';
