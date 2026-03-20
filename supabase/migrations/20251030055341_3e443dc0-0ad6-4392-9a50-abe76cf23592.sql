-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant permissions to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Schedule auction expiration check to run every 5 minutes
SELECT cron.schedule(
  'check-expired-auctions',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://cmvhcudymrtvmbomkenq.supabase.co/functions/v1/check-expired-auctions',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtdmhjdWR5bXJ0dm1ib21rZW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MDExNjMsImV4cCI6MjA3NzI3NzE2M30.fReZhCHmaETToAR06JhCr4CXv7TgRZO7SswPd4XdGUY"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);