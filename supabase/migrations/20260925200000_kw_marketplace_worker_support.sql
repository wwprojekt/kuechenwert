-- ============================================================================
-- KuechenWert Marktplatz: Hilfsfunktionen fuer den Outbox-Worker
--   * kw_outbox_claim   – Batch mit FOR UPDATE SKIP LOCKED reservieren, damit
--                         ueberlappende Cron-Laeufe nichts doppelt senden
--   * kw_outbox_finish  – Ergebnis protokollieren (Retry mit Backoff)
--   * kw_tender_recipients – Studios im Einzugsgebiet einer Ausschreibung
-- ============================================================================

create or replace function public.kw_outbox_claim(p_limit integer default 25)
returns setof public.kw_outbox
language sql
security definer
set search_path = public, pg_catalog
as $$
  update public.kw_outbox o
  set attempts = o.attempts + 1,
      available_at = now() + make_interval(mins => least(60, power(2, o.attempts)::integer))
  where o.id in (
    select id from public.kw_outbox
    where processed_at is null and available_at <= now() and attempts < 8
    order by id
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  )
  returning o.*;
$$;
revoke execute on function public.kw_outbox_claim(integer) from public, anon, authenticated;
grant execute on function public.kw_outbox_claim(integer) to service_role;

create or replace function public.kw_outbox_finish(p_id bigint, p_error text default null)
returns void
language sql
security definer
set search_path = public, pg_catalog
as $$
  update public.kw_outbox
  set processed_at = case when p_error is null then now() else processed_at end,
      last_error = left(p_error, 2000)
  where id = p_id;
$$;
revoke execute on function public.kw_outbox_finish(bigint, text) from public, anon, authenticated;
grant execute on function public.kw_outbox_finish(bigint, text) to service_role;

create or replace function public.kw_tender_recipients(p_auction_id uuid)
returns table (
  dealer_id uuid,
  email text,
  company_name text,
  distance_km numeric,
  notify_email boolean
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with t as (
    select a.id, l.postal_code, coalesce(a.reference_price_eur, (a.estimate_min_eur + a.estimate_max_eur) / 2) as value_eur
    from public.lead_auctions a
    join public.leads l on l.id = a.lead_id
    where a.id = p_auction_id
  ),
  d as (
    select
      p.id,
      p.email,
      coalesce(nullif(p.company_name, ''), trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''))) as company,
      o.postal_code as origin,
      o.radius_km,
      coalesce(mp.notify_new_projects, true) as notify,
      mp.min_project_value_eur
    from public.user_roles r
    join public.profiles p on p.id = r.user_id
    left join public.kw_dealer_market_profiles mp on mp.dealer_id = p.id
    cross join lateral public.kw_dealer_origin(p.id) o
    where r.role = 'dealer'::app_role
      and coalesce(p.is_suspended, false) = false
      and coalesce(p.account_restricted, false) = false
  )
  select d.id, d.email, d.company,
         case when d.origin is null then null else public.kw_plz_distance_km(d.origin, t.postal_code) end,
         d.notify and coalesce(t.value_eur, 0) >= coalesce(d.min_project_value_eur, 0)
  from d, t
  where d.origin is null
     or public.kw_plz_distance_km(d.origin, t.postal_code) is null
     or public.kw_plz_distance_km(d.origin, t.postal_code) <= d.radius_km;
$$;
revoke execute on function public.kw_tender_recipients(uuid) from public, anon, authenticated;
grant execute on function public.kw_tender_recipients(uuid) to service_role;
