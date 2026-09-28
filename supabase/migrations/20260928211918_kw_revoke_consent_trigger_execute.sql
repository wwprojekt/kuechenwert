-- kw_log_email_consent ist eine SECURITY-DEFINER-Triggerfunktion auf
-- user_notification_preferences (Migration 20260928201711). Beim Anlegen
-- blieben die Standardrechte stehen, damit war sie per /rest/v1/rpc für
-- anon und authenticated sichtbar. Beim Feuern eines Triggers prüft Postgres
-- das EXECUTE-Recht nicht, der Trigger arbeitet also unverändert weiter.

revoke execute on function public.kw_log_email_consent() from public, anon, authenticated;
