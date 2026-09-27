-- Ergebnis der Cloudflare-Turnstile-Prüfung beim Absenden eines Funnels.
-- Ohne gültiges Token wird der Lead angenommen, aber nicht automatisch an
-- Studios veröffentlicht: Das Admin-Team prüft ihn zuerst. So verliert kein
-- Kunde seine Anfrage, dessen Browser Turnstile blockiert.

alter table public.leads
  add column if not exists bot_check text
    check (bot_check in ('passed', 'unverified', 'skipped'));

comment on column public.leads.bot_check is
  'Turnstile beim Absenden: passed = bestanden, unverified = Token fehlte oder war ungültig (keine automatische Veröffentlichung), skipped = Prüfung nicht möglich.';

create or replace function public.kw_leads_after_insert_tender()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_catalog'
as $function$
declare
  -- DEFINER: Ausschreibung und Outbox unabhängig von den Rechten des Einfügenden.
  v_settings public.kw_marketplace_settings%rowtype;
  v_publish boolean;
begin
  if new.funnel_type not in ('a', 'b') then
    return new;
  end if;
  select * into v_settings from public.kw_marketplace_settings where id;
  v_publish := new.funnel_type = 'a' and v_settings.auto_publish_funnel_a
    and new.bot_check is distinct from 'unverified';

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
$function$;
