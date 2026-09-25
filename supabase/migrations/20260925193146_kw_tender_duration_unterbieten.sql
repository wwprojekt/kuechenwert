-- "Angebot unterbieten lassen" (Funnel B) verspricht eine 72-h-Auktion
-- (Startseite, FAQ, Funnel-Texte). Bisher liefen alle Ausschreibungen mit
-- tender_duration_hours (168 h). Eigene, konfigurierbare Laufzeit für B.

alter table public.kw_marketplace_settings
  add column if not exists tender_duration_hours_unterbieten integer not null default 72
    check (tender_duration_hours_unterbieten between 24 and 336);

comment on column public.kw_marketplace_settings.tender_duration_hours_unterbieten is
  'Laufzeit (h) für Ausschreibungen aus Funnel B (vorhandenes Studio-Angebot unterbieten).';

create or replace function public.kw_open_tender(
  p_lead_id uuid,
  p_publish boolean,
  p_public_summary jsonb,
  p_estimate_min_eur numeric,
  p_estimate_max_eur numeric,
  p_reference_price_eur numeric,
  p_planner_session_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
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
$$;

-- Bereits angelegte, noch unveröffentlichte B-Ausschreibungen nachziehen.
update public.lead_auctions la
set duration_hours = s.tender_duration_hours_unterbieten
from public.leads l, public.kw_marketplace_settings s
where la.lead_id = l.id
  and s.id
  and l.funnel_type = 'b'
  and la.status = 'draft';
