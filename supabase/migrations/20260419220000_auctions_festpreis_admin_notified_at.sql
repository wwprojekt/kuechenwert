-- Mark column for the festpreis NULL/0 admin alert path.
-- Used by check-expired-auctions to give the admin a 24h grace window
-- to manually set instant_price on a festpreis listing whose price was
-- never entered. After 24h with the marker still set and instant_price
-- still NULL/0, the listing is ended (no endless auto-extend loop).
--
-- Reset to NULL whenever a valid instant_price is present at the next
-- cron tick (handled in check-expired-auctions code).

ALTER TABLE auctions
  ADD COLUMN IF NOT EXISTS festpreis_admin_notified_at TIMESTAMPTZ;

COMMENT ON COLUMN auctions.festpreis_admin_notified_at IS
  'Timestamp when admin_festpreis_needs_price alert was sent for this listing. If set AND instant_price is still NULL/0 at the next cron tick (~24h later), the listing is ended. Reset to NULL once instant_price is filled in by the admin.';

CREATE INDEX IF NOT EXISTS idx_auctions_festpreis_admin_notified_at
  ON auctions (festpreis_admin_notified_at)
  WHERE festpreis_admin_notified_at IS NOT NULL;
