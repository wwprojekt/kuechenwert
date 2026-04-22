-- Drosselt die Process-Photo-Cron-Jobs nach Backlog-Abbau.
--
-- Stand 2026-04-22 09:45 UTC: Backlog vollständig abgearbeitet
--   pending=0, failed=34 (chronisch >=5 attempts, brauchen Manual-Review),
--   done=2265 von 2299 total.
--
-- Diagnose: Die am 2026-04-20 angelegten hochfrequenten Schedules
-- (active_covers every 1 min, fifo every 2 min, Batches 20/15) haben
-- die pg_cron-Last von ~79 auf ~180 Runs/h verdoppelt. Das fiel exakt mit
-- dem User-berichteten Slowdown "ab ca. 18 Uhr abends" zusammen, weil sich
-- Edge-Function-Calls + Storage-Roundtrips + DB-Writes mit dem Traffic-Peak
-- überlagert haben.
--
-- Da der Backlog jetzt leer ist, reicht eine deutlich seltenere Verarbeitung
-- für neu hochgeladene Photos. Worst-Case-Latenz für eine neu inserierte
-- Auction-Cover-Variant: ~5 min statt ~1 min — das ist akzeptabel, weil der
-- MotorhomeCard-Fallback solange das Original anzeigt.
--
-- Änderungen:
--   active_covers : */1 → */5  (60 → 12 calls/h)   batchSize 20 → 5
--   fifo          : */2 → */10 (30 →  6 calls/h)   batchSize 15 → 5
--   Σ Backend-Last: -72 calls/h (-40 % der heutigen Cron-Last)
--
-- Reversibel: Wenn der Backlog wieder wächst (>50 pending), einfach die
-- Migration 20260420203000_speed_up_process_photo_crons.sql erneut anwenden
-- oder per cron.alter_job das Schedule wieder verkürzen.

do $$
declare
  v_service_key text;
  v_url text := 'https://zcrwqxsyptjwkuxfacvq.supabase.co/functions/v1/process-photo';
begin
  select decrypted_secret into v_service_key
  from vault.decrypted_secrets
  where name = 'service_role_key';

  if v_service_key is null then
    raise exception 'service_role_key not found in vault';
  end if;

  perform cron.unschedule('process-photo-active-covers') where exists (
    select 1 from cron.job where jobname = 'process-photo-active-covers'
  );
  perform cron.unschedule('process-photo-fifo') where exists (
    select 1 from cron.job where jobname = 'process-photo-fifo'
  );

  perform cron.schedule(
    'process-photo-active-covers',
    '*/5 * * * *',
    format($cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body := jsonb_build_object('batchSize', 5, 'priority', 'active_covers'),
        timeout_milliseconds := 60000
      ) as request_id;
    $cmd$, v_url, v_service_key)
  );

  perform cron.schedule(
    'process-photo-fifo',
    '*/10 * * * *',
    format($cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body := jsonb_build_object('batchSize', 5, 'priority', 'fifo'),
        timeout_milliseconds := 60000
      ) as request_id;
    $cmd$, v_url, v_service_key)
  );
end $$;
