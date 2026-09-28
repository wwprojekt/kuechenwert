-- ============================================================================
-- Kontaktformular über die Edge Function kw-contact (28.09.2026)
--
-- submission_id verhindert doppelte Nachrichten bei Wiederholung, bot_check
-- hält das Turnstile-Ergebnis fest. Der direkte INSERT für anon bleibt, bis
-- das Frontend mit kw-contact live ist, und wird danach in einer eigenen
-- Migration entzogen.
-- ============================================================================

alter table public.contact_messages add column if not exists submission_id uuid;
alter table public.contact_messages add column if not exists bot_check text;
create unique index if not exists contact_messages_submission_id_key
  on public.contact_messages (submission_id) where submission_id is not null;
