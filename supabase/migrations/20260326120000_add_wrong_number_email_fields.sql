-- Add wrong_number_email_count and wrong_number_email_last_sent to all lead tables
-- Add admin_estimated_value to wizard_sessions and quick_leads (already exists in value_assessment_leads)

ALTER TABLE wizard_sessions ADD COLUMN IF NOT EXISTS wrong_number_email_count integer DEFAULT 0;
ALTER TABLE wizard_sessions ADD COLUMN IF NOT EXISTS wrong_number_email_last_sent timestamptz;
ALTER TABLE wizard_sessions ADD COLUMN IF NOT EXISTS admin_estimated_value numeric;

ALTER TABLE quick_leads ADD COLUMN IF NOT EXISTS wrong_number_email_count integer DEFAULT 0;
ALTER TABLE quick_leads ADD COLUMN IF NOT EXISTS wrong_number_email_last_sent timestamptz;
ALTER TABLE quick_leads ADD COLUMN IF NOT EXISTS admin_estimated_value numeric;

ALTER TABLE value_assessment_leads ADD COLUMN IF NOT EXISTS wrong_number_email_count integer DEFAULT 0;
ALTER TABLE value_assessment_leads ADD COLUMN IF NOT EXISTS wrong_number_email_last_sent timestamptz;
