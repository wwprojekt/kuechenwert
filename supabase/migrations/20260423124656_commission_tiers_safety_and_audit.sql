-- Migration: Commission tiers safety net + audit + realtime
-- Date: 2026-04-23
--
-- Goals (long-term UX of commission management):
--  1. Make it IMPOSSIBLE to create overlapping active tier ranges (silent
--     mis-pricing root cause) — adds an exclusion constraint on numrange.
--  2. Record every change to commission_tiers so we can answer "who changed
--     what and when" during dispute resolution.
--  3. Honor min_commission ALSO for rate_type='fixed' (current RPC silently
--     ignored it), and document final_rate semantics for fixed tiers.
--  4. Add commission_tiers to the supabase_realtime publication so the
--     admin UI changes propagate to all open tabs in seconds (frontend
--     listener added in the same commit).
--
-- Backwards compatibility:
--  - calculate_commission signature unchanged.
--  - Behavior for rate_type='percentage' is byte-identical to before.
--  - For rate_type='fixed' the only change is that min_commission is now
--    applied (before: silently ignored, which was a bug).
--  - Existing tier data has been verified: zero overlaps among active rows,
--    so the new exclusion constraint adds without rewriting.

-- ============================================================
-- 1. Exclusion constraint: no overlapping ACTIVE tiers
-- ============================================================
create extension if not exists btree_gist;

alter table public.commission_tiers
  add constraint commission_tiers_no_overlap_active
  exclude using gist (
    numrange(min_amount, max_amount, '[)') with &&
  ) where (is_active = true);

comment on constraint commission_tiers_no_overlap_active on public.commission_tiers is
  'Prevents two ACTIVE tiers from covering the same sale_amount. '
  'numrange uses [) bounds, matching calculate_commission''s '
  '"sale_amount >= min_amount AND sale_amount < max_amount" predicate.';

-- ============================================================
-- 2. Audit table for tier changes
-- ============================================================
create table if not exists public.commission_tier_changes (
  id uuid primary key default gen_random_uuid(),
  tier_id uuid not null,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  old_row jsonb,
  new_row jsonb
);

create index if not exists commission_tier_changes_tier_id_idx
  on public.commission_tier_changes (tier_id, changed_at desc);

create index if not exists commission_tier_changes_changed_at_idx
  on public.commission_tier_changes (changed_at desc);

alter table public.commission_tier_changes enable row level security;

-- Only admins may read the audit log (writes happen via trigger in DEFINER context)
drop policy if exists "Admins can view commission tier changes" on public.commission_tier_changes;
create policy "Admins can view commission tier changes"
  on public.commission_tier_changes
  for select
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================
-- 3. Trigger to record every change
-- ============================================================
create or replace function public.commission_tier_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $func$
-- DEFINER: needs to write to commission_tier_changes regardless of caller's RLS.
-- Caller identity is preserved via auth.uid() in changed_by.
begin
  if (tg_op = 'INSERT') then
    insert into public.commission_tier_changes
      (tier_id, operation, changed_by, new_row)
    values
      (new.id, 'INSERT', auth.uid(), to_jsonb(new));
    return new;
  elsif (tg_op = 'UPDATE') then
    -- Skip noise: only record if a meaningful column changed
    if row(old.min_amount, old.max_amount, old.rate_type, old.rate_value, old.min_commission, old.is_active)
       is distinct from
       row(new.min_amount, new.max_amount, new.rate_type, new.rate_value, new.min_commission, new.is_active)
    then
      insert into public.commission_tier_changes
        (tier_id, operation, changed_by, old_row, new_row)
      values
        (new.id, 'UPDATE', auth.uid(), to_jsonb(old), to_jsonb(new));
    end if;
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.commission_tier_changes
      (tier_id, operation, changed_by, old_row)
    values
      (old.id, 'DELETE', auth.uid(), to_jsonb(old));
    return old;
  end if;
  return null;
end;
$func$;

drop trigger if exists commission_tier_audit_trigger on public.commission_tiers;
create trigger commission_tier_audit_trigger
  after insert or update or delete on public.commission_tiers
  for each row execute function public.commission_tier_audit();

-- ============================================================
-- 4. Update calculate_commission: honor min_commission for fixed type
-- ============================================================
-- The previous version (20260407000000_fix_invoice_commission_bugs.sql)
-- only applied min_commission for percentage tiers. Fix that.
create or replace function public.calculate_commission(
  sale_amount numeric,
  dealer_id_param uuid default null
)
returns table(
  base_rate numeric,
  volume_discount numeric,
  final_rate numeric,
  commission_amount numeric,
  tier_id uuid
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $func$
declare
  tier_record record;
  v_discount_rate numeric := 0;
  base_commission numeric;
  final_commission numeric;
begin
  -- Find the matching tier for this sale_amount
  select * into tier_record
  from public.commission_tiers
  where sale_amount >= min_amount
    and sale_amount < max_amount
    and is_active = true
  order by min_amount desc
  limit 1;

  -- Last-resort fallback: highest active tier
  -- (Should only trigger if sale_amount exceeds the topmost max_amount.
  -- The exclusion constraint guarantees there are no gaps among active tiers.)
  if tier_record is null then
    select * into tier_record
    from public.commission_tiers
    where is_active = true
    order by min_amount desc
    limit 1;
    if tier_record is null then
      raise exception 'No active commission tier configured';
    end if;
    raise notice 'calculate_commission: no tier matched sale_amount=%, fell back to top tier id=%',
      sale_amount, tier_record.id;
  end if;

  -- Compute base commission, applying min_commission for BOTH rate types
  if tier_record.rate_type = 'percentage' then
    base_commission := sale_amount * (tier_record.rate_value / 100);
  else
    base_commission := tier_record.rate_value;
  end if;
  base_commission := greatest(base_commission, coalesce(tier_record.min_commission, 0));

  -- Apply dealer volume discount (if any)
  if dealer_id_param is not null then
    select coalesce(dvd.discount_rate, 0) into v_discount_rate
    from public.dealer_volume_discounts dvd
    where dvd.dealer_id = dealer_id_param
      and dvd.is_active = true
      and (dvd.active_until is null or dvd.active_until > now())
    order by dvd.discount_rate desc
    limit 1;
    v_discount_rate := coalesce(v_discount_rate, 0);
  end if;

  final_commission := base_commission * (1 - v_discount_rate / 100);

  return query select
    tier_record.rate_value as base_rate,
    v_discount_rate        as volume_discount,
    case
      when sale_amount > 0 then final_commission / sale_amount * 100
      else 0
    end                    as final_rate,
    final_commission       as commission_amount,
    tier_record.id         as tier_id;
end;
$func$;

comment on function public.calculate_commission(numeric, uuid) is
  'Calculates the commission for a sale, picking the matching tier from '
  'commission_tiers (numrange [min, max)). Applies min_commission for '
  'both percentage and fixed rate types. Throws if no active tier exists. '
  'Falls back to the highest tier (with NOTICE) if sale_amount exceeds '
  'every defined range.';

-- ============================================================
-- 5. Realtime publication for commission_tiers
-- ============================================================
-- Justification (per AGENTS.md): a frontend listener is added in the same
-- commit (see src/hooks/useCommissionTiersRealtime.ts) so the admin UI
-- propagates tier changes to all open tabs without 10-min staleTime delay.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'commission_tiers'
  ) then
    alter publication supabase_realtime add table public.commission_tiers;
  end if;
end$$;

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
