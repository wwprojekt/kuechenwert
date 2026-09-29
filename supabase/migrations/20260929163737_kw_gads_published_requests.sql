-- ============================================================================
-- Google Ads: geprüfte Anfragen als frühes Qualitätssignal melden
-- ============================================================================
--
-- Bisher meldete die Warteschlange kw_gads_conversion_uploads nur Umsätze
-- (Rechnungen). Solange kaum Studios kaufen, erfährt Google daraus wenig.
-- Neu: Ist die Ausschreibung einer Anfrage aus einem Google-Klick
-- veröffentlicht (lead_auctions.is_published, published_at: Funnel A/C nach
-- bestandener Bot-Prüfung automatisch, Funnel B durch den Admin), geht sie
-- als „Anfrage veröffentlicht“ an Google, Wert = Kontaktpreis der
-- Ausschreibung (was ein Studio mindestens zahlt). So lernen die Gebote
-- früh, welche Klicks echte Anfragen bringen, statt erst nach dem ersten
-- Kauf. Meldefrist von 24 Stunden und Fallback-Wert: Migration
-- kw_gads_qualified_hold.
--
-- Wird die Anfrage später abgelehnt (status disqualified oder disputed), zieht
-- der nächste Lauf die Meldung zurück; vor dem Upload wird sie übersprungen,
-- ebenso nach Anonymisierung.
--
-- source_id statt invoice_id: Rechnung (contact, order) oder Anfrage
-- (qualified). Die Tabelle war beim Umbau leer.
-- ============================================================================

alter table public.kw_gads_conversion_uploads rename column invoice_id to source_id;
alter table public.kw_gads_conversion_uploads drop constraint if exists kw_gads_conversion_uploads_kind_check;
alter table public.kw_gads_conversion_uploads
  add constraint kw_gads_conversion_uploads_kind_check check (kind in ('qualified', 'contact', 'order'));
comment on column public.kw_gads_conversion_uploads.source_id is
  'Rechnung (kind contact, order) bzw. Anfrage (kind qualified)';

create or replace function public.kw_gads_collect_conversions()
returns integer
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_revenue integer;
  v_qualified integer;
  v_skipped integer;
  v_retract integer;
begin
  insert into public.kw_gads_conversion_uploads (source_id, lead_id, kind, order_id, value_eur, conversion_at)
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
  on conflict (source_id) do nothing;
  get diagnostics v_revenue = row_count;

  insert into public.kw_gads_conversion_uploads (source_id, lead_id, kind, order_id, value_eur, conversion_at)
  select l.id,
         l.id,
         'qualified',
         'kw-lead-' || l.id::text || '-published',
         coalesce(nullif(a.contact_price_cents, 0), 2500) / 100.0,
         a.published_at
    from public.leads l
    join lateral (
      select la.contact_price_cents, la.published_at
        from public.lead_auctions la
       where la.lead_id = l.id and la.is_published and la.published_at is not null
       order by la.published_at
       limit 1
    ) a on true
   where coalesce(l.gclid, l.gbraid, l.wbraid) is not null
     and l.anonymized_at is null
     and l.status not in ('disqualified', 'disputed')
     and a.published_at <= l.created_at + interval '90 days'
  on conflict (source_id) do nothing;
  get diagnostics v_qualified = row_count;

  update public.kw_gads_conversion_uploads u
     set status = 'skipped',
         last_error = case u.kind when 'qualified' then 'Anfrage vor dem Upload abgelehnt oder anonymisiert'
                                  else 'Rechnung vor dem Upload storniert oder erstattet' end,
         updated_at = now()
   where u.status in ('pending', 'failed')
     and not case u.kind
       when 'qualified' then exists (
         select 1 from public.leads l
          where l.id = u.source_id and l.anonymized_at is null and l.status not in ('disqualified', 'disputed'))
       else exists (
         select 1 from public.invoices i
          where i.id = u.source_id and i.status is distinct from 'cancelled'
            and i.payment_status is distinct from 'refunded')
     end;
  get diagnostics v_skipped = row_count;

  update public.kw_gads_conversion_uploads u
     set status = 'retract_pending', attempts = 0, next_attempt_at = now(), last_error = null, updated_at = now()
   where u.status = 'uploaded'
     and case u.kind
       when 'qualified' then exists (
         select 1 from public.leads l where l.id = u.source_id and l.status in ('disqualified', 'disputed'))
       else not exists (
         select 1 from public.invoices i
          where i.id = u.source_id and i.status is distinct from 'cancelled'
            and i.payment_status is distinct from 'refunded')
     end;
  get diagnostics v_retract = row_count;

  return v_revenue + v_qualified + v_skipped + v_retract;
end;
$$;

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
           as r(source_id uuid, status text, attempts integer, next_attempt_at timestamptz, last_error text)
     where u.source_id = r.source_id
    returning 1
  )
  select count(*)::integer from upd;
$$;

revoke execute on function public.kw_gads_collect_conversions() from public, anon, authenticated;
revoke execute on function public.kw_gads_record_upload_results(jsonb) from public, anon, authenticated;
grant execute on function public.kw_gads_collect_conversions() to service_role;
grant execute on function public.kw_gads_record_upload_results(jsonb) to service_role;
