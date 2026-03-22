-- Fix: Update cron job to point to the correct Supabase project
-- Old project: cmvhcudymrtvmbomkenq (wrong)
-- New project: zcrwqxsyptjwkuxfacvq (correct)

-- Remove the old cron job
SELECT cron.unschedule('check-expired-auctions');

-- Re-create with the correct project URL and service role key
SELECT cron.schedule(
  'check-expired-auctions',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://zcrwqxsyptjwkuxfacvq.supabase.co/functions/v1/check-expired-auctions',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjcndxeHN5cHRqd2t1eGZhY3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzgwMzcsImV4cCI6MjA4OTYxNDAzN30.5-ds7Fw1392_iyRLKpXVtTkOyZ0-bDIcTivdGEOFrhc"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Add cron job for auction ending notifications (every 15 minutes)
-- This checks for auctions ending within the next hour and notifies bidders
SELECT cron.schedule(
  'send-auction-ending-notifications',
  '*/15 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://zcrwqxsyptjwkuxfacvq.supabase.co/functions/v1/send-auction-ending-notification',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjcndxeHN5cHRqd2t1eGZhY3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzgwMzcsImV4cCI6MjA4OTYxNDAzN30.5-ds7Fw1392_iyRLKpXVtTkOyZ0-bDIcTivdGEOFrhc"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);
