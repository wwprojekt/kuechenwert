-- Add broadcast_emails_enabled to user_notification_preferences for unsubscribe feature
ALTER TABLE user_notification_preferences
ADD COLUMN IF NOT EXISTS broadcast_emails_enabled BOOLEAN DEFAULT true;

-- Add scheduled_at, updated_at, read_at to admin_emails if not already present
ALTER TABLE admin_emails
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Create index for faster webhook status updates
CREATE INDEX IF NOT EXISTS idx_admin_emails_resend_id ON admin_emails(resend_id) WHERE resend_id IS NOT NULL;

-- Create index for faster inbox queries
CREATE INDEX IF NOT EXISTS idx_admin_emails_direction_archived ON admin_emails(direction, is_archived) WHERE is_archived = false;

-- Create index for faster contact history lookups
CREATE INDEX IF NOT EXISTS idx_admin_emails_sender_email ON admin_emails(sender_email);
CREATE INDEX IF NOT EXISTS idx_admin_emails_recipient_email ON admin_emails(recipient_email);

-- Enable realtime for admin_emails table
ALTER PUBLICATION supabase_realtime ADD TABLE admin_emails;
