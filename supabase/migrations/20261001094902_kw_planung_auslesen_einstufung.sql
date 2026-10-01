-- ============================================================================
-- Funnel B: Planung zählt bei der Einstufung, Planungen per KI auslesen
-- (01.10.2026, Betreiber-Entscheidung)
--
-- 1. Einstufung: Eine hochgeladene Planung (lead_files.category = grundriss)
--    zählt als „Maße vorhanden“ (kw_lead_tier_score), wie in kw-lead-b.
--    kw_lead_refresh_tier rechnet Funnel-B-Anfragen nach jedem Upload neu,
--    auch für nachgereichte Planungen, und passt den Kontaktpreis des
--    Entwurfs an. Ist die Ausschreibung veröffentlicht, bleiben Einstufung
--    und Preis: Studios sehen den Preis dann schon.
-- 2. Planungen auslesen: kw_plan_readings (eine Zeile je Anfrage, nur Admins
--    lesen), Warteschlange über den Trigger auf lead_files, Cron
--    kw-plan-reading ruft kw-plan-read nur bei Bedarf, Schalter und Modell in
--    kw_ai_settings, Mistral-Schlüssel im Vault (kw_mistral_api_key).
-- 3. kw_anonymize_lead löscht die Auslesung, kw_project_export gibt sie aus.
-- 4. kw_health_snapshot: wartende und fehlgeschlagene Auslesungen.
-- 5. Datenschutzerklärung Abschnitt 3: Auslesen durch Mistral AI (EU).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Einstufung
-- ----------------------------------------------------------------------------

create or replace function public.kw_lead_refresh_tier(p_lead_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  -- DEFINER: läuft im Trigger auf lead_files (Uploads über die Service-Role,
  -- geschwärzte Fassungen vom Admin) und schreibt Lead und Entwurf.
  v_lead public.leads%rowtype;
  v_draft public.lead_auctions%rowtype;
  v_settings public.kw_marketplace_settings%rowtype;
  v_tier public.lead_tier;
  v_score integer;
  v_basis numeric;
  v_price integer;
begin
  select * into v_lead from public.leads where id = p_lead_id;
  if v_lead.id is null or v_lead.funnel_type::text <> 'b' or v_lead.anonymized_at is not null then
    return;
  end if;
  -- Veröffentlicht: Studios kennen den Kontaktpreis, die Einstufung bleibt.
  if exists (
    select 1 from public.lead_auctions
    where lead_id = p_lead_id and status in ('active', 'completed', 'awarded')
  ) then
    return;
  end if;

  select s.tier, s.score into v_tier, v_score
    from public.kw_lead_tier_score(
      exists (select 1 from public.lead_files where lead_id = p_lead_id and category in ('kueche_bild', 'grundriss')),
      exists (select 1 from public.lead_files where lead_id = p_lead_id and category = 'grundriss'),
      v_lead.phone is not null,
      v_lead.timeframe_months,
      coalesce(round(v_lead.existing_offer_price_cents / 100.0), v_lead.budget_midpoint)
    ) s;
  if v_tier is distinct from v_lead.tier or v_score is distinct from v_lead.score then
    update public.leads set tier = v_tier, score = v_score where id = p_lead_id;
  end if;

  select * into v_draft from public.lead_auctions
  where lead_id = p_lead_id and status = 'draft'
  order by created_at desc limit 1;
  if v_draft.id is null then
    return;
  end if;
  select * into v_settings from public.kw_marketplace_settings where id;
  -- Wie kw_open_tender.
  v_basis := coalesce(
    (v_draft.estimate_min_eur + v_draft.estimate_max_eur) / 2,
    v_draft.reference_price_eur,
    v_lead.budget_midpoint,
    v_lead.existing_offer_price_cents / 100.0
  );
  v_price := coalesce(
    public.calculate_lead_price_cents(round(coalesce(v_basis, 0) * 100)::integer, v_tier),
    v_settings.contact_price_fallback_cents
  );
  if v_price is distinct from v_draft.contact_price_cents then
    update public.lead_auctions set contact_price_cents = v_price where id = v_draft.id and status = 'draft';
  end if;
end;
$function$;

revoke all on function public.kw_lead_refresh_tier(uuid) from public, anon, authenticated;
grant execute on function public.kw_lead_refresh_tier(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- 2. Planungen auslesen
-- ----------------------------------------------------------------------------

alter table public.kw_ai_settings
  add column if not exists plan_reading_enabled boolean not null default true,
  add column if not exists plan_reading_model text not null default 'mistral-medium-latest';

comment on column public.kw_ai_settings.plan_reading_enabled is
  'Hochgeladene Planungen aus Funnel B per KI auslesen (kw-plan-read). Aus: keine neuen Auslesungen.';
comment on column public.kw_ai_settings.plan_reading_model is
  'Mistral-Modell für kw-plan-read; unbekannte IDs nutzen das Standardmodell (_shared/plan-reading.ts).';

create table if not exists public.kw_plan_readings (
  lead_id uuid primary key references public.leads(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed', 'skipped')),
  requested_at timestamptz not null default now(),
  next_attempt_at timestamptz,
  attempts smallint not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  model text,
  file_ids uuid[] not null default '{}',
  result jsonb,
  error_code text,
  error_message text,
  duration_ms integer,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.kw_plan_readings is
  'KI-Auslesung hochgeladener Planungen (Funnel B) als Vorschlag fürs Briefing des Experten-Checks. Ohne Namen und Kontaktdaten, nur ob welche auf den Unterlagen stehen; Studios sehen nichts davon. Nur Admins lesen; geschrieben wird über kw-plan-read (service_role) und den Trigger auf lead_files.';

create index if not exists idx_kw_plan_readings_due
  on public.kw_plan_readings (requested_at) where status in ('pending', 'running');

drop trigger if exists kw_plan_readings_updated_at on public.kw_plan_readings;
create trigger kw_plan_readings_updated_at
  before update on public.kw_plan_readings
  for each row execute function public.kw_set_updated_at();

alter table public.kw_plan_readings enable row level security;
revoke all on public.kw_plan_readings from anon, authenticated;
grant select on public.kw_plan_readings to authenticated;
drop policy if exists "PlanReadings: admin read" on public.kw_plan_readings;
create policy "PlanReadings: admin read" on public.kw_plan_readings
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

create or replace function public.kw_mistral_api_key()
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $function$
  -- DEFINER: liest den Mistral-Schlüssel aus dem Vault für kw-plan-read; nur service_role.
  select decrypted_secret
    from vault.decrypted_secrets
   where name = 'mistral_api_key'
   order by created_at desc
   limit 1;
$function$;

revoke all on function public.kw_mistral_api_key() from public, anon, authenticated;
grant execute on function public.kw_mistral_api_key() to service_role;

create or replace function public.kw_plan_readings_claim(p_limit integer default 1)
returns setof public.kw_plan_readings
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
begin
  -- DEFINER: nur service_role (kw-plan-read); vergibt wartende Auslesungen
  -- ohne Doppelvergabe. Läufe, deren Function abgebrochen ist, gibt es frei.
  update public.kw_plan_readings
     set status = 'pending'
   where status = 'running' and started_at < now() - interval '10 minutes';

  return query
  update public.kw_plan_readings r
     set status = 'running', started_at = now(), attempts = r.attempts + 1
   where r.lead_id in (
     select q.lead_id from public.kw_plan_readings q
      where q.status = 'pending'
        and q.requested_at < now() - interval '45 seconds'
        and (q.next_attempt_at is null or q.next_attempt_at <= now())
      order by q.requested_at
      limit greatest(1, least(coalesce(p_limit, 1), 5))
      for update skip locked
   )
  returning r.*;
end;
$function$;

create or replace function public.kw_plan_reading_start(p_lead_id uuid)
returns setof public.kw_plan_readings
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
begin
  -- DEFINER: nur service_role (kw-plan-read, Admin „Planung auslesen“);
  -- übernimmt die Auslesung, außer ein anderer Lauf ist gerade dabei.
  return query
  insert into public.kw_plan_readings as r (lead_id, status, requested_at, started_at, attempts)
  values (p_lead_id, 'running', now(), now(), 1)
  on conflict (lead_id) do update
     set status = 'running', requested_at = now(), started_at = now(), attempts = 1,
         next_attempt_at = null, error_code = null, error_message = null
   where r.status <> 'running' or r.started_at < now() - interval '10 minutes'
  returning r.*;
end;
$function$;

revoke all on function public.kw_plan_readings_claim(integer) from public, anon, authenticated;
revoke all on function public.kw_plan_reading_start(uuid) from public, anon, authenticated;
grant execute on function public.kw_plan_readings_claim(integer) to service_role;
grant execute on function public.kw_plan_reading_start(uuid) to service_role;

create or replace function public.kw_lead_files_after_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  -- DEFINER: Uploads kommen über die Service-Role (Funnel, Projektseite) oder
  -- vom Admin (geschwärzte Fassung); schreibt Einstufung und Warteschlange.
  v_funnel text;
begin
  select funnel_type::text into v_funnel from public.leads where id = new.lead_id;
  if v_funnel is distinct from 'b' then
    return new;
  end if;

  begin
    perform public.kw_lead_refresh_tier(new.lead_id);
  exception when others then
    -- Ein Upload darf nie an der Einstufung scheitern.
    raise warning 'kw_lead_refresh_tier(%): %', new.lead_id, sqlerrm;
  end;

  -- Geschwärzte Fassungen lädt das Team hoch; sie bringen nichts Neues.
  if new.category in ('grundriss', 'angebot')
     and coalesce(new.file_name, '') !~* '\(geschwärzt\)\.[a-z0-9]+$'
     and coalesce((select s.plan_reading_enabled from public.kw_ai_settings s where s.id), false) then
    begin
      -- Läuft gerade eine Auslesung, liest kw-plan-read danach noch einmal mit der neuen Datei.
      insert into public.kw_plan_readings as r (lead_id, status, requested_at)
      values (new.lead_id, 'pending', now())
      on conflict (lead_id) do update
         set requested_at = now(),
             status = case when r.status = 'running' then r.status else 'pending' end,
             attempts = case when r.status = 'running' then r.attempts else 0 end,
             next_attempt_at = case when r.status = 'running' then r.next_attempt_at end;
    exception when others then
      raise warning 'kw_plan_readings enqueue(%): %', new.lead_id, sqlerrm;
    end;
  end if;
  return new;
end;
$function$;

drop trigger if exists kw_lead_files_after_insert on public.lead_files;
create trigger kw_lead_files_after_insert
  after insert on public.lead_files
  for each row execute function public.kw_lead_files_after_insert();

do $$
begin
  if exists (select 1 from cron.job where jobname = 'kw-plan-reading') then
    perform cron.unschedule('kw-plan-reading');
  end if;
end;
$$;

select cron.schedule(
  'kw-plan-reading',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://gzqayoalwtmypndrmqes.supabase.co/functions/v1/kw-plan-read',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-kw-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'kw_cron_secret')),
    body := '{"action":"sweep"}'::jsonb,
    timeout_milliseconds := 30000
  )
  where exists (
    select 1 from public.kw_plan_readings
    where (status = 'pending' and requested_at < now() - interval '45 seconds'
           and (next_attempt_at is null or next_attempt_at <= now()))
       or (status = 'running' and started_at < now() - interval '10 minutes')
  );
  $cron$
);

-- ----------------------------------------------------------------------------
-- 3. Anonymisierung und Datenexport
-- ----------------------------------------------------------------------------

create or replace function public.kw_anonymize_lead(p_lead_id uuid, p_source text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
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
         funnel_answers = (coalesce(funnel_answers, '{}'::jsonb)
           - 'salutation' - 'extrasNotes' - 'planChangesText' - 'wishes' - 'special_wishes' - 'notes' - 'contact')
           #- '{config,wishes}',
         status = case when status = 'closed_won' then status else 'closed_lost'::lead_status end,
         anonymized_at = now()
   where id = p_lead_id;

  -- Freitexte der Ausschreibung sehen Studios mit Angebot weiterhin.
  update public.lead_auctions
     set public_summary = coalesce(public_summary, '{}'::jsonb) - 'wishes'
           #- '{config,wishes}' #- '{room,notes}' #- '{answers,extrasNotes}' #- '{answers,planChangesText}'
   where lead_id = p_lead_id;

  update public.lead_consents set ip_address = null, user_agent = null where lead_id = p_lead_id;
  update public.lead_access_tokens set revoked_at = now() where lead_id = p_lead_id and revoked_at is null;
  delete from public.lead_upload_tokens where lead_id = p_lead_id;
  delete from public.lead_files where lead_id = p_lead_id;
  delete from public.lead_views where lead_id = p_lead_id;
  delete from public.kw_lead_details where lead_id = p_lead_id;
  delete from public.kw_plan_readings where lead_id = p_lead_id;
  update public.planner_sessions
     set photo_paths = '{}', ip_address = null, user_agent = null, expert_note = null,
         spec = coalesce(spec, '{}'::jsonb) - 'wishes'
   where lead_id = p_lead_id;
  update public.planner_renders r
     set image_path = null, input_image_path = null, user_message = null
    from public.planner_sessions s
   where s.id = r.session_id and s.lead_id = p_lead_id;

  insert into public.audit_logs (action, entity_type, entity_id, details)
  values ('lead_anonymized', 'lead', p_lead_id::text, jsonb_build_object('source', p_source));

  return jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.kw_anonymize_lead(uuid, text) from public, anon, authenticated;
grant execute on function public.kw_anonymize_lead(uuid, text) to service_role;

create or replace function public.kw_project_export(p_lead_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $function$
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
    'ergaenzungen', (
      select jsonb_build_object('vom_kunden', d.customer, 'vom_kunden_am', d.customer_updated_at,
                                'experten_check', d.expert, 'experten_check_am', d.expert_updated_at)
      from public.kw_lead_details d where d.lead_id = p_lead_id
    ),
    'ki_auslesung_der_planung', (
      select jsonb_build_object('ergebnis', r.result, 'ausgelesen_am', r.finished_at, 'modell', r.model)
      from public.kw_plan_readings r where r.lead_id = p_lead_id and r.status = 'done'
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
$function$;

-- ----------------------------------------------------------------------------
-- 4. Health-Check
-- ----------------------------------------------------------------------------

create or replace function public.kw_health_snapshot()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $function$
  -- DEFINER: liest Outbox, Cron-Protokoll, pg_net-Antworten, Anfragen,
  -- Rechnungen, Reklamationen, Fehler, KI-Bilder und Planungs-Auslesungen für kw-maintenance; nur service_role.
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
        and public.kw_lead_share_consent(l.id) is not false
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
    ),
    -- Meist fehlt der Mistral-Schlüssel; ohne Mistral das Auslesen ausschalten.
    'plan_readings_waiting', (
      select count(*) from public.kw_plan_readings
      where status = 'pending' and requested_at < now() - interval '2 hours'
    ),
    'plan_readings_failed', (
      select count(*) from public.kw_plan_readings
      where status = 'failed' and finished_at > now() - interval '24 hours'
    )
  );
$function$;

-- ----------------------------------------------------------------------------
-- 5. Datenschutzerklärung
-- ----------------------------------------------------------------------------

do $$
declare
  v_anchor text := '<p><strong>Rechtsgrundlagen:</strong> Die Vermittlung erfolgt auf Ihre Anfrage hin';
  v_new text := '<p><strong>Auslesen hochgeladener Planungen:</strong> Laden Sie die Planung oder das Angebot eines '
    || 'Küchenstudios hoch, lassen wir die Dateien von <strong>Mistral AI</strong> (Mistral AI SAS, Paris, Frankreich) '
    || 'auslesen, damit Sie die Angaben nicht abtippen müssen, etwa Küchenform, Hersteller, Maße, Geräte und enthaltene '
    || 'Leistungen. Mistral AI verarbeitet die Dateien in unserem Auftrag auf Servern in der EU, nutzt sie nicht zum '
    || 'Training von KI-Modellen und löscht die Anfragedaten spätestens nach 30 Tagen. Das Ergebnis ist ein Vorschlag '
    || 'für unser Team: Küchenstudios sehen die Angaben erst, nachdem wir sie geprüft haben, und ohne Namen und '
    || 'Kontaktdaten. Namen, Anschriften und Kontaktdaten auf Ihren Unterlagen übernehmen wir dabei nicht; wir vermerken '
    || 'nur, ob welche zu sehen sind, damit wir sie vor einer Freigabe schwärzen. Rechtsgrundlage ist die von Ihnen '
    || 'angefragte Vermittlung (Art. 6 Abs. 1 lit. b DSGVO). Das Ergebnis löschen wir mit der Anonymisierung Ihrer '
    || 'Anfrage.</p>' || chr(10);
  v_content text;
begin
  select content into v_content from public.legal_pages where slug = 'datenschutz';
  if v_content is null then
    raise exception 'Datenschutzerklärung fehlt';
  end if;
  if strpos(v_content, 'Auslesen hochgeladener Planungen') > 0 then
    return;
  end if;
  if strpos(v_content, v_anchor) = 0 then
    raise exception 'Datenschutzerklärung wurde zwischenzeitlich geändert – Ergänzung abgebrochen';
  end if;
  update public.legal_pages
     set content = replace(v_content, v_anchor, v_new || v_anchor),
         updated_at = now(),
         published_at = now(),
         version = version + 1
   where slug = 'datenschutz';
end $$;
