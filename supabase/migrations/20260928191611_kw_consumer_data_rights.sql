-- ============================================================================
-- KüchenWert Betroffenenrechte (28.09.2026)
--
-- kw_lead_storage_paths: alle Dateien eines Leads (Funnel-B-Uploads,
--   Raumfotos, KI-Bilder), damit kw-project bzw. der Löschjob sie über die
--   Storage-API löschen kann, bevor die Datenbankzeilen anonymisiert werden.
-- kw_anonymize_lead: beendet eine offene Ausschreibung und entfernt alle
--   personenbezogenen Daten des Leads. Rechnungen an Studios bleiben
--   (Aufbewahrungspflicht) und enthalten nur PLZ-Bereich und Projektnummer.
-- kw_project_erase: Löschung auf Wunsch des Kunden über die Projektseite.
-- kw_project_export: Auskunft/Datenübertragbarkeit (Art. 15/20 DSGVO).
-- ============================================================================

create or replace function public.kw_lead_storage_paths(p_lead_id uuid)
returns table(bucket text, path text)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: nur service_role (Edge Functions) ruft die Funktion auf.
  select 'lead-files'::text, f.file_url
  from public.lead_files f
  where f.lead_id = p_lead_id and f.file_url is not null
  union
  select 'planner-media'::text, p
  from public.planner_sessions s, unnest(s.photo_paths) p
  where s.lead_id = p_lead_id
  union
  select coalesce(r.storage_bucket, 'planner-media'), r.image_path
  from public.planner_renders r
  join public.planner_sessions s on s.id = r.session_id
  where s.lead_id = p_lead_id and r.image_path is not null
  union
  select 'planner-media'::text, r.input_image_path
  from public.planner_renders r
  join public.planner_sessions s on s.id = r.session_id
  where s.lead_id = p_lead_id and r.input_image_path is not null;
$$;

create or replace function public.kw_anonymize_lead(p_lead_id uuid, p_source text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: nur service_role; Dateien löscht der Aufrufer vorher über die
  -- Storage-API (kw_lead_storage_paths).
  v_a public.lead_auctions%rowtype;
begin
  if not exists (select 1 from public.leads where id = p_lead_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  select * into v_a from public.lead_auctions
  where lead_id = p_lead_id and status in ('draft', 'active', 'completed')
  for update;
  if v_a.id is not null then
    update public.lead_auctions
       set status = 'cancelled', cancelled_reason = 'Daten gelöscht', decided_at = now()
     where id = v_a.id;
    update public.lead_bids set status = 'declined' where auction_id = v_a.id and status = 'active';
    perform public.kw_enqueue('project_cancelled', jsonb_build_object('auction_id', v_a.id, 'lead_id', p_lead_id));
  end if;

  update public.leads
     set first_name = 'Gelöscht',
         last_name = null,
         email = null,
         phone = null,
         address_line = null,
         city = null,
         ip_address = null,
         user_agent = null,
         special_wishes = null,
         consent_call = false,
         consent_marketing = false,
         gclid = null, gbraid = null, wbraid = null, msclkid = null, fbclid = null,
         user_id = null,
         funnel_answers = coalesce(funnel_answers, '{}'::jsonb)
           - 'salutation' - 'extrasNotes' - 'wishes' - 'special_wishes' - 'notes' - 'contact',
         status = case when status = 'closed_won' then status else 'closed_lost'::lead_status end
   where id = p_lead_id;

  update public.lead_consents set ip_address = null, user_agent = null where lead_id = p_lead_id;
  update public.lead_access_tokens set revoked_at = now() where lead_id = p_lead_id and revoked_at is null;
  delete from public.lead_upload_tokens where lead_id = p_lead_id;
  delete from public.lead_files where lead_id = p_lead_id;
  update public.planner_sessions
     set photo_paths = '{}', ip_address = null, user_agent = null, expert_note = null
   where lead_id = p_lead_id;
  update public.planner_renders r
     set image_path = null, input_image_path = null, user_message = null
    from public.planner_sessions s
   where s.id = r.session_id and s.lead_id = p_lead_id;

  insert into public.audit_logs (action, entity_type, entity_id, details)
  values ('lead_anonymized', 'lead', p_lead_id::text, jsonb_build_object('source', p_source));

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.kw_project_erase(p_lead_id uuid)
returns jsonb
language sql
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: kw-project ruft die Funktion nach Bestätigung durch den Kunden auf.
  select public.kw_anonymize_lead(p_lead_id, 'customer');
$$;

create or replace function public.kw_project_export(p_lead_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: Kunden haben keine Tabellenrechte; Zugriff nur über den Projektlink.
  select jsonb_build_object(
    'erstellt_am', now(),
    'anfrage', (
      select to_jsonb(l) - 'id' - 'submission_id' - 'tier' - 'score' - 'bot_check'
      from public.leads l where l.id = p_lead_id
    ),
    'einwilligungen', coalesce((
      select jsonb_agg(jsonb_build_object(
        'zweck', c.purpose, 'erteilt', c.granted, 'textversion', c.text_version,
        'zeitpunkt', c.created_at, 'ip_adresse', c.ip_address
      ) order by c.created_at)
      from public.lead_consents c where c.lead_id = p_lead_id
    ), '[]'::jsonb),
    'ausschreibungen', coalesce((
      select jsonb_agg(jsonb_build_object(
        'status', a.status, 'veroeffentlicht', a.published_at, 'ende', a.ends_at,
        'entscheidung_bis', a.decision_deadline_at, 'zusammenfassung', a.public_summary
      ) order by a.created_at)
      from public.lead_auctions a where a.lead_id = p_lead_id
    ), '[]'::jsonb),
    'angebote', coalesce((
      select jsonb_agg(jsonb_build_object(
        'studio', coalesce(nullif(p.company_name, ''), 'Küchenstudio'),
        'preis_eur', b.price_eur, 'status', b.status, 'abgegeben', b.created_at
      ) order by b.created_at)
      from public.lead_bids b
      join public.lead_auctions a on a.id = b.auction_id
      join public.profiles p on p.id = b.dealer_id
      where a.lead_id = p_lead_id
    ), '[]'::jsonb),
    'kontaktfreigaben', coalesce((
      select jsonb_agg(jsonb_build_object(
        'studio', coalesce(nullif(p.company_name, ''), 'Küchenstudio'),
        'zeitpunkt', mc.purchased_at
      ) order by mc.purchased_at)
      from public.lead_match_candidates mc
      join public.profiles p on p.id = mc.dealer_id
      where mc.lead_id = p_lead_id and mc.is_purchased
    ), '[]'::jsonb),
    'planung', (
      select jsonb_build_object('raum', s.room, 'konfiguration', s.spec, 'schaetzung', s.estimate,
                                'anzahl_fotos', cardinality(s.photo_paths))
      from public.planner_sessions s where s.lead_id = p_lead_id
      order by s.created_at desc limit 1
    ),
    'auftrag', (
      select jsonb_build_object('status', o.status, 'angebotspreis_eur', o.offer_price_eur,
                                'auftragswert_eur', o.contract_value_eur, 'erstellt', o.created_at)
      from public.kw_orders o where o.lead_id = p_lead_id
      order by o.created_at desc limit 1
    )
  );
$$;

revoke execute on function public.kw_lead_storage_paths(uuid) from public, anon, authenticated;
revoke execute on function public.kw_anonymize_lead(uuid, text) from public, anon, authenticated;
revoke execute on function public.kw_project_erase(uuid) from public, anon, authenticated;
revoke execute on function public.kw_project_export(uuid) from public, anon, authenticated;
grant execute on function public.kw_lead_storage_paths(uuid) to service_role;
grant execute on function public.kw_anonymize_lead(uuid, text) to service_role;
grant execute on function public.kw_project_erase(uuid) to service_role;
grant execute on function public.kw_project_export(uuid) to service_role;
