-- ============================================================================
-- Google Ads: „Anfrage veröffentlicht“ erst nach 24 Stunden ohne Ablehnung
-- ============================================================================
--
-- Funnel A und C veröffentlichen eine Anfrage sofort, wenn die Bot-Prüfung
-- bestanden ist (kw_marketplace_settings.auto_publish_funnel_a/_c), nur
-- Funnel B wartet auf den Admin. Ohne Frist wäre die Meldung damit kaum mehr
-- als „Küchenanfrage“. Gemeldet wird deshalb erst, wenn die Anfrage 24 Stunden
-- veröffentlicht war und in der Zeit nicht abgelehnt wurde (Admin prüft nach
-- der Mail project_created). Spätere Ablehnungen und Reklamationen zieht der
-- Lauf weiterhin zurück. Zeitpunkt der Conversion bleibt published_at.
--
-- Ohne Kontaktpreis an der Ausschreibung gilt der eingestellte Fallback
-- (contact_price_fallback_cents) statt fester 25 €.
-- ============================================================================

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
  v_fallback_cents integer;
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

  select coalesce(nullif(s.contact_price_fallback_cents, 0), 2500)
    into v_fallback_cents
    from public.kw_marketplace_settings s
   where s.id;

  insert into public.kw_gads_conversion_uploads (source_id, lead_id, kind, order_id, value_eur, conversion_at)
  select l.id,
         l.id,
         'qualified',
         'kw-lead-' || l.id::text || '-published',
         coalesce(nullif(a.contact_price_cents, 0), v_fallback_cents, 2500) / 100.0,
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
     and a.published_at <= now() - interval '24 hours'
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

revoke execute on function public.kw_gads_collect_conversions() from public, anon, authenticated;
grant execute on function public.kw_gads_collect_conversions() to service_role;
