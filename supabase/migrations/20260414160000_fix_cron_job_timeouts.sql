-- Fix: send-dealer-auction-digest and send-inactivity-email cron jobs
-- were missing timeout_milliseconds, causing pg_net to use the 5s default.
-- These functions process 70+ dealers with N+1 queries and need 60-120s.
-- Also: all other working cron jobs (2,5,6,7,8,10) already have 30s timeout.

-- ── Fix Job 18: send-dealer-auction-digest (daily 08:00 UTC) ────────────
SELECT cron.unschedule('send-dealer-auction-digest');
SELECT cron.schedule(
  'send-dealer-auction-digest',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/send-dealer-auction-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- ── Fix Job 19: send-inactivity-email (daily 09:00 UTC) ─────────────────
SELECT cron.unschedule('send-inactivity-emails');
SELECT cron.schedule(
  'send-inactivity-emails',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/send-inactivity-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
