-- Migration: Optimize cron interval and create purchase-contracts storage
-- 1. Change check-expired-auctions from every 5 minutes to every 1 minute
-- 2. Create storage bucket for purchase contracts

-- ─── 1. Update cron job interval ──────────────────────────────────────────────
SELECT cron.unschedule('check-expired-auctions');

SELECT cron.schedule(
  'check-expired-auctions',
  '* * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://zcrwqxsyptjwkuxfacvq.supabase.co/functions/v1/check-expired-auctions',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjcndxeHN5cHRqd2t1eGZhY3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzgwMzcsImV4cCI6MjA4OTYxNDAzN30.5-ds7Fw1392_iyRLKpXVtTkOyZ0-bDIcTivdGEOFrhc"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- ─── 2. Create storage bucket for purchase contracts ──────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('purchase-contracts', 'purchase-contracts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for purchase-contracts bucket
-- Admin can do everything
CREATE POLICY "Admin full access to purchase-contracts"
  ON storage.objects FOR ALL
  USING (bucket_id = 'purchase-contracts' AND EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (bucket_id = 'purchase-contracts' AND EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- Service role can do everything (for Edge Functions)
CREATE POLICY "Service role full access to purchase-contracts"
  ON storage.objects FOR ALL
  USING (bucket_id = 'purchase-contracts')
  WITH CHECK (bucket_id = 'purchase-contracts');

-- Sellers and dealers can read their own contracts
CREATE POLICY "Users can read own purchase-contracts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'purchase-contracts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
