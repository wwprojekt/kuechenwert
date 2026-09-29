-- ============================================================================
-- admin_emails: fehlende email_type-Werte im Check-Constraint
-- ============================================================================
--
-- Der Constraint admin_emails_email_type_check stammt aus dem CaravanWert-Fork.
-- Sechs Typen, die Functions heute schreiben, fehlten; deren Protokollzeilen
-- scheiterten still (der Versand selbst lief):
--   ops_health_alert            kw-maintenance (Betriebshinweise)
--   gads_search_terms_report    kw-google-ads (Wochenbericht, Wiederholungssperre)
--   email_confirmation_resend   resend-confirmation-email
--   invoice_cancellation        cancel-invoice
--   account_deleted             admin-delete-user
--   dealer_application_deleted  admin-delete-dealer-application
-- Ergänzt werden nur fehlende Werte; bestehende bleiben (Altdaten).
-- ============================================================================

do $$
declare
  v_def text;
  v_add text := '';
  v_type text;
begin
  select pg_get_constraintdef(oid) into v_def
    from pg_constraint
   where conrelid = 'public.admin_emails'::regclass and conname = 'admin_emails_email_type_check';
  if v_def is null then
    raise exception 'admin_emails_email_type_check fehlt';
  end if;
  foreach v_type in array array['ops_health_alert', 'gads_search_terms_report', 'email_confirmation_resend',
                                'invoice_cancellation', 'account_deleted', 'dealer_application_deleted'] loop
    if strpos(v_def, '''' || v_type || '''::text') = 0 then
      v_add := v_add || ', ''' || v_type || '''::text';
    end if;
  end loop;
  if v_add = '' then
    return;
  end if;
  if right(v_def, 4) <> '])))' then
    raise exception 'Unerwartete Form von admin_emails_email_type_check: …%', right(v_def, 40);
  end if;
  execute 'alter table public.admin_emails drop constraint admin_emails_email_type_check';
  execute 'alter table public.admin_emails add constraint admin_emails_email_type_check '
       || left(v_def, length(v_def) - 4) || v_add || '])))';
end $$;
