-- Persist the process-photo cron schedule to */5 (active_covers) and */10 (fifo).
--
-- Background: An earlier migration (in git only, never applied) tried to throttle
-- these jobs after a backlog had drained. Because the migration was not persisted
-- to supabase_migrations.schema_migrations, the live DB kept running the previous
-- "fast" schedule (*/1 and */2) and on 2026-04-21 18:00 UTC overloaded the
-- connection pool / storage worker for ~16h. This migration is the persisted
-- version of that fix and is safe to re-run (idempotent).

DO $$
DECLARE
  active_jobid bigint;
  fifo_jobid   bigint;
BEGIN
  SELECT jobid INTO active_jobid FROM cron.job WHERE jobname = 'process-photo-active-covers';
  SELECT jobid INTO fifo_jobid   FROM cron.job WHERE jobname = 'process-photo-fifo';

  IF active_jobid IS NOT NULL THEN
    PERFORM cron.alter_job(job_id => active_jobid, schedule => '*/5 * * * *');
  END IF;

  IF fifo_jobid IS NOT NULL THEN
    PERFORM cron.alter_job(job_id => fifo_jobid, schedule => '*/10 * * * *');
  END IF;
END;
$$;
