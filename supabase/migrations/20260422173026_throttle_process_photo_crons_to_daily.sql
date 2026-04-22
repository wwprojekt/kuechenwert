-- 2026-04-22: process-photo Crons drastisch throttlen auf 1x/Tag.
--
-- Hintergrund: Die Edge Function `process-photo` crasht bei ~80% der Aufrufe
-- mit HTTP 546 (WORKER_RESOURCE_LIMIT), weil jsquash WASM bei normalen 4032×3024
-- iPhone-JPEGs den 256 MB Function-Heap sprengt. Selbst batchSize=1 hilft nicht.
--
-- Lösung: On-demand Resize via Cloudflare Worker /img/?w=480 hat process-photo
-- praktisch obsolet gemacht. Cards/Detail-Photos werden jetzt via Supabase
-- Image Transformation (vom Worker geproxied + 1 Jahr CF-Edge gecached) on
-- demand resized. Funktioniert auch wenn process-photo komplett ausfällt.
--
-- Wir behalten die Crons aber 1x/Tag laufen, damit:
--   1. Pre-baked card_url/medium_url für alte Photos weiterhin generiert
--      werden (kostenlos, weil Cron schon läuft) -> Fallback-Pfad im Worker
--   2. Bei Worker- oder Image-Transformation-Outage haben wir ein Backup
--   3. Falls jemand das System spamt, bleibt der Worker-Quota geschützt
--
-- Schedule: 03:30 / 03:35 nachts, niedrige Last-Zeit, EINE Photo-Iteration.

DO $$
DECLARE
  active_jobid bigint;
  fifo_jobid   bigint;
BEGIN
  SELECT jobid INTO active_jobid FROM cron.job WHERE jobname = 'process-photo-active-covers';
  SELECT jobid INTO fifo_jobid   FROM cron.job WHERE jobname = 'process-photo-fifo';

  IF active_jobid IS NOT NULL THEN
    PERFORM cron.alter_job(job_id => active_jobid, schedule => '30 3 * * *');
  END IF;

  IF fifo_jobid IS NOT NULL THEN
    PERFORM cron.alter_job(job_id => fifo_jobid, schedule => '35 3 * * *');
  END IF;
END;
$$;
