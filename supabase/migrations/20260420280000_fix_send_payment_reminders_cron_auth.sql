-- =====================================================================
-- Bug-Fix: send-payment-reminders Cron-Job benutzt brokenes Auth-Pattern
-- =====================================================================
-- Der Cron `send-payment-reminders` (jeden Tag 10:00 UTC) wurde in
-- 20260322000004_email_automation_crons.sql mit
--
--   'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
--
-- angelegt. Dieses Pattern setzt voraus, dass der GUC
-- `app.settings.service_role_key` auf Datenbank-Ebene konfiguriert ist.
-- In diesem Projekt ist das NICHT der Fall (alle anderen Cron-Jobs sind
-- inzwischen auf das `vault.decrypted_secrets`-Pattern umgestellt — siehe
-- 20260414160000_fix_cron_job_timeouts.sql, 20260419000000_add_missing_cron_jobs.sql).
--
-- Konsequenz: Der Cron läuft zwar laut pg_cron.job_run_details
-- "succeeded", aber der HTTP-Aufruf an /functions/v1/send-payment-reminder
-- enthält einen leeren Bearer-Token, weshalb die Edge-Function mit 401
-- antwortet (sie verwendet checkServiceRoleOrAdmin). Damit geht die
-- freundliche 3-Tage-Zahlungserinnerung seit dem Deploy am 22.03. nicht raus.
--
-- Dieser Patch:
--   1) entfernt den alten Cron-Job
--   2) re-scheduled ihn mit dem Vault-Pattern (= identisch zu allen
--      anderen Cron-Jobs) inkl. timeout_milliseconds (60s reicht — die
--      Function macht 1 SELECT + N Resend-Calls; bei 100+ überfälligen
--      Rechnungen kann das ein paar Sekunden dauern).
-- =====================================================================

-- ─── 1) alten Cron entfernen (idempotent) ────────────────────────────
DO $$
BEGIN
  PERFORM cron.unschedule('send-payment-reminders');
EXCEPTION WHEN OTHERS THEN
  -- Job existiert nicht mehr — ignorieren.
  NULL;
END $$;

-- ─── 2) neu schedulen mit Vault-Auth + Timeout ───────────────────────
SELECT cron.schedule(
  'send-payment-reminders',
  '0 10 * * *',  -- täglich 10:00 UTC (= 12:00 MESZ); 1h vor process-dunning
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/send-payment-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- ─── 3) Smoke-Test ───────────────────────────────────────────────────
-- Sicherstellen, dass der Job angelegt wurde UND dass die Vault-Secrets
-- existieren (sonst würde der Job zur Laufzeit erneut leise scheitern).
DO $$
DECLARE
  v_job_count int;
  v_project_url_count int;
  v_service_role_key_count int;
BEGIN
  SELECT COUNT(*) INTO v_job_count
    FROM cron.job
   WHERE jobname = 'send-payment-reminders';
  IF v_job_count = 0 THEN
    RAISE EXCEPTION 'Cron-Job send-payment-reminders wurde NICHT angelegt';
  END IF;

  SELECT COUNT(*) INTO v_project_url_count
    FROM vault.decrypted_secrets
   WHERE name = 'project_url';
  IF v_project_url_count = 0 THEN
    RAISE EXCEPTION 'Vault-Secret "project_url" fehlt — Cron würde mit NULL-URL fehlschlagen';
  END IF;

  SELECT COUNT(*) INTO v_service_role_key_count
    FROM vault.decrypted_secrets
   WHERE name = 'service_role_key';
  IF v_service_role_key_count = 0 THEN
    RAISE EXCEPTION 'Vault-Secret "service_role_key" fehlt — Cron würde mit leerem Bearer fehlschlagen';
  END IF;

  RAISE NOTICE 'OK: send-payment-reminders ist mit Vault-Auth re-scheduled.';
END $$;
