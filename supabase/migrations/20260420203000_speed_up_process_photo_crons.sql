-- Beschleunigt die Cover-Variant-Pipeline.
--
-- Stand 2026-04-20 19:00 UTC: 44 von 77 active covers haben noch keine
-- card_url/medium_url-Variants → /kaufen lädt 5-13 MB Original-JPGs für
-- diese Cards. User berichtet noch immer "extrem langsam".
--
-- Änderung:
--   • active_covers Batch  10 → 20 (verdoppelt Throughput auf 20 photos/min,
--     verbleibender Backlog von ~44 covers in <3 min weg)
--   • fifo Batch          10 → 15 (50 % mehr non-blocking Background-Work)
--
-- Risk: pg_cron timeout bleibt 60000 ms. Bei 20 photos × ~3 s WASM-Decode =
-- 60 s Worst-Case — knapp aber im Limit. Falls timeouts auftreten würden,
-- müssen wir auf 15/Batch zurück. Wir monitoren via cron.job_run_details.

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
    '*/1 * * * *',
    format($cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body := jsonb_build_object('batchSize', 20, 'priority', 'active_covers'),
        timeout_milliseconds := 60000
      ) as request_id;
    $cmd$, v_url, v_service_key)
  );

  perform cron.schedule(
    'process-photo-fifo',
    '*/2 * * * *',
    format($cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body := jsonb_build_object('batchSize', 15, 'priority', 'fifo'),
        timeout_milliseconds := 60000
      ) as request_id;
    $cmd$, v_url, v_service_key)
  );
end $$;
