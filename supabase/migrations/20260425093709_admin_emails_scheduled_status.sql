-- Extend admin_emails.status CHECK-Constraint um 'scheduled' fuer die
-- Quiet-Hours-Queue und fuer das bestehende send-admin-email Scheduling,
-- das zuvor stillschweigend am Constraint scheiterte (scheduled_rows=0
-- in Produktion).
--
-- Alte Werte bleiben erhalten, nur 'scheduled' wird hinzugefuegt.

alter table public.admin_emails
  drop constraint if exists admin_emails_status_check;

alter table public.admin_emails
  add constraint admin_emails_status_check
  check (status = any (array[
    'queued'::text,
    'scheduled'::text,
    'sent'::text,
    'delivered'::text,
    'opened'::text,
    'clicked'::text,
    'bounced'::text,
    'failed'::text,
    'read'::text,
    'unread'::text
  ]));

comment on constraint admin_emails_status_check on public.admin_emails is
  'Erlaubte Status-Werte fuer admin_emails. `scheduled` wird verwendet wenn die Mail zu einem spaeteren Zeitpunkt per process-scheduled-emails-Cron versendet werden soll (z. B. Quiet-Hours-Deferral).';
