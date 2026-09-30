-- ============================================================================
-- Projekt-Ergänzungen: Angaben vervollständigen, Experten-Check, Uploads
-- ============================================================================
--
-- * kw_lead_details: Ergänzungen nach dem Absenden, getrennt von den
--   Funnel-Antworten. customer = vom Kunden auf der Projektseite (kw-project
--   save-details), expert = Briefing des Teams nach dem Experten-Check
--   (Admin über RLS). _shared/lead-details.ts bereinigt vor dem Speichern
--   (bekannte Felder, Freitexte ohne Kontaktdaten); die Zeitstempel setzt
--   der Trigger.
-- * project_updated (Outbox, market): nach Änderungen an kw_lead_details und
--   nach der Freigabe einer Datei für Studios. kw-market-worker benachrichtigt
--   Studios mit Angebot oder gekauftem Kontakt (höchstens alle 6 Stunden).
-- * kw_dealer_project, kw_project_view und kw_project_export geben die
--   Ergänzungen aus; kw_anonymize_lead löscht sie und entfernt die
--   Planer-Wünsche (Freitext) auch aus Konfiguration und Ausschreibung.
-- * Check-Constraints: dealer_notifications 'project_updated'; admin_emails
--   'project_updated_dealer' und fünf Typen der Worker, deren Protokollzeilen
--   bisher still scheiterten (complaint_admin, complaint_decided,
--   invoice_issue_blocked, lead_files_admin, order_reminder).
-- * kw_ux_field_label kennt die neuen Funnel-Felder; die
--   Datenschutzerklärung beschreibt Ergänzungen und Uploads.
-- ============================================================================

create table if not exists public.kw_lead_details (
  lead_id uuid primary key references public.leads(id) on delete cascade,
  customer jsonb not null default '{}'::jsonb,
  customer_updated_at timestamptz,
  expert jsonb not null default '{}'::jsonb,
  expert_updated_at timestamptz,
  expert_updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kw_lead_details_customer_check check (jsonb_typeof(customer) = 'object' and octet_length(customer::text) <= 8000),
  constraint kw_lead_details_expert_check check (jsonb_typeof(expert) = 'object' and octet_length(expert::text) <= 8000)
);

comment on table public.kw_lead_details is
  'Ergänzungen zu einer Anfrage nach dem Absenden: customer (Projektseite), expert (Experten-Check des Teams). Studios sehen beides ohne Kontaktdaten.';

alter table public.kw_lead_details enable row level security;
revoke all on public.kw_lead_details from anon, authenticated;
grant select, insert, update on public.kw_lead_details to authenticated;

drop policy if exists "LeadDetails: admin full" on public.kw_lead_details;
create policy "LeadDetails: admin full" on public.kw_lead_details
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

create or replace function public.kw_lead_details_touch()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    if new.customer <> '{}'::jsonb then
      new.customer_updated_at := now();
    end if;
    if new.expert <> '{}'::jsonb then
      new.expert_updated_at := now();
      new.expert_updated_by := auth.uid();
    end if;
  else
    if new.customer is distinct from old.customer then
      new.customer_updated_at := now();
    end if;
    if new.expert is distinct from old.expert then
      new.expert_updated_at := now();
      new.expert_updated_by := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.kw_lead_details_touch() from public, anon, authenticated;

drop trigger if exists kw_lead_details_touch on public.kw_lead_details;
create trigger kw_lead_details_touch
  before insert or update on public.kw_lead_details
  for each row execute function public.kw_lead_details_touch();

create or replace function public.kw_lead_details_changed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: Admins und kw-project schreiben, die Outbox ist nur für service_role.
  v_customer boolean;
  v_expert boolean;
begin
  if tg_op = 'INSERT' then
    v_customer := new.customer <> '{}'::jsonb;
    v_expert := new.expert <> '{}'::jsonb;
  else
    v_customer := new.customer is distinct from old.customer;
    v_expert := new.expert is distinct from old.expert;
  end if;
  if v_customer then
    perform public.kw_enqueue('project_updated', jsonb_build_object('lead_id', new.lead_id, 'source', 'customer'));
  end if;
  if v_expert then
    perform public.kw_enqueue('project_updated', jsonb_build_object('lead_id', new.lead_id, 'source', 'expert'));
  end if;
  return null;
end;
$$;

revoke all on function public.kw_lead_details_changed() from public, anon, authenticated;

drop trigger if exists kw_lead_details_changed on public.kw_lead_details;
create trigger kw_lead_details_changed
  after insert or update on public.kw_lead_details
  for each row execute function public.kw_lead_details_changed();

create or replace function public.kw_lead_file_released()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- DEFINER: Admins geben Dateien frei, die Outbox ist nur für service_role.
  if new.shared_with_studios and not coalesce(old.shared_with_studios, false) then
    perform public.kw_enqueue('project_updated', jsonb_build_object('lead_id', new.lead_id, 'source', 'files'));
  end if;
  return null;
end;
$$;

revoke all on function public.kw_lead_file_released() from public, anon, authenticated;

drop trigger if exists kw_lead_file_released on public.lead_files;
create trigger kw_lead_file_released
  after update of shared_with_studios on public.lead_files
  for each row execute function public.kw_lead_file_released();

-- ----------------------------------------------------------------------------
-- Check-Constraints: fehlende Werte anhängen, bestehende bleiben (Altdaten)
-- ----------------------------------------------------------------------------

do $$
declare
  v_target record;
  v_def text;
  v_add text;
  v_value text;
begin
  for v_target in
    select * from (values
      ('dealer_notifications', 'dealer_notifications_type_check', array['project_updated']),
      ('admin_emails', 'admin_emails_email_type_check',
       array['project_updated_dealer', 'complaint_admin', 'complaint_decided', 'invoice_issue_blocked', 'lead_files_admin', 'order_reminder'])
    ) as t(tbl, con, vals)
  loop
    select pg_get_constraintdef(oid) into v_def
      from pg_constraint
     where conrelid = ('public.' || v_target.tbl)::regclass and conname = v_target.con;
    if v_def is null then
      raise exception '% fehlt', v_target.con;
    end if;
    v_add := '';
    foreach v_value in array v_target.vals loop
      if strpos(v_def, '''' || v_value || '''::text') = 0 then
        v_add := v_add || ', ''' || v_value || '''::text';
      end if;
    end loop;
    continue when v_add = '';
    if right(v_def, 4) <> '])))' then
      raise exception 'Unerwartete Form von %: …%', v_target.con, right(v_def, 40);
    end if;
    execute format('alter table public.%I drop constraint %I', v_target.tbl, v_target.con);
    execute format('alter table public.%I add constraint %I ', v_target.tbl, v_target.con)
         || left(v_def, length(v_def) - 4) || v_add || '])))';
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Studio-Portal: Ergänzungen zur Ausschreibung
-- ----------------------------------------------------------------------------

create or replace function public.kw_dealer_project(p_auction_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: siehe kw_dealer_projects; Kontaktdaten nur bei Kauf/Zuschlag.
  v_uid uuid := auth.uid();
  v_origin text;
  v_radius integer;
  v_a public.lead_auctions%rowtype;
  v_l public.leads%rowtype;
  v_unlocked boolean;
  v_won boolean;
  v_has_bid boolean;
  v_distance numeric;
  v_media jsonb;
begin
  if not public.kw_is_dealer_account(v_uid) then
    raise exception 'Nur für freigeschaltete Küchenstudios.' using errcode = '42501';
  end if;
  select * into v_a from public.lead_auctions where id = p_auction_id;
  if v_a.id is null or v_a.status = 'draft' then
    raise exception 'Projekt nicht gefunden.' using errcode = 'P0002';
  end if;
  select * into v_l from public.leads where id = v_a.lead_id;
  select o.postal_code, o.radius_km into v_origin, v_radius from public.kw_dealer_origin(v_uid) o;
  v_distance := case when v_origin is null then null else public.kw_plz_distance_km(v_origin, v_l.postal_code) end;

  v_unlocked := exists (select 1 from public.lead_match_candidates mc
                        where mc.lead_id = v_l.id and mc.dealer_id = v_uid and mc.is_purchased);
  v_won := exists (select 1 from public.lead_bids b where b.id = v_a.won_bid_id and b.dealer_id = v_uid);
  v_has_bid := exists (select 1 from public.lead_bids b where b.auction_id = v_a.id and b.dealer_id = v_uid);

  -- Eigene Projekte bleiben immer abrufbar; fremde nur, solange sie offen sind,
  -- im Einzugsgebiet liegen und das Konto aktiv ist.
  if not (v_unlocked or v_won or v_has_bid) then
    if v_a.status not in ('active', 'completed')
       or not public.kw_is_active_dealer(v_uid)
       or not public.kw_dealer_in_area(v_uid, v_l.postal_code) then
      raise exception 'Projekt nicht gefunden.' using errcode = 'P0002';
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('bucket', r.storage_bucket, 'path', r.image_path,
                                               'kind', 'render', 'mode', r.mode, 'created_at', r.created_at)
                            order by r.version desc), '[]'::jsonb)
  into v_media
  from public.planner_renders r
  where r.session_id = v_a.planner_session_id and r.status = 'success' and r.image_path is not null;

  if v_a.planner_session_id is not null then
    select v_media || coalesce((
      select jsonb_agg(jsonb_build_object('bucket', 'planner-media', 'path', p, 'kind', 'photo'))
      from public.planner_sessions s, unnest(s.photo_paths) p
      where s.id = v_a.planner_session_id
    ), '[]'::jsonb) into v_media;
  end if;

  -- Unterlagen: freigegebene immer, alle erst nach Kontaktkauf oder Zuschlag.
  select v_media || coalesce((
    select jsonb_agg(jsonb_build_object(
             'bucket', 'lead-files', 'path', f.file_url, 'kind', 'document',
             'category', f.category, 'type', f.file_type,
             'name', case when v_unlocked or v_won then f.file_name end,
             'released', f.shared_with_studios)
           order by f.created_at)
    from public.lead_files f
    where f.lead_id = v_l.id
      and (f.shared_with_studios or v_unlocked or v_won)
  ), '[]'::jsonb) into v_media;

  insert into public.lead_views (lead_id, dealer_id)
  select v_l.id, v_uid
  where not exists (
    select 1 from public.lead_views lv
    where lv.lead_id = v_l.id and lv.dealer_id = v_uid and lv.viewed_at > now() - interval '1 day'
  );

  return jsonb_build_object(
    'auction_id', v_a.id,
    'status', v_a.status,
    'funnel_type', v_l.funnel_type::text,
    'published_at', v_a.published_at,
    'ends_at', v_a.ends_at,
    'decision_deadline_at', v_a.decision_deadline_at,
    'postal_prefix', left(v_l.postal_code, 3) || 'xx',
    'region', v_l.region,
    'distance_km', v_distance,
    'service_radius_km', v_radius,
    'in_service_area', (v_origin is not null and (v_distance is null or v_distance <= v_radius)),
    'summary', v_a.public_summary,
    'estimate_min_eur', v_a.estimate_min_eur,
    'estimate_max_eur', v_a.estimate_max_eur,
    'reference_price_eur', v_a.reference_price_eur,
    'bid_visibility', v_a.bid_visibility,
    'offer_count', (select count(*) from public.lead_bids b where b.auction_id = v_a.id and b.status in ('active', 'accepted')),
    'lowest_offer_eur', case when v_a.bid_visibility = 'lowest_price'
      then (select min(b.price_eur) from public.lead_bids b where b.auction_id = v_a.id and b.status = 'active') end,
    'my_offer', (select to_jsonb(b) - 'dealer_id' - 'is_winning' from public.lead_bids b
                 where b.auction_id = v_a.id and b.dealer_id = v_uid),
    'contact_unlocked', v_unlocked,
    'contact_purchases', (select count(*) from public.lead_match_candidates mc
                          where mc.lead_id = v_l.id and mc.is_purchased and mc.access_source = 'purchase'),
    'max_contact_purchases', v_a.max_contact_purchases,
    'contact_price_cents', v_a.contact_price_cents,
    'contact_available', public.kw_lead_share_consent(v_l.id),
    'awarded_to_me', v_won,
    'media', v_media,
    'details', (select jsonb_build_object('customer', d.customer, 'customer_updated_at', d.customer_updated_at,
                                          'expert', d.expert, 'expert_updated_at', d.expert_updated_at)
                from public.kw_lead_details d where d.lead_id = v_l.id),
    'contact', case when v_unlocked or v_won then jsonb_build_object(
      'first_name', v_l.first_name, 'last_name', v_l.last_name,
      'email', v_l.email,
      'phone', case when v_won or v_l.consent_call then v_l.phone end,
      'postal_code', v_l.postal_code, 'city', v_l.city, 'address_line', v_l.address_line,
      'consent_call', v_l.consent_call
    ) end
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- Projektseite: eigene Ergänzungen des Kunden
-- ----------------------------------------------------------------------------

create or replace function public.kw_project_view(p_lead_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: Kunden lesen ihr Projekt über den Projektlink ohne Tabellenrechte.
  v_l public.leads%rowtype;
  v_a public.lead_auctions%rowtype;
  v_offers jsonb;
  v_renders jsonb;
  v_session public.planner_sessions%rowtype;
begin
  select * into v_l from public.leads where id = p_lead_id;
  if v_l.id is null then
    return null;
  end if;
  select * into v_a from public.lead_auctions where lead_id = p_lead_id order by created_at desc limit 1;
  select * into v_session from public.planner_sessions where lead_id = p_lead_id order by created_at desc limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
      'bid_id', b.id,
      'price_eur', b.price_eur,
      'delivery_weeks', b.delivery_weeks,
      'includes', b.includes,
      'valid_until', b.valid_until,
      'message', b.notes,
      'revision', b.revision,
      'status', b.status,
      'submitted_at', b.created_at,
      'updated_at', b.updated_at,
      'dealer', jsonb_strip_nulls(jsonb_build_object(
        'company_name', coalesce(nullif(p.company_name, ''), 'Küchenstudio'),
        'city', p.company_city,
        'website', p.website,
        'verified', coalesce(p.is_verified, false),
        'member_since', p.created_at,
        'distance_km', public.kw_plz_distance_km(coalesce(p.company_zip, p.address_zip, ''), v_l.postal_code),
        'rating', rs.average_rating,
        'reviews', coalesce(rs.total_reviews, 0),
        'intro', mp.offer_intro,
        'phone', case when b.status = 'accepted' then p.phone end,
        'email', case when b.status = 'accepted' then p.email end,
        'street', case when b.status = 'accepted' then p.company_street end,
        'postal_code', case when b.status = 'accepted' then p.company_zip end
      ))
    ) order by b.price_eur asc), '[]'::jsonb)
  into v_offers
  from public.lead_bids b
  join public.profiles p on p.id = b.dealer_id
  left join public.dealer_rating_summary rs on rs.dealer_id = b.dealer_id
  left join public.kw_dealer_market_profiles mp on mp.dealer_id = b.dealer_id
  where v_a.id is not null and b.auction_id = v_a.id and b.status in ('active', 'accepted', 'declined');

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'bucket', r.storage_bucket, 'path', r.image_path, 'mode', r.mode,
      'version', r.version, 'variant', r.variant_label, 'created_at', r.created_at
    ) order by r.version desc), '[]'::jsonb)
  into v_renders
  from public.planner_renders r
  where v_session.id is not null and r.session_id = v_session.id and r.status = 'success' and r.image_path is not null;

  return jsonb_build_object(
    'lead', jsonb_build_object(
      'id', v_l.id, 'funnel_type', v_l.funnel_type::text, 'status', v_l.status::text,
      'first_name', v_l.first_name, 'postal_code', v_l.postal_code, 'created_at', v_l.created_at,
      'kitchen_form', v_l.kitchen_form, 'kitchen_style', v_l.kitchen_style,
      'budget_eur', v_l.budget_midpoint, 'timeframe_months', v_l.timeframe_months,
      'has_phone', (v_l.phone is not null and length(trim(v_l.phone)) > 0),
      'studios_in_area', public.kw_studios_covering(v_l.postal_code)
    ),
    'tender', case when v_a.id is null then null else jsonb_build_object(
      'id', v_a.id, 'status', v_a.status, 'published_at', v_a.published_at,
      'ends_at', v_a.ends_at, 'decision_deadline_at', v_a.decision_deadline_at,
      'estimate_min_eur', v_a.estimate_min_eur, 'estimate_max_eur', v_a.estimate_max_eur,
      'reference_price_eur', v_a.reference_price_eur, 'won_bid_id', v_a.won_bid_id,
      'decided_at', v_a.decided_at, 'summary', v_a.public_summary,
      'contact_unlocks', (select count(*) from public.lead_match_candidates mc
                          where mc.lead_id = v_l.id and mc.is_purchased and mc.access_source = 'purchase')
    ) end,
    'offers', v_offers,
    'renders', v_renders,
    'planner', case when v_session.id is null then null else jsonb_build_object(
      'room', v_session.room, 'spec', v_session.spec,
      'estimate', v_session.estimate, 'photo_count', cardinality(v_session.photo_paths)
    ) end,
    'details', (select jsonb_build_object('customer', d.customer, 'updated_at', d.customer_updated_at)
                from public.kw_lead_details d where d.lead_id = v_l.id)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- Auskunft (Art. 15/20 DSGVO): Ergänzungen gehören dazu
-- ----------------------------------------------------------------------------

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
    'ergaenzungen', (
      select jsonb_build_object('vom_kunden', d.customer, 'vom_kunden_am', d.customer_updated_at,
                                'experten_check', d.expert, 'experten_check_am', d.expert_updated_at)
      from public.kw_lead_details d where d.lead_id = p_lead_id
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

-- ----------------------------------------------------------------------------
-- Anonymisierung: Ergänzungen löschen, Freitext-Wünsche überall entfernen
-- ----------------------------------------------------------------------------

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
         funnel_answers = (coalesce(funnel_answers, '{}'::jsonb)
           - 'salutation' - 'extrasNotes' - 'wishes' - 'special_wishes' - 'notes' - 'contact') #- '{config,wishes}',
         status = case when status = 'closed_won' then status else 'closed_lost'::lead_status end,
         anonymized_at = now()
   where id = p_lead_id;

  -- Freitexte der Ausschreibung sehen Studios mit Angebot weiterhin.
  update public.lead_auctions
     set public_summary = coalesce(public_summary, '{}'::jsonb) - 'wishes'
           #- '{config,wishes}' #- '{room,notes}' #- '{answers,extrasNotes}'
   where lead_id = p_lead_id;

  update public.lead_consents set ip_address = null, user_agent = null where lead_id = p_lead_id;
  update public.lead_access_tokens set revoked_at = now() where lead_id = p_lead_id and revoked_at is null;
  delete from public.lead_upload_tokens where lead_id = p_lead_id;
  delete from public.lead_files where lead_id = p_lead_id;
  delete from public.lead_views where lead_id = p_lead_id;
  delete from public.kw_lead_details where lead_id = p_lead_id;
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
$$;

-- ----------------------------------------------------------------------------
-- UX-Alerts: Namen der neuen Funnel-Felder
-- ----------------------------------------------------------------------------

create or replace function public.kw_ux_field_label(p_field text)
returns text
language sql
immutable
set search_path = public, pg_catalog
as $$
  select case
    when p_field is null then null
    when p_field ~ '^wall-[a-z]$' then 'Wand ' || upper(right(p_field, 1))
    else coalesce((
      select m.label
      from (values
        ('first_name', 'Vorname'), ('last_name', 'Nachname'), ('email', 'E-Mail'), ('phone', 'Telefon'),
        ('salutation', 'Anrede'), ('postal_code', 'Postleitzahl'), ('postal-code', 'Postleitzahl'),
        ('plz-early', 'Postleitzahl'), ('funnel-plz', 'Postleitzahl'), ('plz', 'Postleitzahl'), ('city', 'Ort'),
        ('existing_offer_price', 'Angebotspreis'), ('existing_offer_studio', 'Name des Küchenstudios'),
        ('offer_delivery', 'Unterlagen hochladen oder nachreichen'), ('uploads', 'Unterlagen'),
        ('remove_file', 'Datei entfernen'), ('consent_share', 'Einwilligung zur Weitergabe'),
        ('share_with_studios', 'Einwilligung zur Weitergabe'), ('consent_call', 'Einwilligung zum Rückruf'),
        ('consent_studio_call', 'Anrufe durch Studios'), ('contact_by_phone', 'Telefonkontakt'),
        ('anruf', 'Telefonkontakt'), ('marketing', 'Werbe-Einwilligung'), ('ai_training', 'KI-Training'),
        ('ceiling', 'Raumhöhe'), ('wishes', 'Wünsche'), ('timeframe', 'Zeitrahmen'), ('zeitrahmen', 'Zeitrahmen'),
        ('kitchen_form', 'Küchenform'), ('kuechenform', 'Küchenform'), ('room_type', 'Raum'),
        ('housing_type', 'Wohnsituation'), ('extra_appliances', 'Zusatzgeräte'), ('budget_eur', 'Budget'),
        ('services', 'Leistungen'), ('leistungen', 'Leistungen'), ('offer_includes', 'Im Preis enthalten'),
        ('leistungsumfang', 'Im Preis enthalten'), ('offer_valid_until', 'Angebot gültig bis'),
        ('budget', 'Budget'), ('purchase_reason', 'Anlass'), ('anlass', 'Anlass'),
        ('housing', 'Wohnsituation'), ('wohnsituation', 'Wohnsituation'),
        ('ventilation', 'Dunstabzug'), ('abluft', 'Dunstabzug'), ('notes', 'Hinweis')
      ) as m(key, label)
      where m.key = regexp_replace(p_field, '^kontakt-', '')
    ), p_field)
  end
$$;

-- ----------------------------------------------------------------------------
-- Datenschutzerklärung Abschnitt 3: Ergänzungen und Uploads
-- ----------------------------------------------------------------------------

do $$
declare
  v_old text := 'Geprüfte Küchenstudios aus Ihrer Region sehen eine Beschreibung Ihres Projekts ohne Namen und Kontaktdaten.';
  v_new text := 'Geprüfte Küchenstudios aus Ihrer Region sehen eine Beschreibung Ihres Projekts ohne Namen und Kontaktdaten. '
    || 'Dazu gehören Angaben, die Sie auf Ihrer Projektseite ergänzen, und was wir bei Rückfragen mit Ihnen klären '
    || '(etwa Maße, Hersteller oder enthaltene Leistungen); Telefonnummern, E-Mail-Adressen und Links in Freitexten '
    || 'entfernen wir dabei automatisch. Grundrisse, Fotos und Angebote, die Sie hochladen, prüfen wir zuerst und geben '
    || 'sie nur frei, wenn darauf keine Namen oder Kontaktdaten zu sehen sind; vollständig erhalten sie nur die Studios, '
    || 'die Ihre Kontaktdaten erhalten.';
  v_content text;
begin
  select content into v_content from public.legal_pages where slug = 'datenschutz';
  if v_content is null then
    raise exception 'Datenschutzerklärung fehlt';
  end if;
  if strpos(v_content, 'Dazu gehören Angaben, die Sie auf Ihrer Projektseite ergänzen') > 0 then
    return;
  end if;
  if strpos(v_content, v_old) = 0 then
    raise exception 'Datenschutzerklärung wurde zwischenzeitlich geändert – Ersetzung abgebrochen';
  end if;
  update public.legal_pages
     set content = replace(v_content, v_old, v_new),
         updated_at = now(),
         published_at = now(),
         version = version + 1
   where slug = 'datenschutz';
end $$;
