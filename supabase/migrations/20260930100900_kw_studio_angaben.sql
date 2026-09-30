-- Studio-Angaben vollständig und unverfälscht weitergeben
--
-- * planner_sessions.provenance (Funnel C): welche Planer-Schritte der Kunde
--   beantwortet und welche Wandlängen er selbst eingegeben hat
--   ({"steps": [...], "walls": [...]}). kw-planner schreibt sie bei save und
--   generate; die Ausschreibung kennzeichnet damit Standardwerte und
--   Beispielmaße (_shared/planner-provenance.ts). null = unbekannt (ältere
--   Planungen), dann bleibt alles ungekennzeichnet.
-- * kw_lead_public_summary: gibt die Konditionen des vorhandenen Angebots aus
--   Funnel B an die Studios weiter (Zahlungsart, Effektivzins, Laufzeit,
--   Anzahlung, Mülltrennsystem). Bisher lagen sie nur in leads-Spalten und
--   erreichten weder Studio-Portal noch Mails.

alter table public.planner_sessions add column if not exists provenance jsonb;

comment on column public.planner_sessions.provenance is
  'Funnel C: vom Kunden beantwortete Planer-Schritte und eingegebene Wandlängen ({steps, walls}); null = unbekannt.';

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
    'payment_financing', p_lead.payment_financing,
    'payment_financing_apr', p_lead.payment_financing_apr,
    'payment_financing_months', p_lead.payment_financing_months,
    'payment_down_payment_percent', p_lead.payment_down_payment_percent,
    'waste_separation_system', p_lead.waste_separation_system,
    'estimate', case when public.kw_lead_estimate_eur(p_lead, 'min') is not null
                     then p_lead.funnel_answers -> 'estimate' end,
    'answers', coalesce(p_lead.funnel_answers, '{}'::jsonb) - 'salutation'
  ));
$$;

revoke all on function public.kw_lead_public_summary(public.leads) from public, anon, authenticated;
grant execute on function public.kw_lead_public_summary(public.leads) to service_role;
