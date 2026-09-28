-- Kontaktanfragen nur noch über die Edge Function kw-contact.
--
-- Die Policy "Anyone can submit contact messages" (WITH CHECK true) erlaubte
-- jedem einen direkten INSERT über PostgREST, vorbei an Turnstile,
-- Rate-Limit und Validierung in kw-contact. Die Kontaktseite sendet seit dem
-- Deploy vom 2026-09-28 ausschließlich über kw-contact (Service Role).
-- Admins lesen, bearbeiten und löschen weiterhin über die bestehenden
-- Admin-Policies (authenticated).

drop policy if exists "Anyone can submit contact messages" on public.contact_messages;

revoke all on public.contact_messages from anon;
revoke insert, truncate, references, trigger on public.contact_messages from authenticated;
