
-- Add status_changed_at to track when dealer was approved/rejected
ALTER TABLE dealer_applications 
ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;

-- Backfill: set status_changed_at = updated_at for existing records
UPDATE dealer_applications 
SET status_changed_at = COALESCE(updated_at, created_at)
WHERE status_changed_at IS NULL;

-- Create trigger to auto-set status_changed_at when status changes
CREATE OR REPLACE FUNCTION update_dealer_status_changed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dealer_status_changed ON dealer_applications;
CREATE TRIGGER trg_dealer_status_changed
  BEFORE UPDATE ON dealer_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_dealer_status_changed_at();

-- Schedule daily dealer auction digest at 8:00 UTC (9:00/10:00 CET/CEST)
SELECT cron.schedule(
  'send-dealer-auction-digest',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/send-dealer-auction-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Also run inactivity check daily (currently only Monday) to catch 3-day nudges faster
-- Update existing schedule from weekly to daily at 9:00 UTC
SELECT cron.unschedule('send-inactivity-emails');
SELECT cron.schedule(
  'send-inactivity-emails',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/send-inactivity-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
