-- Bug 1: heal phantom expired offers.
--
-- Until now, post_auction_offers.expires_at was a hard-coded 24h window from
-- creation, while the actual Kaufchance window on auctions.kaufchance_expires_at
-- is 72h. The cron job and accept-kaufchance-offer never enforced offer.expires_at,
-- so these are stale data points that show up in admin/dashboard reports as
-- „expired but pending" offers and could later be tightened into a real check
-- that would surprise dealers.
--
-- Fix: bring offer.expires_at in line with the parent auction's kaufchance window
-- for all open offers (pending/countered) on auctions still in kaufchance phase.
-- The new code in PostAuctionOfferDialog/MyKaufchancen will keep them in sync
-- going forward.

UPDATE public.post_auction_offers AS pao
SET    expires_at = a.kaufchance_expires_at,
       updated_at = NOW()
FROM   public.auctions AS a
WHERE  a.id = pao.auction_id
  AND  pao.status IN ('pending', 'countered')
  AND  a.status = 'kaufchance'
  AND  a.kaufchance_expires_at IS NOT NULL
  AND  pao.expires_at IS DISTINCT FROM a.kaufchance_expires_at;
