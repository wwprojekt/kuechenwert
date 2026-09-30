-- ============================================================================
-- KI & Preis-Engine: Gedächtnis über 30 Tage, Änderungsprotokoll und eine
-- Preis-Engine, die ihre Treffsicherheit misst (30.09.2026)
--
-- 1. kw_ai_settings.price_calibration_enabled: Marktabgleich anwenden oder
--    neutral (Faktor 1) lassen; gelernt und angezeigt wird trotzdem.
-- 2. kw_ai_settings_history: jede Änderung der KI-Einstellungen mit altem und
--    neuem Wert (Trigger), damit sich Kennzahlen Änderungen zuordnen lassen.
-- 3. kw_ai_stats_between: Kennzahlen eines Zeitraums (Modelle, A/B-Gruppen,
--    Bewertungsgründe, Planer-Funnel), genutzt von kw_admin_ai_stats und der
--    Tagesstatistik kw_ai_stats_daily. Planungen ohne Anfrage werden nach
--    30 Tagen gelöscht; die Tageswerte enthalten nur Zählungen und
--    Modellnamen, keine Personendaten, und bleiben. Cron kw-ai-stats-daily
--    (01:10 UTC) schreibt die letzten zwei Tage (spätere Bewertungen).
-- 4. kitchen_price_calibration_runs: jeder Lauf der Preiskalibrierung mit
--    Faktoren und Treffsicherheit (angezeigte Schätzung, Engine roh und mit
--    Abgleich gegen den Median der Angebote).
-- 5. kw_price_observations liefert zusätzlich Datum und angezeigte Schätzung
--    der Ausschreibung (Zeitgewicht und Treffsicherheit in kw-maintenance).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Schalter für den Marktabgleich
-- ---------------------------------------------------------------------------

alter table public.kw_ai_settings
  add column if not exists price_calibration_enabled boolean not null default true;

comment on column public.kw_ai_settings.price_calibration_enabled is
  'Marktabgleich der Preis-Engine anwenden (kitchen_price_calibration.factor); aus = alle Faktoren 1, gelernt wird weiter (kitchen_price_calibration_runs).';

-- ---------------------------------------------------------------------------
-- 2. Änderungsprotokoll
-- ---------------------------------------------------------------------------

create table if not exists public.kw_ai_settings_history (
  id bigint generated always as identity primary key,
  changed_at timestamptz not null default now(),
  changed_by uuid references public.profiles(id) on delete set null,
  changes jsonb not null
);

comment on table public.kw_ai_settings_history is
  'Änderungen an kw_ai_settings: {spalte: {from, to}} je Speichern (Trigger kw_ai_settings_log).';

create index if not exists idx_kw_ai_settings_history_changed on public.kw_ai_settings_history (changed_at desc);

alter table public.kw_ai_settings_history enable row level security;

drop policy if exists "AiSettingsHistory: admin read" on public.kw_ai_settings_history;
create policy "AiSettingsHistory: admin read" on public.kw_ai_settings_history
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

revoke all on public.kw_ai_settings_history from anon;
revoke insert, update, delete, truncate, references, trigger on public.kw_ai_settings_history from authenticated;
grant select on public.kw_ai_settings_history to authenticated;
grant all on public.kw_ai_settings_history to service_role;

create or replace function public.kw_ai_settings_log()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: schreibt das Protokoll, in dem Admins nur lesen dürfen.
  v_changes jsonb;
begin
  select jsonb_object_agg(n.key, jsonb_build_object('from', o.value, 'to', n.value))
    into v_changes
    from jsonb_each(to_jsonb(new) - 'updated_at' - 'updated_by') n
    join jsonb_each(to_jsonb(old) - 'updated_at' - 'updated_by') o on o.key = n.key
   where n.value is distinct from o.value;
  if v_changes is not null then
    insert into public.kw_ai_settings_history (changed_by, changes) values (new.updated_by, v_changes);
  end if;
  return null;
end;
$$;

revoke execute on function public.kw_ai_settings_log() from public, anon, authenticated;

drop trigger if exists kw_ai_settings_log on public.kw_ai_settings;
create trigger kw_ai_settings_log
  after update on public.kw_ai_settings
  for each row execute function public.kw_ai_settings_log();

-- ---------------------------------------------------------------------------
-- 3. Kennzahlen je Zeitraum und Tagesstatistik
-- ---------------------------------------------------------------------------

create or replace function public.kw_ai_stats_between(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
set search_path = public, pg_catalog
as $$
begin
  -- INVOKER: Admins lesen über RLS; ohne Nutzer (Cron, service_role) zählt alles.
  if auth.uid() is not null and not public.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'models', coalesce((
      with base as (
        select coalesce(r.fallback_from, r.model_slug) as first_model, r.model_slug, r.fallback_from,
               r.mode, r.status, r.generation_ms, r.cost_cents, r.feedback, r.feedback_reasons, r.base_render_id
        from public.planner_renders r
        where r.created_at >= p_from and r.created_at < p_to
      ),
      tried as (
        select first_model as model, mode,
               count(*) as started,
               count(*) filter (where fallback_from is null and status = 'success') as first_try_success,
               count(*) filter (where fallback_from is not null) as fell_back,
               count(*) filter (where status = 'failed') as failed
        from base
        group by first_model, mode
      ),
      produced as (
        select model_slug as model, mode,
               count(*) as images,
               count(*) filter (where fallback_from is not null) as as_fallback,
               count(*) filter (where base_render_id is not null) as variants,
               round(avg(generation_ms)) as avg_ms,
               round(percentile_cont(0.5) within group (order by generation_ms)) as p50_ms,
               round(percentile_cont(0.9) within group (order by generation_ms)) as p90_ms,
               coalesce(sum(cost_cents), 0) as cost_cents,
               count(*) filter (where feedback = 1) as thumbs_up,
               count(*) filter (where feedback = -1) as thumbs_down
        from base
        where status = 'success'
        group by model_slug, mode
      ),
      reasons as (
        select x.model_slug as model, x.mode, jsonb_object_agg(x.reason, x.n) as reasons
        from (
          select b.model_slug, b.mode, reason, count(*) as n
          from base b
          cross join lateral unnest(b.feedback_reasons) as reason
          where b.status = 'success' and b.feedback = -1
          group by b.model_slug, b.mode, reason
        ) x
        group by x.model_slug, x.mode
      )
      select jsonb_agg(jsonb_build_object(
               'model', coalesce(t.model, p.model),
               'mode', coalesce(t.mode, p.mode),
               'started', coalesce(t.started, 0),
               'first_try_success', coalesce(t.first_try_success, 0),
               'fell_back', coalesce(t.fell_back, 0),
               'failed', coalesce(t.failed, 0),
               'images', coalesce(p.images, 0),
               'as_fallback', coalesce(p.as_fallback, 0),
               'variants', coalesce(p.variants, 0),
               'avg_ms', p.avg_ms,
               'p50_ms', p.p50_ms,
               'p90_ms', p.p90_ms,
               'cost_cents', coalesce(p.cost_cents, 0),
               'thumbs_up', coalesce(p.thumbs_up, 0),
               'thumbs_down', coalesce(p.thumbs_down, 0),
               'reasons', coalesce(rs.reasons, '{}'::jsonb)
             ) order by coalesce(t.started, 0) + coalesce(p.images, 0) desc)
      from tried t
      full join produced p on p.model = t.model and p.mode = t.mode
      left join reasons rs on rs.model = coalesce(t.model, p.model) and rs.mode = coalesce(t.mode, p.mode)
    ), '[]'::jsonb),
    -- A/B: nur Bilder mit Foto (Erstbild und Varianten laufen je Gruppe mit
    -- demselben Modell); Bewertungen und Erfolg nur der Erstbilder, weil
    -- Varianten vom Änderungswunsch der Kund:innen abhängen.
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
               'group', g.ai_group,
               'sessions', g.sessions,
               'leads', g.leads,
               'renders', g.renders,
               'first_renders', g.first_renders,
               'success', g.success,
               'fell_back', g.fell_back,
               'variants', g.variants,
               'thumbs_up', g.thumbs_up,
               'thumbs_down', g.thumbs_down,
               'cost_cents', g.cost_cents
             ) order by g.ai_group)
      from (
        select s.ai_group,
               count(*) as sessions,
               count(*) filter (where s.lead_id is not null) as leads,
               coalesce(sum(x.renders), 0) as renders,
               coalesce(sum(x.first_renders), 0) as first_renders,
               coalesce(sum(x.success), 0) as success,
               coalesce(sum(x.fell_back), 0) as fell_back,
               coalesce(sum(x.variants), 0) as variants,
               coalesce(sum(x.thumbs_up), 0) as thumbs_up,
               coalesce(sum(x.thumbs_down), 0) as thumbs_down,
               coalesce(sum(x.cost_cents), 0) as cost_cents
        from public.planner_sessions s
        left join lateral (
          select count(*) as renders,
                 count(*) filter (where r.base_render_id is null) as first_renders,
                 count(*) filter (where r.base_render_id is null and r.status = 'success') as success,
                 count(*) filter (where r.base_render_id is null and r.fallback_from is not null) as fell_back,
                 count(*) filter (where r.base_render_id is not null) as variants,
                 count(*) filter (where r.base_render_id is null and r.feedback = 1) as thumbs_up,
                 count(*) filter (where r.base_render_id is null and r.feedback = -1) as thumbs_down,
                 coalesce(sum(r.cost_cents) filter (where r.status = 'success'), 0) as cost_cents
          from public.planner_renders r
          where r.session_id = s.id and r.mode = 'edit'
        ) x on true
        where s.created_at >= p_from and s.created_at < p_to and s.ai_group is not null
        group by s.ai_group
      ) g
    ), '[]'::jsonb),
    'reasons', coalesce((
      select jsonb_object_agg(x.reason, x.n)
      from (
        select reason, count(*) as n
        from public.planner_renders r
        cross join lateral unnest(r.feedback_reasons) as reason
        where r.created_at >= p_from and r.created_at < p_to and r.feedback = -1
        group by reason
      ) x
    ), '{}'::jsonb),
    'funnel', (
      select jsonb_build_object(
        'sessions', count(*),
        'with_render', count(*) filter (where exists (
          select 1 from public.planner_renders r where r.session_id = s.id and r.status = 'success')),
        'with_photo_render', count(*) filter (where exists (
          select 1 from public.planner_renders r where r.session_id = s.id and r.status = 'success' and r.mode = 'edit')),
        'leads', count(*) filter (where s.lead_id is not null),
        'ai_training_consents', count(*) filter (where s.ai_training_consent),
        'cost_cents', coalesce((
          select sum(r.cost_cents) from public.planner_renders r
          where r.created_at >= p_from and r.created_at < p_to and r.status = 'success'), 0)
      )
      from public.planner_sessions s
      where s.created_at >= p_from and s.created_at < p_to
    )
  );
end;
$$;

revoke execute on function public.kw_ai_stats_between(timestamptz, timestamptz) from public, anon;
grant execute on function public.kw_ai_stats_between(timestamptz, timestamptz) to authenticated, service_role;

create or replace function public.kw_admin_ai_stats(p_days integer default 30)
returns jsonb
language plpgsql
stable
set search_path = public, pg_catalog
as $$
declare
  -- INVOKER: Admins lesen Renders, Sitzungen und Trainingsdaten über RLS.
  -- Planungen ohne Anfrage werden nach 30 Tagen gelöscht, deshalb höchstens
  -- 30 Tage; länger zurück reicht kw_ai_stats_daily.
  v_days integer := greatest(1, least(coalesce(p_days, 30), 30));
  v_since timestamptz := now() - make_interval(days => v_days);
  v_cap integer;
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select daily_render_cap into v_cap from public.kw_ai_settings limit 1;
  v_cap := coalesce(v_cap, 300);

  return public.kw_ai_stats_between(v_since, now()) || jsonb_build_object(
    'days', v_days,
    'since', v_since,
    'today', (
      select jsonb_build_object(
        'renders', count(*),
        'open', count(*) filter (where not r.verified),
        'cap', v_cap,
        'open_cap', floor(v_cap * 0.7)::integer
      )
      from public.planner_renders r
      where r.created_at > now() - interval '24 hours'
    ),
    'training', jsonb_build_object(
      'samples', (select count(*) from public.kw_ai_training_samples where expires_at > now()),
      'sessions', (select count(distinct planner_session_id) from public.kw_ai_training_samples where expires_at > now())
    )
  );
end;
$$;

revoke execute on function public.kw_admin_ai_stats(integer) from public, anon;
grant execute on function public.kw_admin_ai_stats(integer) to authenticated;

create table if not exists public.kw_ai_stats_daily (
  day date primary key,
  stats jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.kw_ai_stats_daily is
  'Anonyme Tageskennzahlen der KI-Visualisierung (kw_ai_stats_between je Kalendertag Europe/Berlin): nur Zählungen, Dauer, Kosten und Modellnamen, bleibt über die 30-Tage-Löschung der Planungen hinaus.';

alter table public.kw_ai_stats_daily enable row level security;

drop policy if exists "AiStatsDaily: admin read" on public.kw_ai_stats_daily;
create policy "AiStatsDaily: admin read" on public.kw_ai_stats_daily
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

revoke all on public.kw_ai_stats_daily from anon;
revoke insert, update, delete, truncate, references, trigger on public.kw_ai_stats_daily from authenticated;
grant select on public.kw_ai_stats_daily to authenticated;
grant all on public.kw_ai_stats_daily to service_role;

create or replace function public.kw_ai_rollup_daily(p_day date)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: Cron kw-ai-stats-daily schreibt die Tagesstatistik ohne RLS.
  v_stats jsonb := public.kw_ai_stats_between(
    p_day::timestamp at time zone 'Europe/Berlin',
    (p_day + 1)::timestamp at time zone 'Europe/Berlin'
  );
begin
  if (v_stats->'funnel'->>'sessions')::integer = 0 and jsonb_array_length(v_stats->'models') = 0 then
    return;
  end if;
  insert into public.kw_ai_stats_daily (day, stats, updated_at)
  values (p_day, v_stats, now())
  on conflict (day) do update set stats = excluded.stats, updated_at = now();
end;
$$;

revoke execute on function public.kw_ai_rollup_daily(date) from public, anon, authenticated;
grant execute on function public.kw_ai_rollup_daily(date) to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'kw-ai-stats-daily') then
    perform cron.unschedule('kw-ai-stats-daily');
  end if;
end;
$$;

select cron.schedule(
  'kw-ai-stats-daily',
  '10 1 * * *',
  $cron$
  select public.kw_ai_rollup_daily((now() at time zone 'Europe/Berlin')::date - g) from generate_series(1, 2) g;
  $cron$
);

-- Bisherige Tage nachtragen, heute vorläufig (der Cron überschreibt ihn morgen).
select public.kw_ai_rollup_daily(d::date)
from generate_series(
  (select min(created_at) at time zone 'Europe/Berlin' from public.planner_renders)::date,
  (now() at time zone 'Europe/Berlin')::date,
  interval '1 day'
) d;

-- ---------------------------------------------------------------------------
-- 4. Läufe der Preiskalibrierung
-- ---------------------------------------------------------------------------

create table if not exists public.kitchen_price_calibration_runs (
  id bigint generated always as identity primary key,
  run_at timestamptz not null default now(),
  applied boolean not null,
  observations integer not null default 0,
  global_factor numeric(6,4),
  factors jsonb not null default '[]'::jsonb,
  accuracy jsonb not null default '{}'::jsonb
);

comment on table public.kitchen_price_calibration_runs is
  'Jeder Lauf von kw-maintenance price-calibration: gelernte Faktoren (applied = angewendet) und Treffsicherheit {shown, raw, calibrated} je {n, mdape, coverage, bias} (_shared/price-accuracy.ts).';

create index if not exists idx_kitchen_price_calibration_runs_at on public.kitchen_price_calibration_runs (run_at desc);

alter table public.kitchen_price_calibration_runs enable row level security;

drop policy if exists "PriceCalibrationRuns: admin read" on public.kitchen_price_calibration_runs;
create policy "PriceCalibrationRuns: admin read" on public.kitchen_price_calibration_runs
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

revoke all on public.kitchen_price_calibration_runs from anon;
revoke insert, update, delete, truncate, references, trigger on public.kitchen_price_calibration_runs from authenticated;
grant select on public.kitchen_price_calibration_runs to authenticated;
grant all on public.kitchen_price_calibration_runs to service_role;

-- ---------------------------------------------------------------------------
-- 5. Beobachtungen mit Datum und angezeigter Schätzung
-- ---------------------------------------------------------------------------

drop function if exists public.kw_price_observations(integer);

create function public.kw_price_observations(p_limit integer default 2000)
returns table(
  auction_id uuid,
  funnel text,
  postal_code text,
  funnel_answers jsonb,
  kitchen_form text,
  kitchen_style text,
  planner_config jsonb,
  planner_room jsonb,
  observed_eur numeric,
  bid_count integer,
  created_at timestamptz,
  shown_min_eur numeric,
  shown_max_eur numeric,
  shown_mid_eur numeric
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: nur service_role (kw-maintenance, Preiskalibrierung); liest
  -- Ausschreibungen, Leads und Angebote ohne RLS und liefert keine Kontaktdaten.
  with offers as (
    select b.auction_id,
           percentile_cont(0.5) within group (order by b.price_eur) as median_eur,
           count(*)::integer as n
    from public.lead_bids b
    where b.status in ('active', 'accepted', 'declined')
      and b.price_eur > 0
      and b.montage_included is distinct from false
    group by b.auction_id
  )
  select a.id, l.funnel_type::text, l.postal_code, l.funnel_answers, l.kitchen_form, l.kitchen_style,
         s.spec, s.room, o.median_eur::numeric, o.n,
         a.created_at, a.estimate_min_eur, a.estimate_max_eur, a.reference_price_eur
  from public.lead_auctions a
  join offers o on o.auction_id = a.id
  join public.leads l on l.id = a.lead_id
  left join public.planner_sessions s on s.id = a.planner_session_id
  where l.funnel_type in ('a', 'traumkueche')
    and a.status <> 'draft'
    and a.created_at > now() - interval '24 months'
  order by a.created_at desc
  limit greatest(1, least(coalesce(p_limit, 2000), 5000));
$$;

revoke execute on function public.kw_price_observations(integer) from public, anon, authenticated;
grant execute on function public.kw_price_observations(integer) to service_role;
