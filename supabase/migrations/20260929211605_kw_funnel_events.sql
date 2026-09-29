-- ============================================================================
-- Funnel-Telemetrie (29.09.2026)
--
-- Schritt- und Feldereignisse der Funnels A (/formular, /funnel/a), B und C
-- für die Abbruchanalyse unter Admin → Analytics → Funnels, nach dem Vorbild
-- der Wizard-Telemetrie von CaravanWert (wizard_step_events).
--
-- Datenschutz: nur Schritt- und Feldschlüssel (z. B. "email"), nie Eingaben;
-- keine IP-Adresse, keine Click-IDs. Der Browser sendet nur mit
-- Statistik-Einwilligung (src/lib/funnelTelemetry.ts). Geschrieben wird nur
-- über die Edge Function kw-funnel-telemetry (service_role), gelesen nur von
-- Admins. Aufbewahrung 90 Tage (kw_retention_cleanup).
-- ============================================================================

create table if not exists public.kw_funnel_events (
  id bigint generated always as identity primary key,
  session_id uuid not null,
  funnel text not null check (funnel in ('a', 'b', 'c')),
  step text not null,
  step_index smallint not null check (step_index between 0 and 40),
  -- Erlaubte Ereignisse prüft kw-funnel-telemetry (_shared/funnel-telemetry.ts),
  -- damit neue Ereignisse keine Migration brauchen.
  event text not null,
  field_name text,
  error_fields text[],
  time_on_step_ms integer check (time_on_step_ms is null or time_on_step_ms >= 0),
  device_type text check (device_type is null or device_type in ('mobile', 'tablet', 'desktop')),
  viewport_width smallint,
  consent_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

comment on table public.kw_funnel_events is
  'Funnel-Telemetrie (Schritte, Feldschlüssel, Verweildauer, Fehler) ohne Eingaben. Schreiben nur kw-funnel-telemetry, lesen nur Admins, 90 Tage.';
comment on column public.kw_funnel_events.field_name is 'Technischer Feldschlüssel (z. B. "email"), nie der eingegebene Wert.';
comment on column public.kw_funnel_events.consent_id is 'Kennung der Cookie-Einwilligung (cookie_consent.consent_id), unter der gesendet wurde.';

create index if not exists kw_funnel_events_funnel_created_idx on public.kw_funnel_events (funnel, created_at);
create index if not exists kw_funnel_events_session_idx on public.kw_funnel_events (session_id, id);
create index if not exists kw_funnel_events_created_idx on public.kw_funnel_events (created_at);

alter table public.kw_funnel_events enable row level security;

revoke all on public.kw_funnel_events from anon;
revoke insert, update, delete, truncate, references, trigger on public.kw_funnel_events from authenticated;
grant select on public.kw_funnel_events to authenticated;
grant all on public.kw_funnel_events to service_role;

drop policy if exists "kw_funnel_events: admin read" on public.kw_funnel_events;
create policy "kw_funnel_events: admin read"
  on public.kw_funnel_events
  for select
  to authenticated
  using (public.has_role((select auth.uid()), 'admin'::app_role));

-- ----------------------------------------------------------------------------
-- Auswertung für Admin → Analytics → Funnels
-- ----------------------------------------------------------------------------
create or replace function public.kw_admin_funnel_stats(p_funnel text, p_days integer default 30)
returns jsonb
language plpgsql
stable
set search_path = public, pg_catalog
as $$
declare
  -- INVOKER: Admins lesen kw_funnel_events über RLS. Höchstens 90 Tage,
  -- länger werden die Ereignisse nicht aufbewahrt.
  v_days integer := greatest(1, least(coalesce(p_days, 30), 90));
  v_since timestamptz := now() - make_interval(days => v_days);
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_funnel is null or p_funnel not in ('a', 'b', 'c') then
    raise exception 'Unbekannter Funnel' using errcode = '22023';
  end if;

  return (
    with ev as (
      select e.id, e.session_id, e.step, e.step_index, e.event, e.field_name, e.error_fields,
             e.time_on_step_ms, e.device_type, e.metadata, e.created_at
      from public.kw_funnel_events e
      where e.funnel = p_funnel and e.created_at >= v_since
    ),
    sessions as (
      select session_id,
             max(step_index) filter (where event = 'step_enter') as furthest,
             bool_or(event = 'next_clicked') as answered,
             bool_or(event = 'submit_succeeded') as converted,
             min(created_at) as started_at,
             max(created_at) as last_seen,
             min(created_at) filter (where event = 'submit_succeeded') as converted_at,
             (array_agg(device_type order by id) filter (where device_type is not null))[1] as device,
             (array_agg(metadata order by id) filter (where event = 'segmentation'))[1] as entry
      from ev
      group by session_id
      having bool_or(event = 'step_enter')
    ),
    steps as (
      select step_index,
             (array_agg(step order by id desc))[1] as step,
             (array_agg(metadata->>'label' order by id desc) filter (where event = 'step_enter' and metadata ? 'label'))[1] as label,
             count(distinct session_id) filter (where event = 'step_enter') as reached,
             percentile_cont(0.5) within group (order by time_on_step_ms::double precision)
               filter (where event = 'next_clicked' and time_on_step_ms is not null) as median_ms,
             count(*) filter (where event = 'validation_failed') as validation_failed,
             count(distinct session_id) filter (where event = 'validation_failed') as validation_sessions,
             count(*) filter (where event = 'back_clicked') as back_clicks,
             count(distinct session_id) filter (where event = 'idle') as idle_sessions,
             count(distinct session_id) filter (where event = 'exit_intent') as exit_intents
      from ev
      group by step_index
    ),
    -- Abbruch = weitester Schritt ohne Absenden; Durchläufe der letzten 30 Minuten laufen noch.
    dropped as (
      select furthest as step_index, count(*) as n
      from sessions
      where not converted and furthest is not null and last_seen < now() - interval '30 minutes'
      group by furthest
    ),
    step_errors as (
      select step_index, jsonb_agg(jsonb_build_object('field', field, 'count', n) order by n desc) as fields
      from (
        select ev.step_index, f as field, count(*) as n
        from ev, unnest(ev.error_fields) as f
        where ev.event = 'validation_failed'
        group by ev.step_index, f
      ) x
      group by step_index
    ),
    fields as (
      select field_name,
             (array_agg(step order by id desc))[1] as step,
             min(step_index) as step_index,
             count(distinct session_id) filter (where event = 'field_focus') as focus_sessions,
             count(*) filter (where event = 'field_focus') as focuses,
             count(*) filter (where event = 'field_blur_empty') as left_empty,
             count(*) filter (where event = 'field_corrected') as corrected,
             count(*) filter (where event = 'field_change') as changes
      from ev
      where field_name is not null
      group by field_name
    ),
    field_errors as (
      select f as field_name, count(*) as n
      from ev, unnest(ev.error_fields) as f
      where ev.event = 'validation_failed'
      group by f
    ),
    problems as (
      select event,
             coalesce(metadata->>'message', metadata->>'reason', 'unbekannt') as message,
             count(*) as n,
             count(distinct session_id) as affected,
             max(created_at) as last_seen
      from ev
      where event in ('js_error', 'submit_failed')
      group by 1, 2
    )
    select jsonb_build_object(
      'funnel', p_funnel,
      'days', v_days,
      'since', v_since,
      'totals', (
        select jsonb_build_object(
          'sessions', count(*),
          'answered', count(*) filter (where answered),
          'converted', count(*) filter (where converted),
          'median_duration_ms', percentile_cont(0.5) within group (order by (extract(epoch from (converted_at - started_at)) * 1000)::double precision)
            filter (where converted)
        )
        from sessions
      ),
      'steps', coalesce((
        select jsonb_agg(jsonb_build_object(
          'step_index', s.step_index,
          'step', s.step,
          'label', s.label,
          'reached', s.reached,
          'dropped', coalesce(d.n, 0),
          'median_ms', s.median_ms,
          'validation_failed', s.validation_failed,
          'validation_sessions', s.validation_sessions,
          'back_clicks', s.back_clicks,
          'idle_sessions', s.idle_sessions,
          'exit_intents', s.exit_intents,
          'error_fields', coalesce(se.fields, '[]'::jsonb)
        ) order by s.step_index)
        from steps s
        left join dropped d using (step_index)
        left join step_errors se using (step_index)
        where s.reached > 0
      ), '[]'::jsonb),
      'fields', coalesce((
        select jsonb_agg(jsonb_build_object(
          'field', f.field_name,
          'step', f.step,
          'step_index', f.step_index,
          'sessions', f.focus_sessions,
          'focuses', f.focuses,
          'left_empty', f.left_empty,
          'corrected', f.corrected,
          'changes', f.changes,
          'validation_errors', coalesce(fe.n, 0)
        ) order by f.step_index, f.focus_sessions desc)
        from fields f
        left join field_errors fe using (field_name)
      ), '[]'::jsonb),
      'devices', coalesce((
        select jsonb_agg(jsonb_build_object('device', device, 'sessions', n, 'converted', c) order by n desc)
        from (
          select coalesce(device, 'unbekannt') as device, count(*) as n, count(*) filter (where converted) as c
          from sessions
          group by 1
        ) x
      ), '[]'::jsonb),
      'sources', coalesce((
        select jsonb_agg(jsonb_build_object('source', source, 'sessions', n, 'converted', c) order by n desc)
        from (
          select coalesce(nullif(entry->>'utm_source', ''), nullif(entry->>'click_source', ''), nullif(entry->>'referrer_host', ''), 'direkt') as source,
                 count(*) as n,
                 count(*) filter (where converted) as c
          from sessions
          group by 1
          order by 2 desc
          limit 12
        ) x
      ), '[]'::jsonb),
      'problems', coalesce((
        select jsonb_agg(jsonb_build_object('event', event, 'message', message, 'count', n, 'sessions', affected, 'last_seen', last_seen) order by n desc)
        from (select * from problems order by n desc limit 20) x
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke execute on function public.kw_admin_funnel_stats(text, integer) from public, anon;
grant execute on function public.kw_admin_funnel_stats(text, integer) to authenticated;

-- ----------------------------------------------------------------------------
-- Aufbewahrung: 90 Tage (bisheriger Stand aus 20260928200833_kw_maintenance_jobs
-- plus kw_funnel_events)
-- ----------------------------------------------------------------------------
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

  delete from public.kw_funnel_events where created_at < now() - interval '90 days';
  get diagnostics v_count = row_count; v_result := v_result || jsonb_build_object('kw_funnel_events', v_count);

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
