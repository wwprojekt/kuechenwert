-- Funnel C: Jede Visualisierung ist ein Lead. Wer bei „Möchten Sie auch
-- Angebote?“ Nein wählt, bekommt einen Lead ohne Ausschreibung
-- (lead_consents.share_with_studios = false). Studios dürfen eine solche
-- Planung nie sehen: kw_open_tender verweigert die Ausschreibung, solange die
-- jüngste Einwilligung zur Weitergabe ausdrücklich fehlt. Das gilt für alle
-- Wege (kw-planner, kw-project, Admin „Ausschreibung anlegen“).
-- Leads ohne Einwilligungszeile (Lead-Trigger von Funnel A/B, der vor dem
-- Einfügen der Einwilligungen läuft) bleiben unverändert möglich.

create or replace function public.kw_lead_share_consent(p_lead_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
  select c.granted
  from public.lead_consents c
  where c.lead_id = p_lead_id and c.purpose = 'share_with_studios'
  order by c.created_at desc, c.id desc
  limit 1
$$;

comment on function public.kw_lead_share_consent(uuid) is
  'Jüngste Einwilligung share_with_studios eines Leads (null = keine Zeile).';

revoke execute on function public.kw_lead_share_consent(uuid) from public, anon, authenticated;
grant execute on function public.kw_lead_share_consent(uuid) to service_role;

create or replace function public.kw_open_tender(
  p_lead_id uuid,
  p_publish boolean,
  p_public_summary jsonb,
  p_estimate_min_eur numeric,
  p_estimate_max_eur numeric,
  p_reference_price_eur numeric,
  p_planner_session_id uuid default null::uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  -- DEFINER: wird vom Lead-Trigger (anonyme Funnel-Inserts) und von
  -- service_role-Edge-Functions aufgerufen.
  v_settings public.kw_marketplace_settings%rowtype;
  v_lead public.leads%rowtype;
  v_auction_id uuid;
  v_price_basis numeric;
  v_contact_price integer;
  v_duration integer;
begin
  select * into v_settings from public.kw_marketplace_settings where id;
  select * into v_lead from public.leads where id = p_lead_id;
  if v_lead.id is null then
    raise exception 'kw_open_tender: lead % not found', p_lead_id;
  end if;

  select id into v_auction_id from public.lead_auctions
  where lead_id = p_lead_id and status in ('draft', 'active', 'completed')
  limit 1;
  if v_auction_id is not null then
    return v_auction_id;
  end if;

  if public.kw_lead_share_consent(p_lead_id) is false then
    raise exception 'Der Kunde hat der Weitergabe an Küchenstudios nicht zugestimmt. Er kann Angebote selbst auf seiner Projektseite anfordern.'
      using errcode = 'P0001';
  end if;

  v_duration := case
    when v_lead.funnel_type = 'b' then v_settings.tender_duration_hours_unterbieten
    else v_settings.tender_duration_hours
  end;

  v_price_basis := coalesce(
    (p_estimate_min_eur + p_estimate_max_eur) / 2,
    p_reference_price_eur,
    v_lead.budget_midpoint,
    v_lead.existing_offer_price_cents / 100.0
  );
  v_contact_price := coalesce(
    public.calculate_lead_price_cents(round(coalesce(v_price_basis, 0) * 100)::integer, v_lead.tier),
    v_settings.contact_price_fallback_cents
  );

  insert into public.lead_auctions (
    lead_id, status, spec_sheet, offer_price_eur, duration_hours,
    starts_at, ends_at, is_published, published_at,
    planner_session_id, estimate_min_eur, estimate_max_eur, reference_price_eur,
    public_summary, bid_visibility, max_contact_purchases, contact_price_cents,
    decision_deadline_at
  ) values (
    p_lead_id,
    case when p_publish then 'active' else 'draft' end,
    coalesce(p_public_summary, '{}'::jsonb),
    case when v_lead.has_existing_offer then v_lead.existing_offer_price_cents / 100.0 end,
    v_duration,
    case when p_publish then now() end,
    case when p_publish then now() + make_interval(hours => v_duration) end,
    p_publish,
    case when p_publish then now() end,
    p_planner_session_id, p_estimate_min_eur, p_estimate_max_eur,
    coalesce(p_reference_price_eur, v_price_basis),
    coalesce(p_public_summary, '{}'::jsonb),
    v_settings.bid_visibility, v_settings.max_contact_purchases, v_contact_price,
    case when p_publish
      then now() + make_interval(hours => v_duration)
                 + make_interval(days => v_settings.decision_window_days) end
  )
  returning id into v_auction_id;

  if p_publish then
    update public.leads set status = 'in_auction' where id = p_lead_id and status = 'new';
    perform public.kw_enqueue('tender_published', jsonb_build_object('auction_id', v_auction_id));
  end if;

  return v_auction_id;
end;
$function$;
