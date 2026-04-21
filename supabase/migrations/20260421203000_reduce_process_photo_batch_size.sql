-- Reduce process-photo Cron-Batch von 10 → 3.
--
-- Edge Function Logs zeigen dass batchSize=10 in 100% der Aufrufe HTTP 546
-- (WORKER_RESOURCE_LIMIT) triggert. Aktuell werden 0 Photos pro Stunde
-- verarbeitet — der Backlog wächst statt zu schrumpfen.
--
-- 3 Photos pro Aufruf passen sicher in das 256 MB Function-Memory-Limit.
-- Cron läuft jede Minute (active_covers) + alle 2 Min (fifo) = 3+1.5 = 4.5
-- Photos/Min = 270/h = 6480/Tag. Reicht für tägliches Upload-Volumen
-- (~50-100 neue Photos/Tag).
--
-- Bestehender Backlog von ~825 Photos wird parallel via
-- scripts/backfill-photo-variants.mjs (lokal mit sharp) abgearbeitet.

do $$
declare
  v_service_key text;
  v_url text := 'https://zcrwqxsyptjwkuxfacvq.supabase.co/functions/v1/process-photo';
begin
  select decrypted_secret into v_service_key from vault.decrypted_secrets where name = 'service_role_key';

  perform cron.unschedule('process-photo-active-covers') where exists (select 1 from cron.job where jobname='process-photo-active-covers');
  perform cron.unschedule('process-photo-fifo') where exists (select 1 from cron.job where jobname='process-photo-fifo');

  perform cron.schedule(
    'process-photo-active-covers', '*/1 * * * *',
    format($cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '|| %L),
        body := jsonb_build_object('batchSize', 3, 'priority', 'active_covers'),
        timeout_milliseconds := 60000
      ) as request_id;
    $cmd$, v_url, v_service_key)
  );

  perform cron.schedule(
    'process-photo-fifo', '*/2 * * * *',
    format($cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '|| %L),
        body := jsonb_build_object('batchSize', 3, 'priority', 'fifo'),
        timeout_milliseconds := 60000
      ) as request_id;
    $cmd$, v_url, v_service_key)
  );
end $$;
