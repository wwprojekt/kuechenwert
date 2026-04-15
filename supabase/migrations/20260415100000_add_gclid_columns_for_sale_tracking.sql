-- Add Google Ads Click-ID columns to wizard_sessions and motorhomes
-- so we can trace a sale back to the original Google Ads click
-- and upload the actual commission as an offline conversion.

ALTER TABLE wizard_sessions
  ADD COLUMN IF NOT EXISTS gclid  TEXT,
  ADD COLUMN IF NOT EXISTS gbraid TEXT,
  ADD COLUMN IF NOT EXISTS wbraid TEXT;

ALTER TABLE motorhomes
  ADD COLUMN IF NOT EXISTS gclid  TEXT,
  ADD COLUMN IF NOT EXISTS gbraid TEXT,
  ADD COLUMN IF NOT EXISTS wbraid TEXT;

COMMENT ON COLUMN wizard_sessions.gclid  IS 'Google Click ID captured at wizard start for offline conversion attribution';
COMMENT ON COLUMN wizard_sessions.gbraid IS 'Google Broad ID (iOS) captured at wizard start';
COMMENT ON COLUMN wizard_sessions.wbraid IS 'Web Broad ID captured at wizard start';
COMMENT ON COLUMN motorhomes.gclid  IS 'Google Click ID from original lead for sale-back conversion tracking';
COMMENT ON COLUMN motorhomes.gbraid IS 'Google Broad ID (iOS) from original lead';
COMMENT ON COLUMN motorhomes.wbraid IS 'Web Broad ID from original lead';
