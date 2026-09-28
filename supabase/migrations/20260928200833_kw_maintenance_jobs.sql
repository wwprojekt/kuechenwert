-- ============================================================================
-- Betrieb: Löschfristen, Gesundheitsprüfung und fehlende Zeitpläne (28.09.2026)
--
-- Bisher liefen nur Marktplatz- und Auftrags-Worker. Mahnlauf,
-- Zahlungserinnerung und geplante Admin-Mails liefen nie automatisch, es gab
-- keine Löschfristen (die Datenschutzerklärung verspricht Löschung nach
-- Erledigung) und cron.job_run_details wuchs um rund 2.900 Zeilen pro Tag.
--
-- Löschfristen (kw-maintenance, täglich):
--   * Ausschreibung ohne Zuschlag beendet (abgelaufen/abgebrochen): 90 Tage
--     nach Ende anonymisieren.
--   * Zuschlag erteilt: 36 Monate nach der Entscheidung (Verjährung von
--     Provisionsansprüchen, § 195 BGB) – nicht, solange ein Auftrag in den
--     letzten 12 Monaten noch bearbeitet wurde.
--   * Anfrage ohne Ausschreibung: 180 Tage nach Eingang.
--   * Planer-Sitzungen ohne Anfrage: 30 Tage nach letzter Änderung löschen.
--   * Fehlerprotokoll 90 Tage, Statistik 14 Monate, Rate-Limit-Zähler 2 Tage,
--     verarbeitete Outbox 30 Tage (fehlgeschlagene 90 Tage), abgelaufene
--     Projektlinks 30 Tage, erledigte Kontaktanfragen 180 Tage,
--     Studio-Benachrichtigungen und Aufrufprotokolle 12 Monate,
--     Cron-Protokoll 14 Tage.
--   Rechnungen (GoBD) und Einwilligungsnachweise (Art. 7 Abs. 1 DSGVO, ohne
--   IP/User-Agent) bleiben erhalten.
--
-- Gesundheitsprüfung (kw-maintenance, stündlich): Outbox, Cron, HTTP-Aufrufe,
-- offene Anfragen, blockierte Rechnungen, kritische Fehler. Hinweis-Mail an
-- das Admin-Postfach, je Befund höchstens alle 12 Stunden.
-- ============================================================================

alter table public.leads add column if not exists anonymized_at timestamptz;

comment on column public.leads.anonymized_at is
  'Zeitpunkt der Anonymisierung (Kundenwunsch oder Löschfrist); gesetzt von kw_anonymize_lead.';

update public.leads
set anonymized_at = updated_at
where anonymized_at is null and email is null and first_name = 'Gelöscht';

create index if not exists leads_retention_idx on public.leads (created_at) where anonymized_at is null;

create or replace function public.kw_anonymize_lead(p_lead_id uuid, p_source text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: nur service_role; Dateien löscht der Aufrufer vorher über die
  -- Storage-API (kw_lead_storage_paths).
  v_lead record;
  v_a public.lead_auctions%rowtype;
begin
  select id, email, anonymized_at into v_lead from public.leads where id = p_lead_id for update;
  if v_lead.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_lead.anonymized_at is not null then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  select * into v_a from public.lead_auctions
  where lead_id = p_lead_id and status in ('draft', 'active', 'completed')
  for update;
  if v_a.id is not null then
    update public.lead_auctions
       set status = 'cancelled', cancelled_reason = 'Daten gelöscht', decided_at = now()
     where id = v_a.id;
    update public.lead_bids set status = 'declined' where auction_id = v_a.id and status = 'active';
    perform public.kw_enqueue('project_cancelled', jsonb_build_object('auction_id', v_a.id, 'lead_id', p_lead_id));
  end if;

  -- Mail-Protokoll mit dem Kunden (Projektlinks, Angebote, Antworten) leeren;
  -- Studio- und Kontomails tragen eine recipient_id und bleiben unberührt.
  if v_lead.email is not null then
    update public.admin_emails
       set body_html = '', body_text = '', recipient_name = null,
           recipient_email = 'geloescht@anonymisiert.invalid', raw_headers = null, attachments = null
     where recipient_id is null and lower(recipient_email) = lower(v_lead.email);
    update public.admin_emails
       set body_html = '', body_text = '', sender_name = null,
           sender_email = 'geloescht@anonymisiert.invalid', raw_headers = null, attachments = null
     where direction = 'inbound' and lower(sender_email) = lower(v_lead.email);
  end if;

  update public.leads
     set first_name = 'Gelöscht',
         last_name = null,
         email = null,
         phone = null,
         address_line = null,
         city = null,
         ip_address = null,
         user_agent = null,
         special_wishes = null,
         consent_call = false,
         consent_marketing = false,
         gclid = null, gbraid = null, wbraid = null, msclkid = null, fbclid = null,
         user_id = null,
         funnel_answers = coalesce(funnel_answers, '{}'::jsonb)
           - 'salutation' - 'extrasNotes' - 'wishes' - 'special_wishes' - 'notes' - 'contact',
         status = case when status = 'closed_won' then status else 'closed_lost'::lead_status end,
         anonymized_at = now()
   where id = p_lead_id;

  update public.lead_consents set ip_address = null, user_agent = null where lead_id = p_lead_id;
  update public.lead_access_tokens set revoked_at = now() where lead_id = p_lead_id and revoked_at is null;
  delete from public.lead_upload_tokens where lead_id = p_lead_id;
  delete from public.lead_files where lead_id = p_lead_id;
  delete from public.lead_views where lead_id = p_lead_id;
  update public.planner_sessions
     set photo_paths = '{}', ip_address = null, user_agent = null, expert_note = null
   where lead_id = p_lead_id;
  update public.planner_renders r
     set image_path = null, input_image_path = null, user_message = null
    from public.planner_sessions s
   where s.id = r.session_id and s.lead_id = p_lead_id;

  insert into public.audit_logs (action, entity_type, entity_id, details)
  values ('lead_anonymized', 'lead', p_lead_id::text, jsonb_build_object('source', p_source));

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.kw_retention_due_leads(p_limit integer default 50)
returns table(lead_id uuid, reason text)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: nur service_role (kw-maintenance); liest Leads, Ausschreibungen
  -- und Aufträge ohne RLS.
  with candidates as (
    select l.id,
      case
        when exists (select 1 from public.lead_auctions a where a.lead_id = l.id and a.status = 'awarded') then
          case when (
            select max(coalesce(a.decided_at, a.updated_at)) from public.lead_auctions a
            where a.lead_id = l.id and a.status = 'awarded'
          ) < now() - interval '36 months' then 'zuschlag_36_monate' end
        when exists (select 1 from public.lead_auctions a where a.lead_id = l.id and a.status in ('draft', 'active')) then
          null
        when exists (select 1 from public.lead_auctions a where a.lead_id = l.id) then
          case when (
            select max(coalesce(a.decided_at, a.decision_deadline_at, a.ends_at, a.updated_at))
            from public.lead_auctions a where a.lead_id = l.id
          ) < now() - interval '90 days' then 'beendet_90_tage' end
        else
          case when l.created_at < now() - interval '180 days' then 'ohne_ausschreibung_180_tage' end
      end as reason
    from public.leads l
    where l.anonymized_at is null
  )
  select c.id, c.reason
  from candidates c
  where c.reason is not null
    and not exists (
      select 1 from public.kw_orders o
      where o.lead_id = c.id
        and o.completed_at is null and o.cancelled_at is null
        and o.updated_at > now() - interval '12 months'
    )
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

create or replace function public.kw_retention_stale_planner_files(p_limit integer default 100)
returns table(session_id uuid, bucket text, path text)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: nur service_role (kw-maintenance). Je Sitzung eine Zeile mit
  -- bucket/path = null, damit auch Sitzungen ohne Dateien geliefert werden.
  with s as (
    select id, photo_paths
    from public.planner_sessions
    where lead_id is null and updated_at < now() - interval '30 days'
    order by updated_at
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  )
  select s.id, null::text, null::text from s
  union all
  select s.id, 'planner-media', p from s, unnest(coalesce(s.photo_paths, '{}')) p
  union all
  select r.session_id, coalesce(r.storage_bucket, 'planner-media'), r.image_path
  from public.planner_renders r join s on s.id = r.session_id
  where r.image_path is not null
  union all
  select r.session_id, 'planner-media', r.input_image_path
  from public.planner_renders r join s on s.id = r.session_id
  where r.input_image_path is not null;
$$;

create or replace function public.kw_delete_planner_sessions(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: nur service_role; löscht ausschließlich Sitzungen ohne Anfrage
  -- (Renderings per Kaskade), nachdem kw-maintenance die Dateien entfernt hat.
  v_count integer;
begin
  delete from public.planner_sessions
  where id = any(p_ids) and lead_id is null and updated_at < now() - interval '30 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.kw_retention_cleanup()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: löscht abgelaufene Betriebsdaten tabellenübergreifend (inkl.
  -- cron.job_run_details); nur service_role (kw-maintenance).
  v_result jsonb := '{}'::jsonb;
  v_count bigint;
begin
  delete from public.error_logs where coalesce(last_seen_at, created_at) < now() - interval '90 days';
  get diagnostics v_count = row_count; v_result := v_result || jsonb_build_object('error_logs', v_count);

  delete from public.analytics_events where created_at < now() - interval '14 months';
  get diagnostics v_count = row_count; v_result := v_result || jsonb_build_object('analytics_events', v_count);

  delete from public.analytics_page_views where created_at < now() - interval '14 months';
  get diagnostics v_count = row_count; v_result := v_result || jsonb_build_object('analytics_page_views', v_count);

  delete from public.analytics_sessions where created_at < now() - interval '14 months';
  get diagnostics v_count = row_count; v_result := v_result || jsonb_build_object('analytics_sessions', v_count);

  delete from public.planner_rate_limits where window_start < now() - interval '2 days';
  get diagnostics v_count = row_count; v_result := v_result || jsonb_build_object('planner_rate_limits', v_count);

  delete from public.rate_limits where window_end < now() - interval '1 day';
  get diagnostics v_count = row_count; v_result := v_result || jsonb_build_object('rate_limits', v_count);

  delete from public.kw_outbox
  where (processed_at is not null and processed_at < now() - interval '30 days')
     or (processed_at is null and attempts >= 8 and created_at < now() - interval '90 days');
  get diagnostics v_count = row_count; v_result := v_result || jsonb_build_object('kw_outbox', v_count);

  delete from public.lead_access_tokens where coalesce(revoked_at, expires_at) < now() - interval '30 days';
  get diagnostics v_count = row_count; v_result := v_result || jsonb_build_object('lead_access_tokens', v_count);

  delete from public.contact_messages
  where coalesce(deleted_at, case when status = 'resolved' then coalesce(updated_at, created_at) end) < now() - interval '180 days';
  get diagnostics v_count = row_count; v_result := v_result || jsonb_build_object('contact_messages', v_count);

  delete from public.dealer_notifications where created_at < now() - interval '12 months';
  get diagnostics v_count = row_count; v_result := v_result || jsonb_build_object('dealer_notifications', v_count);

  delete from public.lead_views where viewed_at < now() - interval '12 months';
  get diagnostics v_count = row_count; v_result := v_result || jsonb_build_object('lead_views', v_count);

  delete from cron.job_run_details where end_time < now() - interval '14 days';
  get diagnostics v_count = row_count; v_result := v_result || jsonb_build_object('cron_job_run_details', v_count);

  return v_result;
end;
$$;

create or replace function public.kw_health_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: liest Outbox, Cron-Protokoll, pg_net-Antworten, Anfragen,
  -- Rechnungen und Fehler für kw-maintenance; nur service_role.
  select jsonb_build_object(
    'outbox_dead', (select count(*) from public.kw_outbox where processed_at is null and attempts >= 8),
    'outbox_stuck', (select count(*) from public.kw_outbox where processed_at is null and attempts < 8 and available_at < now() - interval '30 minutes'),
    'cron_failed', (select count(*) from cron.job_run_details where status = 'failed' and start_time > now() - interval '2 hours'),
    'http_failed', (select count(*) from net._http_response where created > now() - interval '2 hours' and (status_code >= 400 or error_msg is not null or timed_out)),
    'leads_waiting', (
      select count(*) from public.leads l
      where l.status = 'new' and l.anonymized_at is null
        and l.created_at between now() - interval '30 days' and now() - interval '24 hours'
        and not exists (select 1 from public.lead_auctions a where a.lead_id = l.id)
    ),
    'invoices_blocked', (
      select count(*) from public.invoices i
      where i.status = 'draft' and i.created_at < now() - interval '1 day'
        and i.invoice_type in ('lead_purchase', 'lead_commission')
        and coalesce((select m.auto_issue_invoices from public.kw_marketplace_settings m limit 1), true)
    ),
    'errors_critical', (select count(*) from public.error_logs where severity = 'critical' and coalesce(last_seen_at, created_at) > now() - interval '1 hour')
  );
$$;

revoke execute on function public.kw_retention_due_leads(integer) from public, anon, authenticated;
revoke execute on function public.kw_retention_stale_planner_files(integer) from public, anon, authenticated;
revoke execute on function public.kw_delete_planner_sessions(uuid[]) from public, anon, authenticated;
revoke execute on function public.kw_retention_cleanup() from public, anon, authenticated;
revoke execute on function public.kw_health_snapshot() from public, anon, authenticated;
revoke execute on function public.kw_anonymize_lead(uuid, text) from public, anon, authenticated;
grant execute on function public.kw_retention_due_leads(integer) to service_role;
grant execute on function public.kw_retention_stale_planner_files(integer) to service_role;
grant execute on function public.kw_delete_planner_sessions(uuid[]) to service_role;
grant execute on function public.kw_retention_cleanup() to service_role;
grant execute on function public.kw_health_snapshot() to service_role;
grant execute on function public.kw_anonymize_lead(uuid, text) to service_role;
grant execute on function public.planner_rate_limit_increment(text, integer, integer) to service_role;

-- ── Zeitpläne (UTC) ─────────────────────────────────────────────────────────
do $$
declare
  v_job text;
begin
  foreach v_job in array array['kw-maintenance-retention', 'kw-maintenance-health', 'kw-dunning', 'kw-payment-reminder', 'kw-scheduled-emails'] loop
    if exists (select 1 from cron.job where jobname = v_job) then
      perform cron.unschedule(v_job);
    end if;
  end loop;
end $$;

select cron.schedule('kw-maintenance-retention', '15 2 * * *', $cmd$
  select net.http_post(
    url := 'https://gzqayoalwtmypndrmqes.supabase.co/functions/v1/kw-maintenance',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-kw-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'kw_cron_secret')),
    body := '{"task":"retention"}'::jsonb,
    timeout_milliseconds := 55000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'kw_cron_secret');
$cmd$);

select cron.schedule('kw-maintenance-health', '5 * * * *', $cmd$
  select net.http_post(
    url := 'https://gzqayoalwtmypndrmqes.supabase.co/functions/v1/kw-maintenance',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-kw-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'kw_cron_secret')),
    body := '{"task":"health"}'::jsonb,
    timeout_milliseconds := 55000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'kw_cron_secret');
$cmd$);

select cron.schedule('kw-dunning', '30 7 * * *', $cmd$
  select net.http_post(
    url := 'https://gzqayoalwtmypndrmqes.supabase.co/functions/v1/process-dunning',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-kw-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'kw_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'kw_cron_secret')
    and exists (
      select 1 from public.invoices
      where status not in ('draft', 'cancelled', 'paid')
        and payment_status in ('pending', 'partial')
        and due_date < current_date
    );
$cmd$);

select cron.schedule('kw-payment-reminder', '0 7 * * *', $cmd$
  select net.http_post(
    url := 'https://gzqayoalwtmypndrmqes.supabase.co/functions/v1/send-payment-reminder',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-kw-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'kw_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'kw_cron_secret')
    and exists (
      select 1 from public.invoices
      where status not in ('draft', 'cancelled', 'paid')
        and payment_status in ('pending', 'partial')
        and coalesce(payment_reminder_sent, false) = false
        and due_date <= current_date - 3
    );
$cmd$);

select cron.schedule('kw-scheduled-emails', '*/5 * * * *', $cmd$
  select net.http_post(
    url := 'https://gzqayoalwtmypndrmqes.supabase.co/functions/v1/process-scheduled-emails',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-kw-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'kw_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'kw_cron_secret')
    and exists (
      select 1 from public.admin_emails
      where status in ('scheduled', 'queued') and scheduled_at is not null and scheduled_at <= now()
    );
$cmd$);
