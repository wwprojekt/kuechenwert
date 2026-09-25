-- Funnel B: budget_midpoint ist wie bei Funnel A und dem Konfigurator ein
-- Euro-Betrag. Das Funnel-B-Frontend (Direkt-Insert) schrieb bis 09/2026 den
-- Angebotspreis in Cent hinein; Admin-Liste, Admin-Dashboard und Admin-Mail
-- zeigten dadurch das Hundertfache. Für Funnel B ist das Budget der Preis des
-- vorliegenden Angebots, deshalb setzt der Trigger den Wert serverseitig aus
-- existing_offer_price_cents – unabhängig davon, was der Client schickt.

create or replace function public.kw_leads_before_insert_normalize()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.funnel_type = 'b' and new.existing_offer_price_cents is not null then
    new.budget_midpoint := round(new.existing_offer_price_cents / 100.0)::integer;
  end if;
  return new;
end;
$$;

revoke all on function public.kw_leads_before_insert_normalize() from public, anon, authenticated;

drop trigger if exists kw_leads_before_insert_normalize on public.leads;
create trigger kw_leads_before_insert_normalize
  before insert on public.leads
  for each row execute function public.kw_leads_before_insert_normalize();

update public.leads
set budget_midpoint = round(existing_offer_price_cents / 100.0)::integer
where funnel_type = 'b'
  and existing_offer_price_cents is not null
  and budget_midpoint is distinct from round(existing_offer_price_cents / 100.0)::integer;

update public.lead_auctions a
set public_summary = jsonb_set(a.public_summary, '{budget_eur}', to_jsonb(l.budget_midpoint)),
    spec_sheet = case when a.spec_sheet ? 'budget_eur'
                      then jsonb_set(a.spec_sheet, '{budget_eur}', to_jsonb(l.budget_midpoint))
                      else a.spec_sheet end
from public.leads l
where l.id = a.lead_id
  and l.funnel_type = 'b'
  and l.budget_midpoint is not null
  and a.public_summary ? 'budget_eur'
  and a.public_summary -> 'budget_eur' is distinct from to_jsonb(l.budget_midpoint);
