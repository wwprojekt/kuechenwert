-- Rollback der vorherigen Migration (20260420203000_speed_up_process_photo_crons).
--
-- 20er Batch fuer process-photo triggert HTTP 546 (WORKER_RESOURCE_LIMIT) im
-- Cron-Lauf. jsquash WASM-Module akkumulieren Memory zwischen sequentiellen
-- Decodes. Empirisch ist 10 das stabile Maximum.
--
-- Throughput-Verlust ist OK: der Cloudflare Worker /api/auctions/active liefert
-- jetzt on-the-fly Image-Transformation-URLs (480w/q70) als Fallback wenn keine
-- Variant existiert. /kaufen ist daher nicht mehr von der Variant-Pipeline-
-- Geschwindigkeit abhaengig.

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
        body := jsonb_build_object('batchSize', 10, 'priority', 'active_covers'),
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
        body := jsonb_build_object('batchSize', 10, 'priority', 'fifo'),
        timeout_milliseconds := 60000
      ) as request_id;
    $cmd$, v_url, v_service_key)
  );
end $$;
