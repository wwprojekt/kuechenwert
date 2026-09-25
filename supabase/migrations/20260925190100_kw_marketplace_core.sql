-- ============================================================================
-- KuechenWert Marktplatz-Kern: Projekt-Ausschreibungen, Studio-Angebote,
-- Kontaktkauf, Kunden-Projektlink, Rechnungsentwuerfe, Outbox, Cron-Tick.
--
-- Datenfluss
--   Funnel A/B/C erzeugt einen Lead (Projekt). Pro Lead gibt es hoechstens
--   eine offene Ausschreibung (lead_auctions). Verifizierte Studios im
--   Einzugsgebiet sehen das Projekt anonymisiert (public_summary) und koennen
--     a) ein Angebot abgeben (lead_bids, nur absenkbar) oder
--     b) die Kontaktdaten kaufen (lead_match_candidates, max. N Studios).
--   Der Kunde vergleicht die Angebote ueber seinen Projektlink und waehlt ein
--   Studio. Das Studio erhaelt dann die Kontaktdaten, fuer die Provision wird
--   ein Rechnungsentwurf angelegt.
--
-- Zugriffsmodell
--   * Haendler: nur ueber kw_dealer_* RPCs (SECURITY DEFINER mit Rollen-,
--     Sperr- und Status-Pruefung). Keine direkten Tabellenrechte.
--   * Kunden: Capability-Link (Token), wird in der Edge Function kw-project
--     gehasht und ueber service_role-RPCs aufgeloest.
--   * E-Mails/In-App-Hinweise: Outbox-Tabelle, verarbeitet von der Edge
--     Function kw-market-worker (Cron jede Minute, nur wenn Events offen).
--
-- Voraussetzung ausserhalb dieser Datei: Vault-Secret `kw_cron_secret`
-- (identisch mit Edge-Function-Secret KW_CRON_SECRET).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- A) Einstellungen (Singleton)
-- ----------------------------------------------------------------------------
create table if not exists public.kw_marketplace_settings (
  id boolean primary key default true check (id),
  tender_duration_hours integer not null default 168 check (tender_duration_hours between 24 and 720),
  decision_window_days integer not null default 21 check (decision_window_days between 3 and 90),
  max_contact_purchases integer not null default 3 check (max_contact_purchases between 0 and 10),
  bid_visibility text not null default 'lowest_price' check (bid_visibility in ('lowest_price', 'sealed')),
  default_service_radius_km integer not null default 80 check (default_service_radius_km between 10 and 500),
  min_offer_ratio numeric(4,2) not null default 0.40 check (min_offer_ratio between 0.05 and 1),
  auto_publish_funnel_a boolean not null default true,
  auto_publish_funnel_c boolean not null default true,
  contact_price_fallback_cents integer not null default 4900 check (contact_price_fallback_cents >= 0),
  updated_at timestamptz not null default now()
);

insert into public.kw_marketplace_settings (id) values (true) on conflict (id) do nothing;

alter table public.kw_marketplace_settings enable row level security;
drop policy if exists "MarketSettings: public read" on public.kw_marketplace_settings;
create policy "MarketSettings: public read" on public.kw_marketplace_settings for select using (true);
drop policy if exists "MarketSettings: admin manage" on public.kw_marketplace_settings;
create policy "MarketSettings: admin manage" on public.kw_marketplace_settings for all
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));
grant select on public.kw_marketplace_settings to anon, authenticated;
grant update on public.kw_marketplace_settings to authenticated;
grant all on public.kw_marketplace_settings to service_role;


-- PLZ-Zentroide: bekannte Fehler der Quelltabelle korrigieren. 200xx liegt in
-- Hamburg-Mitte; Eintraege mit dem Deutschland-Mittelpunkt sind Platzhalter
-- und wuerden Distanzen verfaelschen (ohne Eintrag gilt "im Einzugsgebiet").
update public.kw_plz3_centroids set lat = 53.5511, lng = 9.9937 where plz3 = '200';
delete from public.kw_plz3_centroids where lat = 51.1657 and lng = 10.4515;


-- ----------------------------------------------------------------------------
-- B) Studio-Einstellungen fuer den Marktplatz
-- ----------------------------------------------------------------------------
create table if not exists public.kw_dealer_market_profiles (
  dealer_id uuid primary key references public.profiles(id) on delete cascade,
  service_postal_code text check (service_postal_code ~ '^[0-9]{5}$'),
  service_radius_km integer not null default 80 check (service_radius_km between 10 and 500),
  notify_new_projects boolean not null default true,
  min_project_value_eur integer check (min_project_value_eur >= 0),
  offer_intro text check (char_length(offer_intro) <= 1500),
  updated_at timestamptz not null default now()
);

alter table public.kw_dealer_market_profiles enable row level security;
drop policy if exists "DealerMarket: own read" on public.kw_dealer_market_profiles;
create policy "DealerMarket: own read" on public.kw_dealer_market_profiles for select to authenticated
  using (dealer_id = auth.uid() or public.has_role(auth.uid(), 'admin'::app_role));
drop policy if exists "DealerMarket: own insert" on public.kw_dealer_market_profiles;
create policy "DealerMarket: own insert" on public.kw_dealer_market_profiles for insert to authenticated
  with check (dealer_id = auth.uid() and public.has_role(auth.uid(), 'dealer'::app_role));
drop policy if exists "DealerMarket: own update" on public.kw_dealer_market_profiles;
create policy "DealerMarket: own update" on public.kw_dealer_market_profiles for update to authenticated
  using (dealer_id = auth.uid())
  with check (dealer_id = auth.uid());
grant select, insert, update on public.kw_dealer_market_profiles to authenticated;
grant all on public.kw_dealer_market_profiles to service_role;

drop trigger if exists set_kw_dealer_market_profiles_updated_at on public.kw_dealer_market_profiles;
create trigger set_kw_dealer_market_profiles_updated_at before update on public.kw_dealer_market_profiles
  for each row execute function public.kw_set_updated_at();


-- ----------------------------------------------------------------------------
-- C) Ausschreibungen (lead_auctions) erweitern
-- ----------------------------------------------------------------------------
alter table public.lead_auctions
  add column if not exists planner_session_id uuid references public.planner_sessions(id) on delete set null,
  add column if not exists estimate_min_eur numeric(10,2),
  add column if not exists estimate_max_eur numeric(10,2),
  add column if not exists reference_price_eur numeric(10,2),
  add column if not exists public_summary jsonb not null default '{}'::jsonb,
  add column if not exists bid_visibility text not null default 'lowest_price',
  add column if not exists max_contact_purchases integer not null default 3,
  add column if not exists contact_price_cents integer,
  add column if not exists decision_deadline_at timestamptz,
  add column if not exists decided_at timestamptz,
  add column if not exists cancelled_reason text;

alter table public.lead_auctions drop constraint if exists lead_auctions_status_check;
alter table public.lead_auctions add constraint lead_auctions_status_check
  check (status in ('draft', 'active', 'completed', 'awarded', 'expired', 'cancelled'));
alter table public.lead_auctions drop constraint if exists lead_auctions_bid_visibility_check;
alter table public.lead_auctions add constraint lead_auctions_bid_visibility_check
  check (bid_visibility in ('lowest_price', 'sealed'));
alter table public.lead_auctions drop constraint if exists lead_auctions_max_contacts_check;
alter table public.lead_auctions add constraint lead_auctions_max_contacts_check
  check (max_contact_purchases between 0 and 10);

create unique index if not exists uq_lead_auctions_open_per_lead
  on public.lead_auctions(lead_id) where status in ('draft', 'active', 'completed');
create index if not exists idx_lead_auctions_active_ends
  on public.lead_auctions(ends_at) where status = 'active';
create index if not exists idx_lead_auctions_planner_session
  on public.lead_auctions(planner_session_id);

grant all on public.lead_auctions, public.lead_bids, public.lead_auction_spec_items,
  public.lead_match_candidates, public.lead_views, public.lead_consents to service_role;
grant select, insert, update, delete on public.lead_auctions, public.lead_bids,
  public.lead_auction_spec_items to authenticated;


-- ----------------------------------------------------------------------------
-- D) Angebote (lead_bids) erweitern
-- ----------------------------------------------------------------------------
alter table public.lead_bids
  add column if not exists status text not null default 'active',
  add column if not exists includes jsonb not null default '{}'::jsonb,
  add column if not exists valid_until date,
  add column if not exists revision integer not null default 1,
  add column if not exists updated_at timestamptz not null default now();

alter table public.lead_bids drop constraint if exists lead_bids_status_check;
alter table public.lead_bids add constraint lead_bids_status_check
  check (status in ('active', 'withdrawn', 'accepted', 'declined'));
alter table public.lead_bids drop constraint if exists lead_bids_price_positive;
alter table public.lead_bids add constraint lead_bids_price_positive
  check (price_eur > 0 and price_eur < 2000000);
alter table public.lead_bids drop constraint if exists lead_bids_delivery_weeks_check;
alter table public.lead_bids add constraint lead_bids_delivery_weeks_check
  check (delivery_weeks is null or delivery_weeks between 1 and 78);

create unique index if not exists uq_lead_bids_dealer_per_auction on public.lead_bids(auction_id, dealer_id);

drop trigger if exists set_lead_bids_updated_at on public.lead_bids;
create trigger set_lead_bids_updated_at before update on public.lead_bids
  for each row execute function public.kw_set_updated_at();

create table if not exists public.lead_bid_revisions (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references public.lead_bids(id) on delete cascade,
  price_eur numeric(10,2) not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_lead_bid_revisions_bid on public.lead_bid_revisions(bid_id, created_at);
alter table public.lead_bid_revisions enable row level security;
drop policy if exists "BidRevisions: admin read" on public.lead_bid_revisions;
create policy "BidRevisions: admin read" on public.lead_bid_revisions for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));
grant select on public.lead_bid_revisions to authenticated;
grant all on public.lead_bid_revisions to service_role;


-- ----------------------------------------------------------------------------
-- E) Kontaktzugriff (lead_match_candidates) erweitern
-- ----------------------------------------------------------------------------
alter table public.lead_match_candidates
  add column if not exists access_source text not null default 'purchase',
  add column if not exists auction_id uuid references public.lead_auctions(id) on delete set null,
  add column if not exists invoice_id uuid references public.invoices(id) on delete set null;
alter table public.lead_match_candidates drop constraint if exists lead_match_candidates_access_source_check;
alter table public.lead_match_candidates add constraint lead_match_candidates_access_source_check
  check (access_source in ('purchase', 'awarded', 'admin'));


-- ----------------------------------------------------------------------------
-- F) Projektlink fuer Endkunden (nur Hash wird gespeichert)
-- ----------------------------------------------------------------------------
create table if not exists public.lead_access_tokens (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists idx_lead_access_tokens_lead on public.lead_access_tokens(lead_id);
alter table public.lead_access_tokens enable row level security;
drop policy if exists "LeadTokens: admin read" on public.lead_access_tokens;
create policy "LeadTokens: admin read" on public.lead_access_tokens for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));
grant select on public.lead_access_tokens to authenticated;
grant all on public.lead_access_tokens to service_role;


-- ----------------------------------------------------------------------------
-- G) Rechnungen: Marktplatz-Typen
-- ----------------------------------------------------------------------------
alter table public.invoices
  add column if not exists lead_id uuid references public.leads(id) on delete set null,
  add column if not exists lead_auction_id uuid references public.lead_auctions(id) on delete set null;
alter table public.invoices drop constraint if exists invoices_invoice_type_check;
alter table public.invoices add constraint invoices_invoice_type_check
  check (invoice_type in ('commission', 'seller_penalty', 'lead_purchase', 'lead_commission'));
alter table public.invoice_items drop constraint if exists invoice_items_item_type_check;
alter table public.invoice_items add constraint invoice_items_item_type_check
  check (item_type in ('commission', 'fee', 'service', 'other', 'seller_penalty', 'lead_purchase'));
create index if not exists idx_invoices_lead on public.invoices(lead_id);


-- ----------------------------------------------------------------------------
-- H) In-App-Benachrichtigungen + E-Mail-Typen
-- ----------------------------------------------------------------------------
alter table public.dealer_notifications
  add column if not exists lead_auction_id uuid references public.lead_auctions(id) on delete cascade;
alter table public.dealer_notifications drop constraint if exists dealer_notifications_type_check;
alter table public.dealer_notifications add constraint dealer_notifications_type_check
  check (type in ('outbid', 'auction_won', 'auction_ending', 'new_auction', 'search_match',
                  'payment_reminder', 'system', 'bid_confirmed',
                  'project_new', 'project_underbid', 'project_awarded', 'project_not_awarded',
                  'project_ended', 'project_cancelled', 'contact_unlocked'));

alter table public.admin_emails drop constraint if exists admin_emails_email_type_check;
alter table public.admin_emails add constraint admin_emails_email_type_check
  check (email_type in (
    'single', 'broadcast', 'reply', 'inbound', 'auto', 'welcome', 'auto_response',
    'wizard_resume', 'wizard_recovery_first', 'wizard_recovery_followup',
    'appointment_confirmation', 'appointment_pin', 'appointment_reminder',
    'auction_ending_soon', 'auction_summary', 'auction_winner', 'auction_new', 'auction_update',
    'auction_ended', 'auction_new_auction', 'auction_new_bid', 'auction_outbid', 'auction_won',
    'auction_lost', 'auction_auction_started', 'auction_seller_sold', 'auction_seller_not_sold',
    'auction_kaufchance_invite', 'auction_seller_kaufchance', 'auction_seller_relisted',
    'auction_kaufchance_expired', 'auction_seller_auto_relisted', 'auction_auction_relisted',
    'auction_seller_new_offer', 'auction_admin_new_offer', 'auction_buyer_offer_rejected',
    'auction_buyer_counter_offer', 'auction_seller_buyer_rejected', 'auction_seller_festpreis_extended',
    'auction_admin_festpreis_needs_price', 'auction_seller_festpreis_round_warning',
    'auction_seller_auction_round_warning', 'auction_seller_soft_brake',
    'auction_seller_festpreis_cap_reached', 'auction_seller_existing_listing_optin',
    'bid_confirmed', 'bid_outbid', 'payment_confirmation', 'payment_reminder', 'invoice',
    'inactivity', 'favorite_notification', 'favorite_price_change', 'expert_valuation',
    'registration_invite', 'wrong_number_followup', 'no_answer_followup', 'considering_followup',
    'done_followup', 'purchase_inquiry_dealer', 'purchase_inquiry_customer', 'purchase_contract',
    'purchase_contract_notification', 'handover_protocol_blank',
    'lead_admin_wertermittlung', 'lead_admin_wertrechner', 'lead_admin_wizard', 'lead_admin_kontakt',
    'lead_admin_dealer', 'lead_user_wertermittlung', 'lead_user_wertrechner', 'lead_user_wizard',
    'lead_user_kontakt', 'lead_user_dealer', 'lead_user_funnel', 'lead_admin_funnel',
    'dealer_welcome', 'dealer_approved', 'dealer_rejected', 'dealer_suspended', 'dealer_reactivated',
    'dealer_level_change', 'dealer_registration_invite', 'dealer_first_nudge', 'dealer_auction_digest',
    'dealer_instant_buy_alert', 'dealer_outreach',
    'dunning_level_1', 'dunning_level_2', 'dunning_level_3', 'dunning_level_4', 'dunning_level_5',
    'scheduled', 'vehicle_question', 'dealer_documents_request', 'google_review_request',
    'project_link', 'project_new_offer', 'project_contact_unlocked', 'project_tender_ended',
    'project_awarded_consumer', 'project_awarded_dealer', 'project_not_awarded_dealer',
    'project_new_dealer', 'project_admin_new'
  ));


-- ----------------------------------------------------------------------------
-- I) Outbox
-- ----------------------------------------------------------------------------
create table if not exists public.kw_outbox (
  id bigint generated always as identity primary key,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0,
  last_error text
);
create index if not exists idx_kw_outbox_pending on public.kw_outbox(available_at) where processed_at is null;
alter table public.kw_outbox enable row level security;
drop policy if exists "Outbox: admin read" on public.kw_outbox;
create policy "Outbox: admin read" on public.kw_outbox for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));
grant select on public.kw_outbox to authenticated;
grant all on public.kw_outbox to service_role;

create or replace function public.kw_enqueue(p_event_type text, p_payload jsonb, p_delay interval default '0 seconds')
returns void
language sql
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: wird aus Haendler-/Kunden-RPCs aufgerufen, deren Aufrufer keine
  -- Rechte auf die Outbox haben.
  insert into public.kw_outbox (event_type, payload, available_at)
  values (p_event_type, coalesce(p_payload, '{}'::jsonb), now() + coalesce(p_delay, '0 seconds'));
$$;
revoke execute on function public.kw_enqueue(text, jsonb, interval) from public, anon, authenticated;
grant execute on function public.kw_enqueue(text, jsonb, interval) to service_role;


-- ----------------------------------------------------------------------------
-- J) Planer v2 (Raumfoto, Masse, Preis-Schaetzung, private Medien)
-- ----------------------------------------------------------------------------
alter table public.planner_sessions
  add column if not exists spec_version integer not null default 1,
  add column if not exists room jsonb not null default '{}'::jsonb,
  add column if not exists estimate jsonb,
  add column if not exists photo_paths text[] not null default '{}';

alter table public.planner_renders
  add column if not exists mode text not null default 'text',
  add column if not exists input_image_path text,
  add column if not exists storage_bucket text not null default 'planner-renders',
  add column if not exists fal_status_url text,
  add column if not exists fal_response_url text,
  add column if not exists variant_label text;
alter table public.planner_renders drop constraint if exists planner_renders_mode_check;
alter table public.planner_renders add constraint planner_renders_mode_check check (mode in ('text', 'edit'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('planner-media', 'planner-media', false, 15728640,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ----------------------------------------------------------------------------
-- K) Preis-Engine: Rate-Card-Overrides (leer = Code-Defaults)
-- ----------------------------------------------------------------------------
create table if not exists public.kitchen_pricing_rate_cards (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique,
  is_active boolean not null default false,
  overrides jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);
create unique index if not exists uq_kitchen_pricing_rate_cards_active
  on public.kitchen_pricing_rate_cards((true)) where is_active;
alter table public.kitchen_pricing_rate_cards enable row level security;
drop policy if exists "RateCards: public read active" on public.kitchen_pricing_rate_cards;
create policy "RateCards: public read active" on public.kitchen_pricing_rate_cards for select
  using (is_active or public.has_role(auth.uid(), 'admin'::app_role));
drop policy if exists "RateCards: admin manage" on public.kitchen_pricing_rate_cards;
create policy "RateCards: admin manage" on public.kitchen_pricing_rate_cards for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));
grant select on public.kitchen_pricing_rate_cards to anon, authenticated;
grant insert, update, delete on public.kitchen_pricing_rate_cards to authenticated;
grant all on public.kitchen_pricing_rate_cards to service_role;

insert into public.kitchen_pricing_rate_cards (version, is_active, overrides, notes)
values (1, true, '{}'::jsonb, 'Startversion: Code-Defaults aus supabase/functions/_shared/kitchen-pricing.ts')
on conflict (version) do nothing;


-- ----------------------------------------------------------------------------
-- L) Hilfsfunktionen
-- ----------------------------------------------------------------------------
create or replace function public.kw_is_active_dealer(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: liest user_roles/profiles unabhaengig von deren RLS.
  select exists (
    select 1
    from public.user_roles r
    join public.profiles p on p.id = r.user_id
    where r.user_id = p_uid
      and r.role = 'dealer'::app_role
      and coalesce(p.is_suspended, false) = false
      and coalesce(p.account_restricted, false) = false
  );
$$;
revoke execute on function public.kw_is_active_dealer(uuid) from public, anon;
grant execute on function public.kw_is_active_dealer(uuid) to authenticated, service_role;

create or replace function public.kw_dealer_origin(p_uid uuid)
returns table (postal_code text, radius_km integer)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: kombiniert Marktplatz-Profil, Firmenstammdaten und Default-Radius.
  select
    coalesce(mp.service_postal_code,
             nullif(regexp_replace(coalesce(p.company_zip, ''), '\D', '', 'g'), ''),
             nullif(regexp_replace(coalesce(p.address_zip, ''), '\D', '', 'g'), '')),
    coalesce(mp.service_radius_km, s.default_service_radius_km, 80)
  from public.profiles p
  cross join public.kw_marketplace_settings s
  left join public.kw_dealer_market_profiles mp on mp.dealer_id = p.id
  where p.id = p_uid;
$$;
revoke execute on function public.kw_dealer_origin(uuid) from public, anon, authenticated;
grant execute on function public.kw_dealer_origin(uuid) to service_role;

create or replace function public.kw_lead_tier_score(
  p_has_photo boolean,
  p_has_dimensions boolean,
  p_has_phone boolean,
  p_timeframe_months integer,
  p_value_eur numeric
) returns table (tier public.lead_tier, score integer)
language plpgsql
immutable
set search_path = public, pg_catalog
as $$
declare
  v_score integer := 20;
begin
  if p_has_photo then v_score := v_score + 15; end if;
  if p_has_dimensions then v_score := v_score + 15; end if;
  if p_has_phone then v_score := v_score + 15; end if;
  if p_timeframe_months is not null and p_timeframe_months <= 3 then
    v_score := v_score + 15;
  elsif p_timeframe_months is not null and p_timeframe_months <= 6 then
    v_score := v_score + 8;
  end if;
  if coalesce(p_value_eur, 0) >= 30000 then v_score := v_score + 10; end if;
  tier := case
    when v_score >= 70 then 'hot'::public.lead_tier
    when v_score >= 50 then 'premium'::public.lead_tier
    when v_score >= 30 then 'qualified'::public.lead_tier
    else 'standard'::public.lead_tier
  end;
  score := least(v_score, 100);
  return next;
end;
$$;
grant execute on function public.kw_lead_tier_score(boolean, boolean, boolean, integer, numeric)
  to authenticated, service_role;

create or replace function public.kw_create_market_invoice(
  p_dealer_id uuid,
  p_type text,
  p_net_cents integer,
  p_description text,
  p_lead_id uuid,
  p_auction_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: wird aus Haendler-/Kunden-RPCs aufgerufen; Rechnungen duerfen
  -- nur hier (mit korrekter Steuerlogik) entstehen.
  v_invoice_id uuid;
  v_tax record;
  v_net numeric(12,2);
  v_tax_amount numeric(12,2);
  v_terms integer;
  v_customer_number text;
  v_item_type text;
begin
  if p_type not in ('lead_purchase', 'lead_commission') then
    raise exception 'kw_create_market_invoice: unknown type %', p_type;
  end if;
  if coalesce(p_net_cents, 0) <= 0 then
    return null;
  end if;

  select * into v_tax from public.get_dealer_tax_info(p_dealer_id);
  v_net := round(p_net_cents / 100.0, 2);
  v_tax_amount := round(v_net * coalesce(v_tax.tax_rate, 19) / 100, 2);

  select coalesce(nullif(invoice_payment_terms_days, 0), 14) into v_terms from public.site_settings limit 1;
  v_terms := coalesce(v_terms, 14);
  select customer_number into v_customer_number from public.profiles where id = p_dealer_id;

  insert into public.invoices (
    invoice_number, dealer_id, customer_number, status, invoice_type,
    net_amount, tax_rate, tax_amount, gross_amount,
    payment_terms_days, due_date, invoice_date, notes,
    reverse_charge, dealer_country, lead_id, lead_auction_id
  ) values (
    public.generate_invoice_number(), p_dealer_id, v_customer_number, 'draft', p_type,
    v_net, coalesce(v_tax.tax_rate, 19), v_tax_amount, v_net + v_tax_amount,
    v_terms, current_date + v_terms, current_date,
    case when coalesce(v_tax.is_reverse_charge, false)
      then 'Reverse Charge (§13b UStG): ' || p_description
      else p_description end,
    coalesce(v_tax.is_reverse_charge, false), coalesce(v_tax.dealer_country, 'DE'),
    p_lead_id, p_auction_id
  )
  returning id into v_invoice_id;

  v_item_type := case when p_type = 'lead_purchase' then 'lead_purchase' else 'commission' end;
  insert into public.invoice_items (
    invoice_id, description, quantity, unit_price, net_amount, tax_rate, tax_amount,
    gross_amount, item_type, reference_id
  ) values (
    v_invoice_id, p_description, 1, v_net, v_net, coalesce(v_tax.tax_rate, 19), v_tax_amount,
    v_net + v_tax_amount, v_item_type, p_auction_id
  );

  return v_invoice_id;
end;
$$;
revoke execute on function public.kw_create_market_invoice(uuid, text, integer, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.kw_create_market_invoice(uuid, text, integer, text, uuid, uuid) to service_role;


-- ----------------------------------------------------------------------------
-- M) Ausschreibung anlegen / veroeffentlichen
-- ----------------------------------------------------------------------------
create or replace function public.kw_open_tender(
  p_lead_id uuid,
  p_publish boolean,
  p_public_summary jsonb,
  p_estimate_min_eur numeric,
  p_estimate_max_eur numeric,
  p_reference_price_eur numeric,
  p_planner_session_id uuid default null
) returns uuid
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
    v_settings.tender_duration_hours,
    case when p_publish then now() end,
    case when p_publish then now() + make_interval(hours => v_settings.tender_duration_hours) end,
    p_publish,
    case when p_publish then now() end,
    p_planner_session_id, p_estimate_min_eur, p_estimate_max_eur,
    coalesce(p_reference_price_eur, v_price_basis),
    coalesce(p_public_summary, '{}'::jsonb),
    v_settings.bid_visibility, v_settings.max_contact_purchases, v_contact_price,
    case when p_publish
      then now() + make_interval(hours => v_settings.tender_duration_hours)
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
revoke execute on function public.kw_open_tender(uuid, boolean, jsonb, numeric, numeric, numeric, uuid)
  from public, anon, authenticated;
grant execute on function public.kw_open_tender(uuid, boolean, jsonb, numeric, numeric, numeric, uuid) to service_role;

create or replace function public.kw_admin_publish_tender(p_auction_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: Admin-Aktion aus dem Frontend, prueft die Rolle selbst.
  v_settings public.kw_marketplace_settings%rowtype;
  v_auction public.lead_auctions%rowtype;
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into v_settings from public.kw_marketplace_settings where id;
  select * into v_auction from public.lead_auctions where id = p_auction_id for update;
  if v_auction.id is null or v_auction.status <> 'draft' then
    raise exception 'Ausschreibung ist nicht im Entwurf.' using errcode = 'P0001';
  end if;

  update public.lead_auctions
  set status = 'active',
      is_published = true,
      published_at = now(),
      starts_at = now(),
      ends_at = now() + make_interval(hours => coalesce(duration_hours, v_settings.tender_duration_hours)),
      decision_deadline_at = now()
        + make_interval(hours => coalesce(duration_hours, v_settings.tender_duration_hours))
        + make_interval(days => v_settings.decision_window_days)
  where id = p_auction_id;

  update public.leads set status = 'in_auction' where id = v_auction.lead_id and status in ('new', 'qualified');
  perform public.kw_enqueue('tender_published', jsonb_build_object('auction_id', p_auction_id));
  return jsonb_build_object('ok', true);
end;
$$;
revoke execute on function public.kw_admin_publish_tender(uuid) from public, anon;
grant execute on function public.kw_admin_publish_tender(uuid) to authenticated, service_role;

-- Funnel A (Angebote einholen) und Funnel B (Angebot unterbieten) erzeugen
-- ihre Leads direkt aus dem Browser. Die Ausschreibung entsteht per Trigger:
-- A sofort aktiv (wenn konfiguriert), B als Entwurf fuer den Experten-Check.
create or replace function public.kw_leads_after_insert_tender()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: der anonyme Inserter hat keine Rechte auf lead_auctions/Outbox.
  v_settings public.kw_marketplace_settings%rowtype;
  v_summary jsonb;
  v_publish boolean;
begin
  if new.funnel_type not in ('a', 'b') then
    return new;
  end if;
  select * into v_settings from public.kw_marketplace_settings where id;
  v_publish := new.funnel_type = 'a' and v_settings.auto_publish_funnel_a;

  v_summary := jsonb_strip_nulls(jsonb_build_object(
    'source', new.funnel_type::text,
    'kitchen_form', new.kitchen_form,
    'kitchen_style', new.kitchen_style,
    'budget_eur', new.budget_midpoint,
    'existing_offer_eur', case when new.has_existing_offer then round(new.existing_offer_price_cents / 100.0) end,
    'existing_offer_studio_known', new.existing_offer_studio is not null,
    'timeframe_months', new.timeframe_months,
    'housing_type', new.housing_type,
    'purchase_reason', new.purchase_reason,
    'special_wishes', to_jsonb(new.special_wishes),
    'delivery_mode', new.delivery_mode,
    'answers', coalesce(new.funnel_answers, '{}'::jsonb) - 'salutation'
  ));

  begin
    perform public.kw_open_tender(
      new.id, v_publish, v_summary, null, null,
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
revoke execute on function public.kw_leads_after_insert_tender() from public, anon, authenticated;

drop trigger if exists kw_leads_after_insert_tender on public.leads;
create trigger kw_leads_after_insert_tender
  after insert on public.leads
  for each row execute function public.kw_leads_after_insert_tender();


-- ----------------------------------------------------------------------------
-- N) Haendler-RPCs
-- ----------------------------------------------------------------------------
create or replace function public.kw_dealer_projects(
  p_scope text default 'open',
  p_limit integer default 60,
  p_offset integer default 0
) returns table (
  auction_id uuid,
  status text,
  funnel_type text,
  published_at timestamptz,
  ends_at timestamptz,
  decision_deadline_at timestamptz,
  postal_prefix text,
  region text,
  distance_km numeric,
  summary jsonb,
  estimate_min_eur numeric,
  estimate_max_eur numeric,
  reference_price_eur numeric,
  offer_count integer,
  lowest_offer_eur numeric,
  my_offer jsonb,
  contact_unlocked boolean,
  contact_purchases integer,
  max_contact_purchases integer,
  contact_price_cents integer,
  awarded_to_me boolean,
  in_service_area boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: Haendler haben keine Tabellenrechte auf Leads/Ausschreibungen;
  -- diese Funktion liefert ausschliesslich anonymisierte Felder.
  v_uid uuid := auth.uid();
  v_origin text;
  v_radius integer;
begin
  if not public.kw_is_active_dealer(v_uid) then
    raise exception 'Nur fuer freigeschaltete Kuechenstudios.' using errcode = '42501';
  end if;
  select o.postal_code, o.radius_km into v_origin, v_radius from public.kw_dealer_origin(v_uid) o;

  return query
  with base as (
    select
      a.*,
      l.funnel_type::text as l_funnel,
      l.postal_code as l_plz,
      l.region as l_region,
      case when v_origin is null then null else public.kw_plz_distance_km(v_origin, l.postal_code) end as dist,
      (select count(*)::integer from public.lead_bids b where b.auction_id = a.id and b.status in ('active', 'accepted')) as n_offers,
      (select min(b.price_eur) from public.lead_bids b where b.auction_id = a.id and b.status = 'active') as min_offer,
      (select jsonb_build_object('id', b.id, 'price_eur', b.price_eur, 'status', b.status,
                                 'revision', b.revision, 'updated_at', b.updated_at,
                                 'delivery_weeks', b.delivery_weeks)
         from public.lead_bids b where b.auction_id = a.id and b.dealer_id = v_uid) as mine,
      exists (select 1 from public.lead_match_candidates mc
              where mc.lead_id = a.lead_id and mc.dealer_id = v_uid and mc.is_purchased) as unlocked,
      (select count(*)::integer from public.lead_match_candidates mc
        where mc.lead_id = a.lead_id and mc.is_purchased and mc.access_source = 'purchase') as n_purchases,
      exists (select 1 from public.lead_bids b where b.id = a.won_bid_id and b.dealer_id = v_uid) as won
    from public.lead_auctions a
    join public.leads l on l.id = a.lead_id
    where a.status in ('active', 'completed', 'awarded')
  )
  select
    b.id, b.status, b.l_funnel, b.published_at, b.ends_at, b.decision_deadline_at,
    left(b.l_plz, 3) || 'xx', b.l_region, b.dist,
    b.public_summary, b.estimate_min_eur, b.estimate_max_eur, b.reference_price_eur,
    b.n_offers,
    case when b.bid_visibility = 'lowest_price' then b.min_offer end,
    b.mine, b.unlocked, b.n_purchases, b.max_contact_purchases, b.contact_price_cents,
    b.won,
    (v_origin is null or b.dist is null or b.dist <= v_radius)
  from base b
  where
    case p_scope
      when 'mine' then (b.mine is not null or b.unlocked)
      when 'all' then b.status = 'active'
      else b.status = 'active' and (v_origin is null or b.dist is null or b.dist <= v_radius)
    end
  order by
    case when p_scope = 'mine' then b.updated_at end desc nulls last,
    b.ends_at asc nulls last
  limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset);
end;
$$;
revoke execute on function public.kw_dealer_projects(text, integer, integer) from public, anon;
grant execute on function public.kw_dealer_projects(text, integer, integer) to authenticated, service_role;

create or replace function public.kw_dealer_project(p_auction_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: siehe kw_dealer_projects; Kontaktdaten nur bei Kauf/Zuschlag.
  v_uid uuid := auth.uid();
  v_origin text;
  v_radius integer;
  v_a public.lead_auctions%rowtype;
  v_l public.leads%rowtype;
  v_unlocked boolean;
  v_won boolean;
  v_media jsonb;
  v_result jsonb;
begin
  if not public.kw_is_active_dealer(v_uid) then
    raise exception 'Nur fuer freigeschaltete Kuechenstudios.' using errcode = '42501';
  end if;
  select * into v_a from public.lead_auctions where id = p_auction_id;
  if v_a.id is null or v_a.status not in ('active', 'completed', 'awarded') then
    raise exception 'Projekt nicht gefunden.' using errcode = 'P0002';
  end if;
  select * into v_l from public.leads where id = v_a.lead_id;
  select o.postal_code, o.radius_km into v_origin, v_radius from public.kw_dealer_origin(v_uid) o;

  v_unlocked := exists (select 1 from public.lead_match_candidates mc
                        where mc.lead_id = v_l.id and mc.dealer_id = v_uid and mc.is_purchased);
  v_won := exists (select 1 from public.lead_bids b where b.id = v_a.won_bid_id and b.dealer_id = v_uid);

  if v_a.status = 'awarded' and not v_won and not v_unlocked
     and not exists (select 1 from public.lead_bids b where b.auction_id = v_a.id and b.dealer_id = v_uid) then
    raise exception 'Projekt nicht gefunden.' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('bucket', r.storage_bucket, 'path', r.image_path,
                                               'kind', 'render', 'mode', r.mode, 'created_at', r.created_at)
                            order by r.version desc), '[]'::jsonb)
  into v_media
  from public.planner_renders r
  where r.session_id = v_a.planner_session_id and r.status = 'success' and r.image_path is not null;

  if v_a.planner_session_id is not null then
    select v_media || coalesce((
      select jsonb_agg(jsonb_build_object('bucket', 'planner-media', 'path', p, 'kind', 'photo'))
      from public.planner_sessions s, unnest(s.photo_paths) p
      where s.id = v_a.planner_session_id
    ), '[]'::jsonb) into v_media;
  end if;

  insert into public.lead_views (lead_id, dealer_id) values (v_l.id, v_uid);

  v_result := jsonb_build_object(
    'auction_id', v_a.id,
    'status', v_a.status,
    'funnel_type', v_l.funnel_type::text,
    'published_at', v_a.published_at,
    'ends_at', v_a.ends_at,
    'decision_deadline_at', v_a.decision_deadline_at,
    'postal_prefix', left(v_l.postal_code, 3) || 'xx',
    'region', v_l.region,
    'distance_km', case when v_origin is null then null else public.kw_plz_distance_km(v_origin, v_l.postal_code) end,
    'service_radius_km', v_radius,
    'summary', v_a.public_summary,
    'estimate_min_eur', v_a.estimate_min_eur,
    'estimate_max_eur', v_a.estimate_max_eur,
    'reference_price_eur', v_a.reference_price_eur,
    'bid_visibility', v_a.bid_visibility,
    'offer_count', (select count(*) from public.lead_bids b where b.auction_id = v_a.id and b.status in ('active', 'accepted')),
    'lowest_offer_eur', case when v_a.bid_visibility = 'lowest_price'
      then (select min(b.price_eur) from public.lead_bids b where b.auction_id = v_a.id and b.status = 'active') end,
    'my_offer', (select to_jsonb(b) - 'dealer_id' - 'is_winning' from public.lead_bids b
                 where b.auction_id = v_a.id and b.dealer_id = v_uid),
    'contact_unlocked', v_unlocked,
    'contact_purchases', (select count(*) from public.lead_match_candidates mc
                          where mc.lead_id = v_l.id and mc.is_purchased and mc.access_source = 'purchase'),
    'max_contact_purchases', v_a.max_contact_purchases,
    'contact_price_cents', v_a.contact_price_cents,
    'awarded_to_me', v_won,
    'media', v_media,
    'contact', case when v_unlocked or v_won then jsonb_build_object(
      'first_name', v_l.first_name, 'last_name', v_l.last_name,
      'email', v_l.email, 'phone', v_l.phone,
      'postal_code', v_l.postal_code, 'city', v_l.city, 'address_line', v_l.address_line,
      'consent_call', v_l.consent_call
    ) end
  );
  return v_result;
end;
$$;
revoke execute on function public.kw_dealer_project(uuid) from public, anon;
grant execute on function public.kw_dealer_project(uuid) to authenticated, service_role;

create or replace function public.kw_dealer_place_offer(
  p_auction_id uuid,
  p_price_eur numeric,
  p_delivery_weeks integer default null,
  p_includes jsonb default '{}'::jsonb,
  p_valid_until date default null,
  p_message text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: einzige Stelle, an der Angebote entstehen oder geaendert werden.
  v_uid uuid := auth.uid();
  v_settings public.kw_marketplace_settings%rowtype;
  v_a public.lead_auctions%rowtype;
  v_existing public.lead_bids%rowtype;
  v_bid_id uuid;
  v_floor numeric;
  v_is_update boolean := false;
  v_prev_lowest numeric;
  v_rank integer;
begin
  if not public.kw_is_active_dealer(v_uid) then
    raise exception 'Nur fuer freigeschaltete Kuechenstudios.' using errcode = '42501';
  end if;
  if p_price_eur is null or p_price_eur <= 0 then
    raise exception 'Bitte einen gueltigen Angebotspreis angeben.' using errcode = '22023';
  end if;
  if p_message is not null and char_length(p_message) > 2000 then
    raise exception 'Die Nachricht ist zu lang (max. 2000 Zeichen).' using errcode = '22023';
  end if;
  if p_includes is not null and octet_length(p_includes::text) > 4000 then
    raise exception 'Leistungsumfang ist zu umfangreich.' using errcode = '22023';
  end if;
  if p_valid_until is not null and p_valid_until < current_date then
    raise exception 'Das Gueltigkeitsdatum liegt in der Vergangenheit.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_auction_id::text, 0));
  select * into v_settings from public.kw_marketplace_settings where id;
  select * into v_a from public.lead_auctions where id = p_auction_id;
  if v_a.id is null or v_a.status <> 'active' or v_a.ends_at <= now() then
    raise exception 'Fuer dieses Projekt koennen keine Angebote mehr abgegeben werden.' using errcode = 'P0001';
  end if;

  v_floor := coalesce(v_a.estimate_min_eur, v_a.reference_price_eur);
  if v_floor is not null and p_price_eur < round(v_floor * v_settings.min_offer_ratio, 2) then
    raise exception 'Der Preis liegt unplausibel weit unter der Projekt-Schaetzung. Bitte pruefen.' using errcode = '22023';
  end if;

  select min(price_eur) into v_prev_lowest from public.lead_bids where auction_id = p_auction_id and status = 'active';
  select * into v_existing from public.lead_bids where auction_id = p_auction_id and dealer_id = v_uid for update;

  if v_existing.id is not null then
    if v_existing.status = 'active' and p_price_eur > v_existing.price_eur then
      raise exception 'Ein abgegebenes Angebot kann nur gesenkt werden.' using errcode = 'P0001';
    end if;
    if v_existing.status in ('accepted', 'declined') then
      raise exception 'Dieses Angebot ist abgeschlossen.' using errcode = 'P0001';
    end if;
    update public.lead_bids
    set price_eur = p_price_eur,
        delivery_weeks = p_delivery_weeks,
        includes = coalesce(p_includes, '{}'::jsonb),
        valid_until = p_valid_until,
        notes = p_message,
        status = 'active',
        revision = v_existing.revision + 1
    where id = v_existing.id
    returning id into v_bid_id;
    v_is_update := v_existing.status = 'active';
  else
    insert into public.lead_bids (auction_id, dealer_id, price_eur, delivery_weeks, includes,
                                  valid_until, notes, montage_included)
    values (p_auction_id, v_uid, p_price_eur, p_delivery_weeks, coalesce(p_includes, '{}'::jsonb),
            p_valid_until, p_message, coalesce((p_includes ->> 'assembly')::boolean, true))
    returning id into v_bid_id;
  end if;

  insert into public.lead_bid_revisions (bid_id, price_eur) values (v_bid_id, p_price_eur);

  select count(*) + 1 into v_rank from public.lead_bids
  where auction_id = p_auction_id and status = 'active' and price_eur < p_price_eur;

  perform public.kw_enqueue('offer_placed', jsonb_build_object(
    'auction_id', p_auction_id, 'bid_id', v_bid_id, 'dealer_id', v_uid,
    'price_eur', p_price_eur, 'is_update', v_is_update,
    'undercut_previous_lowest', v_prev_lowest is not null and p_price_eur < v_prev_lowest
  ));

  return jsonb_build_object('ok', true, 'bid_id', v_bid_id, 'rank', v_rank, 'is_update', v_is_update);
end;
$$;
revoke execute on function public.kw_dealer_place_offer(uuid, numeric, integer, jsonb, date, text) from public, anon;
grant execute on function public.kw_dealer_place_offer(uuid, numeric, integer, jsonb, date, text) to authenticated, service_role;

create or replace function public.kw_dealer_withdraw_offer(p_auction_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: Haendler duerfen lead_bids nicht direkt aendern.
  v_uid uuid := auth.uid();
  v_a public.lead_auctions%rowtype;
begin
  if not public.kw_is_active_dealer(v_uid) then
    raise exception 'Nur fuer freigeschaltete Kuechenstudios.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_auction_id::text, 0));
  select * into v_a from public.lead_auctions where id = p_auction_id;
  if v_a.id is null or v_a.status <> 'active' then
    raise exception 'Das Angebot kann nur waehrend der Angebotsphase zurueckgezogen werden.' using errcode = 'P0001';
  end if;
  update public.lead_bids set status = 'withdrawn'
  where auction_id = p_auction_id and dealer_id = v_uid and status = 'active';
  if not found then
    raise exception 'Kein aktives Angebot vorhanden.' using errcode = 'P0002';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke execute on function public.kw_dealer_withdraw_offer(uuid) from public, anon;
grant execute on function public.kw_dealer_withdraw_offer(uuid) to authenticated, service_role;

create or replace function public.kw_dealer_unlock_contact(p_auction_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: Kontaktkauf ist atomar (Limit, Rechnung, Zugriff, Benachrichtigung).
  v_uid uuid := auth.uid();
  v_a public.lead_auctions%rowtype;
  v_l public.leads%rowtype;
  v_count integer;
  v_price integer;
  v_invoice uuid;
begin
  if not public.kw_is_active_dealer(v_uid) then
    raise exception 'Nur fuer freigeschaltete Kuechenstudios.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_auction_id::text, 0));
  select * into v_a from public.lead_auctions where id = p_auction_id;
  if v_a.id is null or v_a.status not in ('active', 'completed') then
    raise exception 'Fuer dieses Projekt koennen keine Kontakte mehr freigeschaltet werden.' using errcode = 'P0001';
  end if;
  select * into v_l from public.leads where id = v_a.lead_id;

  if exists (select 1 from public.lead_match_candidates
             where lead_id = v_l.id and dealer_id = v_uid and is_purchased) then
    return public.kw_dealer_project(p_auction_id);
  end if;

  select count(*) into v_count from public.lead_match_candidates
  where lead_id = v_l.id and is_purchased and access_source = 'purchase';
  if v_count >= v_a.max_contact_purchases then
    raise exception 'Das Kontingent fuer dieses Projekt ist ausgeschoepft.' using errcode = 'P0001';
  end if;

  v_price := coalesce(v_a.contact_price_cents, 0);
  insert into public.lead_match_candidates (lead_id, dealer_id, is_purchased, purchased_at,
                                            price_cents, access_source, auction_id)
  values (v_l.id, v_uid, true, now(), v_price, 'purchase', v_a.id)
  on conflict (lead_id, dealer_id) do update
    set is_purchased = true, purchased_at = now(), price_cents = excluded.price_cents,
        access_source = 'purchase', auction_id = excluded.auction_id;

  v_invoice := public.kw_create_market_invoice(
    v_uid, 'lead_purchase', v_price,
    'Kontaktfreischaltung Küchenprojekt ' || left(v_l.postal_code, 3) || 'xx (Projekt ' || left(v_a.id::text, 8) || ')',
    v_l.id, v_a.id
  );
  update public.lead_match_candidates set invoice_id = v_invoice where lead_id = v_l.id and dealer_id = v_uid;

  perform public.kw_enqueue('contact_unlocked', jsonb_build_object(
    'auction_id', v_a.id, 'lead_id', v_l.id, 'dealer_id', v_uid, 'invoice_id', v_invoice));

  return public.kw_dealer_project(p_auction_id);
end;
$$;
revoke execute on function public.kw_dealer_unlock_contact(uuid) from public, anon;
grant execute on function public.kw_dealer_unlock_contact(uuid) to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- O) Kunden-RPCs (nur service_role; Token-Pruefung in Edge Function kw-project)
-- ----------------------------------------------------------------------------
create or replace function public.kw_project_issue_token(p_lead_id uuid, p_token_hash text)
returns void
language sql
security definer
set search_path = public, pg_catalog
as $$
  insert into public.lead_access_tokens (lead_id, token_hash) values (p_lead_id, p_token_hash);
$$;
revoke execute on function public.kw_project_issue_token(uuid, text) from public, anon, authenticated;
grant execute on function public.kw_project_issue_token(uuid, text) to service_role;

create or replace function public.kw_project_resolve_token(p_token_hash text)
returns uuid
language sql
security definer
set search_path = public, pg_catalog
as $$
  update public.lead_access_tokens
  set last_used_at = now()
  where token_hash = p_token_hash and revoked_at is null
  returning lead_id;
$$;
revoke execute on function public.kw_project_resolve_token(text) from public, anon, authenticated;
grant execute on function public.kw_project_resolve_token(text) to service_role;

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
      'dealer', jsonb_build_object(
        'company_name', coalesce(nullif(p.company_name, ''), 'Küchenstudio'),
        'city', p.company_city,
        'website', p.website,
        'verified', coalesce(p.is_verified, false),
        'member_since', p.created_at,
        'distance_km', public.kw_plz_distance_km(coalesce(p.company_zip, p.address_zip, ''), v_l.postal_code),
        'rating', rs.average_rating,
        'reviews', coalesce(rs.total_reviews, 0),
        'intro', mp.offer_intro
      )
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
      'budget_eur', v_l.budget_midpoint, 'timeframe_months', v_l.timeframe_months
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
      'session_token', v_session.session_token, 'room', v_session.room, 'spec', v_session.spec,
      'estimate', v_session.estimate, 'photo_count', cardinality(v_session.photo_paths)
    ) end
  );
end;
$$;
revoke execute on function public.kw_project_view(uuid) from public, anon, authenticated;
grant execute on function public.kw_project_view(uuid) to service_role;

create or replace function public.kw_project_accept_offer(p_lead_id uuid, p_bid_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_a public.lead_auctions%rowtype;
  v_b public.lead_bids%rowtype;
  v_commission integer;
  v_invoice uuid;
begin
  select * into v_b from public.lead_bids where id = p_bid_id;
  if v_b.id is null then
    raise exception 'Angebot nicht gefunden.' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_b.auction_id::text, 0));
  select * into v_a from public.lead_auctions where id = v_b.auction_id for update;
  if v_a.lead_id <> p_lead_id then
    raise exception 'Angebot gehoert nicht zu diesem Projekt.' using errcode = '42501';
  end if;
  if v_a.status not in ('active', 'completed') then
    raise exception 'Fuer dieses Projekt wurde bereits entschieden.' using errcode = 'P0001';
  end if;
  if v_a.decision_deadline_at is not null and v_a.decision_deadline_at < now() then
    raise exception 'Die Entscheidungsfrist ist abgelaufen.' using errcode = 'P0001';
  end if;
  if v_b.status <> 'active' then
    raise exception 'Dieses Angebot ist nicht mehr verfuegbar.' using errcode = 'P0001';
  end if;
  if v_b.valid_until is not null and v_b.valid_until < current_date then
    raise exception 'Dieses Angebot ist abgelaufen.' using errcode = 'P0001';
  end if;

  update public.lead_bids set status = 'accepted', is_winning = true where id = v_b.id;
  update public.lead_bids set status = 'declined'
  where auction_id = v_a.id and id <> v_b.id and status = 'active';
  update public.lead_auctions
  set status = 'awarded', won_bid_id = v_b.id, decided_at = now(),
      ends_at = least(coalesce(ends_at, now()), now())
  where id = v_a.id;
  update public.leads set status = 'matched' where id = p_lead_id;

  insert into public.lead_match_candidates (lead_id, dealer_id, is_purchased, purchased_at,
                                            price_cents, access_source, auction_id)
  values (p_lead_id, v_b.dealer_id, true, now(), 0, 'awarded', v_a.id)
  on conflict (lead_id, dealer_id) do update
    set is_purchased = true, access_source = case when lead_match_candidates.access_source = 'purchase'
                                                  then 'purchase' else 'awarded' end,
        auction_id = excluded.auction_id;

  v_commission := public.calculate_lead_commission_cents(round(v_b.price_eur * 100)::integer);
  v_invoice := public.kw_create_market_invoice(
    v_b.dealer_id, 'lead_commission', v_commission,
    'Vermittlungsprovision Küchenprojekt (Auftragswert ' || round(v_b.price_eur)::text || ' EUR brutto)',
    p_lead_id, v_a.id
  );

  perform public.kw_enqueue('offer_accepted', jsonb_build_object(
    'auction_id', v_a.id, 'lead_id', p_lead_id, 'bid_id', v_b.id,
    'dealer_id', v_b.dealer_id, 'invoice_id', v_invoice));

  return jsonb_build_object('ok', true, 'auction_id', v_a.id, 'bid_id', v_b.id);
end;
$$;
revoke execute on function public.kw_project_accept_offer(uuid, uuid) from public, anon, authenticated;
grant execute on function public.kw_project_accept_offer(uuid, uuid) to service_role;

create or replace function public.kw_project_cancel(p_lead_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_a public.lead_auctions%rowtype;
begin
  select * into v_a from public.lead_auctions
  where lead_id = p_lead_id and status in ('draft', 'active', 'completed')
  for update;
  if v_a.id is null then
    raise exception 'Keine offene Ausschreibung vorhanden.' using errcode = 'P0002';
  end if;
  update public.lead_auctions
  set status = 'cancelled', cancelled_reason = left(p_reason, 500), decided_at = now()
  where id = v_a.id;
  update public.lead_bids set status = 'declined' where auction_id = v_a.id and status = 'active';
  update public.leads set status = 'closed_lost' where id = p_lead_id;
  perform public.kw_enqueue('project_cancelled', jsonb_build_object('auction_id', v_a.id, 'lead_id', p_lead_id));
  return jsonb_build_object('ok', true);
end;
$$;
revoke execute on function public.kw_project_cancel(uuid, text) from public, anon, authenticated;
grant execute on function public.kw_project_cancel(uuid, text) to service_role;


-- ----------------------------------------------------------------------------
-- P) Medienzugriff fuer Studios (Storage-Policy auf planner-media)
-- ----------------------------------------------------------------------------
create or replace function public.kw_can_view_planner_media(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: prueft Ausschreibungsstatus, den der Studio-Account nicht lesen darf.
  select
    public.has_role(auth.uid(), 'admin'::app_role)
    or (
      public.kw_is_active_dealer(auth.uid())
      and exists (
        select 1
        from public.lead_auctions a
        where a.planner_session_id::text = split_part(p_object_name, '/', 1)
          and (
            a.status in ('active', 'completed')
            or exists (select 1 from public.lead_bids b
                       where b.auction_id = a.id and b.dealer_id = auth.uid())
            or exists (select 1 from public.lead_match_candidates mc
                       where mc.lead_id = a.lead_id and mc.dealer_id = auth.uid() and mc.is_purchased)
          )
      )
    );
$$;
revoke execute on function public.kw_can_view_planner_media(text) from public, anon;
grant execute on function public.kw_can_view_planner_media(text) to authenticated, service_role;

drop policy if exists "PlannerMedia: dealer and admin read" on storage.objects;
create policy "PlannerMedia: dealer and admin read"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'planner-media' and public.kw_can_view_planner_media(name));


-- ----------------------------------------------------------------------------
-- Q) Zeitgesteuerter Lebenszyklus
-- ----------------------------------------------------------------------------
create or replace function public.kw_marketplace_tick()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_ended integer := 0;
  v_expired integer := 0;
  r record;
begin
  for r in
    update public.lead_auctions
    set status = 'completed'
    where status = 'active' and ends_at <= now()
    returning id, lead_id
  loop
    v_ended := v_ended + 1;
    perform public.kw_enqueue('tender_ended', jsonb_build_object('auction_id', r.id, 'lead_id', r.lead_id));
  end loop;

  for r in
    update public.lead_auctions
    set status = 'expired'
    where status = 'completed' and decision_deadline_at is not null and decision_deadline_at <= now()
    returning id, lead_id
  loop
    v_expired := v_expired + 1;
    update public.lead_bids set status = 'declined' where auction_id = r.id and status = 'active';
  end loop;

  delete from public.kw_outbox where processed_at < now() - interval '90 days';
  delete from public.planner_rate_limits where window_start < now() - interval '2 days';

  return jsonb_build_object('ended', v_ended, 'expired', v_expired);
end;
$$;
revoke execute on function public.kw_marketplace_tick() from public, anon, authenticated;
grant execute on function public.kw_marketplace_tick() to service_role;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('kw-marketplace-tick', 'kw-market-worker');
end $$;

select cron.schedule('kw-marketplace-tick', '*/5 * * * *', $cron$select public.kw_marketplace_tick();$cron$);

select cron.schedule('kw-market-worker', '* * * * *', $cron$
  select net.http_post(
    url := 'https://gzqayoalwtmypndrmqes.supabase.co/functions/v1/kw-market-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-kw-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'kw_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  )
  where exists (select 1 from public.kw_outbox where processed_at is null and available_at <= now() and attempts < 8)
    and exists (select 1 from vault.decrypted_secrets where name = 'kw_cron_secret');
$cron$);
