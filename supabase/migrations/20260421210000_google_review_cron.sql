-- =====================================================================
-- Cron: send-google-review-batch
-- =====================================================================
-- Scheduled outreach for Google reviews. Runs once per day at 11:00 UTC
-- (= 13:00 MESZ Sommerzeit, 12:00 MEZ Winterzeit) and asks the
-- send-google-review-request Edge Function to:
--   1. top-up the queue from all eligible source tables (≥14 days old)
--   2. claim a batch of up to 50 queued recipients
--   3. send one email each, with 150ms spacing for Resend rate limit
--
-- Why 11:00 UTC:
--   - process-dunning runs at 11:00 UTC; this cron piggybacks on the
--     already warm worker pool window
--   - email is most likely to be opened mid-day in DACH timezone
--   - well separated from billing/invoice mails (10:00 UTC) so Resend
--     rate limits don't clash
--
-- Why 50/day cap:
--   - Resend Free Plan has 100 emails/day; we share with notifications
--   - keeps the spam-trap risk low (gradual ramp)
--   - if backlog grows, just temporarily edit the cron body to use a
--     larger batch_size, no migration needed
--
-- Auth pattern: same Vault-based auth as all other crons in this project
--   (see 20260420280000_fix_send_payment_reminders_cron_auth.sql for
--   the rationale — `app.settings.service_role_key` GUC is NOT set).
-- =====================================================================

-- ─── 1) Cron entfernen (idempotent) ───────────────────────────────────
DO $$
BEGIN
  PERFORM cron.unschedule('send-google-review-batch');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ─── 2) Cron neu schedulen ────────────────────────────────────────────
SELECT cron.schedule(
  'send-google-review-batch',
  '0 11 * * *',  -- täglich 11:00 UTC
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/send-google-review-request',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := jsonb_build_object(
      'batch_size', 50,
      'top_up', true,
      'min_age_days', 14,
      'dry_run', false
    ),
    timeout_milliseconds := 120000  -- 2min (50 sends × 150ms = ~7.5s + Resend latency + DB writes)
  );
  $$
);

-- ─── 3) Smoke-Test ────────────────────────────────────────────────────
DO $$
DECLARE
  v_job_count int;
  v_project_url_count int;
  v_service_role_key_count int;
BEGIN
  SELECT COUNT(*) INTO v_job_count
    FROM cron.job
   WHERE jobname = 'send-google-review-batch';
  IF v_job_count = 0 THEN
    RAISE EXCEPTION 'Cron-Job send-google-review-batch wurde NICHT angelegt';
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

  RAISE NOTICE 'OK: send-google-review-batch täglich 11:00 UTC scheduled (50 Mails/Tag, ≥14d alt).';
END $$;
