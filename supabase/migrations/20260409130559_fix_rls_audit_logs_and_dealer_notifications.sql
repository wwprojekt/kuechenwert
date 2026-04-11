
-- 1. audit_logs: Entferne die offene INSERT-Policy (true)
-- Die Policy "Authenticated users can insert audit logs" mit auth.uid() IS NOT NULL bleibt bestehen
DROP POLICY IF EXISTS "Service role can insert audit logs" ON audit_logs;

-- 2. dealer_notifications: Ersetze offene INSERT mit authentifiziert-only
-- Notifications werden von Edge Functions mit service_role eingefügt (bypassed RLS)
-- Kein anonymer User soll Notifications erstellen können
DROP POLICY IF EXISTS "Service role can insert notifications" ON dealer_notifications;
