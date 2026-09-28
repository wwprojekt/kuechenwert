-- ============================================================================
-- E-Mail-Einwilligungen protokollieren, Abmeldung per Link (28.09.2026)
--
-- user_notification_preferences speicherte nur den aktuellen Stand von
-- Newsletter, Werbung und Plattform-Hinweisen. Für den Nachweis einer
-- Einwilligung (Art. 7 Abs. 1 DSGVO, § 7 UWG) und eines Widerspruchs braucht
-- es den Verlauf: user_consent_events, befüllt per Trigger bei jeder Änderung
-- (Einstellungsseite, Admin, Abmeldelink). Die Quelle kommt aus der
-- Transaktionsvariable kw.consent_source oder wird aus dem Aufrufer abgeleitet.
--
-- kw_email_unsubscribe: Abmeldung über signierten Link ohne Login
-- (kw-unsubscribe, RFC 8058 One-Click).
-- ============================================================================

create table if not exists public.user_consent_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('newsletter', 'werbung', 'plattform_hinweise')),
  granted boolean not null,
  source text not null,
  created_at timestamptz not null default now()
);

comment on table public.user_consent_events is
  'Verlauf der E-Mail-Einwilligungen (Newsletter, Werbung, Plattform-Hinweise); nur per Trigger beschrieben.';

create index if not exists user_consent_events_user_idx on public.user_consent_events (user_id, created_at desc);

alter table public.user_consent_events enable row level security;

drop policy if exists "Consent events: own read" on public.user_consent_events;
create policy "Consent events: own read"
  on public.user_consent_events for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Consent events: admin read" on public.user_consent_events;
create policy "Consent events: admin read"
  on public.user_consent_events for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'::app_role));

revoke all on public.user_consent_events from anon;
revoke insert, update, delete, truncate on public.user_consent_events from authenticated;
grant select on public.user_consent_events to authenticated;

create or replace function public.kw_log_email_consent()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: schreibt ins Einwilligungsprotokoll, auf das Nutzer keine
  -- Schreibrechte haben.
  v_source text := coalesce(
    nullif(current_setting('kw.consent_source', true), ''),
    case
      when auth.uid() = new.user_id then 'einstellungen'
      when auth.uid() is not null then 'admin'
      else 'system'
    end
  );
begin
  -- Beim Anlegen zählen nur Abweichungen vom Standard (kein Newsletter, keine
  -- Werbung, Plattform-Hinweise an); danach jede Änderung.
  if (tg_op = 'INSERT' and new.newsletter_enabled is true)
     or (tg_op = 'UPDATE' and new.newsletter_enabled is distinct from old.newsletter_enabled) then
    insert into public.user_consent_events (user_id, purpose, granted, source)
    values (new.user_id, 'newsletter', coalesce(new.newsletter_enabled, false), v_source);
  end if;
  if (tg_op = 'INSERT' and new.promotional_emails is true)
     or (tg_op = 'UPDATE' and new.promotional_emails is distinct from old.promotional_emails) then
    insert into public.user_consent_events (user_id, purpose, granted, source)
    values (new.user_id, 'werbung', coalesce(new.promotional_emails, false), v_source);
  end if;
  if (tg_op = 'INSERT' and new.broadcast_emails_enabled is false)
     or (tg_op = 'UPDATE' and new.broadcast_emails_enabled is distinct from old.broadcast_emails_enabled) then
    insert into public.user_consent_events (user_id, purpose, granted, source)
    values (new.user_id, 'plattform_hinweise', coalesce(new.broadcast_emails_enabled, true), v_source);
  end if;
  return new;
end;
$$;

drop trigger if exists kw_log_email_consent on public.user_notification_preferences;
create trigger kw_log_email_consent
  after insert or update of newsletter_enabled, promotional_emails, broadcast_emails_enabled
  on public.user_notification_preferences
  for each row execute function public.kw_log_email_consent();

create or replace function public.kw_email_unsubscribe(p_user_id uuid, p_scope text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- DEFINER: Abmeldung per signiertem Link ohne Login; nur service_role
  -- (kw-unsubscribe prüft die Signatur).
  if p_scope not in ('werbung', 'hinweise') then
    raise exception 'Unbekannter Abmeldebereich: %', p_scope using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  perform set_config('kw.consent_source', 'abmeldelink', true);
  insert into public.user_notification_preferences (user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  if p_scope = 'werbung' then
    update public.user_notification_preferences
       set newsletter_enabled = false, promotional_emails = false, updated_at = now()
     where user_id = p_user_id
       and (newsletter_enabled is distinct from false or promotional_emails is distinct from false);
  else
    update public.user_notification_preferences
       set broadcast_emails_enabled = false, updated_at = now()
     where user_id = p_user_id and broadcast_emails_enabled is distinct from false;
  end if;

  return jsonb_build_object('ok', true, 'scope', p_scope);
end;
$$;

revoke execute on function public.kw_email_unsubscribe(uuid, text) from public, anon, authenticated;
grant execute on function public.kw_email_unsubscribe(uuid, text) to service_role;
