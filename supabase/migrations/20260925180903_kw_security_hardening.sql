-- ============================================================================
-- KuechenWert Security-Hardening (Audit 2026-09-25)
--
-- Befunde aus Supabase-Advisors + manuellem Review:
--   1. Haendler konnten per RLS-Policy ALLE Leads inkl. Name/E-Mail/Telefon
--      lesen, ohne sie gekauft zu haben ("masked via view" war wirkungslos).
--   2. leads_masked + auctions_public liefen als SECURITY-DEFINER-Views mit
--      INSERT/UPDATE/DELETE-Grants fuer anon -> jeder Besucher konnte Leads und
--      Auktionen ueber die REST-API aendern oder loeschen. auctions_public
--      exponierte zusaetzlich den geheimen reserve_price. Beide Views werden
--      nirgends genutzt und fallen weg.
--   3. lead_bids erlaubte Haendlern direkte INSERTs (beliebige Preise,
--      is_winning=true). Gebote laufen ab jetzt nur ueber geprueften RPC.
--   4. get_vapid_keys() gab den privaten VAPID-Key an anon heraus.
--   5. ensure_profile_exists() erlaubte jedem, E-Mail/Name/Telefon beliebiger
--      Profile zu ueberschreiben (und war durch ON CONFLICT (user_id, role)
--      ohne passenden Unique-Index ohnehin defekt).
--   6. ~40 SECURITY-DEFINER-Server-/Cron-/Trigger-Funktionen waren fuer anon
--      aufrufbar (u. a. place_bid_atomic mit frei waehlbarer bidder_id,
--      try_acquire_cron_lock, planner_rate_limit_increment).
--   7. Rechnungsnummern trugen das CaravanWert-Praefix "CA".
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Leads: kein Pauschal-Lesezugriff mehr fuer Haendler
-- ----------------------------------------------------------------------------
drop policy if exists "Leads: dealers read verified-active (masked via view)" on public.leads;


-- ----------------------------------------------------------------------------
-- 2) Unsichere Definer-Views entfernen, Views generell read-only
-- ----------------------------------------------------------------------------
drop view if exists public.leads_masked;
drop view if exists public.auctions_public;

revoke insert, update, delete, truncate, references, trigger
  on public.analytics_daily_summary, public.bids_public, public.error_logs_grouped,
     public.error_logs_stats, public.public_site_settings
  from anon, authenticated;


-- ----------------------------------------------------------------------------
-- 3) Lead-Auktionen/Gebote: nur noch ueber RPCs (siehe Marktplatz-Migration)
-- ----------------------------------------------------------------------------
drop policy if exists "LeadBids: dealer insert own" on public.lead_bids;
drop policy if exists "LeadAuctions: dealer read active" on public.lead_auctions;
drop policy if exists "LeadSpecItems: dealer read active" on public.lead_auction_spec_items;


-- ----------------------------------------------------------------------------
-- 4) Uploads in lead-files nur fuer frisch angelegte Leads (Funnel B)
-- ----------------------------------------------------------------------------
create or replace function public.kw_lead_accepts_uploads(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER noetig: anon darf leads nicht lesen, muss aber pruefen koennen,
  -- ob der Upload zu einem gerade erst eingereichten Lead gehoert.
  select exists (
    select 1 from public.leads l
    where l.id = p_lead_id
      and l.created_at > now() - interval '2 hours'
  );
$$;

revoke execute on function public.kw_lead_accepts_uploads(uuid) from public;
grant execute on function public.kw_lead_accepts_uploads(uuid) to anon, authenticated, service_role;

drop policy if exists "LeadFiles: anon/auth insert" on public.lead_files;
create policy "LeadFiles: anon/auth insert"
  on public.lead_files
  for insert
  to anon, authenticated
  with check (public.kw_lead_accepts_uploads(lead_id));

drop policy if exists "LeadFiles Storage: anon upload" on storage.objects;
drop policy if exists "LeadFiles Storage: authenticated upload" on storage.objects;
create policy "LeadFiles Storage: funnel upload"
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'lead-files'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.kw_lead_accepts_uploads(((storage.foldername(name))[1])::uuid)
  );


-- ----------------------------------------------------------------------------
-- 5) ensure_profile_exists: nur eigener Account, nur fehlende Felder ergaenzen
-- ----------------------------------------------------------------------------
create or replace function public.ensure_profile_exists(
  p_user_id uuid,
  p_email text,
  p_first_name text default null,
  p_last_name text default null,
  p_phone text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- DEFINER noetig: legt Profil + Rolle an, bevor die RLS-Policies des neuen
  -- Users greifen. Aufruf nur fuer den eigenen Account oder service_role.
  if coalesce(auth.role(), '') <> 'service_role'
     and (auth.uid() is null or auth.uid() <> p_user_id) then
    raise exception 'ensure_profile_exists: not allowed' using errcode = '42501';
  end if;

  insert into public.profiles (id, email, first_name, last_name, phone)
  values (p_user_id, p_email, p_first_name, p_last_name, p_phone)
  on conflict (id) do update
    set email      = coalesce(profiles.email, excluded.email),
        first_name = coalesce(profiles.first_name, excluded.first_name),
        last_name  = coalesce(profiles.last_name, excluded.last_name),
        phone      = coalesce(profiles.phone, excluded.phone),
        updated_at = now();

  insert into public.user_roles (user_id, role)
  values (p_user_id, 'seller')
  on conflict (user_id) do nothing;
end;
$$;


-- ----------------------------------------------------------------------------
-- 6) record_agb_acceptance: eigener Account oder frisch registrierter User
-- ----------------------------------------------------------------------------
create or replace function public.record_agb_acceptance(
  p_user_id uuid,
  p_context text default 'registration',
  p_ip_address text default null,
  p_user_agent text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_version text;
begin
  -- DEFINER noetig: wird direkt nach signUp aufgerufen, wenn wegen
  -- E-Mail-Bestaetigung noch keine Session existiert. Deshalb nur fuer den
  -- eigenen Account oder Accounts, die juenger als 30 Minuten sind.
  if p_user_id is null then
    return;
  end if;
  if not exists (
    select 1 from auth.users u
    where u.id = p_user_id
      and (u.id = auth.uid()
           or coalesce(auth.role(), '') = 'service_role'
           or u.created_at > now() - interval '30 minutes')
  ) then
    return;
  end if;
  select public.get_current_agb_version() into v_version;
  insert into public.agb_acceptances (user_id, agb_version, context, ip_address, user_agent)
  values (p_user_id, v_version, p_context, p_ip_address, p_user_agent);
end;
$$;


-- ----------------------------------------------------------------------------
-- 7) Server-, Cron- und Trigger-Funktionen nicht mehr ueber die REST-API
--    (anon/authenticated) aufrufbar. service_role behaelt EXECUTE.
-- ----------------------------------------------------------------------------
do $$
declare
  fn record;
  -- Nur Edge Functions / pg_cron / andere DEFINER-Funktionen rufen diese auf.
  server_only text[] := array[
    'admin_delete_bid', 'admin_search_listings',
    'bing_oauth_release_lock', 'bing_oauth_try_acquire_lock',
    'clean_old_analytics_data', 'cleanup_expired_rate_limits',
    'cleanup_expired_sessions', 'cleanup_old_error_logs', 'cleanup_old_notifications',
    'create_instant_buy_invoice', 'enqueue_google_review_for_email',
    'generate_contract_number', 'generate_customer_number',
    'get_dealer_tax_info', 'get_primary_role', 'get_vapid_keys',
    'handle_autobid_atomic', 'place_bid_atomic', 'hash_review_ip',
    'lift_dealer_restriction', 'restrict_dealer_account',
    'log_audit_event', 'planner_rate_limit_increment', 'planner_rate_limits_cleanup',
    'process_approved_claim', 'process_search_alerts_for_kitchen',
    'release_cron_lock', 'try_acquire_cron_lock',
    'update_dealer_level', 'update_kitchen_damage_status',
    'verify_wizard_session_ownership', 'webhook_add_email_suppression'
  ];
  -- Werden aus dem eingeloggten Frontend aufgerufen und pruefen intern Rolle
  -- bzw. Ownership, brauchen aber keinen anonymen Zugriff.
  authenticated_only text[] := array[
    'admin_add_email_suppression', 'admin_get_cron_jobs_health',
    'admin_get_cron_run_history', 'admin_get_cron_schedule_drift',
    'admin_get_http_response_health', 'admin_get_recent_http_failures',
    'approve_dealer_application', 'calculate_commission', 'create_auction_invoice',
    'ensure_profile_exists', 'generate_release_pin', 'get_auction_owner_meta',
    'get_auctions_owner_meta_bulk', 'link_wizard_sessions_to_confirmed_user',
    'reapply_dealer_application', 'seller_archive_listing', 'seller_restart_listing',
    'seller_unarchive_listing', 'toggle_auto_relist', 'toggle_dynamic_pricing',
    'update_listing_prices_in_draft'
  ];
begin
  for fn in
    select p.oid::regprocedure as sig, p.proname, p.prorettype = 'trigger'::regtype as is_trigger
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    if fn.is_trigger or fn.proname = any(server_only) then
      execute format('revoke execute on function %s from public, anon, authenticated', fn.sig);
      execute format('grant execute on function %s to service_role', fn.sig);
    elsif fn.proname = any(authenticated_only) then
      execute format('revoke execute on function %s from public, anon', fn.sig);
      execute format('grant execute on function %s to authenticated, service_role', fn.sig);
    end if;
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- 8) Fehlender search_path (Advisor function_search_path_mutable)
-- ----------------------------------------------------------------------------
alter function public.kw_set_updated_at() set search_path = public, pg_catalog;
alter function public.update_purchase_contracts_updated_at() set search_path = public, pg_catalog;
alter function public.wizard_sessions_set_completed_at() set search_path = public, pg_catalog;


-- ----------------------------------------------------------------------------
-- 9) Rechnungsnummern mit KuechenWert-Praefix
-- ----------------------------------------------------------------------------
create or replace function public.generate_invoice_number()
returns text
language plpgsql
set search_path = ''
as $$
declare
  year_part text := to_char(current_date, 'YYYY');
  seq_part text := lpad(nextval('public.invoice_number_seq')::text, 6, '0');
begin
  return 'KW' || year_part || '-' || seq_part;
end;
$$;
