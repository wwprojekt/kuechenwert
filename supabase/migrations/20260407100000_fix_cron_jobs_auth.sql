-- ============================================================
-- Fix: Cron-Jobs check-expired-auctions und send-auction-ending-notifications
-- verwenden den ANON Key statt service_role Key.
-- 
-- Problem: check-expired-auctions gibt 401 zurück weil die Edge Function
-- service_role oder admin erwartet, aber der Cron-Job den anon-Key sendet.
--
-- Lösung: Beide Cron-Jobs auf das gleiche Pattern umstellen wie in
-- Migration 20260322000004 (Vault-basierter service_role Key).
-- ============================================================

-- 1. Alten check-expired-auctions Cron-Job entfernen
SELECT cron.unschedule('check-expired-auctions');

-- 2. Neuen check-expired-auctions Cron-Job mit service_role Key erstellen
SELECT cron.schedule(
  'check-expired-auctions',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://zcrwqxsyptjwkuxfacvq.supabase.co/functions/v1/check-expired-auctions',
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
        ),
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- 3. Alten send-auction-ending-notifications Cron-Job entfernen
SELECT cron.unschedule('send-auction-ending-notifications');

-- 4. Neuen send-auction-ending-notifications Cron-Job mit service_role Key erstellen
SELECT cron.schedule(
  'send-auction-ending-notifications',
  '*/15 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://zcrwqxsyptjwkuxfacvq.supabase.co/functions/v1/send-auction-ending-notification',
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
        ),
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);
