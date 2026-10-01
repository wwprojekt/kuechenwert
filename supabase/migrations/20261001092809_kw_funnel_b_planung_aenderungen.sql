-- Funnel B mit hochgeladener Planung: Der Funnel fragt nicht mehr ab, was in
-- der Planung steht (Küchenform, Detailfragen), sondern nur, ob die Studios
-- sie genau so oder geändert anbieten sollen. Die Antwort steht in
-- leads.funnel_answers (planChanges = none | changes, planChangesText) und
-- über kw_lead_public_summary (answers) in der Zusammenfassung der
-- Ausschreibung.
--
-- * kw_anonymize_lead: entfernt den Freitext planChangesText wie extrasNotes
--   aus den Antworten und aus der Zusammenfassung der Ausschreibung.
-- * kw_ux_field_label: Namen der neuen Felder und des Schritts „aenderungen“.

-- ----------------------------------------------------------------------------
-- 1. Anonymisierung
-- ----------------------------------------------------------------------------

create or replace function public.kw_anonymize_lead(p_lead_id uuid, p_source text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  -- DEFINER: nur service_role; Dateien löscht der Aufrufer vorher über die
  -- Storage-API (kw_lead_storage_paths).
  v_lead record;
  v_a public.lead_auctions%rowtype;
begin
  select id, email, anonymized_at into v_lead from public.leads where id = p_lead_id for update;
  if v_lead.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_lead.anonymized_at is not null then
    return jsonb_build_object('ok', true, 'already', true);
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

  -- Mail-Protokoll mit dem Kunden (Projektlinks, Angebote, Antworten) leeren;
  -- Studio- und Kontomails tragen eine recipient_id und bleiben unberührt.
  if v_lead.email is not null then
    update public.admin_emails
       set body_html = '', body_text = '', recipient_name = null,
           recipient_email = 'geloescht@anonymisiert.invalid', raw_headers = null, attachments = null
     where recipient_id is null and lower(recipient_email) = lower(v_lead.email);
    update public.admin_emails
       set body_html = '', body_text = '', sender_name = null,
           sender_email = 'geloescht@anonymisiert.invalid', raw_headers = null, attachments = null
     where direction = 'inbound' and lower(sender_email) = lower(v_lead.email);
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
         funnel_answers = (coalesce(funnel_answers, '{}'::jsonb)
           - 'salutation' - 'extrasNotes' - 'planChangesText' - 'wishes' - 'special_wishes' - 'notes' - 'contact')
           #- '{config,wishes}',
         status = case when status = 'closed_won' then status else 'closed_lost'::lead_status end,
         anonymized_at = now()
   where id = p_lead_id;

  -- Freitexte der Ausschreibung sehen Studios mit Angebot weiterhin.
  update public.lead_auctions
     set public_summary = coalesce(public_summary, '{}'::jsonb) - 'wishes'
           #- '{config,wishes}' #- '{room,notes}' #- '{answers,extrasNotes}' #- '{answers,planChangesText}'
   where lead_id = p_lead_id;

  update public.lead_consents set ip_address = null, user_agent = null where lead_id = p_lead_id;
  update public.lead_access_tokens set revoked_at = now() where lead_id = p_lead_id and revoked_at is null;
  delete from public.lead_upload_tokens where lead_id = p_lead_id;
  delete from public.lead_files where lead_id = p_lead_id;
  delete from public.lead_views where lead_id = p_lead_id;
  delete from public.kw_lead_details where lead_id = p_lead_id;
  update public.planner_sessions
     set photo_paths = '{}', ip_address = null, user_agent = null, expert_note = null,
         spec = coalesce(spec, '{}'::jsonb) - 'wishes'
   where lead_id = p_lead_id;
  update public.planner_renders r
     set image_path = null, input_image_path = null, user_message = null
    from public.planner_sessions s
   where s.id = r.session_id and s.lead_id = p_lead_id;

  insert into public.audit_logs (action, entity_type, entity_id, details)
  values ('lead_anonymized', 'lead', p_lead_id::text, jsonb_build_object('source', p_source));

  return jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.kw_anonymize_lead(uuid, text) from public, anon, authenticated;
grant execute on function public.kw_anonymize_lead(uuid, text) to service_role;

-- ----------------------------------------------------------------------------
-- 2. Feldnamen der UX-Alerts
-- ----------------------------------------------------------------------------

create or replace function public.kw_ux_field_label(p_field text)
returns text
language sql
immutable
set search_path to 'public', 'pg_catalog'
as $function$
  select case
    when p_field is null then null
    when p_field ~ '^wall-[a-z]$' then 'Wand ' || upper(right(p_field, 1))
    else coalesce((
      select m.label
      from (values
        ('first_name', 'Vorname'), ('last_name', 'Nachname'), ('email', 'E-Mail'), ('phone', 'Telefon'),
        ('salutation', 'Anrede'), ('postal_code', 'Postleitzahl'), ('postal-code', 'Postleitzahl'),
        ('plz-early', 'Postleitzahl'), ('funnel-plz', 'Postleitzahl'), ('plz', 'Postleitzahl'), ('city', 'Ort'),
        ('existing_offer_price', 'Genannter Preis'), ('existing_offer_studio', 'Name des Küchenstudios'),
        ('offer_delivery', 'Planung hochladen oder nachreichen'), ('uploads', 'Planung und Unterlagen'),
        ('remove_file', 'Datei entfernen'), ('accept_terms', 'AGB-Haken'), ('terms', 'AGB-Haken'),
        ('plan_changes', 'Änderungen an der Planung'), ('aenderungen', 'Änderungen an der Planung'),
        ('plan_changes_text', 'Änderungswünsche zur Planung'),
        ('consent_share', 'Einwilligung zur Weitergabe'),
        ('share_with_studios', 'Einwilligung zur Weitergabe'), ('consent_call', 'Einwilligung zum Rückruf'),
        ('consent_studio_call', 'Anrufe durch Studios'), ('contact_by_phone', 'Telefonkontakt'),
        ('anruf', 'Telefonkontakt'), ('marketing', 'Werbe-Einwilligung'), ('ai_training', 'KI-Training'),
        ('ceiling', 'Raumhöhe'), ('wishes', 'Wünsche'), ('timeframe', 'Zeitrahmen'), ('zeitrahmen', 'Zeitrahmen'),
        ('kitchen_form', 'Küchenform'), ('kuechenform', 'Küchenform'), ('room_type', 'Raum'),
        ('housing_type', 'Wohnsituation'), ('extra_appliances', 'Zusatzgeräte'), ('budget_eur', 'Budget'),
        ('services', 'Leistungen'), ('leistungen', 'Leistungen'), ('offer_includes', 'Im Preis enthalten'),
        ('leistungsumfang', 'Im Preis enthalten'), ('offer_valid_until', 'Preis gilt bis'),
        ('budget', 'Budget'), ('purchase_reason', 'Anlass'), ('anlass', 'Anlass'),
        ('housing', 'Wohnsituation'), ('wohnsituation', 'Wohnsituation'),
        ('ventilation', 'Dunstabzug'), ('abluft', 'Dunstabzug'), ('notes', 'Hinweis')
      ) as m(key, label)
      where m.key = regexp_replace(p_field, '^kontakt-', '')
    ), p_field)
  end
$function$;
