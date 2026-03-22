-- Add followup_email_sent_at column to wizard_sessions
-- This tracks the second re-engagement email sent 14 days after abandonment
ALTER TABLE wizard_sessions
ADD COLUMN IF NOT EXISTS followup_email_sent_at TIMESTAMPTZ DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN wizard_sessions.followup_email_sent_at IS 'Timestamp when the 14-day follow-up re-engagement email was sent';
