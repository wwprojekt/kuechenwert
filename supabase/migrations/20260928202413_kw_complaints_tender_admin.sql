-- ============================================================================
-- Reklamation gekaufter Kontakte und Admin-Aktionen an Ausschreibungen
-- (28.09.2026)
--
-- Studios bezahlen Kontaktfreischaltungen, konnten fehlerhafte Kontakte aber
-- nirgends melden. Jetzt:
--   * kw_contact_complaints: eine Reklamation je Freischaltung, bis 14 Tage
--     nach dem Kauf, nicht nach eigenem Zuschlag.
--   * kw_dealer_file_complaint / kw_dealer_complaint_status (Studio-Portal).
--   * kw_admin_decide_complaint: Admin erkennt an oder lehnt ab; bei
--     Anerkennung storniert das Admin-Frontend anschließend die Rechnung über
--     cancel-invoice (Storno-Mail nur bei bereits versendeter Rechnung).
--   * Outbox complaint_filed / complaint_decided → kw-market-worker (Mails).
--
-- kw_admin_tender_action: Angebotsphase verlängern, vorzeitig beenden oder
-- Ausschreibung abbrechen (mit Begründung), jeweils mit Audit-Log.
-- ============================================================================

create table if not exists public.kw_contact_complaints (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.lead_match_candidates(id) on delete cascade,
  auction_id uuid references public.lead_auctions(id) on delete set null,
  lead_id uuid not null references public.leads(id) on delete cascade,
  dealer_id uuid not null references public.profiles(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  reason text not null check (reason in ('nicht_erreichbar', 'falsche_kontaktdaten', 'kein_kuechenprojekt', 'doppelt', 'sonstiges')),
  note text check (note is null or char_length(note) <= 1000),
  status text not null default 'offen' check (status in ('offen', 'anerkannt', 'abgelehnt')),
  decision_note text check (decision_note is null or char_length(decision_note) <= 1000),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.kw_contact_complaints is
  'Reklamationen gekaufter Kontakte; Anlage und Entscheidung nur über kw_dealer_file_complaint bzw. kw_admin_decide_complaint.';

create index if not exists kw_contact_complaints_auction_idx on public.kw_contact_complaints (auction_id);
create index if not exists kw_contact_complaints_open_idx on public.kw_contact_complaints (created_at) where status = 'offen';

alter table public.kw_contact_complaints enable row level security;

drop policy if exists "Complaints: dealer own read" on public.kw_contact_complaints;
create policy "Complaints: dealer own read"
  on public.kw_contact_complaints for select to authenticated
  using (dealer_id = (select auth.uid()));

drop policy if exists "Complaints: admin read" on public.kw_contact_complaints;
create policy "Complaints: admin read"
  on public.kw_contact_complaints for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'::app_role));

revoke all on public.kw_contact_complaints from anon;
revoke insert, update, delete, truncate on public.kw_contact_complaints from authenticated;
grant select on public.kw_contact_complaints to authenticated;

create or replace function public.kw_dealer_complaint_status(p_auction_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: Studios lesen Freischaltung und Zuschlag nur für sich selbst.
  select jsonb_build_object(
    'purchased_at', m.purchased_at,
    'deadline', m.purchased_at + interval '14 days',
    'can_file', c.id is null
      and m.purchased_at > now() - interval '14 days'
      and not exists (
        select 1 from public.lead_auctions a join public.lead_bids b on b.id = a.won_bid_id
        where a.id = m.auction_id and b.dealer_id = m.dealer_id
      ),
    'complaint', case when c.id is null then null else jsonb_build_object(
      'id', c.id, 'reason', c.reason, 'note', c.note, 'status', c.status,
      'decision_note', c.decision_note, 'created_at', c.created_at, 'decided_at', c.decided_at
    ) end
  )
  from public.lead_match_candidates m
  left join public.kw_contact_complaints c on c.match_id = m.id
  where m.auction_id = p_auction_id
    and m.dealer_id = auth.uid()
    and m.access_source = 'purchase'
    and m.is_purchased;
$$;

create or replace function public.kw_dealer_file_complaint(p_auction_id uuid, p_reason text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: Reklamationstabelle hat keine Schreibrechte für Studios;
  -- Berechtigung, Frist und Zuschlag prüft die Funktion.
  v_uid uuid := auth.uid();
  v_match public.lead_match_candidates%rowtype;
  v_id uuid;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if v_uid is null or not public.kw_is_dealer_account(v_uid) then
    raise exception 'Nur freigeschaltete Küchenstudios können Kontakte reklamieren.' using errcode = '42501';
  end if;
  if p_reason not in ('nicht_erreichbar', 'falsche_kontaktdaten', 'kein_kuechenprojekt', 'doppelt', 'sonstiges') then
    raise exception 'Bitte einen Reklamationsgrund auswählen.' using errcode = '22023';
  end if;
  if p_reason = 'sonstiges' and coalesce(char_length(v_note), 0) < 10 then
    raise exception 'Bitte beschreiben Sie den Grund in mindestens 10 Zeichen.' using errcode = '22023';
  end if;
  if char_length(coalesce(v_note, '')) > 1000 then
    raise exception 'Die Beschreibung darf höchstens 1.000 Zeichen lang sein.' using errcode = '22023';
  end if;

  select * into v_match from public.lead_match_candidates
  where auction_id = p_auction_id and dealer_id = v_uid and access_source = 'purchase' and is_purchased
  for update;
  if v_match.id is null then
    raise exception 'Für dieses Projekt haben Sie keinen Kontakt gekauft.' using errcode = 'P0002';
  end if;
  if v_match.purchased_at <= now() - interval '14 days' then
    raise exception 'Reklamationen sind bis 14 Tage nach der Freischaltung möglich.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.lead_auctions a join public.lead_bids b on b.id = a.won_bid_id
    where a.id = p_auction_id and b.dealer_id = v_uid
  ) then
    raise exception 'Nach einem Zuschlag an Ihr Studio ist keine Reklamation mehr möglich.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.kw_contact_complaints where match_id = v_match.id) then
    raise exception 'Für diesen Kontakt liegt bereits eine Reklamation vor.' using errcode = 'P0001';
  end if;

  insert into public.kw_contact_complaints (match_id, auction_id, lead_id, dealer_id, invoice_id, reason, note)
  values (v_match.id, p_auction_id, v_match.lead_id, v_uid, v_match.invoice_id, p_reason, v_note)
  returning id into v_id;

  perform public.kw_enqueue('complaint_filed', jsonb_build_object('complaint_id', v_id));
  return public.kw_dealer_complaint_status(p_auction_id);
end;
$$;

create or replace function public.kw_admin_decide_complaint(p_complaint_id uuid, p_accept boolean, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: Admin-Aktion aus dem Frontend, prüft die Rolle selbst.
  v_c public.kw_contact_complaints%rowtype;
  v_invoice record;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not p_accept and coalesce(char_length(v_note), 0) < 10 then
    raise exception 'Bitte begründen Sie die Ablehnung (mindestens 10 Zeichen).' using errcode = '22023';
  end if;

  select * into v_c from public.kw_contact_complaints where id = p_complaint_id for update;
  if v_c.id is null then
    raise exception 'Reklamation nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_c.status <> 'offen' then
    raise exception 'Über diese Reklamation wurde bereits entschieden.' using errcode = 'P0001';
  end if;

  update public.kw_contact_complaints
     set status = case when p_accept then 'anerkannt' else 'abgelehnt' end,
         decision_note = v_note,
         decided_at = now(),
         decided_by = auth.uid()
   where id = p_complaint_id;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
  values (auth.uid(), case when p_accept then 'complaint_accepted' else 'complaint_rejected' end,
          'kw_contact_complaint', p_complaint_id::text, jsonb_build_object('invoice_id', v_c.invoice_id));

  perform public.kw_enqueue('complaint_decided', jsonb_build_object('complaint_id', p_complaint_id));

  select id, status, payment_status into v_invoice from public.invoices where id = v_c.invoice_id;
  return jsonb_build_object(
    'ok', true,
    'status', case when p_accept then 'anerkannt' else 'abgelehnt' end,
    'invoice_id', v_c.invoice_id,
    'invoice_cancellable', p_accept and v_invoice.id is not null
      and v_invoice.status <> 'cancelled' and v_invoice.payment_status <> 'paid',
    'invoice_paid', p_accept and v_invoice.payment_status = 'paid'
  );
end;
$$;

create or replace function public.kw_admin_tender_complaints(p_auction_id uuid)
returns table(
  id uuid, dealer_id uuid, dealer_name text, reason text, note text, status text,
  decision_note text, created_at timestamptz, decided_at timestamptz,
  invoice_id uuid, invoice_number text, invoice_status text, invoice_payment_status text
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: Admin-Übersicht mit Studio- und Rechnungsdaten; prüft die Rolle.
  select c.id, c.dealer_id,
         coalesce(p.company_name, nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Studio'),
         c.reason, c.note, c.status, c.decision_note, c.created_at, c.decided_at,
         c.invoice_id, i.invoice_number, i.status, i.payment_status
  from public.kw_contact_complaints c
  left join public.profiles p on p.id = c.dealer_id
  left join public.invoices i on i.id = c.invoice_id
  where c.auction_id = p_auction_id
    and public.has_role(auth.uid(), 'admin'::app_role)
  order by c.created_at desc;
$$;

create or replace function public.kw_admin_tender_action(p_auction_id uuid, p_action text, p_hours integer default null, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: Admin-Aktion aus dem Frontend, prüft die Rolle selbst.
  v_a public.lead_auctions%rowtype;
  v_settings public.kw_marketplace_settings%rowtype;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into v_settings from public.kw_marketplace_settings where id;
  select * into v_a from public.lead_auctions where id = p_auction_id for update;
  if v_a.id is null then
    raise exception 'Ausschreibung nicht gefunden.' using errcode = 'P0002';
  end if;

  if p_action = 'extend' then
    if v_a.status <> 'active' then
      raise exception 'Verlängern ist nur während der Angebotsphase möglich.' using errcode = 'P0001';
    end if;
    if p_hours is null or p_hours < 1 or p_hours > 336 then
      raise exception 'Bitte zwischen 1 und 336 Stunden verlängern.' using errcode = '22023';
    end if;
    update public.lead_auctions
       set ends_at = ends_at + make_interval(hours => p_hours),
           decision_deadline_at = decision_deadline_at + make_interval(hours => p_hours)
     where id = p_auction_id;
  elsif p_action = 'end_now' then
    if v_a.status <> 'active' then
      raise exception 'Nur laufende Ausschreibungen können vorzeitig beendet werden.' using errcode = 'P0001';
    end if;
    update public.lead_auctions
       set status = 'completed',
           ends_at = now(),
           decision_deadline_at = now() + make_interval(days => v_settings.decision_window_days)
     where id = p_auction_id;
    perform public.kw_enqueue('tender_ended', jsonb_build_object('auction_id', v_a.id, 'lead_id', v_a.lead_id));
  elsif p_action = 'cancel' then
    if v_a.status not in ('draft', 'active', 'completed') then
      raise exception 'Diese Ausschreibung ist bereits abgeschlossen.' using errcode = 'P0001';
    end if;
    if coalesce(char_length(v_reason), 0) < 5 then
      raise exception 'Bitte einen Grund für den Abbruch angeben.' using errcode = '22023';
    end if;
    update public.lead_auctions
       set status = 'cancelled', cancelled_reason = left(v_reason, 500), decided_at = now()
     where id = p_auction_id;
    update public.lead_bids set status = 'declined' where auction_id = p_auction_id and status = 'active';
    if v_a.status <> 'draft' then
      perform public.kw_enqueue('project_cancelled', jsonb_build_object('auction_id', v_a.id, 'lead_id', v_a.lead_id, 'by', 'admin'));
    end if;
  else
    raise exception 'Unbekannte Aktion.' using errcode = '22023';
  end if;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'tender_' || p_action, 'lead_auction', p_auction_id::text,
          jsonb_build_object('hours', p_hours, 'reason', v_reason, 'previous_status', v_a.status));

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.kw_dealer_complaint_status(uuid) from public, anon;
revoke execute on function public.kw_dealer_file_complaint(uuid, text, text) from public, anon;
revoke execute on function public.kw_admin_decide_complaint(uuid, boolean, text) from public, anon;
revoke execute on function public.kw_admin_tender_complaints(uuid) from public, anon;
revoke execute on function public.kw_admin_tender_action(uuid, text, integer, text) from public, anon;
grant execute on function public.kw_dealer_complaint_status(uuid) to authenticated;
grant execute on function public.kw_dealer_file_complaint(uuid, text, text) to authenticated;
grant execute on function public.kw_admin_decide_complaint(uuid, boolean, text) to authenticated;
grant execute on function public.kw_admin_tender_complaints(uuid) to authenticated;
grant execute on function public.kw_admin_tender_action(uuid, text, integer, text) to authenticated;
