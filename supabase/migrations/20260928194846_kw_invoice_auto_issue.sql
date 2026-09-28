-- ============================================================================
-- Rechnungs-Lebenszyklus für den Marktplatz (28.09.2026)
--
-- 1. kw_create_market_invoice legte Rechnungen für Kontaktfreischaltungen und
--    Provisionen nur als Entwurf an; kein Prozess hat sie versendet. Jetzt
--    stellt kw-market-worker sie über das Outbox-Ereignis invoice_issue aus
--    (PDF erzeugen, per E-Mail senden, Status sent). Mit
--    kw_marketplace_settings.auto_issue_invoices = false bleiben sie für eine
--    manuelle Prüfung im Admin als Entwurf liegen. Fehlen Pflichtangaben des
--    Ausstellers (IBAN, USt-IdNr./Steuernummer), bleibt die Rechnung ebenfalls
--    Entwurf und das Admin-Postfach wird informiert.
-- 2. invoices.service_date: Leistungsdatum (§ 14 Abs. 4 Nr. 6 UStG).
-- 3. USt-IdNr. aus dem veröffentlichten Impressum in die Rechnungsdaten.
-- 4. GoBD: Ausgestellte Rechnungen und ihre Positionen sind unveränderbar;
--    Korrekturen nur über Storno und neue Rechnung.
-- 5. Studios sehen nur ausgestellte Rechnungen, keine Entwürfe.
-- ============================================================================

alter table public.kw_marketplace_settings
  add column if not exists auto_issue_invoices boolean not null default true;

comment on column public.kw_marketplace_settings.auto_issue_invoices is
  'true: Marktplatz-Rechnungen werden sofort ausgestellt und versendet; false: bleiben als Entwurf zur Prüfung.';

alter table public.invoices
  add column if not exists service_date date;

comment on column public.invoices.service_date is
  'Leistungsdatum (§ 14 Abs. 4 Nr. 6 UStG): Tag der Kontaktfreischaltung bzw. des Zuschlags.';

update public.invoices
set service_date = coalesce(invoice_date, created_at::date)
where service_date is null;

update public.site_settings
set ust_id = 'DE462042479'
where coalesce(trim(ust_id), '') = '';

create or replace function public.kw_create_market_invoice(p_dealer_id uuid, p_type text, p_net_cents integer, p_description text, p_lead_id uuid, p_auction_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: wird aus Studio-/Kunden-RPCs aufgerufen; Rechnungen dürfen
  -- nur hier (mit korrekter Steuerlogik) entstehen.
  v_invoice_id uuid;
  v_tax record;
  v_net numeric(12,2);
  v_tax_amount numeric(12,2);
  v_terms integer;
  v_customer_number text;
  v_item_type text;
  v_today date := (now() at time zone 'Europe/Berlin')::date;
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
    payment_terms_days, due_date, invoice_date, service_date, notes,
    reverse_charge, dealer_country, lead_id, lead_auction_id
  ) values (
    public.generate_invoice_number(), p_dealer_id, v_customer_number, 'draft', p_type,
    v_net, coalesce(v_tax.tax_rate, 19), v_tax_amount, v_net + v_tax_amount,
    v_terms, v_today + v_terms, v_today, v_today,
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

  perform public.kw_enqueue('invoice_issue', jsonb_build_object('invoice_id', v_invoice_id));
  return v_invoice_id;
end;
$$;

-- Jahr der Rechnungsnummer nach deutscher Zeit (Silvester-Nacht).
create or replace function public.generate_invoice_number()
returns text
language plpgsql
set search_path = ''
as $$
declare
  year_part text := to_char((now() at time zone 'Europe/Berlin')::date, 'YYYY');
  seq_part text := lpad(nextval('public.invoice_number_seq')::text, 6, '0');
begin
  return 'KW' || year_part || '-' || seq_part;
end;
$$;

-- ── GoBD: Unveränderbarkeit ausgestellter Rechnungen ─────────────────────────
create or replace function public.kw_protect_issued_invoice()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if old.status = 'draft' then
    return new;
  end if;
  if new.status = 'draft'
    or new.invoice_number is distinct from old.invoice_number
    or new.dealer_id is distinct from old.dealer_id
    or new.invoice_type is distinct from old.invoice_type
    or new.invoice_date is distinct from old.invoice_date
    or new.service_date is distinct from old.service_date
    or new.customer_number is distinct from old.customer_number
    or new.net_amount is distinct from old.net_amount
    or new.tax_rate is distinct from old.tax_rate
    or new.tax_amount is distinct from old.tax_amount
    or new.gross_amount is distinct from old.gross_amount
    or new.reverse_charge is distinct from old.reverse_charge
    or new.dealer_country is distinct from old.dealer_country
    or new.lead_id is distinct from old.lead_id
    or new.lead_auction_id is distinct from old.lead_auction_id
  then
    raise exception 'Rechnung % ist bereits ausgestellt und kann nicht mehr geändert werden. Bitte stornieren und neu ausstellen.', old.invoice_number
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists kw_protect_issued_invoice on public.invoices;
create trigger kw_protect_issued_invoice
  before update on public.invoices
  for each row execute function public.kw_protect_issued_invoice();

create or replace function public.kw_protect_issued_invoice_items()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: prüft den Status der Rechnung unabhängig von der RLS-Sicht des
  -- Aufrufers; liest nur invoices.status. Löschen verhindert bereits
  -- prevent_invoice_item_delete.
begin
  if exists (
    select 1 from public.invoices i
    where i.status <> 'draft'
      and (i.id = new.invoice_id or (tg_op = 'UPDATE' and i.id = old.invoice_id))
  ) then
    raise exception 'Positionen ausgestellter Rechnungen können nicht geändert werden.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.kw_protect_issued_invoice_items() from public, anon, authenticated;

drop trigger if exists kw_protect_issued_invoice_items on public.invoice_items;
create trigger kw_protect_issued_invoice_items
  before insert or update on public.invoice_items
  for each row execute function public.kw_protect_issued_invoice_items();

-- ── Studios sehen nur ausgestellte Rechnungen ───────────────────────────────
drop policy if exists "Dealers can view own invoices" on public.invoices;
create policy "Dealers can view own invoices"
  on public.invoices for select
  using (dealer_id = (select auth.uid()) and status <> 'draft');

drop policy if exists "Dealers can view own invoice items" on public.invoice_items;
create policy "Dealers can view own invoice items"
  on public.invoice_items for select
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_items.invoice_id
      and i.dealer_id = (select auth.uid())
      and i.status <> 'draft'
  ));
