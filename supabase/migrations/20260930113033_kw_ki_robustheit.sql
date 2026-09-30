-- ============================================================================
-- KI-Visualisierung: Datenschutz bei fal, Nachlauf, Kontingent-Reserve,
-- Bewertungsgründe, ehrlicher A/B-Vergleich und Warnungen (30.09.2026)
--
-- 1. kw_ai_settings: Modell-IDs mit anderem Anbieter-Präfix erlauben
--    (openai/gpt-image-2.5/sunburst/edit, _shared/fal-models.ts).
-- 2. planner_renders.verified: zählt zum geprüften Teil des Tageslimits
--    (Planung mit Anfrage und bestandener Bot-Prüfung). Ungeprüfte Besucher
--    teilen sich höchstens 70 % (kw-planner OPEN_POOL_SHARE), damit Bots das
--    Kontingent nicht für echte Kund:innen aufbrauchen.
-- 3. planner_renders.feedback_reasons: Gründe bei „Gefällt mir nicht“
--    (_shared/render-feedback.ts).
-- 4. Cron kw-planner-sweep: jede Minute, aber nur wenn eine Visualisierung
--    seit über 75 s offen ist. Schließt ab, was kein Browser mehr abfragt
--    (Tab zu, Handy im Standby), auch über die Ausweichkette.
-- 5. kw_health_snapshot: fal-Konto sperrt Aufträge, hohe Ausweichquote,
--    hängende Visualisierungen (Texte in kw-maintenance).
-- 6. kw_admin_ai_stats: A/B-Vergleich über die Bilder mit Foto der Gruppe,
--    Bewertungen nur der Erstbilder, Ausweichquote, p90, Bewertungsgründe,
--    Kontingent geprüft/ungeprüft.
-- 7. Datenschutzerklärung Abschnitt 4: OpenAI als Modellhersteller, fal.ai
--    speichert keine Anfragedaten und löscht Bilder nach einer Stunde,
--    Bewertungsgründe, Einwilligung zur KI-Verbesserung im Ergebnis bzw. auf
--    der Projektseite (seit 20260930091716 nicht mehr beim Absenden).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Modell-IDs
-- ---------------------------------------------------------------------------

alter table public.kw_ai_settings drop constraint if exists kw_ai_settings_model_ids;
alter table public.kw_ai_settings add constraint kw_ai_settings_model_ids check (
  edit_model ~ '^[a-z0-9-]+/[a-z0-9./-]+$'
  and text_model ~ '^[a-z0-9-]+/[a-z0-9./-]+$'
  and coalesce(variant_model, 'x/x') ~ '^[a-z0-9-]+/[a-z0-9./-]+$'
  and coalesce(fallback_edit_model, 'x/x') ~ '^[a-z0-9-]+/[a-z0-9./-]+$'
  and coalesce(fallback_edit_model_2, 'x/x') ~ '^[a-z0-9-]+/[a-z0-9./-]+$'
  and coalesce(fallback_text_model, 'x/x') ~ '^[a-z0-9-]+/[a-z0-9./-]+$'
  and coalesce(challenger_edit_model, 'x/x') ~ '^[a-z0-9-]+/[a-z0-9./-]+$'
);

-- ---------------------------------------------------------------------------
-- 2. + 3. Kontingent und Bewertungsgründe
-- ---------------------------------------------------------------------------

alter table public.planner_renders
  add column if not exists verified boolean not null default false,
  add column if not exists feedback_reasons text[];

comment on column public.planner_renders.verified is
  'Zählt zum geprüften Teil des Tageslimits: Planung mit Anfrage und bestandener Bot-Prüfung. Ungeprüfte Besucher teilen sich höchstens 70 % (kw-planner OPEN_POOL_SHARE).';
comment on column public.planner_renders.feedback_reasons is
  'Gründe bei „Gefällt mir nicht“ (feedback = -1), IDs aus _shared/render-feedback.ts.';

alter table public.planner_renders drop constraint if exists planner_renders_feedback_reasons_check;
alter table public.planner_renders add constraint planner_renders_feedback_reasons_check check (
  feedback_reasons is null
  or (
    feedback = -1
    and cardinality(feedback_reasons) between 1 and 5
    and feedback_reasons <@ array['raum', 'kueche', 'material', 'proportionen', 'unecht']::text[]
  )
);

create index if not exists idx_planner_renders_open_created
  on public.planner_renders (created_at desc) where not verified;
create index if not exists idx_planner_renders_pending_created
  on public.planner_renders (created_at) where status = 'pending';

-- ---------------------------------------------------------------------------
-- 4. Nachlauf
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from cron.job where jobname = 'kw-planner-sweep') then
    perform cron.unschedule('kw-planner-sweep');
  end if;
end;
$$;

select cron.schedule(
  'kw-planner-sweep',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://gzqayoalwtmypndrmqes.supabase.co/functions/v1/kw-planner',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-kw-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'kw_cron_secret')),
    body := '{"action":"sweep"}'::jsonb,
    timeout_milliseconds := 55000
  )
  where exists (
      select 1 from public.planner_renders
      where status = 'pending' and created_at < now() - interval '75 seconds'
    )
    and exists (select 1 from vault.decrypted_secrets where name = 'kw_cron_secret');
  $cron$
);

-- ---------------------------------------------------------------------------
-- 5. Gesundheitsprüfung
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
    ),
    -- Kontosperre, fehlendes Guthaben oder ungültiger Schlüssel treffen alle Modelle.
    'fal_account_blocked', (
      select count(*) from public.planner_renders
      where created_at > now() - interval '2 hours'
        and concat_ws(' ', error_message, fallback_reason)
            ~* '(fal (submit|status|result) (401|402|403)|exhausted balance|user is locked|FAL_API_KEY)'
    ),
    -- Die Ausweichkette verdeckt ein gestörtes Hauptmodell: Bilder kommen, nur später und evtl. schwächer.
    'renders_fallback_high', (
      select case when f.fell_back >= 3 and f.fell_back >= f.total * 0.25 then f.fell_back else 0 end
      from (
        select count(*) filter (where fallback_from is not null) as fell_back, count(*) as total
        from public.planner_renders
        where created_at > now() - interval '24 hours' and status in ('success', 'failed')
      ) f
    ),
    'renders_stuck', (
      select count(*) from public.planner_renders
      where status = 'pending' and created_at < now() - interval '10 minutes'
    )
  );
$$;

revoke execute on function public.kw_health_snapshot() from public, anon, authenticated;
grant execute on function public.kw_health_snapshot() to service_role;

-- ---------------------------------------------------------------------------
-- 6. Kennzahlen für den Admin
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
  v_cap := coalesce(v_cap, 300);

  return jsonb_build_object(
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
    'models', coalesce((
      with base as (
        select coalesce(r.fallback_from, r.model_slug) as first_model, r.model_slug, r.fallback_from,
               r.mode, r.status, r.generation_ms, r.cost_cents, r.feedback, r.feedback_reasons, r.base_render_id
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
        where s.created_at >= v_since and s.ai_group is not null
        group by s.ai_group
      ) g
    ), '[]'::jsonb),
    'reasons', coalesce((
      select jsonb_object_agg(x.reason, x.n)
      from (
        select reason, count(*) as n
        from public.planner_renders r
        cross join lateral unnest(r.feedback_reasons) as reason
        where r.created_at >= v_since and r.feedback = -1
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
-- 7. Datenschutzerklärung
-- ---------------------------------------------------------------------------

do $$
declare
  v_old_vendors text := 'fal.ai nutzt dafür Bildmodelle verschiedener Hersteller (etwa Google, Black Forest Labs oder Alibaba), die das Foto zur Bilderzeugung verarbeiten; welches Modell eine Visualisierung erzeugt, wählen wir nach Qualität und Verfügbarkeit.';
  v_new_vendors text := 'fal.ai nutzt dafür Bildmodelle verschiedener Hersteller (etwa Google, OpenAI, Black Forest Labs oder Alibaba), die das Foto zur Bilderzeugung verarbeiten; welches Modell eine Visualisierung erzeugt, wählen wir nach Qualität und Verfügbarkeit. '
    || 'Wir weisen fal.ai an, die Anfragedaten nicht zu speichern und erzeugte Bilder spätestens nach einer Stunde zu löschen; aufbewahrt werden sie nur in unserem eigenen, nicht öffentlichen Speicher.';
  v_old_feedback text := 'Wenn Sie eine Visualisierung bewerten, speichern wir die Bewertung mit der Visualisierung, um die Qualität der Bildmodelle zu vergleichen';
  v_new_feedback text := 'Wenn Sie eine Visualisierung bewerten, speichern wir die Bewertung und die gewählten Gründe mit der Visualisierung, um die Qualität der Bildmodelle zu vergleichen';
  v_old_consent text := 'Wenn Sie beim Absenden zustimmen, speichern wir eine Kopie Ihrer Raumfotos';
  v_new_consent text := 'Wenn Sie im Ergebnis des Planers oder auf Ihrer Projektseite zustimmen, speichern wir eine Kopie Ihrer Raumfotos';
  v_content text;
begin
  select content into v_content from public.legal_pages where slug = 'datenschutz';
  if v_content is null then
    raise exception 'Datenschutzerklärung fehlt';
  end if;
  if strpos(v_content, 'Wir weisen fal.ai an, die Anfragedaten nicht zu speichern') > 0 then
    return;
  end if;
  if strpos(v_content, v_old_vendors) = 0 or strpos(v_content, v_old_feedback) = 0 or strpos(v_content, v_old_consent) = 0 then
    raise exception 'Datenschutzerklärung wurde zwischenzeitlich geändert – Ersetzung abgebrochen';
  end if;
  update public.legal_pages
     set content = replace(replace(replace(v_content, v_old_vendors, v_new_vendors), v_old_feedback, v_new_feedback), v_old_consent, v_new_consent),
         updated_at = now(),
         published_at = now(),
         version = version + 1
   where slug = 'datenschutz';
end $$;
