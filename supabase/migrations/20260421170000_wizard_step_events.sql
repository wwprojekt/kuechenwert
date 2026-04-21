-- =====================================================================
-- Migration: wizard_step_events (Telemetry)
-- =====================================================================
--
-- Zweck: Granulare Step-/Field-Level-Telemetrie fuer den Verkaufswizard,
-- damit Drop-offs praezise analysiert werden koennen (welche Felder wurden
-- angeklickt, wo hat die Validierung gefeuert, wurde "Weiter" ueberhaupt
-- geklickt, wann ist der User abgesprungen).
--
-- Datenschutz:
-- - Keine PII in der Tabelle selbst. `field_name` speichert lediglich
--   Feldschluessel (z. B. "mileage", "manufacturer") und NIEMALS Eingabewerte.
-- - Rohdaten (Werte) verbleiben in `wizard_sessions.form_data`.
-- - Rechtsgrundlage: Art. 6 (1) lit. f DSGVO (berechtigtes Interesse
--   Drop-off-Analyse, keine Werbezwecke).
--
-- Zugriff:
-- - INSERT nur via service_role (Edge Function `wizard-telemetry`).
-- - SELECT nur fuer Admins (Funnel-Analyse im Admin-Dashboard, spaeter).
-- - Anon / authenticated Clients duerfen NICHTS.
--
-- Retention: 90 Tage via pg_cron.
-- =====================================================================

create table if not exists public.wizard_step_events (
  id bigserial primary key,
  session_id uuid not null references public.wizard_sessions(id) on delete cascade,
  step smallint not null check (step between 0 and 10),
  event text not null check (event in (
    'step_enter',
    'next_clicked',
    'validation_failed',
    'back_clicked',
    'submit_clicked',
    'submit_succeeded',
    'submit_failed',
    'leave',
    'field_focus',
    'field_blur_empty',
    'field_blur_filled',
    'field_change'
  )),
  field_name text,
  error_fields text[],
  viewport_width smallint,
  device_type text check (device_type in ('mobile','tablet','desktop')),
  -- Zeit seit step_enter in Millisekunden (fuer Dauer-Analysen)
  time_on_step_ms integer,
  -- Optional: free-form metadata (nie PII). z. B. { scroll_depth: 0.8 }
  metadata jsonb,
  created_at timestamptz not null default now()
);

comment on table public.wizard_step_events is
  'Step- und Field-Level-Telemetrie fuer den Verkaufswizard. INSERT nur via Edge Function wizard-telemetry (service_role). SELECT nur Admins. Retention 90 Tage via pg_cron.';
comment on column public.wizard_step_events.field_name is
  'Technischer Feldschluessel (z. B. "mileage"). KEINE Eingabewerte.';
comment on column public.wizard_step_events.error_fields is
  'Bei validation_failed: Liste der Feldschluessel, die die Validierung nicht bestanden haben.';
comment on column public.wizard_step_events.time_on_step_ms is
  'Millisekunden, die der User auf diesem Step verbracht hat (bei next/back/leave/validation_failed).';

create index if not exists wizard_step_events_session_idx
  on public.wizard_step_events (session_id, created_at);

create index if not exists wizard_step_events_step_event_idx
  on public.wizard_step_events (step, event, created_at);

create index if not exists wizard_step_events_event_created_idx
  on public.wizard_step_events (event, created_at);

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.wizard_step_events enable row level security;

-- Admins duerfen lesen (spaetere Funnel-Dashboards).
drop policy if exists "wizard_step_events admin select" on public.wizard_step_events;
create policy "wizard_step_events admin select"
  on public.wizard_step_events
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Wir geben KEINE INSERT/UPDATE/DELETE-Policies an authenticated / anon:
-- Inserts laufen ausschliesslich via Edge Function (service_role bypasst RLS).

-- =====================================================================
-- Grants
-- =====================================================================
-- Tabellen-Grants: nichts fuer anon/authenticated (RLS SELECT reicht).
-- service_role hat ohnehin BYPASSRLS.
grant usage, select on sequence public.wizard_step_events_id_seq to service_role;

-- =====================================================================
-- Retention: 90 Tage, via pg_cron taeglich 03:17 UTC.
-- =====================================================================
do $$
declare
  v_jobid bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into v_jobid from cron.job where jobname = 'cleanup-wizard-step-events' limit 1;
    if v_jobid is not null then
      perform cron.unschedule(v_jobid);
    end if;

    perform cron.schedule(
      'cleanup-wizard-step-events',
      '17 3 * * *',
      $cron$
        delete from public.wizard_step_events
        where created_at < now() - interval '90 days';
      $cron$
    );
  end if;
end
$$;
