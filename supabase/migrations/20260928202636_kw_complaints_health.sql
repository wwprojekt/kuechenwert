-- ============================================================================
-- Reklamationen: Gesundheitsprüfung und eindeutige Rückgabewerte (28.09.2026)
--
-- kw_health_snapshot meldet offene Reklamationen, die älter als 5 Tage sind
-- (zugesagte Bearbeitungszeit). kw_admin_decide_complaint liefert
-- invoice_cancellable/invoice_paid immer als true/false statt null.
-- ============================================================================

create or replace function public.kw_health_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: liest Outbox, Cron-Protokoll, pg_net-Antworten, Anfragen,
  -- Rechnungen, Reklamationen und Fehler für kw-maintenance; nur service_role.
  select jsonb_build_object(
    'outbox_dead', (select count(*) from public.kw_outbox where processed_at is null and attempts >= 8),
    'outbox_stuck', (select count(*) from public.kw_outbox where processed_at is null and attempts < 8 and available_at < now() - interval '30 minutes'),
    'cron_failed', (select count(*) from cron.job_run_details where status = 'failed' and start_time > now() - interval '2 hours'),
    'http_failed', (select count(*) from net._http_response where created > now() - interval '2 hours' and (status_code >= 400 or error_msg is not null or timed_out)),
    'leads_waiting', (
      select count(*) from public.leads l
      where l.status = 'new' and l.anonymized_at is null
        and l.created_at between now() - interval '30 days' and now() - interval '24 hours'
        and not exists (select 1 from public.lead_auctions a where a.lead_id = l.id)
    ),
    'invoices_blocked', (
      select count(*) from public.invoices i
      where i.status = 'draft' and i.created_at < now() - interval '1 day'
        and i.invoice_type in ('lead_purchase', 'lead_commission')
        and coalesce((select m.auto_issue_invoices from public.kw_marketplace_settings m limit 1), true)
    ),
    'complaints_open', (select count(*) from public.kw_contact_complaints where status = 'offen' and created_at < now() - interval '5 days'),
    'errors_critical', (select count(*) from public.error_logs where severity = 'critical' and coalesce(last_seen_at, created_at) > now() - interval '1 hour')
  );
$$;

revoke execute on function public.kw_health_snapshot() from public, anon, authenticated;
grant execute on function public.kw_health_snapshot() to service_role;

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
    'invoice_cancellable', coalesce(p_accept and v_invoice.id is not null
      and v_invoice.status <> 'cancelled' and v_invoice.payment_status <> 'paid', false),
    'invoice_paid', coalesce(p_accept and v_invoice.payment_status = 'paid', false)
  );
end;
$$;

revoke execute on function public.kw_admin_decide_complaint(uuid, boolean, text) from public, anon;
grant execute on function public.kw_admin_decide_complaint(uuid, boolean, text) to authenticated;
