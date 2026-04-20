-- Background-Pipeline für Bild-Variants (card 480px / medium 1024px WebP).
--
-- Hintergrund: Phase 1/2 hat die `process-photo` Edge-Function gebaut, aber
-- der zugehörige Cron wurde nie eingerichtet (die alte `resize-photo-variants`
-- war broken und wurde gestoppt). Daher hatten 2081 Photos NIE Variants und
-- /kaufen lieferte 2-6 MB Original-JPEGs statt 50 KB WebP — DAS war der echte
-- Performance-Bottleneck, nicht ein Cache-Header.
--
-- Zwei Jobs mit unterschiedlicher Priorität:
--   1) active_covers: jede Minute, 10/Batch → leert 70 sichtbare Cover in ~7 min
--   2) fifo: alle 2 Minuten, 10/Batch → arbeitet den Rest in ~3.5 h ab
--
-- Idempotent: Falls die Jobs schon existieren, werden sie ersetzt.

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
        body := jsonb_build_object('batchSize', 10, 'priority', 'active_covers'),
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
        body := jsonb_build_object('batchSize', 10, 'priority', 'fifo'),
        timeout_milliseconds := 60000
      ) as request_id;
    $cmd$, v_url, v_service_key)
  );
end $$;
