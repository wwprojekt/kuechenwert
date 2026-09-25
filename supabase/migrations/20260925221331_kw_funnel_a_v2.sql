-- Funnel A v2 („Küchenangebote einholen“ über die Edge Function kw-lead)
--
-- kw-lead schätzt den Küchenpreis serverseitig und speichert die Spanne in
-- leads.funnel_answers->'estimate' ({min, max, mid} in Euro).
-- * kw_lead_estimate_eur: liest die Schätzung aus (nur wenn min und max Zahlen sind).
-- * kw_leads_after_insert_tender / kw_admin_open_tender: übernehmen die
--   Schätzung als Spanne der Ausschreibung. Referenzpreis bleibt Angebot bzw.
--   genanntes Budget; nur wer „Weiß nicht“ wählt (budget_midpoint null),
--   bekommt die Schätzungsmitte. Leads ohne Schätzung (altes Frontend mit
--   Direkt-Insert, Funnel B) laufen unverändert.
-- * kw_lead_public_summary: gibt die Schätzung an Projektseite, Studio-Portal
--   und E-Mails weiter.
-- * kw_project_view: meldet has_phone, damit die Projektseite das Nachtragen
--   einer Telefonnummer (kw-project, Aktion add-phone) anbieten kann.

create or replace function public.kw_lead_estimate_eur(p_lead public.leads, p_key text)
returns numeric
language sql
immutable
set search_path = public, pg_catalog
as $$
  select case
    when jsonb_typeof(p_lead.funnel_answers -> 'estimate' -> 'min') = 'number'
     and jsonb_typeof(p_lead.funnel_answers -> 'estimate' -> 'max') = 'number'
     and jsonb_typeof(p_lead.funnel_answers -> 'estimate' -> p_key) = 'number'
    then (p_lead.funnel_answers -> 'estimate' ->> p_key)::numeric
  end;
$$;

revoke all on function public.kw_lead_estimate_eur(public.leads, text) from public, anon, authenticated;
grant execute on function public.kw_lead_estimate_eur(public.leads, text) to service_role;

create or replace function public.kw_lead_public_summary(p_lead public.leads)
returns jsonb
language sql
stable
set search_path = public, pg_catalog
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'source', p_lead.funnel_type::text,
    'kitchen_form', p_lead.kitchen_form,
    'kitchen_style', p_lead.kitchen_style,
    'budget_eur', p_lead.budget_midpoint,
    'existing_offer_eur', case when p_lead.has_existing_offer then round(p_lead.existing_offer_price_cents / 100.0) end,
    'existing_offer_studio_known', p_lead.existing_offer_studio is not null,
    'timeframe_months', p_lead.timeframe_months,
    'housing_type', p_lead.housing_type,
    'purchase_reason', p_lead.purchase_reason,
    'special_wishes', to_jsonb(p_lead.special_wishes),
    'delivery_mode', p_lead.delivery_mode,
    'estimate', case when public.kw_lead_estimate_eur(p_lead, 'min') is not null
                     then p_lead.funnel_answers -> 'estimate' end,
    'answers', coalesce(p_lead.funnel_answers, '{}'::jsonb) - 'salutation'
  ));
$$;

revoke all on function public.kw_lead_public_summary(public.leads) from public, anon, authenticated;
grant execute on function public.kw_lead_public_summary(public.leads) to service_role;

create or replace function public.kw_leads_after_insert_tender()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: der anonyme Inserter hat keine Rechte auf lead_auctions/Outbox.
  v_settings public.kw_marketplace_settings%rowtype;
  v_publish boolean;
begin
  if new.funnel_type not in ('a', 'b') then
    return new;
  end if;
  select * into v_settings from public.kw_marketplace_settings where id;
  v_publish := new.funnel_type = 'a' and v_settings.auto_publish_funnel_a;

  begin
    perform public.kw_open_tender(
      new.id, v_publish, public.kw_lead_public_summary(new),
      public.kw_lead_estimate_eur(new, 'min'), public.kw_lead_estimate_eur(new, 'max'),
      coalesce(new.existing_offer_price_cents / 100.0, new.budget_midpoint::numeric,
               public.kw_lead_estimate_eur(new, 'mid')),
      null
    );
    perform public.kw_enqueue('project_created', jsonb_build_object('lead_id', new.id, 'funnel', new.funnel_type::text));
  exception when others then
    -- Die Anfrage des Kunden darf nie an der Marktplatz-Logik scheitern.
    raise warning 'kw_leads_after_insert_tender(%): %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

create or replace function public.kw_admin_open_tender(p_lead_id uuid, p_notify_customer boolean default false)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: Admin-Aktion aus dem Frontend, prüft die Rolle selbst.
  v_lead public.leads%rowtype;
  v_auction_id uuid;
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into v_lead from public.leads where id = p_lead_id;
  if v_lead.id is null then
    raise exception 'Lead nicht gefunden.' using errcode = 'P0002';
  end if;

  v_auction_id := public.kw_open_tender(
    p_lead_id, false, public.kw_lead_public_summary(v_lead),
    public.kw_lead_estimate_eur(v_lead, 'min'), public.kw_lead_estimate_eur(v_lead, 'max'),
    coalesce(v_lead.existing_offer_price_cents / 100.0, v_lead.budget_midpoint::numeric,
             public.kw_lead_estimate_eur(v_lead, 'mid')),
    null
  );
  if p_notify_customer then
    perform public.kw_enqueue('project_created', jsonb_build_object('lead_id', p_lead_id, 'funnel', v_lead.funnel_type::text));
  end if;
  return v_auction_id;
end;
$$;

revoke all on function public.kw_admin_open_tender(uuid, boolean) from public, anon;
grant execute on function public.kw_admin_open_tender(uuid, boolean) to authenticated, service_role;

create or replace function public.kw_project_view(p_lead_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
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
      'has_phone', (v_l.phone is not null and length(trim(v_l.phone)) > 0)
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
    ) end
  );
end;
$$;
