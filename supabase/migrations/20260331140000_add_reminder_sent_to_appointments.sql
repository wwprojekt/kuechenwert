-- Add reminder_sent column to appointments table for the send-appointment-reminder Edge Function
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent boolean DEFAULT false;

-- Create index for efficient querying of appointments that need reminders
CREATE INDEX IF NOT EXISTS idx_appointments_reminder_sent ON appointments (reminder_sent) WHERE reminder_sent = false;
