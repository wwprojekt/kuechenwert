-- ============================================================================
-- Einwilligungen, Widerruf und Ausschreibungen (30.09.2026)
--
-- 1. „Projekt beenden“ auf der Projektseite widerruft die Weitergabe:
--    kw_project_cancel protokolliert share_with_studios = false, damit
--    kw_open_tender ohne neue Anfrage keine neue Ausschreibung anlegt.
-- 2. kw_admin_publish_tender veröffentlicht nur mit Weitergabe-Einwilligung.
-- 3. kw_admin_open_tender lehnt Planungen aus Funnel C ab: Ihre Ausschreibung
--    braucht die Planung (Konfiguration, Maße, Bilder) und entsteht über
--    kw-planner (Aktion admin-open-tender, _shared/planner-offers.ts).
-- 4. Einwilligungsprotokoll: Admins lesen nur; schreiben dürfen nur
--    service_role und die Definer-Funktionen.
-- 5. Datenschutzerklärung: Studios sehen Raumfotos und Visualisierungen aus
--    dem Planer, „Projekt beenden“ ist ein Widerruf der Weitergabe.
-- 6. Health-Check leads_waiting zählt Leads ohne Weitergabe-Einwilligung
--    (Funnel C „nur Visualisierung“) nicht als unbearbeitet; übrige Befunde
--    wie in kw_ki_robustheit (20260930113033).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Projekt beenden = Widerruf der Weitergabe
-- ----------------------------------------------------------------------------

drop function if exists public.kw_project_cancel(uuid, text);

create function public.kw_project_cancel(
  p_lead_id uuid,
  p_reason text default null,
  p_ip inet default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: kw-project (service_role) beendet das Projekt über den Projektlink.
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

  -- Ohne diese Zeile gälte die alte Zustimmung weiter und das Team könnte neu ausschreiben.
  insert into public.lead_consents (lead_id, user_id, purpose, granted, text_version, ip_address, user_agent)
  select l.id, l.user_id, 'share_with_studios', false, 'kw-projekt-beenden-2026-09-30', p_ip, left(p_user_agent, 500)
  from public.leads l
  where l.id = p_lead_id;

  perform public.kw_enqueue('project_cancelled', jsonb_build_object('auction_id', v_a.id, 'lead_id', p_lead_id));
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.kw_project_cancel(uuid, text, inet, text) from public, anon, authenticated;
grant execute on function public.kw_project_cancel(uuid, text, inet, text) to service_role;

-- ----------------------------------------------------------------------------
-- 2. Veröffentlichen nur mit Einwilligung
-- ----------------------------------------------------------------------------

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
  if public.kw_lead_share_consent(v_auction.lead_id) is false then
    raise exception 'Der Kunde hat der Weitergabe an Küchenstudios nicht zugestimmt oder sie widerrufen. Die Ausschreibung bleibt ein Entwurf.'
      using errcode = 'P0001';
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

-- ----------------------------------------------------------------------------
-- 3. Funnel C nur über die Planung ausschreiben
-- ----------------------------------------------------------------------------

create or replace function public.kw_admin_open_tender(p_lead_id uuid, p_notify_customer boolean default false)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: Admin-Aktion aus dem Frontend, prüft die Rolle selbst.
  v_lead public.leads%rowtype;
  v_auction_id uuid;
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into v_lead from public.leads where id = p_lead_id;
  if v_lead.id is null then
    raise exception 'Lead nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_lead.funnel_type = 'traumkueche' then
    raise exception 'Planungen aus dem Traumküchen-Planer schreibt kw-planner aus (Aktion admin-open-tender), sonst fehlen Studios Konfiguration, Maße und Bilder.'
      using errcode = 'P0001';
  end if;

  v_auction_id := public.kw_open_tender(
    p_lead_id, false, public.kw_lead_public_summary(v_lead),
    public.kw_lead_estimate_eur(v_lead, 'min'), public.kw_lead_estimate_eur(v_lead, 'max'),
    coalesce(v_lead.existing_offer_price_cents / 100.0, v_lead.budget_midpoint::numeric,
             public.kw_lead_estimate_eur(v_lead, 'mid')),
    null
  );
  if p_notify_customer then
    perform public.kw_enqueue('project_created', jsonb_build_object('lead_id', p_lead_id, 'funnel', v_lead.funnel_type::text));
  end if;
  return v_auction_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Einwilligungsprotokoll nur lesbar
-- ----------------------------------------------------------------------------

drop policy if exists "LeadConsents: admin full" on public.lead_consents;
drop policy if exists "LeadConsents: admin read" on public.lead_consents;
create policy "LeadConsents: admin read" on public.lead_consents
  for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'::app_role));

revoke insert, update, delete, truncate on public.lead_consents from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. Datenschutzerklärung
-- ----------------------------------------------------------------------------

do $$
declare
  v_content text;
  v_pairs text[][] := array[
    array[
      'vollständig erhalten sie nur die Studios, die Ihre Kontaktdaten erhalten.',
      'vollständig erhalten sie nur die Studios, die Ihre Kontaktdaten erhalten. Anders im Traumküchen-Planer: '
        || 'Fordern Sie Angebote an, sehen die Studios Ihre Planung mit den Visualisierungen und den Raumfotos, '
        || 'die Sie dort hochgeladen haben.'
    ],
    array[
      'Angebote können Sie später auf Ihrer Projektseite anfordern.</p>',
      'Angebote können Sie später auf Ihrer Projektseite anfordern. Beenden Sie Ihr Projekt auf Ihrer Projektseite, '
        || 'widerrufen Sie damit auch die Weitergabe: Ohne neue Anfrage von Ihnen schreiben wir es nicht erneut aus.</p>'
    ],
    array[
      'Bitte laden Sie keine Fotos hoch, auf denen Personen zu sehen sind.',
      'Bitte laden Sie keine Fotos hoch, auf denen Personen zu sehen sind. Fordern Sie Angebote an, sehen auch die '
        || 'Küchenstudios Ihre Raumfotos und Visualisierungen, ohne Ihren Namen und Ihre Kontaktdaten.'
    ]
  ];
  i integer;
begin
  select content into v_content from public.legal_pages where slug = 'datenschutz';
  if v_content is null then
    raise exception 'Datenschutzerklärung fehlt';
  end if;
  if strpos(v_content, 'widerrufen Sie damit auch die Weitergabe') > 0 then
    return;
  end if;
  for i in 1 .. array_length(v_pairs, 1) loop
    if strpos(v_content, v_pairs[i][1]) = 0 then
      raise exception 'Datenschutzerklärung wurde zwischenzeitlich geändert (%) – Ersetzung abgebrochen', left(v_pairs[i][1], 60);
    end if;
    v_content := replace(v_content, v_pairs[i][1], v_pairs[i][2]);
  end loop;
  update public.legal_pages
     set content = v_content,
         updated_at = now(),
         published_at = now(),
         version = version + 1
   where slug = 'datenschutz';
end $$;

-- ----------------------------------------------------------------------------
-- 6. Health-Check: „nur Visualisierung“ wartet auf keine Bearbeitung
-- ----------------------------------------------------------------------------

create or replace function public.kw_health_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: liest Outbox, Cron-Protokoll, pg_net-Antworten, Anfragen,
  -- Rechnungen, Reklamationen, Fehler und KI-Bilder für kw-maintenance; nur service_role.
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
        and public.kw_lead_share_consent(l.id) is not false
    ),
    'invoices_blocked', (
      select count(*) from public.invoices i
      where i.status = 'draft' and i.created_at < now() - interval '1 day'
        and i.invoice_type in ('lead_purchase', 'lead_commission')
        and coalesce((select m.auto_issue_invoices from public.kw_marketplace_settings m limit 1), true)
    ),
    'complaints_open', (select count(*) from public.kw_contact_complaints where status = 'offen' and created_at < now() - interval '5 days'),
    'errors_critical', (select count(*) from public.error_logs where severity = 'critical' and coalesce(last_seen_at, created_at) > now() - interval '1 hour'),
    'render_cap_near', (
      select case when c.cap > 0 and r.n >= ceil(c.cap * 0.8) then r.n else 0 end
      from (select coalesce((select s.daily_render_cap from public.kw_ai_settings s limit 1), 300) as cap) c,
           (select count(*) as n from public.planner_renders where created_at > now() - interval '24 hours') r
    ),
    'renders_failing', (
      select case when f.failed >= 3 and f.failed >= f.total * 0.3 then f.failed else 0 end
      from (
        select count(*) filter (where status = 'failed') as failed, count(*) as total
        from public.planner_renders
        where created_at > now() - interval '2 hours'
      ) f
    ),
    -- Kontosperre, fehlendes Guthaben oder ungültiger Schlüssel treffen alle Modelle.
    'fal_account_blocked', (
      select count(*) from public.planner_renders
      where created_at > now() - interval '2 hours'
        and concat_ws(' ', error_message, fallback_reason)
            ~* '(fal (submit|status|result) (401|402|403)|exhausted balance|user is locked|FAL_API_KEY)'
    ),
    -- Die Ausweichkette verdeckt ein gestörtes Hauptmodell: Bilder kommen, nur später und evtl. schwächer.
    'renders_fallback_high', (
      select case when f.fell_back >= 3 and f.fell_back >= f.total * 0.25 then f.fell_back else 0 end
      from (
        select count(*) filter (where fallback_from is not null) as fell_back, count(*) as total
        from public.planner_renders
        where created_at > now() - interval '24 hours' and status in ('success', 'failed')
      ) f
    ),
    'renders_stuck', (
      select count(*) from public.planner_renders
      where status = 'pending' and created_at < now() - interval '10 minutes'
    )
  );
$$;

revoke execute on function public.kw_health_snapshot() from public, anon, authenticated;
grant execute on function public.kw_health_snapshot() to service_role;
