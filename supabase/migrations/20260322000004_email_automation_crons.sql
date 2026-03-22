-- =============================================
-- Migration: E-Mail-Automatisierung Cron-Jobs
-- Termin-Erinnerung, Zahlungserinnerung, Auktions-Zusammenfassung,
-- Inaktivitäts-E-Mail, geplanter Versand, Willkommens-E-Mail
-- =============================================

-- 1. Neue Spalten für Tracking
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_reminder_sent BOOLEAN DEFAULT false;

-- 2. Webhook signing secret in site_settings (für Resend Webhook-Verifizierung)
-- Wird als Umgebungsvariable in der Edge Function gespeichert

-- 3. Bounced email tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_bounced BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_bounced_at TIMESTAMPTZ;

-- 4. Cron-Job: Geplante E-Mails verarbeiten (alle 5 Minuten)
SELECT cron.schedule(
  'process-scheduled-emails',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zcrwqxsyptjwkuxfacvq.supabase.co/functions/v1/process-scheduled-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 5. Cron-Job: Termin-Erinnerungen (täglich um 8:00 Uhr)
SELECT cron.schedule(
  'send-appointment-reminders',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zcrwqxsyptjwkuxfacvq.supabase.co/functions/v1/send-appointment-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 6. Cron-Job: Zahlungserinnerungen (täglich um 10:00 Uhr)
SELECT cron.schedule(
  'send-payment-reminders',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zcrwqxsyptjwkuxfacvq.supabase.co/functions/v1/send-payment-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 7. Cron-Job: Auktions-Zusammenfassung für Verkäufer (täglich um 18:00 Uhr)
SELECT cron.schedule(
  'send-auction-summaries',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zcrwqxsyptjwkuxfacvq.supabase.co/functions/v1/send-auction-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 8. Cron-Job: Inaktivitäts-E-Mails (wöchentlich Montag um 9:00 Uhr)
SELECT cron.schedule(
  'send-inactivity-emails',
  '0 9 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://zcrwqxsyptjwkuxfacvq.supabase.co/functions/v1/send-inactivity-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 9. DB-Trigger: Willkommens-E-Mail nach E-Mail-Bestätigung
-- Wird über einen Trigger auf auth.users ausgelöst wenn email_confirmed_at gesetzt wird
CREATE OR REPLACE FUNCTION public.trigger_welcome_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Nur auslösen wenn email_confirmed_at gerade gesetzt wurde
  IF NEW.email_confirmed_at IS NOT NULL AND (OLD.email_confirmed_at IS NULL) THEN
    PERFORM net.http_post(
      url := 'https://zcrwqxsyptjwkuxfacvq.supabase.co/functions/v1/send-welcome-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object('user_id', NEW.id::text)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger auf auth.users
DROP TRIGGER IF EXISTS on_user_email_confirmed ON auth.users;
CREATE TRIGGER on_user_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_welcome_email();
