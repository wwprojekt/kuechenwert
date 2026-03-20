-- Add WhatsApp number setting for dedicated WhatsApp support button
-- This allows using a different number for WhatsApp than the general support phone

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

COMMENT ON COLUMN site_settings.whatsapp_number IS 'WhatsApp number for support button (if different from support_phone)';
