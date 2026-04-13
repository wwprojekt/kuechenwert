-- check-expired-auctions: häufiger ausführen (jede Minute), mit korrekter Auth aus dem Vault.
-- Hintergrund: Migration 20260325000001 nutzte 1-Minuten-Takt aber den ANON-Key → 401, keine Schließung.
-- Migration 20260407100000 stellt service_role aus vault her, aber nur */5.
-- Diese Migration kombiniert: 1-Minuten-Intervall + Vault-Bearer (wie 20260407).

SELECT cron.unschedule('check-expired-auctions');

SELECT cron.schedule(
  'check-expired-auctions',
  '* * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://zcrwqxsyptjwkuxfacvq.supabase.co/functions/v1/check-expired-auctions',
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
        ),
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) AS request_id;
  $$
);
