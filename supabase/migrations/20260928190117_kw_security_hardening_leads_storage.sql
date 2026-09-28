-- ============================================================================
-- KüchenWert Sicherheits-Härtung (Audit 28.09.2026)
--
-- 1. Studios konnten per RLS alle Leads inklusive Kontaktdaten lesen
--    ("Leads: dealers read masked", nur live angelegt, in keiner Migration)
--    und nach einem Kauf alle Spalten inklusive IP, User-Agent, Klick-IDs und
--    Konkurrenzstudio. Studios erhalten Projektdaten ausschließlich über
--    kw_dealer_project / kw_dealer_projects.
-- 2. Caravan-Buckets purchase-contracts / handover-protocols: Die Policy
--    "Service role full access" galt für jede Rolle (nur bucket_id geprüft).
-- 3. kitchen-photos: Jeder angemeldete Nutzer konnte fremde Dateien ändern
--    und löschen.
-- 4. Caravan-Wizard-, Auktions- und Google-Review-RPCs waren für anon
--    aufrufbar, obwohl KüchenWert sie nicht nutzt.
-- 5. audit_logs: Jeder angemeldete Nutzer konnte Einträge schreiben.
-- 6. blog_posts: Jeder angemeldete Nutzer konnte Entwürfe lesen.
-- 7. Caravan-Tabellen auctions, bids, kitchens: anon las u. a. reserve_price
--    und max_autobid_amount.
-- 8. Studio-Preislisten (lead_commission_tiers, lead_pricing_rules) sind für
--    die Preisseite öffentlich lesbar, aber nur aktive Zeilen.
-- ============================================================================

-- 1) Leads: kein Direktzugriff für Studios
drop policy if exists "Leads: dealers read masked" on public.leads;
drop policy if exists "Leads: dealers read purchased full" on public.leads;
drop policy if exists "Leads: dealers read verified-active (masked via view)" on public.leads;

-- 2) Caravan-Buckets nur noch für Admins und die eigene Datei
drop policy if exists "Service role full access to purchase-contracts" on storage.objects;
drop policy if exists "Service role full access to handover-protocols" on storage.objects;
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['application/pdf']
 where id in ('purchase-contracts', 'handover-protocols');

-- 3) kitchen-photos: Ändern und Löschen nur durch Eigentümer oder Admin
drop policy if exists "Users can update own kitchen photos" on storage.objects;
drop policy if exists "Users can delete own kitchen photos" on storage.objects;
create policy "Users can update own kitchen photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'kitchen-photos'
    and (owner_id = (select auth.uid()::text) or public.has_role((select auth.uid()), 'admin'::app_role))
  );
create policy "Users can delete own kitchen photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'kitchen-photos'
    and (owner_id = (select auth.uid()::text) or public.has_role((select auth.uid()), 'admin'::app_role))
  );

-- 4) Legacy-RPCs nicht mehr über die REST-API
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'create_wizard_session', 'find_wizard_session_by_anonymous_id',
        'find_wizard_session_by_resume_token', 'reactivate_wizard_session_by_resume_token',
        'update_wizard_session_by_anonymous_id', 'get_auction_marketing_anchors',
        'process_google_review_unsubscribe', 'track_google_review_click',
        'get_public_platform_stats'
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn.sig);
    execute format('grant execute on function %s to service_role', fn.sig);
  end loop;

  -- trigger_update_rating_summary (SECURITY INVOKER) ruft die Funktion für
  -- angemeldete Nutzer auf; anon braucht sie nicht.
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'update_dealer_rating_summary'
  loop
    execute format('revoke execute on function %s from public, anon', fn.sig);
    execute format('grant execute on function %s to authenticated, service_role', fn.sig);
  end loop;
end $$;

-- 5) Audit-Log: nur Admins schreiben, und nur unter eigener user_id
drop policy if exists "Authenticated users can insert audit logs" on public.audit_logs;
drop policy if exists "Admins can insert own audit logs" on public.audit_logs;
create policy "Admins can insert own audit logs"
  on public.audit_logs for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.has_role((select auth.uid()), 'admin'::app_role)
  );

-- 6) Blog: Entwürfe nur für Admins
drop policy if exists "Anyone can view published blog posts" on public.blog_posts;
create policy "Anyone can view published blog posts"
  on public.blog_posts for select
  using (published = true or public.has_role((select auth.uid()), 'admin'::app_role));

-- 7) Caravan-Tabellen: kein anonymer Zugriff mehr
revoke select on public.auctions, public.bids, public.kitchens from anon;

-- 8) Studio-Preislisten öffentlich (nur aktive Zeilen)
drop policy if exists "LeadCommission: public read active" on public.lead_commission_tiers;
create policy "LeadCommission: public read active"
  on public.lead_commission_tiers for select to anon, authenticated
  using (is_active);

drop policy if exists "LeadPricing: public read active" on public.lead_pricing_rules;
create policy "LeadPricing: public read active"
  on public.lead_pricing_rules for select to anon, authenticated
  using (is_active);
