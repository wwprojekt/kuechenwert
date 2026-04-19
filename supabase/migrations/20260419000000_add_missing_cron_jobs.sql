-- ─────────────────────────────────────────────────────────────────────────
-- Add missing cron jobs identified in cron audit (2026-04-19):
--
-- 1. process-dunning      – Mahnwesen (1×/Tag, 11:00 UTC)
--    Edge Function exists in repo but had no schedule. Without this cron,
--    dunning emails are only sent if an admin manually invokes the function.
--
-- 2. cleanup-expired-sessions – Auth-Session GC (1×/Tag, 03:30 UTC)
--    SQL function exists since 20260410115326 but was never scheduled.
--    Removes auth.sessions older than 8 days to prevent zombie-session
--    Lock conflicts and keep the auth tables lean.
--
-- All HTTP-based jobs use the same vault-based auth pattern as the other
-- cron jobs (see 20260414160000_fix_cron_job_timeouts.sql).
-- ─────────────────────────────────────────────────────────────────────────

-- ─── 1. process-dunning ───────────────────────────────────────────────────
-- Idempotent: try to unschedule first (will silently error if not present),
-- then re-schedule. Wrapped in DO block so a missing schedule on first run
-- doesn't abort the whole migration.
DO $$
BEGIN
  PERFORM cron.unschedule('process-dunning');
EXCEPTION WHEN OTHERS THEN
  -- Schedule didn't exist yet; ignore.
  NULL;
END $$;

SELECT cron.schedule(
  'process-dunning',
  '0 11 * * *',  -- daily at 11:00 UTC (after payment-reminders at 10:00)
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/process-dunning',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- ─── 2. cleanup-expired-sessions ──────────────────────────────────────────
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-expired-sessions');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'cleanup-expired-sessions',
  '30 3 * * *',  -- daily at 03:30 UTC (low-traffic window)
  $$ SELECT public.cleanup_expired_sessions(); $$
);

-- ─── Documentation comment for future maintainers ─────────────────────────
COMMENT ON FUNCTION public.cleanup_expired_sessions() IS
  'Removes auth.sessions older than 8 days. Scheduled daily at 03:30 UTC via pg_cron job "cleanup-expired-sessions" (added in migration 20260419000000).';
