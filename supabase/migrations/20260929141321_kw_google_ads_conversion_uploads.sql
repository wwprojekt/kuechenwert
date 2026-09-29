-- ============================================================================
-- Google Ads: echte Umsätze als Offline-Conversions melden
-- ============================================================================
--
-- Jede Marktplatz-Rechnung zu einer Anfrage ist ein Umsatz: lead_purchase
-- (ein Studio schaltet den Kontakt frei) und lead_commission (Auftrag
-- vergeben, Provision). Stammt die Anfrage aus einem Google-Ads-Klick (gclid,
-- gbraid oder wbraid am Lead, nur mit Marketing-Einwilligung gespeichert),
-- meldet kw-google-ads (action "upload-conversions") den Nettobetrag an die
-- Conversion „Kontakt freigeschaltet“ bzw. „Auftrag vergeben“. Wird die
-- Rechnung storniert (anerkannte Reklamation) oder erstattet
-- (payment_status 'refunded'), zieht der nächste Lauf die Conversion zurück.
--
-- Die Tabelle hält nur Verweise und Beträge, keine Klick-IDs oder
-- Kontaktdaten: gelesen wird beim Upload am Lead. Löschung und
-- Anonymisierung leeren die Klick-IDs dort, danach wird nichts mehr gemeldet.
--
-- Cron kw-gads-conversion-uploads (stündlich :25) sammelt neue Umsätze und
-- ruft die Function nur, wenn etwas fällig ist.
-- ============================================================================

create table if not exists public.kw_gads_conversion_uploads (
  invoice_id uuid primary key,
  lead_id uuid not null,
  kind text not null check (kind in ('contact', 'order')),
  order_id text not null unique,
  value_eur numeric(12, 2) not null check (value_eur > 0),
  conversion_at timestamptz not null,
  status text not null default 'pending' check (status in (
    'pending', 'uploaded', 'failed', 'skipped', 'rejected',
    'retract_pending', 'retracted', 'retract_expired', 'retract_failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  uploaded_at timestamptz,
  retracted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_kw_gads_uploads_due
  on public.kw_gads_conversion_uploads (next_attempt_at)
  where status in ('pending', 'failed', 'retract_pending');

alter table public.kw_gads_conversion_uploads enable row level security;
revoke all on public.kw_gads_conversion_uploads from public, anon, authenticated;
grant all on public.kw_gads_conversion_uploads to service_role;

-- Neue Umsätze einreihen, vor dem Upload stornierte überspringen, bereits
-- gemeldete, aber stornierte zum Rückzug vormerken. Idempotent.
create or replace function public.kw_gads_collect_conversions()
returns integer
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_new integer;
  v_skipped integer;
  v_retract integer;
begin
  insert into public.kw_gads_conversion_uploads (invoice_id, lead_id, kind, order_id, value_eur, conversion_at)
  select i.id,
         i.lead_id,
         case i.invoice_type when 'lead_purchase' then 'contact' else 'order' end,
         'kw-inv-' || i.id::text,
         i.net_amount,
         i.created_at
    from public.invoices i
    join public.leads l on l.id = i.lead_id
   where i.invoice_type in ('lead_purchase', 'lead_commission')
     and i.status is distinct from 'cancelled'
     and i.payment_status is distinct from 'refunded'
     and i.net_amount > 0
     and coalesce(l.gclid, l.gbraid, l.wbraid) is not null
     and l.anonymized_at is null
     and i.created_at <= l.created_at + interval '90 days'
  on conflict (invoice_id) do nothing;
  get diagnostics v_new = row_count;

  update public.kw_gads_conversion_uploads u
     set status = 'skipped', last_error = 'Rechnung vor dem Upload storniert oder erstattet', updated_at = now()
   where u.status in ('pending', 'failed')
     and not exists (
       select 1 from public.invoices i
        where i.id = u.invoice_id and i.status is distinct from 'cancelled'
          and i.payment_status is distinct from 'refunded');
  get diagnostics v_skipped = row_count;

  update public.kw_gads_conversion_uploads u
     set status = 'retract_pending', attempts = 0, next_attempt_at = now(), last_error = null, updated_at = now()
   where u.status = 'uploaded'
     and not exists (
       select 1 from public.invoices i
        where i.id = u.invoice_id and i.status is distinct from 'cancelled'
          and i.payment_status is distinct from 'refunded');
  get diagnostics v_retract = row_count;

  return v_new + v_skipped + v_retract;
end;
$$;

-- Ergebnisse eines Laufs in einem Update verbuchen.
create or replace function public.kw_gads_record_upload_results(p_results jsonb)
returns integer
language sql
security invoker
set search_path = public, pg_catalog
as $$
  with upd as (
    update public.kw_gads_conversion_uploads u
       set status = r.status,
           attempts = r.attempts,
           next_attempt_at = coalesce(r.next_attempt_at, u.next_attempt_at),
           last_error = r.last_error,
           uploaded_at = case when r.status = 'uploaded' then coalesce(u.uploaded_at, now()) else u.uploaded_at end,
           retracted_at = case when r.status = 'retracted' then now() else u.retracted_at end,
           updated_at = now()
      from jsonb_to_recordset(p_results)
           as r(invoice_id uuid, status text, attempts integer, next_attempt_at timestamptz, last_error text)
     where u.invoice_id = r.invoice_id
    returning 1
  )
  select count(*)::integer from upd;
$$;

revoke execute on function public.kw_gads_collect_conversions() from public, anon, authenticated;
revoke execute on function public.kw_gads_record_upload_results(jsonb) from public, anon, authenticated;
grant execute on function public.kw_gads_collect_conversions() to service_role;
grant execute on function public.kw_gads_record_upload_results(jsonb) to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'kw-gads-conversion-uploads') then
    perform cron.unschedule('kw-gads-conversion-uploads');
  end if;
end $$;

select cron.schedule('kw-gads-conversion-uploads', '25 * * * *', $cmd$
do $job$
begin
  perform public.kw_gads_collect_conversions();
  if exists (select 1 from vault.decrypted_secrets where name = 'kw_cron_secret')
     and exists (
       select 1 from public.kw_gads_conversion_uploads
        where status in ('pending', 'failed', 'retract_pending') and next_attempt_at <= now()) then
    perform net.http_post(
      url := 'https://gzqayoalwtmypndrmqes.supabase.co/functions/v1/kw-google-ads',
      headers := jsonb_build_object('Content-Type', 'application/json',
        'x-kw-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'kw_cron_secret')),
      body := '{"action":"upload-conversions"}'::jsonb,
      timeout_milliseconds := 55000
    );
  end if;
end
$job$;
$cmd$);
