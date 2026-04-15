-- Fix: motorhomes_status_check constraint was missing status values used in the codebase.
--
-- Original constraint (from migration 20251029050837):
--   CHECK (status IN ('available', 'sold', 'pending'))
--
-- Missing values that caused CHECK constraint violations:
--   'active'   — set by AdminAuctions, AdminPostAuctionOffers, check-expired-auctions
--   'not_sold' — set by AdminPostAuctionOffers.handleEndKaufchance()
--   'reserved' — read by AdminMotorhomes.getRealStatus() (future-proofing)
--
-- Production error: "new row for relation 'motorhomes' violates check constraint 'motorhomes_status_check'"
-- triggered when an admin ended a Kaufchance on /admin/offers (status → 'not_sold').

ALTER TABLE public.motorhomes DROP CONSTRAINT IF EXISTS motorhomes_status_check;

ALTER TABLE public.motorhomes ADD CONSTRAINT motorhomes_status_check
  CHECK (status IN ('available', 'active', 'sold', 'pending', 'not_sold', 'reserved'));
