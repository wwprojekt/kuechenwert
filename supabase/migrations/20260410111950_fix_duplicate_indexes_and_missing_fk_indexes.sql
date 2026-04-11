
-- 1. Remove duplicate indexes on audit_logs
DROP INDEX IF EXISTS idx_audit_logs_created;     -- duplicate of idx_audit_logs_created_at
DROP INDEX IF EXISTS idx_audit_logs_user;         -- duplicate of idx_audit_logs_user_id

-- 2. Add missing foreign key indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_emails_in_reply_to ON admin_emails(in_reply_to);
CREATE INDEX IF NOT EXISTS idx_admin_emails_read_by ON admin_emails(read_by);
CREATE INDEX IF NOT EXISTS idx_admin_emails_recipient_id ON admin_emails(recipient_id);
CREATE INDEX IF NOT EXISTS idx_admin_emails_sent_by ON admin_emails(sent_by);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_page_views_user_id ON analytics_page_views(user_id);
CREATE INDEX IF NOT EXISTS idx_auction_addenda_seller_id ON auction_addenda(seller_id);
CREATE INDEX IF NOT EXISTS idx_contact_messages_responded_by ON contact_messages(responded_by);
CREATE INDEX IF NOT EXISTS idx_email_templates_created_by ON email_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_email_templates_updated_by ON email_templates(updated_by);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved_by ON error_logs(resolved_by);
CREATE INDEX IF NOT EXISTS idx_purchase_inquiries_station_id ON purchase_inquiries(station_id);

-- 3. Move pg_net extension to extensions schema (if possible)
-- Note: pg_net may be managed by Supabase and can't be moved easily
-- CREATE SCHEMA IF NOT EXISTS extensions;
-- ALTER EXTENSION pg_net SET SCHEMA extensions;
