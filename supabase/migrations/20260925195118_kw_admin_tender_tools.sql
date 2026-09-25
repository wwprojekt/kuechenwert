-- Admin-Werkzeuge für Ausschreibungen:
-- * kw_lead_public_summary: anonymisierte Projekt-Zusammenfassung eines
--   Leads (eine Quelle für Trigger und Admin-RPC).
-- * kw_admin_open_tender: Ausschreibung als Entwurf für Leads ohne Tender
--   anlegen (Alt-Leads, fehlgeschlagener Trigger), optional mit Kunden-Mail.

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
      new.id, v_publish, public.kw_lead_public_summary(new), null, null,
      coalesce(new.existing_offer_price_cents / 100.0, new.budget_midpoint::numeric), null
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
    p_lead_id, false, public.kw_lead_public_summary(v_lead), null, null,
    coalesce(v_lead.existing_offer_price_cents / 100.0, v_lead.budget_midpoint::numeric), null
  );
  if p_notify_customer then
    perform public.kw_enqueue('project_created', jsonb_build_object('lead_id', p_lead_id, 'funnel', v_lead.funnel_type::text));
  end if;
  return v_auction_id;
end;
$$;

revoke all on function public.kw_admin_open_tender(uuid, boolean) from public, anon;
grant execute on function public.kw_admin_open_tender(uuid, boolean) to authenticated, service_role;
