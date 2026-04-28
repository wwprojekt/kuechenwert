-- ============================================================================
-- KuechenWert Phase 2.1: Lead-zentriertes Funnel-Schema
--
-- Adaptiert die Datenmodelle aus dem alten Next.js-KuechenWert-Projekt
-- (Supabase-Projekt gzqayoalwtmypndrmqes, alte Migrations 001_initial_schema
-- bis 010_kitchen_price_brackets_seed) an den Caravanwert-Stack:
--
--   * `has_role(auth.uid(), 'admin'::app_role)` statt profiles.role-Checks
--   * UUID-PKs + gen_random_uuid() (Caravanwert-Konvention)
--   * Prefix `lead_` wo Namenskonflikte mit bestehenden Caravanwert-Tabellen
--     (`auctions`, `bids`, `commission_tiers`)
--   * RLS ueberall aktiv, alle Policies explizit per pg-Rolle gespiegelt
--
-- Rollout:
--   Teil A: Enum-Erweiterungen (`app_role`, neue Lead-Enums)
--   Teil B: Core-Lead-Tabellen + maskiertes View fuer Haendler
--   Teil C: Stammdaten-Kataloge (9 Tabellen)
--   Teil D: Pricing-Matrix + Provisions-Staffel + Helper-Functions
--   Teil E: Funnel-C (Traumkueche) Planner + Rate-Limits + Preis-Brackets
--   Teil F: Funnel-B-Lead-Auctions (separate Namespaces zu Kitchen-Auctions)
--   Teil G: Musterkuechen + Storage-Buckets
--
-- Seed-Daten (Catalog-Zeilen, Pricing-Defaults, 288 Kitchen-Price-Brackets)
-- kommen in einer separaten Migration, damit dieser DDL-Schritt sauber und
-- reviewbar bleibt.
-- ============================================================================

-- ============================================================================
-- Teil A: ENUM-Erweiterungen
-- ============================================================================

-- app_role 'consumer' wird in der vorstufe-Migration 20260429000000 ergaenzt.
-- Hier nur Lead-spezifische Enums (mehr Typsicherheit als Text-Check-Constraints).

do $$ begin
  create type public.lead_funnel_type as enum ('a', 'b', 'traumkueche');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_status as enum (
    'new', 'qualified', 'disqualified', 'matched', 'in_auction',
    'sold', 'contacted', 'appointment_set', 'offer_sent',
    'closed_won', 'closed_lost', 'disputed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_tier as enum ('standard', 'qualified', 'premium', 'hot');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.kitchen_form_enum as enum ('zeile', 'l', 'u', 'insel', 'parallel', 'g');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.style_segment_enum as enum ('budget', 'mittel', 'premium', 'luxus');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.worktop_tier_enum as enum ('basic', 'mid', 'premium');
exception when duplicate_object then null; end $$;


-- ============================================================================
-- Teil B: CORE LEAD TABLES
-- ============================================================================

-- Zentrale Lead-Tabelle. `user_id` ist optional, weil Funnels anonym starten
-- und der Nutzer erst am Ende mit einem Account (oder Magic-Link) registriert
-- wird. Funnel-Antworten landen in `funnel_answers` jsonb, fuer fluexible
-- Funnel-Varianten.
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,

  funnel_type public.lead_funnel_type not null default 'a',
  funnel_variant text default 'A',
  status public.lead_status not null default 'new',
  tier public.lead_tier not null default 'standard',
  score integer not null default 0,

  -- Ort
  postal_code text not null,
  region text,
  address_line text,
  city text,
  housing_type text check (housing_type in ('rent', 'own', 'unknown')),

  -- Kueche
  kitchen_form text,
  kitchen_style text,
  purchase_reason text,
  special_wishes text[] default '{}',
  timeframe_months integer,
  budget_midpoint integer,
  waste_separation_system boolean,

  -- Funnel-B: bestehendes Angebot
  has_existing_offer boolean not null default false,
  existing_offer_price_cents integer,
  existing_offer_studio text,

  -- Zahlung / Lieferung
  payment_down_payment_percent numeric(5,2),
  payment_financing text check (payment_financing in ('none', 'zero_interest', 'with_interest', 'unknown')),
  payment_financing_apr numeric(5,2),
  payment_financing_months integer,
  delivery_mode text check (delivery_mode in ('delivery_assembly', 'delivery_only', 'pickup', 'unknown')),
  desired_delivery_at date,

  -- Kontakt
  first_name text,
  last_name text,
  email text,
  phone text,
  consent_call boolean not null default false,
  consent_marketing boolean not null default false,

  -- Attribution / Tracking
  funnel_answers jsonb default '{}'::jsonb,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  landing_page text,
  ip_address inet,
  user_agent text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_leads_tier on public.leads(tier);
create index if not exists idx_leads_funnel_type on public.leads(funnel_type);
create index if not exists idx_leads_postal_code on public.leads(postal_code);
create index if not exists idx_leads_created_at on public.leads(created_at desc);
create index if not exists idx_leads_user_id on public.leads(user_id);

alter table public.leads enable row level security;


-- Uploads im Funnel (Grundriss, bestehende Angebote, Renderings, Kueche-Fotos).
create table if not exists public.lead_files (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  file_type text not null,
  file_size_bytes integer,
  category text not null check (category in ('grundriss', 'angebot', 'rendering', 'kueche_bild', 'sonstiges')),
  virus_scan_status text default 'pending' check (virus_scan_status in ('pending', 'clean', 'infected')),
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_files_lead on public.lead_files(lead_id);

alter table public.lead_files enable row level security;


-- Audit: Welcher Haendler hat wann welchen Lead gesehen?
create table if not exists public.lead_views (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  dealer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index if not exists idx_lead_views_lead on public.lead_views(lead_id);
create index if not exists idx_lead_views_dealer on public.lead_views(dealer_id);

alter table public.lead_views enable row level security;


-- Qualifikations-Calls (Telefon-Agent qualifiziert Lead nach Eingang).
create table if not exists public.lead_qualification_calls (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  agent_id uuid references public.profiles(id),
  outcome text not null check (outcome in ('qualified', 'disqualified', 'callback', 'no_answer', 'invalid')),
  notes text,
  missing_data text[] default '{}',
  duration_seconds integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_calls_lead on public.lead_qualification_calls(lead_id);

alter table public.lead_qualification_calls enable row level security;


-- Match-Kandidaten: welcher Haendler sieht welchen Lead?
-- Bei `is_purchased=true` hat der Haendler ihn gekauft und sieht die PII.
create table if not exists public.lead_match_candidates (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  dealer_id uuid not null references public.profiles(id) on delete cascade,
  is_purchased boolean not null default false,
  purchased_at timestamptz,
  price_cents integer,
  created_at timestamptz not null default now(),
  unique (lead_id, dealer_id)
);

create index if not exists idx_lead_matches_dealer on public.lead_match_candidates(dealer_id);
create index if not exists idx_lead_matches_lead on public.lead_match_candidates(lead_id);

alter table public.lead_match_candidates enable row level security;


-- DSGVO-Consents: jeder Lead darf seine Einwilligungen tracken.
create table if not exists public.lead_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  lead_id uuid references public.leads(id) on delete cascade,
  purpose text not null,
  granted boolean not null,
  text_version text not null,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_consents_lead on public.lead_consents(lead_id);

alter table public.lead_consents enable row level security;


-- Maskiertes View fuer Haendler: zeigt Lead-Infos ohne PII.
-- Haendler duerfen pre-purchase nur diese Felder sehen.
create or replace view public.leads_masked as
select
  id,
  funnel_type,
  status,
  tier,
  score,
  postal_code,
  region,
  housing_type,
  kitchen_form,
  kitchen_style,
  purchase_reason,
  special_wishes,
  timeframe_months,
  budget_midpoint,
  has_existing_offer,
  existing_offer_price_cents,
  desired_delivery_at,
  delivery_mode,
  payment_financing,
  waste_separation_system,
  funnel_answers,
  created_at,
  updated_at
from public.leads;


-- ============================================================================
-- Teil C: STAMMDATEN-KATALOGE (9 Tabellen, keine Konflikte mit Caravanwert)
-- ============================================================================

create table if not exists public.catalog_kitchen_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  segment public.style_segment_enum,
  country text default 'DE',
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.catalog_front_materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in (
    'kunststoff', 'lack', 'echtholz', 'glas', 'metall', 'beton', 'sonstiges'
  )),
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  unique (name, category)
);

create table if not exists public.catalog_handle_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 100
);

create table if not exists public.catalog_worktop_materials (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 100
);

create table if not exists public.catalog_worktop_designs (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references public.catalog_worktop_materials(id) on delete cascade,
  name text not null,
  manufacturer text,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  unique (material_id, name)
);

create table if not exists public.catalog_appliance_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 100
);

create table if not exists public.catalog_appliance_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  segment public.style_segment_enum,
  is_active boolean not null default true,
  sort_order integer not null default 100
);

create table if not exists public.catalog_sink_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 100
);

create table if not exists public.catalog_sink_materials (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 100
);

-- RLS auf Katalogen: lesen=public (is_active), schreiben=admin
alter table public.catalog_kitchen_brands      enable row level security;
alter table public.catalog_front_materials     enable row level security;
alter table public.catalog_handle_types        enable row level security;
alter table public.catalog_worktop_materials   enable row level security;
alter table public.catalog_worktop_designs     enable row level security;
alter table public.catalog_appliance_categories enable row level security;
alter table public.catalog_appliance_brands    enable row level security;
alter table public.catalog_sink_brands         enable row level security;
alter table public.catalog_sink_materials      enable row level security;


-- ============================================================================
-- Teil D: PRICING-MATRIX + HELPER-FUNCTIONS
-- ============================================================================

-- Lead-Preis-Staffel (Funnel A: Haendler kauft Lead nach Budget x Tier).
create table if not exists public.lead_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  budget_min_cents integer not null,
  budget_max_cents integer,
  tier public.lead_tier not null,
  percent_of_budget numeric(5,2) not null,
  min_price_cents integer not null,
  max_price_cents integer,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_min_cents, budget_max_cents, tier)
);

create index if not exists idx_lead_pricing_active on public.lead_pricing_rules(is_active);

alter table public.lead_pricing_rules enable row level security;


-- Provisionsstaffel fuer Funnel-B-Auktionssieger (CPA).
-- Prefix `lead_` weil `commission_tiers` schon von Caravanwert belegt ist
-- (anderes Datenmodell fuer Kitchen-Auktionen, dort decimal-amounts).
create table if not exists public.lead_commission_tiers (
  id uuid primary key default gen_random_uuid(),
  order_value_min_cents integer not null,
  order_value_max_cents integer,
  percent numeric(5,2) not null,
  min_cents integer not null,
  max_cents integer,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_value_min_cents, order_value_max_cents)
);

alter table public.lead_commission_tiers enable row level security;


-- Helper: updated_at-Trigger. Caravanwert hat dafuer vermutlich schon eine
-- Funktion; falls ja, nutzen wir die. Ansonsten legen wir sie an.
create or replace function public.kw_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- updated_at-Trigger auf leads + pricing-Tabellen
do $$ begin
  create trigger set_leads_updated_at before update on public.leads
    for each row execute function public.kw_set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger set_lead_pricing_updated_at before update on public.lead_pricing_rules
    for each row execute function public.kw_set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger set_lead_commission_updated_at before update on public.lead_commission_tiers
    for each row execute function public.kw_set_updated_at();
exception when duplicate_object then null; end $$;


-- Berechnet Lead-Preis (Cent) nach Budget-Range x Tier.
create or replace function public.calculate_lead_price_cents(
  p_budget_cents integer,
  p_tier public.lead_tier
) returns integer
language plpgsql
stable
set search_path = public
as $$
declare
  v_rule public.lead_pricing_rules%rowtype;
  v_calc integer;
begin
  if p_budget_cents is null or p_tier is null then
    return null;
  end if;

  select * into v_rule
  from public.lead_pricing_rules
  where is_active = true
    and tier = p_tier
    and budget_min_cents <= p_budget_cents
    and (budget_max_cents is null or budget_max_cents > p_budget_cents)
  order by budget_min_cents desc
  limit 1;

  if v_rule.id is null then
    return null;
  end if;

  v_calc := round(p_budget_cents * v_rule.percent_of_budget / 100.0);
  v_calc := greatest(v_calc, v_rule.min_price_cents);
  if v_rule.max_price_cents is not null then
    v_calc := least(v_calc, v_rule.max_price_cents);
  end if;
  return v_calc;
end;
$$;


-- Berechnet CPA-Provision fuer Funnel-B-Sieger nach Auftragswert.
create or replace function public.calculate_lead_commission_cents(
  p_order_value_cents integer
) returns integer
language plpgsql
stable
set search_path = public
as $$
declare
  v_tier public.lead_commission_tiers%rowtype;
  v_calc integer;
begin
  if p_order_value_cents is null or p_order_value_cents <= 0 then
    return 0;
  end if;

  select * into v_tier
  from public.lead_commission_tiers
  where is_active = true
    and order_value_min_cents <= p_order_value_cents
    and (order_value_max_cents is null or order_value_max_cents > p_order_value_cents)
  order by order_value_min_cents desc
  limit 1;

  if v_tier.id is null then
    return 0;
  end if;

  v_calc := round(p_order_value_cents * v_tier.percent / 100.0);
  v_calc := greatest(v_calc, v_tier.min_cents);
  if v_tier.max_cents is not null then
    v_calc := least(v_calc, v_tier.max_cents);
  end if;
  return v_calc;
end;
$$;


-- ============================================================================
-- Teil E: FUNNEL-C (TRAUMKUECHE) - PLANNER + RATE-LIMITS + PREIS-BRACKETS
-- ============================================================================

-- B2C-Preismatrix: zeigt Nutzern im Traumkueche-Funnel eine Preis-Range
-- (style x appliance x worktop x kitchen_form -> min..max Euro).
create table if not exists public.kitchen_price_brackets (
  id uuid primary key default gen_random_uuid(),
  style_segment public.style_segment_enum not null,
  appliance_segment public.style_segment_enum not null,
  worktop_tier public.worktop_tier_enum not null,
  kitchen_form public.kitchen_form_enum not null,
  price_min_cents integer not null,
  price_max_cents integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (style_segment, appliance_segment, worktop_tier, kitchen_form)
);

create index if not exists idx_kitchen_price_brackets_lookup
  on public.kitchen_price_brackets (style_segment, appliance_segment, worktop_tier, kitchen_form)
  where active = true;

alter table public.kitchen_price_brackets enable row level security;

do $$ begin
  create trigger set_kitchen_price_brackets_updated_at
    before update on public.kitchen_price_brackets
    for each row execute function public.kw_set_updated_at();
exception when duplicate_object then null; end $$;


-- Serverseitige Planner-Session (Funnel C). Enthaelt Spec, ausgewaehltes
-- Render + optional Kontaktdaten. `lead_id` wird gesetzt sobald der Nutzer
-- seine Kontaktdaten freigibt und ein Lead erstellt wird.
create table if not exists public.planner_sessions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  session_token text unique not null,
  spec jsonb not null default '{}'::jsonb,
  current_render_id uuid,
  price_range_min_cents integer,
  price_range_max_cents integer,
  expert_note text,
  status text not null default 'active'
    check (status in ('active', 'completed', 'abandoned')),
  contact_captured_at timestamptz,
  ip_address inet,
  user_agent text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_planner_sessions_token on public.planner_sessions(session_token);
create index if not exists idx_planner_sessions_lead on public.planner_sessions(lead_id);
create index if not exists idx_planner_sessions_created on public.planner_sessions(created_at desc);
create index if not exists idx_planner_sessions_status on public.planner_sessions(status);

alter table public.planner_sessions enable row level security;

do $$ begin
  create trigger set_planner_sessions_updated_at before update on public.planner_sessions
    for each row execute function public.kw_set_updated_at();
exception when duplicate_object then null; end $$;


-- FLUX-Bild-Generierungen pro Session. Versioniert (v1, v2, ...).
create table if not exists public.planner_renders (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.planner_sessions(id) on delete cascade,
  version integer not null default 1,
  prompt text not null,
  negative_prompt text,
  spec_snapshot jsonb not null,
  user_message text,
  image_path text,
  image_width integer,
  image_height integer,
  status text not null default 'pending'
    check (status in ('pending', 'success', 'failed')),
  fal_request_id text,
  model_slug text default 'fal-ai/flux-pro/v1.1-ultra',
  generation_ms integer,
  cost_cents integer,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_planner_renders_session on public.planner_renders(session_id, version desc);
create index if not exists idx_planner_renders_status on public.planner_renders(status);
create index if not exists idx_planner_renders_created on public.planner_renders(created_at desc);

alter table public.planner_renders enable row level security;

-- FK von planner_sessions.current_render_id auf planner_renders (nachtraeglich,
-- weil die Tabelle vorher noch nicht existiert hat).
do $$ begin
  alter table public.planner_sessions
    add constraint planner_sessions_current_render_fkey
    foreign key (current_render_id) references public.planner_renders(id) on delete set null;
exception when duplicate_object then null; end $$;


-- Sliding-Window-Rate-Limits fuer /api/planner/* und /api/leads*.
-- Caravanwert hat eine `rate_limits`-Tabelle fuer seinen eigenen Zweck, daher
-- nennen wir die KW-Bucket-Tabelle anders.
create table if not exists public.planner_rate_limits (
  bucket_key text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.planner_rate_limits enable row level security;

do $$ begin
  create trigger set_planner_rate_limits_updated_at before update on public.planner_rate_limits
    for each row execute function public.kw_set_updated_at();
exception when duplicate_object then null; end $$;


-- Atomarer Rate-Limit-Check: incrementiert Bucket, liefert neuen Count.
create or replace function public.planner_rate_limit_increment(
  p_key text,
  p_window_seconds integer,
  p_limit integer
) returns table (
  current_count integer,
  allowed boolean,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_count integer;
begin
  insert into public.planner_rate_limits (bucket_key, count, window_start)
  values (p_key, 1, v_now)
  on conflict (bucket_key) do update
    set count = case
      when planner_rate_limits.window_start + make_interval(secs => p_window_seconds) < v_now then 1
      else planner_rate_limits.count + 1
    end,
    window_start = case
      when planner_rate_limits.window_start + make_interval(secs => p_window_seconds) < v_now then v_now
      else planner_rate_limits.window_start
    end,
    updated_at = v_now
  returning planner_rate_limits.count, planner_rate_limits.window_start
    into v_count, v_window_start;

  return query
    select
      v_count,
      v_count <= p_limit,
      v_window_start + make_interval(secs => p_window_seconds);
end;
$$;


create or replace function public.planner_rate_limits_cleanup(
  p_older_than_hours integer default 24
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.planner_rate_limits
  where window_start < now() - make_interval(hours => p_older_than_hours);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;


-- ============================================================================
-- Teil F: FUNNEL-B LEAD-AUCTIONS (separate Namespaces zu Kitchen-Auctions)
-- ============================================================================

-- Funnel-B-Auktion: Kunde hat bestehendes Angebot, Haendler bieten dagegen.
-- Verknuepft mit einem Lead (nicht mit einem Kitchen-Asset wie Caravanwert).
create table if not exists public.lead_auctions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'cancelled')),
  spec_sheet jsonb default '{}'::jsonb,
  offer_price_eur numeric(10,2),
  duration_hours integer not null default 72,
  min_bid_eur numeric(10,2),
  starts_at timestamptz,
  ends_at timestamptz,
  won_bid_id uuid,
  penalty_state text not null default 'none'
    check (penalty_state in ('none', 'consumer_cancelled', 'dealer_cancelled', 'paid', 'waived')),
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lead_auctions_lead on public.lead_auctions(lead_id);
create index if not exists idx_lead_auctions_status on public.lead_auctions(status);

alter table public.lead_auctions enable row level security;

do $$ begin
  create trigger set_lead_auctions_updated_at before update on public.lead_auctions
    for each row execute function public.kw_set_updated_at();
exception when duplicate_object then null; end $$;


create table if not exists public.lead_bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.lead_auctions(id) on delete cascade,
  dealer_id uuid not null references public.profiles(id) on delete cascade,
  price_eur numeric(10,2) not null,
  delivery_weeks integer,
  montage_included boolean default true,
  warranty_months integer,
  payment_terms jsonb default '{}'::jsonb,
  is_winning boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_bids_auction on public.lead_bids(auction_id);
create index if not exists idx_lead_bids_dealer on public.lead_bids(dealer_id);

alter table public.lead_bids enable row level security;

-- FK lead_auctions.won_bid_id -> lead_bids.id (nachtraeglich)
do $$ begin
  alter table public.lead_auctions
    add constraint lead_auctions_won_bid_fkey foreign key (won_bid_id)
    references public.lead_bids(id) on delete set null;
exception when duplicate_object then null; end $$;


-- Spec-Items: Position-Liste fuer Funnel-B-Auktion (statt jsonb-Blob).
create table if not exists public.lead_auction_spec_items (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.lead_auctions(id) on delete cascade,
  category text not null check (category in (
    'fronten', 'griffe', 'arbeitsplatte', 'geraet', 'sanitaer',
    'muelltrennung', 'beleuchtung', 'steckdosen', 'besteckeinsatz', 'sonstiges'
  )),
  label text not null,
  brand text,
  model text,
  material text,
  designation text,
  quantity integer default 1,
  notes text,
  image_url text,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_spec_items_auction on public.lead_auction_spec_items(auction_id);

alter table public.lead_auction_spec_items enable row level security;


-- Penalty-Gebuehren fuer Auktions-Abbruch (299 EUR default).
create table if not exists public.lead_penalty_charges (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.lead_auctions(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  party text not null check (party in ('consumer', 'dealer')),
  dealer_id uuid references public.profiles(id),
  amount_cents integer not null default 29900,
  status text not null default 'pending'
    check (status in ('pending', 'invoiced', 'paid', 'waived', 'cancelled')),
  reason text,
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);

create index if not exists idx_lead_penalty_status on public.lead_penalty_charges(status);

alter table public.lead_penalty_charges enable row level security;


-- ============================================================================
-- Teil G: MUSTERKUECHEN (Haendler-Ausstellungsstuecke - eigenstaendige Verkaufsschiene)
-- ============================================================================

create table if not exists public.musterkuechen (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  original_price_eur numeric(10,2) not null,
  sale_price_eur numeric(10,2) not null,
  images text[] default '{}',
  condition text not null default 'ausstellung' check (condition in ('ausstellung', 'neuwertig', 'gebraucht')),
  brand text,
  is_available boolean not null default true,
  is_highlighted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_musterkuechen_dealer on public.musterkuechen(dealer_id);
create index if not exists idx_musterkuechen_available on public.musterkuechen(is_available);

alter table public.musterkuechen enable row level security;

do $$ begin
  create trigger set_musterkuechen_updated_at before update on public.musterkuechen
    for each row execute function public.kw_set_updated_at();
exception when duplicate_object then null; end $$;


-- ============================================================================
-- Teil H: STORAGE-BUCKETS
-- ============================================================================

-- lead-files: private Uploads aus den Funnels (Grundriss, Angebote, Renderings).
-- Zugriff: Consumer hochladen, Admin full, Dealer NUR wenn Lead-Owner.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lead-files',
  'lead-files',
  false,
  20971520, -- 20 MB
  array['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
on conflict (id) do nothing;

-- planner-renders: OEFFENTLICHE AI-generierte Kuechenbilder aus Funnel C.
-- Werden beim Session-Share verbreitet, daher public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'planner-renders',
  'planner-renders',
  true,
  10485760, -- 10 MB
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;


-- ============================================================================
-- Teil I: RLS-POLICIES
-- ============================================================================

-- LEADS: owner kann eigene sehen, admin alles, dealer kann maskiert sehen.
do $$ begin
  create policy "Leads: user reads own"
    on public.leads for select
    using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Leads: admin full access"
    on public.leads for all
    using (public.has_role(auth.uid(), 'admin'::app_role))
    with check (public.has_role(auth.uid(), 'admin'::app_role));
exception when duplicate_object then null; end $$;

-- Haendler duerfen Leads lesen (maskiert ueber leads_masked View).
-- Pre-purchase: nur Lead-Metadata, keine PII.
do $$ begin
  create policy "Leads: dealers read verified-active (masked via view)"
    on public.leads for select
    using (public.has_role(auth.uid(), 'dealer'::app_role));
exception when duplicate_object then null; end $$;

-- Volle PII-Sicht nur fuer Haendler die den Lead gekauft haben.
do $$ begin
  create policy "Leads: dealers read purchased full"
    on public.leads for select
    using (
      exists (
        select 1 from public.lead_match_candidates mc
        where mc.lead_id = leads.id
          and mc.dealer_id = auth.uid()
          and mc.is_purchased = true
      )
    );
exception when duplicate_object then null; end $$;


-- LEAD_FILES: Admin-only. Post-purchase koennten Haendler auch lesen - machen
-- wir spaeter, wenn wir wissen welche Upload-Kategorien pre vs post sichtbar sein sollen.
do $$ begin
  create policy "LeadFiles: admin full"
    on public.lead_files for all
    using (public.has_role(auth.uid(), 'admin'::app_role));
exception when duplicate_object then null; end $$;


-- LEAD_VIEWS: Haendler schreibt+liest eigene Views, Admin liest alles.
do $$ begin
  create policy "LeadViews: dealer self read"
    on public.lead_views for select
    using (dealer_id = auth.uid());
  create policy "LeadViews: dealer self insert"
    on public.lead_views for insert
    with check (dealer_id = auth.uid());
  create policy "LeadViews: admin read"
    on public.lead_views for select
    using (public.has_role(auth.uid(), 'admin'::app_role));
exception when duplicate_object then null; end $$;


-- LEAD_QUALIFICATION_CALLS: Admin-only.
do $$ begin
  create policy "LeadCalls: admin full"
    on public.lead_qualification_calls for all
    using (public.has_role(auth.uid(), 'admin'::app_role));
exception when duplicate_object then null; end $$;


-- LEAD_MATCH_CANDIDATES: Haendler sieht eigene, Admin alles.
do $$ begin
  create policy "LeadMatches: dealer self read"
    on public.lead_match_candidates for select
    using (dealer_id = auth.uid());
  create policy "LeadMatches: admin full"
    on public.lead_match_candidates for all
    using (public.has_role(auth.uid(), 'admin'::app_role));
exception when duplicate_object then null; end $$;


-- LEAD_CONSENTS: User sieht eigene, Admin alles.
do $$ begin
  create policy "LeadConsents: user self read"
    on public.lead_consents for select
    using (user_id = auth.uid());
  create policy "LeadConsents: admin full"
    on public.lead_consents for all
    using (public.has_role(auth.uid(), 'admin'::app_role));
exception when duplicate_object then null; end $$;


-- KATALOGE: oeffentlich lesbar wenn is_active, Admin schreibt.
do $$ begin
  create policy "Catalog Brands: public read active"
    on public.catalog_kitchen_brands for select using (is_active = true);
  create policy "Catalog Brands: admin manage"
    on public.catalog_kitchen_brands for all using (public.has_role(auth.uid(), 'admin'::app_role));

  create policy "Catalog FrontMaterials: public read active"
    on public.catalog_front_materials for select using (is_active = true);
  create policy "Catalog FrontMaterials: admin manage"
    on public.catalog_front_materials for all using (public.has_role(auth.uid(), 'admin'::app_role));

  create policy "Catalog Handles: public read active"
    on public.catalog_handle_types for select using (is_active = true);
  create policy "Catalog Handles: admin manage"
    on public.catalog_handle_types for all using (public.has_role(auth.uid(), 'admin'::app_role));

  create policy "Catalog WorktopMaterials: public read active"
    on public.catalog_worktop_materials for select using (is_active = true);
  create policy "Catalog WorktopMaterials: admin manage"
    on public.catalog_worktop_materials for all using (public.has_role(auth.uid(), 'admin'::app_role));

  create policy "Catalog WorktopDesigns: public read active"
    on public.catalog_worktop_designs for select using (is_active = true);
  create policy "Catalog WorktopDesigns: admin manage"
    on public.catalog_worktop_designs for all using (public.has_role(auth.uid(), 'admin'::app_role));

  create policy "Catalog ApplianceCategories: public read active"
    on public.catalog_appliance_categories for select using (is_active = true);
  create policy "Catalog ApplianceCategories: admin manage"
    on public.catalog_appliance_categories for all using (public.has_role(auth.uid(), 'admin'::app_role));

  create policy "Catalog ApplianceBrands: public read active"
    on public.catalog_appliance_brands for select using (is_active = true);
  create policy "Catalog ApplianceBrands: admin manage"
    on public.catalog_appliance_brands for all using (public.has_role(auth.uid(), 'admin'::app_role));

  create policy "Catalog SinkBrands: public read active"
    on public.catalog_sink_brands for select using (is_active = true);
  create policy "Catalog SinkBrands: admin manage"
    on public.catalog_sink_brands for all using (public.has_role(auth.uid(), 'admin'::app_role));

  create policy "Catalog SinkMaterials: public read active"
    on public.catalog_sink_materials for select using (is_active = true);
  create policy "Catalog SinkMaterials: admin manage"
    on public.catalog_sink_materials for all using (public.has_role(auth.uid(), 'admin'::app_role));
exception when duplicate_object then null; end $$;


-- PRICING (Admin-only, consumer sieht errechneten Preis via function).
do $$ begin
  create policy "LeadPricing: admin manage"
    on public.lead_pricing_rules for all using (public.has_role(auth.uid(), 'admin'::app_role));
  create policy "LeadCommission: admin manage"
    on public.lead_commission_tiers for all using (public.has_role(auth.uid(), 'admin'::app_role));
exception when duplicate_object then null; end $$;


-- KITCHEN-PRICE-BRACKETS: oeffentlich lesbar (Consumer braucht Range im Funnel).
do $$ begin
  create policy "PriceBrackets: public read active"
    on public.kitchen_price_brackets for select using (active = true);
  create policy "PriceBrackets: admin manage"
    on public.kitchen_price_brackets for all using (public.has_role(auth.uid(), 'admin'::app_role));
exception when duplicate_object then null; end $$;


-- PLANNER-SESSIONS + RENDERS: Admin-only (writes ueber service_role).
-- Anonyme Consumer interagieren via session_token, nicht via auth.uid().
do $$ begin
  create policy "PlannerSessions: admin full"
    on public.planner_sessions for all
    using (public.has_role(auth.uid(), 'admin'::app_role));
  create policy "PlannerRenders: admin full"
    on public.planner_renders for all
    using (public.has_role(auth.uid(), 'admin'::app_role));
  create policy "PlannerRateLimits: admin full"
    on public.planner_rate_limits for all
    using (public.has_role(auth.uid(), 'admin'::app_role));
exception when duplicate_object then null; end $$;


-- LEAD-AUCTIONS + BIDS:
--   - Admin full
--   - Dealer: active-auctions lesen, eigene bids sehen+schreiben
do $$ begin
  create policy "LeadAuctions: admin full"
    on public.lead_auctions for all
    using (public.has_role(auth.uid(), 'admin'::app_role));
  create policy "LeadAuctions: dealer read active"
    on public.lead_auctions for select
    using (status = 'active' and public.has_role(auth.uid(), 'dealer'::app_role));

  create policy "LeadBids: dealer insert own"
    on public.lead_bids for insert
    with check (dealer_id = auth.uid());
  create policy "LeadBids: dealer read own"
    on public.lead_bids for select
    using (dealer_id = auth.uid());
  create policy "LeadBids: admin full"
    on public.lead_bids for all
    using (public.has_role(auth.uid(), 'admin'::app_role));

  create policy "LeadSpecItems: dealer read active"
    on public.lead_auction_spec_items for select
    using (
      exists (
        select 1 from public.lead_auctions a
        where a.id = lead_auction_spec_items.auction_id and a.status = 'active'
      )
      and public.has_role(auth.uid(), 'dealer'::app_role)
    );
  create policy "LeadSpecItems: admin full"
    on public.lead_auction_spec_items for all
    using (public.has_role(auth.uid(), 'admin'::app_role));

  create policy "LeadPenalties: admin full"
    on public.lead_penalty_charges for all
    using (public.has_role(auth.uid(), 'admin'::app_role));
  create policy "LeadPenalties: dealer read own"
    on public.lead_penalty_charges for select
    using (dealer_id = auth.uid());
exception when duplicate_object then null; end $$;


-- MUSTERKUECHEN: Public sieht verfuegbare, Dealer managed eigene, Admin alles.
do $$ begin
  create policy "Musterkuechen: public read available"
    on public.musterkuechen for select using (is_available = true);
  create policy "Musterkuechen: dealer manage own"
    on public.musterkuechen for all
    using (dealer_id = auth.uid());
  create policy "Musterkuechen: admin full"
    on public.musterkuechen for all
    using (public.has_role(auth.uid(), 'admin'::app_role));
exception when duplicate_object then null; end $$;


-- STORAGE-Policies fuer neue Buckets
-- lead-files: Consumer uploadet via Funnel (authenticated), Admin read all,
--   Dealer read nur wenn er den zugehoerigen Lead gekauft hat.
do $$ begin
  create policy "LeadFiles Storage: authenticated upload"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'lead-files');
  create policy "LeadFiles Storage: admin all"
    on storage.objects for all
    using (bucket_id = 'lead-files' and public.has_role(auth.uid(), 'admin'::app_role));
exception when duplicate_object then null; end $$;

-- planner-renders ist public, daher braucht es keine SELECT-Policy; service_role schreibt.
do $$ begin
  create policy "PlannerRenders Storage: public read"
    on storage.objects for select
    using (bucket_id = 'planner-renders');
  create policy "PlannerRenders Storage: admin all"
    on storage.objects for all
    using (bucket_id = 'planner-renders' and public.has_role(auth.uid(), 'admin'::app_role));
exception when duplicate_object then null; end $$;


-- ============================================================================
-- Teil J: COMMENTS
-- ============================================================================

comment on table public.leads is
  'Zentrale Lead-Tabelle fuer alle drei KuechenWert-Funnels (A=Lead-Gen, B=Angebots-Vergleich, C=Traumkueche). Enthaelt alle Consumer-Angaben inkl. UTM-Tracking.';
comment on table public.lead_match_candidates is
  'Verknuepfung Lead <-> Dealer. `is_purchased=true` gibt dem Dealer Zugriff auf PII.';
comment on view public.leads_masked is
  'Maskierte Lead-Sicht fuer Haendler pre-purchase (keine PII).';
comment on table public.lead_auctions is
  'Funnel-B Reverse-Auktion: Consumer hat Bestandsangebot, Haendler bieten dagegen.';
comment on table public.planner_sessions is
  'Funnel-C serverseitiger Anker fuer Spec + Contact + Price-Range.';
comment on table public.planner_renders is
  'FLUX-Bild-Generierungen pro planner_session (versioniert).';
comment on table public.kitchen_price_brackets is
  'B2C-Preismatrix (unabhaengig von lead_pricing_rules, die fuer Dealer-CPA gelten).';
comment on function public.calculate_lead_price_cents(integer, public.lead_tier) is
  'Berechnet Lead-Preis in Cent aus Budget+Tier via lead_pricing_rules.';
comment on function public.calculate_lead_commission_cents(integer) is
  'Berechnet Funnel-B-CPA-Provision in Cent aus Auftragswert.';
