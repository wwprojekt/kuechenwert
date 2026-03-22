-- =============================================
-- Migration: Cron-Job für automatische Wizard Recovery E-Mails
-- Prüft alle 30 Minuten auf abgebrochene Wizard-Sessions
-- und sendet automatisch Erinnerungs-E-Mails:
--   1. Nach 2 Stunden Inaktivität (erste Erinnerung)
--   2. Nach 14 Tagen Inaktivität (letzte Erinnerung)
-- =============================================

SELECT cron.schedule(
  'process-abandoned-wizards',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zcrwqxsyptjwkuxfacvq.supabase.co/functions/v1/process-abandoned-wizards',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
