-- Fix: sender_name und recipient_name nullable machen
-- Eingehende E-Mails haben nicht immer einen Absendernamen im From-Header
ALTER TABLE admin_emails ALTER COLUMN sender_name DROP NOT NULL;
ALTER TABLE admin_emails ALTER COLUMN recipient_name DROP NOT NULL;
