-- ============================================================================
-- Funnel C: KI-Steuerung, Lernschleifen und Kostenkontrolle (28.09.2026)
--
-- 1. kw_ai_settings: Bildmodelle (Haupt-, Varianten-, Ausweich- und
--    Vergleichsmodell), Anteil des A/B-Vergleichs, eigenes LoRA und
--    Tageslimit (0 = Visualisierung pausiert). Admins lesen und ändern,
--    kw-planner liest mit service_role. Ersetzt die Secrets FAL_EDIT_MODEL,
--    FAL_TEXT_MODEL und KW_DAILY_RENDER_CAP.
-- 2. planner_renders: Ausweichmodell bei Fehlern oder voller Warteschlange
--    (fallback_from, fallback_reason, attempt_started_at), Varianten auf Basis
--    einer fertigen Visualisierung (base_render_id) und die Bewertung durch
--    Kund:innen (feedback). planner_sessions: A/B-Gruppe und die freiwillige
--    Einwilligung zur Verbesserung der KI.
-- 3. kitchen_price_calibration: Die Preis-Engine gleicht sich täglich mit den
--    Angeboten der Studios ab (kw-maintenance, Task price-calibration, 03:40).
--    kw_price_observations liefert je Ausschreibung den Median der Angebote.
-- 4. kw_ai_training_samples + Bucket ai-training: Kopien der Raumfotos mit
--    Einwilligung, getrennt von der Anfrage, höchstens 36 Monate.
-- 5. kw_admin_ai_stats: Kennzahlen je Modell, A/B-Gruppe und Planer-Funnel.
-- 6. kw_health_snapshot: Tageslimit zu 80 % erreicht, gehäufte Fehlschläge.
-- 7. kw_project_export: Trainingskopien in der Datenauskunft (Art. 15 DSGVO).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. KI-Einstellungen
-- ---------------------------------------------------------------------------

create table if not exists public.kw_ai_settings (
  id boolean primary key default true constraint kw_ai_settings_singleton check (id),
  edit_model text not null default 'fal-ai/nano-banana-pro/edit',
  text_model text not null default 'fal-ai/flux-2-pro',
  variant_model text,
  fallback_edit_model text default 'fal-ai/flux-2-pro/edit',
  fallback_text_model text default 'fal-ai/nano-banana-2',
  challenger_edit_model text,
  challenger_share smallint not null default 0
    constraint kw_ai_settings_share check (challenger_share between 0 and 50),
  lora_url text constraint kw_ai_settings_lora_url check (lora_url is null or lora_url ~ '^https://\S+$'),
  lora_scale numeric(3,2) not null default 1
    constraint kw_ai_settings_lora_scale check (lora_scale between 0 and 2),
  daily_render_cap integer not null default 300
    constraint kw_ai_settings_cap check (daily_render_cap between 0 and 5000),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint kw_ai_settings_model_ids check (
    edit_model ~ '^fal-ai/[a-z0-9./-]+$'
    and text_model ~ '^fal-ai/[a-z0-9./-]+$'
    and coalesce(variant_model, 'fal-ai/x') ~ '^fal-ai/[a-z0-9./-]+$'
    and coalesce(fallback_edit_model, 'fal-ai/x') ~ '^fal-ai/[a-z0-9./-]+$'
    and coalesce(fallback_text_model, 'fal-ai/x') ~ '^fal-ai/[a-z0-9./-]+$'
    and coalesce(challenger_edit_model, 'fal-ai/x') ~ '^fal-ai/[a-z0-9./-]+$'
  )
);

comment on table public.kw_ai_settings is
  'Einzeilige KI-Konfiguration des Traumküchen-Planers. Unbekannte Modell-IDs ersetzt kw-planner durch die Standardmodelle (_shared/fal-models.ts).';
comment on column public.kw_ai_settings.variant_model is 'Modell für Varianten einer fertigen Visualisierung; null = wie edit_model.';
comment on column public.kw_ai_settings.challenger_share is 'Anteil der Planungen mit Foto in Prozent, die challenger_edit_model erhalten (A/B-Vergleich).';
comment on column public.kw_ai_settings.lora_url is 'Eigenes LoRA für LoRA-fähige Modelle (z. B. Qwen Image Edit Plus).';
comment on column public.kw_ai_settings.daily_render_cap is 'Höchstzahl KI-Bilder je 24 h (Kostenschutz); 0 pausiert die Visualisierung.';

insert into public.kw_ai_settings (id) values (true) on conflict (id) do nothing;

create or replace function public.kw_ai_settings_stamp()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  new.id := true;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists kw_ai_settings_stamp on public.kw_ai_settings;
create trigger kw_ai_settings_stamp
  before update on public.kw_ai_settings
  for each row execute function public.kw_ai_settings_stamp();

alter table public.kw_ai_settings enable row level security;

drop policy if exists "AiSettings: admin read" on public.kw_ai_settings;
create policy "AiSettings: admin read" on public.kw_ai_settings
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "AiSettings: admin update" on public.kw_ai_settings;
create policy "AiSettings: admin update" on public.kw_ai_settings
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

revoke all on public.kw_ai_settings from anon;
revoke insert, delete, truncate, references, trigger on public.kw_ai_settings from authenticated;
grant select, update on public.kw_ai_settings to authenticated;
grant all on public.kw_ai_settings to service_role;

-- ---------------------------------------------------------------------------
-- 2. Renders und Sitzungen
-- ---------------------------------------------------------------------------

alter table public.planner_renders
  add column if not exists fallback_from text,
  add column if not exists fallback_reason text,
  add column if not exists attempt_started_at timestamptz,
  add column if not exists base_render_id uuid references public.planner_renders(id) on delete set null,
  add column if not exists feedback smallint,
  add column if not exists feedback_at timestamptz;

alter table public.planner_renders drop constraint if exists planner_renders_feedback_check;
alter table public.planner_renders
  add constraint planner_renders_feedback_check check (feedback in (-1, 1));

-- Veralteter Standard (flux-pro/v1.1-ultra): kw-planner setzt das Modell immer selbst.
alter table public.planner_renders alter column model_slug drop default;

comment on column public.planner_renders.model_slug is 'Modell, das das Bild erzeugt hat (nach einem Ausweichen das Ausweichmodell).';
comment on column public.planner_renders.fallback_from is 'Erstes Modell, falls kw-planner auf das Ausweichmodell wechseln musste.';
comment on column public.planner_renders.base_render_id is 'Variante: Visualisierung, die als Ausgangsbild diente.';
comment on column public.planner_renders.feedback is 'Bewertung durch Kund:innen: 1 gefällt, -1 gefällt nicht.';

create index if not exists idx_planner_renders_base on public.planner_renders (base_render_id);

alter table public.planner_sessions
  add column if not exists ai_group text,
  add column if not exists ai_training_consent boolean not null default false,
  add column if not exists ai_training_consent_at timestamptz;

alter table public.planner_sessions drop constraint if exists planner_sessions_ai_group_check;
alter table public.planner_sessions
  add constraint planner_sessions_ai_group_check check (ai_group in ('control', 'challenger'));

comment on column public.planner_sessions.ai_group is 'A/B-Gruppe der ersten Visualisierung mit Foto (control = Hauptmodell, challenger = Vergleichsmodell).';
comment on column public.planner_sessions.ai_training_consent is 'Freiwillige Einwilligung: Raumfotos ohne Kontaktdaten zur Verbesserung der KI speichern (lead_consents purpose ai_training).';

-- Doppelt zum Unique-Index planner_sessions_session_token_key.
drop index if exists public.idx_planner_sessions_token;

-- ---------------------------------------------------------------------------
-- 3. Lernende Preis-Engine
-- ---------------------------------------------------------------------------

create table if not exists public.kitchen_price_calibration (
  segment text primary key constraint kitchen_price_calibration_segment check (
    segment ~ '^(global|source:(a|c)|quality:(budget|mittel|premium|luxus)|region:[0-9])$'
  ),
  factor numeric(6,4) not null default 1
    constraint kitchen_price_calibration_factor check (factor between 0.5 and 2),
  sample_count integer not null default 0 constraint kitchen_price_calibration_samples check (sample_count >= 0),
  observed_ratio numeric(6,4),
  updated_at timestamptz not null default now()
);

comment on table public.kitchen_price_calibration is
  'Marktabgleich der Preis-Engine: Multiplikator je Segment aus Studio-Angeboten (kw-maintenance, Task price-calibration). Öffentlich lesbar, damit Browser und Server dieselbe Schätzung rechnen.';
comment on column public.kitchen_price_calibration.factor is 'Angewendeter Multiplikator (zur Mitte geschrumpft, relativ zur übergeordneten Ebene).';
comment on column public.kitchen_price_calibration.observed_ratio is 'Ungeschrumpftes geometrisches Mittel Angebot/Schätzung der Ebene.';

alter table public.kitchen_price_calibration enable row level security;

drop policy if exists "PriceCalibration: public read" on public.kitchen_price_calibration;
create policy "PriceCalibration: public read" on public.kitchen_price_calibration
  for select to anon, authenticated
  using (true);

revoke insert, update, delete, truncate, references, trigger on public.kitchen_price_calibration from anon, authenticated;
grant select on public.kitchen_price_calibration to anon, authenticated;
grant all on public.kitchen_price_calibration to service_role;

create or replace function public.kw_price_observations(p_limit integer default 2000)
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
  bid_count integer
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
         s.spec, s.room, o.median_eur::numeric, o.n
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

do $$
begin
  if exists (select 1 from cron.job where jobname = 'kw-price-calibration') then
    perform cron.unschedule('kw-price-calibration');
  end if;
end;
$$;

select cron.schedule(
  'kw-price-calibration',
  '40 3 * * *',
  $cron$
  select net.http_post(
    url := 'https://gzqayoalwtmypndrmqes.supabase.co/functions/v1/kw-maintenance',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-kw-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'kw_cron_secret')),
    body := '{"task":"price-calibration"}'::jsonb,
    timeout_milliseconds := 55000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'kw_cron_secret');
  $cron$
);

-- ---------------------------------------------------------------------------
-- 4. Trainingsdaten mit Einwilligung
-- ---------------------------------------------------------------------------

create table if not exists public.kw_ai_training_samples (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  planner_session_id uuid references public.planner_sessions(id) on delete set null,
  photo_path text not null,
  config jsonb not null default '{}'::jsonb,
  room jsonb not null default '{}'::jsonb,
  render_feedback jsonb not null default '[]'::jsonb,
  consent_text_version text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '36 months')
);

comment on table public.kw_ai_training_samples is
  'Raumfotos (Kopie im Bucket ai-training) mit Planung und Bewertungen, nur mit Einwilligung ai_training; ohne Kontaktdaten, Löschung nach expires_at (kw-maintenance) oder bei Widerruf (kw-project).';

create unique index if not exists uq_kw_ai_training_samples_photo on public.kw_ai_training_samples (photo_path);
create index if not exists idx_kw_ai_training_samples_lead on public.kw_ai_training_samples (lead_id);
create index if not exists idx_kw_ai_training_samples_session on public.kw_ai_training_samples (planner_session_id);
create index if not exists idx_kw_ai_training_samples_expires on public.kw_ai_training_samples (expires_at);

alter table public.kw_ai_training_samples enable row level security;

drop policy if exists "AiTraining: admin read" on public.kw_ai_training_samples;
create policy "AiTraining: admin read" on public.kw_ai_training_samples
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

revoke all on public.kw_ai_training_samples from anon;
revoke insert, update, delete, truncate, references, trigger on public.kw_ai_training_samples from authenticated;
grant select on public.kw_ai_training_samples to authenticated;
grant all on public.kw_ai_training_samples to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ai-training', 'ai-training', false, 15728640, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "AiTraining: admin read files" on storage.objects;
create policy "AiTraining: admin read files" on storage.objects
  for select to authenticated
  using (bucket_id = 'ai-training' and public.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------------
-- 5. Kennzahlen für den Admin
-- ---------------------------------------------------------------------------

create or replace function public.kw_admin_ai_stats(p_days integer default 30)
returns jsonb
language plpgsql
stable
set search_path = public, pg_catalog
as $$
declare
  -- INVOKER: Admins lesen Renders, Sitzungen und Trainingsdaten über RLS.
  -- Planungen ohne Anfrage werden nach 30 Tagen gelöscht, deshalb höchstens
  -- 30 Tage, sonst wäre die Abschlussquote verzerrt.
  v_days integer := greatest(1, least(coalesce(p_days, 30), 30));
  v_since timestamptz := now() - make_interval(days => v_days);
  v_cap integer;
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select daily_render_cap into v_cap from public.kw_ai_settings limit 1;

  return jsonb_build_object(
    'days', v_days,
    'since', v_since,
    'today', jsonb_build_object(
      'renders', (select count(*) from public.planner_renders where created_at > now() - interval '24 hours'),
      'cap', coalesce(v_cap, 300)
    ),
    'models', coalesce((
      with base as (
        select coalesce(r.fallback_from, r.model_slug) as first_model, r.model_slug, r.fallback_from,
               r.mode, r.status, r.generation_ms, r.cost_cents, r.feedback, r.base_render_id
        from public.planner_renders r
        where r.created_at >= v_since
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
               coalesce(sum(cost_cents), 0) as cost_cents,
               count(*) filter (where feedback = 1) as thumbs_up,
               count(*) filter (where feedback = -1) as thumbs_down
        from base
        where status = 'success'
        group by model_slug, mode
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
               'cost_cents', coalesce(p.cost_cents, 0),
               'thumbs_up', coalesce(p.thumbs_up, 0),
               'thumbs_down', coalesce(p.thumbs_down, 0)
             ) order by coalesce(t.started, 0) + coalesce(p.images, 0) desc)
      from tried t
      full join produced p on p.model = t.model and p.mode = t.mode
    ), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
               'group', g.ai_group,
               'sessions', g.sessions,
               'leads', g.leads,
               'renders', g.renders,
               'success', g.success,
               'thumbs_up', g.thumbs_up,
               'thumbs_down', g.thumbs_down,
               'cost_cents', g.cost_cents
             ) order by g.ai_group)
      from (
        select s.ai_group,
               count(*) as sessions,
               count(*) filter (where s.lead_id is not null) as leads,
               coalesce(sum(x.renders), 0) as renders,
               coalesce(sum(x.success), 0) as success,
               coalesce(sum(x.thumbs_up), 0) as thumbs_up,
               coalesce(sum(x.thumbs_down), 0) as thumbs_down,
               coalesce(sum(x.cost_cents), 0) as cost_cents
        from public.planner_sessions s
        left join lateral (
          select count(*) as renders,
                 count(*) filter (where r.status = 'success') as success,
                 count(*) filter (where r.feedback = 1) as thumbs_up,
                 count(*) filter (where r.feedback = -1) as thumbs_down,
                 coalesce(sum(r.cost_cents) filter (where r.status = 'success'), 0) as cost_cents
          from public.planner_renders r
          where r.session_id = s.id
        ) x on true
        where s.created_at >= v_since and s.ai_group is not null
        group by s.ai_group
      ) g
    ), '[]'::jsonb),
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
          where r.created_at >= v_since and r.status = 'success'), 0)
      )
      from public.planner_sessions s
      where s.created_at >= v_since
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

-- ---------------------------------------------------------------------------
-- 6. Gesundheitsprüfung
-- ---------------------------------------------------------------------------

create or replace function public.kw_health_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: liest Outbox, Cron-Protokoll, pg_net-Antworten, Anfragen,
  -- Rechnungen, Reklamationen, Fehler und KI-Bilder für kw-maintenance; nur service_role.
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
    'complaints_open', (select count(*) from public.kw_contact_complaints where status = 'offen' and created_at < now() - interval '5 days'),
    'errors_critical', (select count(*) from public.error_logs where severity = 'critical' and coalesce(last_seen_at, created_at) > now() - interval '1 hour'),
    'render_cap_near', (
      select case when c.cap > 0 and r.n >= ceil(c.cap * 0.8) then r.n else 0 end
      from (select coalesce((select s.daily_render_cap from public.kw_ai_settings s limit 1), 300) as cap) c,
           (select count(*) as n from public.planner_renders where created_at > now() - interval '24 hours') r
    ),
    'renders_failing', (
      select case when f.failed >= 3 and f.failed >= f.total * 0.3 then f.failed else 0 end
      from (
        select count(*) filter (where status = 'failed') as failed, count(*) as total
        from public.planner_renders
        where created_at > now() - interval '2 hours'
      ) f
    )
  );
$$;

revoke execute on function public.kw_health_snapshot() from public, anon, authenticated;
grant execute on function public.kw_health_snapshot() to service_role;

-- ---------------------------------------------------------------------------
-- 7. Datenauskunft
-- ---------------------------------------------------------------------------

create or replace function public.kw_project_export(p_lead_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: Kunden haben keine Tabellenrechte; Zugriff nur über den Projektlink.
  select jsonb_build_object(
    'erstellt_am', now(),
    'anfrage', (
      select to_jsonb(l) - 'id' - 'submission_id' - 'tier' - 'score' - 'bot_check'
      from public.leads l where l.id = p_lead_id
    ),
    'einwilligungen', coalesce((
      select jsonb_agg(jsonb_build_object(
        'zweck', c.purpose, 'erteilt', c.granted, 'textversion', c.text_version,
        'zeitpunkt', c.created_at, 'ip_adresse', c.ip_address
      ) order by c.created_at)
      from public.lead_consents c where c.lead_id = p_lead_id
    ), '[]'::jsonb),
    'ausschreibungen', coalesce((
      select jsonb_agg(jsonb_build_object(
        'status', a.status, 'veroeffentlicht', a.published_at, 'ende', a.ends_at,
        'entscheidung_bis', a.decision_deadline_at, 'zusammenfassung', a.public_summary
      ) order by a.created_at)
      from public.lead_auctions a where a.lead_id = p_lead_id
    ), '[]'::jsonb),
    'angebote', coalesce((
      select jsonb_agg(jsonb_build_object(
        'studio', coalesce(nullif(p.company_name, ''), 'Küchenstudio'),
        'preis_eur', b.price_eur, 'status', b.status, 'abgegeben', b.created_at
      ) order by b.created_at)
      from public.lead_bids b
      join public.lead_auctions a on a.id = b.auction_id
      join public.profiles p on p.id = b.dealer_id
      where a.lead_id = p_lead_id
    ), '[]'::jsonb),
    'kontaktfreigaben', coalesce((
      select jsonb_agg(jsonb_build_object(
        'studio', coalesce(nullif(p.company_name, ''), 'Küchenstudio'),
        'zeitpunkt', mc.purchased_at
      ) order by mc.purchased_at)
      from public.lead_match_candidates mc
      join public.profiles p on p.id = mc.dealer_id
      where mc.lead_id = p_lead_id and mc.is_purchased
    ), '[]'::jsonb),
    'planung', (
      select jsonb_build_object('raum', s.room, 'konfiguration', s.spec, 'schaetzung', s.estimate,
                                'anzahl_fotos', cardinality(s.photo_paths))
      from public.planner_sessions s where s.lead_id = p_lead_id
      order by s.created_at desc limit 1
    ),
    'ki_trainingsdaten', (
      select jsonb_build_object(
        'gespeicherte_fotos', count(*),
        'loeschung_spaetestens', max(t.expires_at)
      )
      from public.kw_ai_training_samples t where t.lead_id = p_lead_id
    ),
    'auftrag', (
      select jsonb_build_object('status', o.status, 'angebotspreis_eur', o.offer_price_eur,
                                'auftragswert_eur', o.contract_value_eur, 'erstellt', o.created_at)
      from public.kw_orders o where o.lead_id = p_lead_id
      order by o.created_at desc limit 1
    )
  );
$$;
