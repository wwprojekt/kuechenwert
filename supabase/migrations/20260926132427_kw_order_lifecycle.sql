-- ============================================================================
-- KuechenWert: Auftragsverlauf nach dem Zuschlag ("Küche bestellen")
--
-- Nimmt die Kundin bzw. der Kunde ein Angebot an (lead_auctions.status wird
-- 'awarded'), legt ein Trigger den Auftrag an. Das Studio meldet die Etappen
-- Kontakt, Aufmaß, Kaufvertrag (mit finalem Auftragswert), Montage und Fertig
-- oder "nicht zustande gekommen". Die Kundenseite zeigt den Verlauf, die
-- Kundin bestätigt die Montage oder meldet ein Problem. Ein stündlicher Tick
-- erinnert Studios ohne Kontaktmeldung (48 h), eskaliert an KüchenWert (96 h)
-- und fragt nach der Montage bei der Kundin nach (3 Tage).
--
-- Benachrichtigungen laufen über den Outbox-Kanal 'order' und die Edge
-- Function kw-order-worker. Der Marktplatz-Worker liest nur Kanal 'market'.
-- Die Provisionsrechnung entsteht unverändert beim Zuschlag
-- (kw_project_accept_offer); weicht der Auftragswert laut Kaufvertrag ab,
-- informiert kw-order-worker das Admin-Team.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- A) Outbox-Kanäle
-- ----------------------------------------------------------------------------
alter table public.kw_outbox add column if not exists channel text not null default 'market';
alter table public.kw_outbox drop constraint if exists kw_outbox_channel_check;
alter table public.kw_outbox add constraint kw_outbox_channel_check check (channel in ('market', 'order'));
drop index if exists public.idx_kw_outbox_pending;
create index if not exists idx_kw_outbox_pending on public.kw_outbox(channel, available_at) where processed_at is null;

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
    where processed_at is null and available_at <= now() and attempts < 8 and channel = 'market'
    order by id
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  )
  returning o.*;
$$;
revoke execute on function public.kw_outbox_claim(integer) from public, anon, authenticated;
grant execute on function public.kw_outbox_claim(integer) to service_role;

create or replace function public.kw_order_outbox_claim(p_limit integer default 25)
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
    where processed_at is null and available_at <= now() and attempts < 8 and channel = 'order'
    order by id
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  )
  returning o.*;
$$;
revoke execute on function public.kw_order_outbox_claim(integer) from public, anon, authenticated;
grant execute on function public.kw_order_outbox_claim(integer) to service_role;

create or replace function public.kw_enqueue_order(p_event_type text, p_payload jsonb, p_delay interval default '0 seconds')
returns void
language sql
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: wird aus Studio-/Kunden-RPCs, Trigger und Cron aufgerufen, deren
  -- Aufrufer keine Rechte auf die Outbox haben.
  insert into public.kw_outbox (event_type, payload, available_at, channel)
  values (p_event_type, coalesce(p_payload, '{}'::jsonb), now() + coalesce(p_delay, '0 seconds'), 'order');
$$;
revoke execute on function public.kw_enqueue_order(text, jsonb, interval) from public, anon, authenticated;
grant execute on function public.kw_enqueue_order(text, jsonb, interval) to service_role;


-- ----------------------------------------------------------------------------
-- B) Aufträge und Verlauf
-- ----------------------------------------------------------------------------
create table if not exists public.kw_orders (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  auction_id uuid not null unique references public.lead_auctions(id) on delete cascade,
  bid_id uuid not null references public.lead_bids(id) on delete cascade,
  dealer_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'awarded',
  offer_price_eur numeric(12,2) not null,
  contract_value_eur numeric(12,2),
  contacted_at timestamptz,
  measurement_at timestamptz,
  contract_signed_at timestamptz,
  installation_at timestamptz,
  completed_at timestamptz,
  consumer_confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  cancel_note text,
  problem_reported_at timestamptz,
  reminder_sent_at timestamptz,
  escalated_at timestamptz,
  completion_check_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kw_orders_status_check check (status in (
    'awarded', 'contacted', 'measurement_scheduled', 'contract_signed',
    'installation_scheduled', 'completed', 'cancelled')),
  constraint kw_orders_contract_value_check check (
    contract_value_eur is null or (contract_value_eur > 0 and contract_value_eur < 2000000)),
  constraint kw_orders_cancel_reason_check check (cancel_reason is null or cancel_reason in (
    'customer_withdrew', 'price_after_measurement', 'not_reachable', 'studio_declined', 'other')),
  constraint kw_orders_cancel_note_check check (cancel_note is null or char_length(cancel_note) <= 1000)
);
create index if not exists idx_kw_orders_dealer on public.kw_orders(dealer_id, status);
create index if not exists idx_kw_orders_lead on public.kw_orders(lead_id);
create index if not exists idx_kw_orders_open on public.kw_orders(created_at) where status not in ('completed', 'cancelled');

create table if not exists public.kw_order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.kw_orders(id) on delete cascade,
  actor text not null check (actor in ('dealer', 'customer', 'admin', 'system')),
  actor_id uuid,
  event text not null check (event in (
    'awarded', 'contacted', 'measurement', 'contract', 'installation', 'completed', 'cancelled',
    'note', 'consumer_confirmed', 'problem_reported', 'reminder', 'escalated', 'completion_check')),
  event_at timestamptz,
  value_eur numeric(12,2),
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists idx_kw_order_events_order on public.kw_order_events(order_id, created_at);

alter table public.kw_orders enable row level security;
alter table public.kw_order_events enable row level security;

drop policy if exists "Orders: admin read" on public.kw_orders;
create policy "Orders: admin read" on public.kw_orders for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));
drop policy if exists "Orders: dealer reads own" on public.kw_orders;
create policy "Orders: dealer reads own" on public.kw_orders for select to authenticated
  using (dealer_id = auth.uid());

drop policy if exists "Order events: admin read" on public.kw_order_events;
create policy "Order events: admin read" on public.kw_order_events for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));
drop policy if exists "Order events: dealer reads own" on public.kw_order_events;
create policy "Order events: dealer reads own" on public.kw_order_events for select to authenticated
  using (exists (select 1 from public.kw_orders o where o.id = order_id and o.dealer_id = auth.uid()));

revoke all on public.kw_orders, public.kw_order_events from anon;
revoke insert, update, delete, truncate on public.kw_orders, public.kw_order_events from authenticated;
grant select on public.kw_orders, public.kw_order_events to authenticated;
grant all on public.kw_orders, public.kw_order_events to service_role;


-- ----------------------------------------------------------------------------
-- C) Hilfsfunktionen
-- ----------------------------------------------------------------------------
create or replace function public.kw_order_status_rank(p_status text)
returns integer
language sql
immutable
set search_path = public, pg_catalog
as $$
  select case p_status
    when 'awarded' then 0
    when 'contacted' then 1
    when 'measurement_scheduled' then 2
    when 'contract_signed' then 3
    when 'installation_scheduled' then 4
    when 'completed' then 5
    else -1
  end;
$$;

-- Die Kundin darf die Montage bestätigen, sobald der Kaufvertrag steht – oder
-- nach drei Wochen, falls das Studio keine Etappen meldet.
create or replace function public.kw_order_can_confirm(p_status text, p_confirmed_at timestamptz, p_created_at timestamptz)
returns boolean
language sql
stable
set search_path = public, pg_catalog
as $$
  select p_status <> 'cancelled'
    and p_confirmed_at is null
    and (p_status in ('contract_signed', 'installation_scheduled', 'completed')
         or p_created_at <= now() - interval '21 days');
$$;

create or replace function public.kw_order_json(p_order_id uuid, p_audience text)
returns jsonb
language sql
stable
set search_path = public, pg_catalog
as $$
  select jsonb_build_object(
    'id', o.id,
    'auction_id', o.auction_id,
    'status', o.status,
    'offer_price_eur', o.offer_price_eur,
    'contract_value_eur', o.contract_value_eur,
    'contacted_at', o.contacted_at,
    'measurement_at', o.measurement_at,
    'contract_signed_at', o.contract_signed_at,
    'installation_at', o.installation_at,
    'completed_at', o.completed_at,
    'consumer_confirmed_at', o.consumer_confirmed_at,
    'cancelled_at', o.cancelled_at,
    'cancel_reason', o.cancel_reason,
    'cancel_note', case when p_audience = 'dealer' then o.cancel_note end,
    'problem_reported_at', o.problem_reported_at,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'can_confirm', public.kw_order_can_confirm(o.status, o.consumer_confirmed_at, o.created_at),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
          'event', e.event,
          'actor', e.actor,
          'event_at', e.event_at,
          'value_eur', e.value_eur,
          'note', case when p_audience = 'dealer' and e.actor <> 'customer' then e.note end,
          'created_at', e.created_at
        ) order by e.created_at, e.id)
      from public.kw_order_events e
      where e.order_id = o.id
        and (p_audience = 'dealer' or e.event not in ('note', 'reminder', 'escalated', 'completion_check'))
    ), '[]'::jsonb)
  )
  from public.kw_orders o
  where o.id = p_order_id;
$$;
revoke execute on function public.kw_order_json(uuid, text) from public, anon, authenticated;
grant execute on function public.kw_order_json(uuid, text) to service_role;


-- ----------------------------------------------------------------------------
-- D) Auftrag beim Zuschlag anlegen
-- ----------------------------------------------------------------------------
create or replace function public.kw_orders_on_award()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: legt den Auftrag an, egal wer den Zuschlag setzt (Kunden-RPC, Admin).
  v_b public.lead_bids%rowtype;
  v_order_id uuid;
begin
  select * into v_b from public.lead_bids where id = new.won_bid_id;
  if v_b.id is null then
    return new;
  end if;
  insert into public.kw_orders (lead_id, auction_id, bid_id, dealer_id, offer_price_eur)
  values (new.lead_id, new.id, v_b.id, v_b.dealer_id, v_b.price_eur)
  on conflict (auction_id) do nothing
  returning id into v_order_id;
  if v_order_id is not null then
    insert into public.kw_order_events (order_id, actor, event, value_eur)
    values (v_order_id, 'customer', 'awarded', v_b.price_eur);
  end if;
  return new;
end;
$$;
revoke execute on function public.kw_orders_on_award() from public, anon, authenticated;

drop trigger if exists trg_kw_orders_on_award on public.lead_auctions;
create trigger trg_kw_orders_on_award
  after update of status on public.lead_auctions
  for each row
  when (new.status = 'awarded' and old.status is distinct from 'awarded' and new.won_bid_id is not null)
  execute function public.kw_orders_on_award();

-- Bestehende Zuschläge nachtragen (ohne nachträgliche Erinnerungen).
insert into public.kw_orders (lead_id, auction_id, bid_id, dealer_id, offer_price_eur, created_at, reminder_sent_at, escalated_at)
select a.lead_id, a.id, b.id, b.dealer_id, b.price_eur, coalesce(a.decided_at, now()), now(), now()
from public.lead_auctions a
join public.lead_bids b on b.id = a.won_bid_id
where a.status = 'awarded'
on conflict (auction_id) do nothing;


-- ----------------------------------------------------------------------------
-- E) Studio: Auftrag lesen und Etappen melden
-- ----------------------------------------------------------------------------
create or replace function public.kw_dealer_order(p_auction_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: kw_order_json ist fuer authenticated gesperrt; hier wird geprueft,
  -- dass nur das beauftragte Studio (oder ein Admin) den Auftrag sieht.
  v_uid uuid := auth.uid();
  v_o public.kw_orders%rowtype;
begin
  if v_uid is null then
    raise exception 'Bitte melden Sie sich an.' using errcode = '42501';
  end if;
  select * into v_o from public.kw_orders where auction_id = p_auction_id;
  if v_o.id is null then
    return null;
  end if;
  if v_o.dealer_id <> v_uid and not public.has_role(v_uid, 'admin'::app_role) then
    raise exception 'Auftrag nicht gefunden.' using errcode = 'P0002';
  end if;
  return public.kw_order_json(v_o.id, 'dealer');
end;
$$;
revoke execute on function public.kw_dealer_order(uuid) from public, anon;
grant execute on function public.kw_dealer_order(uuid) to authenticated, service_role;

create or replace function public.kw_dealer_order_update(
  p_auction_id uuid,
  p_step text,
  p_at timestamptz default null,
  p_value_eur numeric default null,
  p_reason text default null,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: Studios aendern Auftraege nur ueber diese Funktion
  -- (Statusregeln, Verlauf, Lead-Status, Benachrichtigungen).
  v_uid uuid := auth.uid();
  v_o public.kw_orders%rowtype;
  v_target text;
  v_status text;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 1000), '');
  v_lead_status public.lead_status;
begin
  if v_uid is null or not public.kw_is_active_dealer(v_uid) then
    raise exception 'Nur freigeschaltete Studios können Aufträge bearbeiten.' using errcode = '42501';
  end if;
  select * into v_o from public.kw_orders where auction_id = p_auction_id for update;
  if v_o.id is null or v_o.dealer_id <> v_uid then
    raise exception 'Auftrag nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_o.status = 'cancelled' then
    raise exception 'Dieser Auftrag ist bereits als nicht zustande gekommen gemeldet.' using errcode = 'P0001';
  end if;
  if v_o.consumer_confirmed_at is not null and p_step <> 'note' then
    raise exception 'Die Montage wurde von der Kundin bzw. dem Kunden bereits bestätigt.' using errcode = 'P0001';
  end if;
  if p_at is not null and (p_at < now() - interval '400 days' or p_at > now() + interval '730 days') then
    raise exception 'Bitte ein plausibles Datum angeben.' using errcode = '22023';
  end if;

  case p_step
    when 'contacted' then
      v_target := 'contacted';
      update public.kw_orders set contacted_at = coalesce(contacted_at, now()) where id = v_o.id;
    when 'measurement' then
      if p_at is null then
        raise exception 'Bitte den Termin für das Aufmaß angeben.' using errcode = '22023';
      end if;
      v_target := 'measurement_scheduled';
      update public.kw_orders
      set measurement_at = p_at, contacted_at = coalesce(contacted_at, now())
      where id = v_o.id;
    when 'contract' then
      if p_value_eur is null or p_value_eur < 500 or p_value_eur >= 2000000 then
        raise exception 'Bitte den Auftragswert laut Kaufvertrag (brutto) angeben.' using errcode = '22023';
      end if;
      v_target := 'contract_signed';
      update public.kw_orders
      set contract_signed_at = coalesce(p_at, now()), contract_value_eur = round(p_value_eur, 2),
          contacted_at = coalesce(contacted_at, now())
      where id = v_o.id;
    when 'installation' then
      if p_at is null then
        raise exception 'Bitte den Montagetermin angeben.' using errcode = '22023';
      end if;
      v_target := 'installation_scheduled';
      update public.kw_orders
      set installation_at = p_at, completion_check_sent_at = null, contacted_at = coalesce(contacted_at, now())
      where id = v_o.id;
    when 'completed' then
      v_target := 'completed';
      update public.kw_orders
      set completed_at = coalesce(p_at, now()), contacted_at = coalesce(contacted_at, now())
      where id = v_o.id;
    when 'cancelled' then
      if p_reason is null or p_reason not in ('customer_withdrew', 'price_after_measurement', 'not_reachable', 'studio_declined', 'other') then
        raise exception 'Bitte einen Grund auswählen.' using errcode = '22023';
      end if;
      if p_reason = 'other' and v_note is null then
        raise exception 'Bitte den Grund kurz beschreiben.' using errcode = '22023';
      end if;
      v_target := 'cancelled';
      update public.kw_orders
      set cancelled_at = now(), cancel_reason = p_reason, cancel_note = v_note
      where id = v_o.id;
    when 'note' then
      if v_note is null then
        raise exception 'Bitte eine Notiz eingeben.' using errcode = '22023';
      end if;
      v_target := v_o.status;
    else
      raise exception 'Unbekannter Schritt.' using errcode = '22023';
  end case;

  v_status := case
    when v_target = 'cancelled' then 'cancelled'
    when public.kw_order_status_rank(v_target) > public.kw_order_status_rank(v_o.status) then v_target
    else v_o.status
  end;
  update public.kw_orders set status = v_status, updated_at = now() where id = v_o.id;

  insert into public.kw_order_events (order_id, actor, actor_id, event, event_at, value_eur, note)
  values (v_o.id, 'dealer', v_uid, p_step, p_at,
          case when p_step = 'contract' then round(p_value_eur, 2) end,
          v_note);

  if v_status <> v_o.status then
    v_lead_status := case v_status
      when 'contacted' then 'contacted'
      when 'measurement_scheduled' then 'appointment_set'
      when 'contract_signed' then 'closed_won'
      when 'installation_scheduled' then 'closed_won'
      when 'completed' then 'closed_won'
      when 'cancelled' then 'closed_lost'
    end::public.lead_status;
    if v_lead_status is not null then
      update public.leads set status = v_lead_status where id = v_o.lead_id;
    end if;
  end if;

  if p_step in ('measurement', 'contract', 'installation', 'completed') then
    perform public.kw_enqueue_order('order_milestone', jsonb_build_object('order_id', v_o.id, 'step', p_step));
  elsif p_step = 'cancelled' then
    perform public.kw_enqueue_order('order_cancelled', jsonb_build_object('order_id', v_o.id));
  end if;

  return public.kw_order_json(v_o.id, 'dealer');
end;
$$;
revoke execute on function public.kw_dealer_order_update(uuid, text, timestamptz, numeric, text, text) from public, anon;
grant execute on function public.kw_dealer_order_update(uuid, text, timestamptz, numeric, text, text) to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- F) Kundin/Kunde (nur über kw-project nach Token-Prüfung)
-- ----------------------------------------------------------------------------
create or replace function public.kw_project_order(p_lead_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: Aufruf nur ueber kw-project (Service-Role) nach Token-Pruefung.
  select public.kw_order_json(o.id, 'customer')
  from public.kw_orders o
  where o.lead_id = p_lead_id
  order by o.created_at desc
  limit 1;
$$;
revoke execute on function public.kw_project_order(uuid) from public, anon, authenticated;
grant execute on function public.kw_project_order(uuid) to service_role;

create or replace function public.kw_project_order_confirm(p_lead_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: Aufruf nur ueber kw-project (Service-Role) nach Token-Pruefung.
  v_o public.kw_orders%rowtype;
begin
  select * into v_o from public.kw_orders where lead_id = p_lead_id order by created_at desc limit 1 for update;
  if v_o.id is null then
    raise exception 'Für dieses Projekt gibt es noch keinen Auftrag.' using errcode = 'P0002';
  end if;
  if v_o.consumer_confirmed_at is not null then
    return public.kw_order_json(v_o.id, 'customer');
  end if;
  if not public.kw_order_can_confirm(v_o.status, v_o.consumer_confirmed_at, v_o.created_at) then
    raise exception 'Die Bestätigung ist möglich, sobald der Kaufvertrag mit dem Studio geschlossen ist.' using errcode = 'P0001';
  end if;
  update public.kw_orders
  set consumer_confirmed_at = now(), completed_at = coalesce(completed_at, now()),
      status = 'completed', updated_at = now()
  where id = v_o.id;
  update public.leads set status = 'closed_won' where id = v_o.lead_id;
  insert into public.kw_order_events (order_id, actor, event) values (v_o.id, 'customer', 'consumer_confirmed');
  perform public.kw_enqueue_order('order_confirmed', jsonb_build_object('order_id', v_o.id));
  return public.kw_order_json(v_o.id, 'customer');
end;
$$;
revoke execute on function public.kw_project_order_confirm(uuid) from public, anon, authenticated;
grant execute on function public.kw_project_order_confirm(uuid) to service_role;

create or replace function public.kw_project_order_report(p_lead_id uuid, p_message text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: Aufruf nur ueber kw-project (Service-Role) nach Token-Pruefung.
  v_o public.kw_orders%rowtype;
  v_msg text := nullif(left(btrim(coalesce(p_message, '')), 1000), '');
begin
  if v_msg is null or char_length(v_msg) < 10 then
    raise exception 'Bitte beschreiben Sie das Anliegen in ein paar Worten.' using errcode = '22023';
  end if;
  select * into v_o from public.kw_orders where lead_id = p_lead_id order by created_at desc limit 1 for update;
  if v_o.id is null then
    raise exception 'Für dieses Projekt gibt es noch keinen Auftrag.' using errcode = 'P0002';
  end if;
  update public.kw_orders set problem_reported_at = now(), updated_at = now() where id = v_o.id;
  insert into public.kw_order_events (order_id, actor, event, note) values (v_o.id, 'customer', 'problem_reported', v_msg);
  perform public.kw_enqueue_order('order_problem', jsonb_build_object('order_id', v_o.id));
  return public.kw_order_json(v_o.id, 'customer');
end;
$$;
revoke execute on function public.kw_project_order_report(uuid, text) from public, anon, authenticated;
grant execute on function public.kw_project_order_report(uuid, text) to service_role;


-- ----------------------------------------------------------------------------
-- G) Zeitgesteuerte Nachverfolgung
-- ----------------------------------------------------------------------------
create or replace function public.kw_order_tick()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: Cron-Job; setzt Erinnerungs-Zeitstempel und schreibt in die Outbox.
  v_reminded integer := 0;
  v_escalated integer := 0;
  v_checked integer := 0;
  r record;
begin
  for r in
    update public.kw_orders
    set reminder_sent_at = now(), updated_at = now()
    where status = 'awarded' and contacted_at is null and reminder_sent_at is null
      and created_at <= now() - interval '48 hours'
    returning id
  loop
    v_reminded := v_reminded + 1;
    insert into public.kw_order_events (order_id, actor, event) values (r.id, 'system', 'reminder');
    perform public.kw_enqueue_order('order_contact_reminder', jsonb_build_object('order_id', r.id));
  end loop;

  for r in
    update public.kw_orders
    set escalated_at = now(), updated_at = now()
    where status = 'awarded' and contacted_at is null and escalated_at is null
      and created_at <= now() - interval '96 hours'
    returning id
  loop
    v_escalated := v_escalated + 1;
    insert into public.kw_order_events (order_id, actor, event) values (r.id, 'system', 'escalated');
    perform public.kw_enqueue_order('order_escalation', jsonb_build_object('order_id', r.id));
  end loop;

  for r in
    update public.kw_orders
    set completion_check_sent_at = now(), updated_at = now()
    where status in ('installation_scheduled', 'completed')
      and consumer_confirmed_at is null
      and completion_check_sent_at is null
      and coalesce(completed_at, installation_at) <= now() - interval '3 days'
    returning id
  loop
    v_checked := v_checked + 1;
    insert into public.kw_order_events (order_id, actor, event) values (r.id, 'system', 'completion_check');
    perform public.kw_enqueue_order('order_completion_check', jsonb_build_object('order_id', r.id));
  end loop;

  return jsonb_build_object('reminded', v_reminded, 'escalated', v_escalated, 'completion_checks', v_checked);
end;
$$;
revoke execute on function public.kw_order_tick() from public, anon, authenticated;
grant execute on function public.kw_order_tick() to service_role;


-- ----------------------------------------------------------------------------
-- H) Erlaubte Mail- und Hinweistypen
-- ----------------------------------------------------------------------------
-- Neu: order_* sowie dealer_application_received / dealer_role_upgrade, die
-- send-dealer-notification schon immer protokollieren wollte (Insert scheiterte
-- bisher still an dieser Constraint).
alter table public.admin_emails drop constraint if exists admin_emails_email_type_check;
alter table public.admin_emails add constraint admin_emails_email_type_check check (email_type = any (array[
  'single', 'broadcast', 'reply', 'inbound', 'auto', 'welcome', 'auto_response', 'wizard_resume',
  'wizard_recovery_first', 'wizard_recovery_followup', 'appointment_confirmation', 'appointment_pin',
  'appointment_reminder', 'auction_ending_soon', 'auction_summary', 'auction_winner', 'auction_new',
  'auction_update', 'auction_ended', 'auction_new_auction', 'auction_new_bid', 'auction_outbid',
  'auction_won', 'auction_lost', 'auction_auction_started', 'auction_seller_sold', 'auction_seller_not_sold',
  'auction_kaufchance_invite', 'auction_seller_kaufchance', 'auction_seller_relisted',
  'auction_kaufchance_expired', 'auction_seller_auto_relisted', 'auction_auction_relisted',
  'auction_seller_new_offer', 'auction_admin_new_offer', 'auction_buyer_offer_rejected',
  'auction_buyer_counter_offer', 'auction_seller_buyer_rejected', 'auction_seller_festpreis_extended',
  'auction_admin_festpreis_needs_price', 'auction_seller_festpreis_round_warning',
  'auction_seller_auction_round_warning', 'auction_seller_soft_brake', 'auction_seller_festpreis_cap_reached',
  'auction_seller_existing_listing_optin', 'bid_confirmed', 'bid_outbid', 'payment_confirmation',
  'payment_reminder', 'invoice', 'inactivity', 'favorite_notification', 'favorite_price_change',
  'expert_valuation', 'registration_invite', 'wrong_number_followup', 'no_answer_followup',
  'considering_followup', 'done_followup', 'purchase_inquiry_dealer', 'purchase_inquiry_customer',
  'purchase_contract', 'purchase_contract_notification', 'handover_protocol_blank',
  'lead_admin_wertermittlung', 'lead_admin_wertrechner', 'lead_admin_wizard', 'lead_admin_kontakt',
  'lead_admin_dealer', 'lead_user_wertermittlung', 'lead_user_wertrechner', 'lead_user_wizard',
  'lead_user_kontakt', 'lead_user_dealer', 'lead_user_funnel', 'lead_admin_funnel', 'dealer_welcome',
  'dealer_approved', 'dealer_rejected', 'dealer_suspended', 'dealer_reactivated', 'dealer_level_change',
  'dealer_registration_invite', 'dealer_first_nudge', 'dealer_auction_digest', 'dealer_instant_buy_alert',
  'dealer_outreach', 'dunning_level_1', 'dunning_level_2', 'dunning_level_3', 'dunning_level_4',
  'dunning_level_5', 'scheduled', 'vehicle_question', 'dealer_documents_request', 'google_review_request',
  'project_link', 'project_new_offer', 'project_contact_unlocked', 'project_tender_ended',
  'project_awarded_consumer', 'project_awarded_dealer', 'project_not_awarded_dealer', 'project_new_dealer',
  'project_admin_new',
  'dealer_application_received', 'dealer_role_upgrade',
  'order_update_consumer', 'order_update_dealer', 'order_admin'
]::text[]));

alter table public.dealer_notifications drop constraint if exists dealer_notifications_type_check;
alter table public.dealer_notifications add constraint dealer_notifications_type_check check (type = any (array[
  'outbid', 'auction_won', 'auction_ending', 'new_auction', 'search_match', 'payment_reminder', 'system',
  'bid_confirmed', 'project_new', 'project_underbid', 'project_awarded', 'project_not_awarded',
  'project_ended', 'project_cancelled', 'contact_unlocked',
  'order_reminder', 'order_update'
]::text[]));


-- ----------------------------------------------------------------------------
-- I) Cron: Tick stündlich, Worker jede Minute (nur bei offenen Order-Events)
-- ----------------------------------------------------------------------------
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('kw-market-worker', 'kw-order-worker', 'kw-order-tick');
end $$;

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
  where exists (select 1 from public.kw_outbox where channel = 'market' and processed_at is null and available_at <= now() and attempts < 8)
    and exists (select 1 from vault.decrypted_secrets where name = 'kw_cron_secret');
$cron$);

select cron.schedule('kw-order-worker', '* * * * *', $cron$
  select net.http_post(
    url := 'https://gzqayoalwtmypndrmqes.supabase.co/functions/v1/kw-order-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-kw-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'kw_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  )
  where exists (select 1 from public.kw_outbox where channel = 'order' and processed_at is null and available_at <= now() and attempts < 8)
    and exists (select 1 from vault.decrypted_secrets where name = 'kw_cron_secret');
$cron$);

select cron.schedule('kw-order-tick', '7 * * * *', $cron$select public.kw_order_tick();$cron$);
