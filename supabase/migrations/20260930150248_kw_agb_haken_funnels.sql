-- ============================================================================
-- AGB-Haken statt Anruf-Haken, Angebote in jeder Planung (30.09.2026)
--
-- Alle drei Funnels enden mit einem Pflicht-Haken „Ich akzeptiere die AGB und
-- habe die Datenschutzerklärung gelesen“; der Hinweis darüber nennt, dass
-- höchstens drei Studios Name, E-Mail und Telefonnummer für Rückfragen zum
-- Angebot erhalten (supabase/functions/_shared/lead-terms.ts). Die einzelnen
-- Haken für Anrufe und Werbung entfallen, Anrufe schaltet der Kunde auf der
-- Projektseite ab (kw-project, Aktion calls). Der Traumküchen-Planer fragt
-- nicht mehr Ja/Nein zu Angeboten: Jede Planung wird ausgeschrieben. Funnel B
-- fragt nach der Planung aus dem Studio statt nach einem schriftlichen Angebot.
--
-- 1. AGB: Leistung, Kontaktdaten mit Telefonnummer, Anrufe abschalten.
-- 2. Datenschutzerklärung Abschnitt 3 und 4: Ablauf und Rechtsgrundlage.
-- 3. Studios sehen vor dem Kontaktkauf, ob die Telefonnummer dabei ist.
-- 4. Feldnamen der UX-Alerts für den AGB-Haken und die neuen Funnel-B-Texte.
-- Die Textersetzungen brechen ab, wenn der Text zwischenzeitlich geändert wurde.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AGB
-- ----------------------------------------------------------------------------

do $$
declare
  v_content text;
  v_pairs text[][] := array[
    array[
      'KüchenWert ist eine Marke der WohnWert GmbH.</p>',
      'KüchenWert ist eine Marke der WohnWert GmbH.</p>' || chr(10)
        || '<p>(3) Diese Bedingungen bestätigen Sie beim Absenden Ihrer Anfrage.</p>'
    ],
    array[
      'ein vorhandenes Angebot eines Küchenstudios vergleichen und unterbieten lassen oder Ihre Traumküche im Planer mit Kostenschätzung und KI-Visualisierung entwerfen und daraus eine Anfrage erstellen.',
      'den Preis, den Ihnen ein Küchenstudio für Ihre Planung genannt hat, von anderen Studios unterbieten lassen oder Ihre Traumküche im Planer mit Kostenschätzung und KI-Visualisierung entwerfen und dafür Angebote anfragen.'
    ],
    array[
      'Höchstens drei Studios können Ihre Kontaktdaten vorab für Rückfragen erhalten. Ihre Telefonnummer erhalten Studios vor einem Zuschlag nur, wenn Sie Anrufe von Studios erlaubt haben.',
      'Höchstens drei Studios können Ihre Kontaktdaten – Name, E-Mail-Adresse und Telefonnummer – vorab erhalten und Sie per E-Mail oder Telefon kontaktieren, um Rückfragen zu Ihrem Angebot zu klären. '
        || 'Anrufe können Sie auf Ihrer Projektseite jederzeit ausschalten; die Studios erreichen Sie dann per E-Mail. '
        || 'Lassen Sie einen Studio-Preis unterbieten, rufen wir Sie vorher kurz an, um Ihre Planung zu prüfen.'
    ],
    array[
      'Einwilligungen, etwa in Anrufe durch Studios oder Werbung, können Sie jederzeit widerrufen.',
      'Einwilligungen, etwa zur Verbesserung der KI-Visualisierung, können Sie jederzeit widerrufen.'
    ],
    array[
      '<em>Stand: 28. September 2026</em>',
      '<em>Stand: 30. September 2026</em>'
    ]
  ];
  i integer;
begin
  select content into v_content from public.legal_pages where slug = 'agb';
  if v_content is null then
    raise exception 'AGB fehlen';
  end if;
  if strpos(v_content, 'Anrufe können Sie auf Ihrer Projektseite jederzeit ausschalten') > 0 then
    return;
  end if;
  for i in 1 .. array_length(v_pairs, 1) loop
    if strpos(v_content, v_pairs[i][1]) = 0 then
      raise exception 'AGB wurden zwischenzeitlich geändert (%) – Ersetzung abgebrochen', left(v_pairs[i][1], 60);
    end if;
    v_content := replace(v_content, v_pairs[i][1], v_pairs[i][2]);
  end loop;
  update public.legal_pages
     set content = v_content,
         updated_at = now(),
         published_at = now(),
         version = version + 1
   where slug = 'agb';
end $$;

-- ----------------------------------------------------------------------------
-- 2. Datenschutzerklärung
-- ----------------------------------------------------------------------------

do $$
declare
  v_content text;
  v_pairs text[][] := array[
    array[
      'ein vorhandenes Angebot unterbieten lassen oder Ihre Traumküche planen,',
      'einen Studio-Preis unterbieten lassen oder Ihre Traumküche planen,'
    ],
    array[
      'Grundrisse, Fotos und Angebote, die Sie hochladen, prüfen wir zuerst',
      'Planungen, Grundrisse, Fotos und Angebote, die Sie hochladen, prüfen wir zuerst'
    ],
    array[
      'Anders im Traumküchen-Planer: Fordern Sie Angebote an, sehen die Studios Ihre Planung mit den Visualisierungen und den Raumfotos, die Sie dort hochgeladen haben.',
      'Anders im Traumküchen-Planer: Die Studios sehen Ihre Planung mit den Visualisierungen und den Raumfotos, die Sie dort hochgeladen haben.'
    ],
    array[
      'Ihre Kontaktdaten erhalten höchstens drei Studios für Rückfragen sowie das Studio, dessen Angebot Sie annehmen.',
      'Ihre Kontaktdaten – Name, E-Mail-Adresse und Telefonnummer – erhalten höchstens drei Studios für Rückfragen zu Ihrem Angebot sowie das Studio, dessen Angebot Sie annehmen; '
        || 'Anrufe der Studios können Sie auf Ihrer Projektseite jederzeit ausschalten.'
    ],
    array[
      'Bei einem Angebotsvergleich (vorhandenes Studio-Angebot) besprechen wir Ihr Angebot vorher telefonisch mit Ihnen.',
      'Lassen Sie einen Studio-Preis unterbieten, besprechen wir Ihre Planung vorher telefonisch mit Ihnen.'
    ],
    array[
      'sobald Sie Name und E-Mail-Adresse angegeben haben (möchten Sie Angebote, auch Ihre Telefonnummer), und schicken Ihnen beides mit dem Link zu Ihrer Projektseite per E-Mail.',
      'sobald Sie Name, E-Mail-Adresse und Telefonnummer angegeben und unsere AGB bestätigt haben, und schicken Ihnen beides mit dem Link zu Ihrer Projektseite per E-Mail; '
        || 'zugleich fragen Sie damit Angebote der Studios für Ihre Planung an.'
    ],
    array[
      'Möchten Sie dabei keine Angebote, sehen Küchenstudios Ihre Planung nicht; Angebote können Sie später auf Ihrer Projektseite anfordern.',
      'Planungen, die bis zum 30.09.2026 ohne Angebote abgeschlossen wurden, sehen Küchenstudios nicht; Angebote können Sie dafür auf Ihrer Projektseite anfordern.'
    ],
    array[
      'Die Vermittlung erfolgt auf Ihre Anfrage hin (Art. 6 Abs. 1 lit. b DSGVO). Anrufe und Werbe-E-Mails erfolgen nur mit Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die Sie jederzeit mit Wirkung für die Zukunft widerrufen können.',
      'Die Vermittlung erfolgt auf Ihre Anfrage hin und nach unseren AGB (Art. 6 Abs. 1 lit. b DSGVO); dazu gehören die Weitergabe an Studios wie beschrieben '
        || 'und Rückfragen der Studios oder unseres Teams zu Ihrer Anfrage per E-Mail oder Telefon. '
        || 'Werbe-E-Mails erfolgen nur mit Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die Sie jederzeit mit Wirkung für die Zukunft widerrufen können.'
    ],
    array[
      'Fordern Sie Angebote an, sehen auch die Küchenstudios Ihre Raumfotos und Visualisierungen, ohne Ihren Namen und Ihre Kontaktdaten.',
      'Küchenstudios sehen Ihre Raumfotos und Visualisierungen ohne Ihren Namen und Ihre Kontaktdaten.'
    ]
  ];
  i integer;
begin
  select content into v_content from public.legal_pages where slug = 'datenschutz';
  if v_content is null then
    raise exception 'Datenschutzerklärung fehlt';
  end if;
  if strpos(v_content, 'Rückfragen der Studios oder unseres Teams zu Ihrer Anfrage') > 0 then
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
-- 3. Studio-Projektansicht: Telefonnummer vor dem Kontaktkauf ankündigen
-- ----------------------------------------------------------------------------

create or replace function public.kw_dealer_project(p_auction_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  -- DEFINER: siehe kw_dealer_projects; Kontaktdaten nur bei Kauf/Zuschlag.
  v_uid uuid := auth.uid();
  v_origin text;
  v_radius integer;
  v_a public.lead_auctions%rowtype;
  v_l public.leads%rowtype;
  v_unlocked boolean;
  v_won boolean;
  v_has_bid boolean;
  v_distance numeric;
  v_media jsonb;
begin
  if not public.kw_is_dealer_account(v_uid) then
    raise exception 'Nur für freigeschaltete Küchenstudios.' using errcode = '42501';
  end if;
  select * into v_a from public.lead_auctions where id = p_auction_id;
  if v_a.id is null or v_a.status = 'draft' then
    raise exception 'Projekt nicht gefunden.' using errcode = 'P0002';
  end if;
  select * into v_l from public.leads where id = v_a.lead_id;
  select o.postal_code, o.radius_km into v_origin, v_radius from public.kw_dealer_origin(v_uid) o;
  v_distance := case when v_origin is null then null else public.kw_plz_distance_km(v_origin, v_l.postal_code) end;

  v_unlocked := exists (select 1 from public.lead_match_candidates mc
                        where mc.lead_id = v_l.id and mc.dealer_id = v_uid and mc.is_purchased);
  v_won := exists (select 1 from public.lead_bids b where b.id = v_a.won_bid_id and b.dealer_id = v_uid);
  v_has_bid := exists (select 1 from public.lead_bids b where b.auction_id = v_a.id and b.dealer_id = v_uid);

  -- Eigene Projekte bleiben immer abrufbar; fremde nur, solange sie offen sind,
  -- im Einzugsgebiet liegen und das Konto aktiv ist.
  if not (v_unlocked or v_won or v_has_bid) then
    if v_a.status not in ('active', 'completed')
       or not public.kw_is_active_dealer(v_uid)
       or not public.kw_dealer_in_area(v_uid, v_l.postal_code) then
      raise exception 'Projekt nicht gefunden.' using errcode = 'P0002';
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('bucket', r.storage_bucket, 'path', r.image_path,
                                               'kind', 'render', 'mode', r.mode, 'created_at', r.created_at)
                            order by r.version desc), '[]'::jsonb)
  into v_media
  from public.planner_renders r
  where r.session_id = v_a.planner_session_id and r.status = 'success' and r.image_path is not null;

  if v_a.planner_session_id is not null then
    select v_media || coalesce((
      select jsonb_agg(jsonb_build_object('bucket', 'planner-media', 'path', p, 'kind', 'photo'))
      from public.planner_sessions s, unnest(s.photo_paths) p
      where s.id = v_a.planner_session_id
    ), '[]'::jsonb) into v_media;
  end if;

  -- Unterlagen: freigegebene immer, alle erst nach Kontaktkauf oder Zuschlag.
  select v_media || coalesce((
    select jsonb_agg(jsonb_build_object(
             'bucket', 'lead-files', 'path', f.file_url, 'kind', 'document',
             'category', f.category, 'type', f.file_type,
             'name', case when v_unlocked or v_won then f.file_name end,
             'released', f.shared_with_studios)
           order by f.created_at)
    from public.lead_files f
    where f.lead_id = v_l.id
      and (f.shared_with_studios or v_unlocked or v_won)
  ), '[]'::jsonb) into v_media;

  insert into public.lead_views (lead_id, dealer_id)
  select v_l.id, v_uid
  where not exists (
    select 1 from public.lead_views lv
    where lv.lead_id = v_l.id and lv.dealer_id = v_uid and lv.viewed_at > now() - interval '1 day'
  );

  return jsonb_build_object(
    'auction_id', v_a.id,
    'status', v_a.status,
    'funnel_type', v_l.funnel_type::text,
    'published_at', v_a.published_at,
    'ends_at', v_a.ends_at,
    'decision_deadline_at', v_a.decision_deadline_at,
    'postal_prefix', left(v_l.postal_code, 3) || 'xx',
    'region', v_l.region,
    'distance_km', v_distance,
    'service_radius_km', v_radius,
    'in_service_area', (v_origin is not null and (v_distance is null or v_distance <= v_radius)),
    'summary', v_a.public_summary,
    'estimate_min_eur', v_a.estimate_min_eur,
    'estimate_max_eur', v_a.estimate_max_eur,
    'reference_price_eur', v_a.reference_price_eur,
    'bid_visibility', v_a.bid_visibility,
    'offer_count', (select count(*) from public.lead_bids b where b.auction_id = v_a.id and b.status in ('active', 'accepted')),
    'lowest_offer_eur', case when v_a.bid_visibility = 'lowest_price'
      then (select min(b.price_eur) from public.lead_bids b where b.auction_id = v_a.id and b.status = 'active') end,
    'my_offer', (select to_jsonb(b) - 'dealer_id' - 'is_winning' from public.lead_bids b
                 where b.auction_id = v_a.id and b.dealer_id = v_uid),
    'contact_unlocked', v_unlocked,
    'contact_purchases', (select count(*) from public.lead_match_candidates mc
                          where mc.lead_id = v_l.id and mc.is_purchased and mc.access_source = 'purchase'),
    'max_contact_purchases', v_a.max_contact_purchases,
    'contact_price_cents', v_a.contact_price_cents,
    'contact_available', public.kw_lead_share_consent(v_l.id),
    -- Vor dem Kauf nur, ob eine Nummer dabei ist, nie die Nummer selbst.
    'phone_included', (coalesce(length(trim(v_l.phone)), 0) > 0 and v_l.consent_call),
    'awarded_to_me', v_won,
    'media', v_media,
    'details', (select jsonb_build_object('customer', d.customer, 'customer_updated_at', d.customer_updated_at,
                                          'expert', d.expert, 'expert_updated_at', d.expert_updated_at)
                from public.kw_lead_details d where d.lead_id = v_l.id),
    'contact', case when v_unlocked or v_won then jsonb_build_object(
      'first_name', v_l.first_name, 'last_name', v_l.last_name,
      'email', v_l.email,
      'phone', case when v_won or v_l.consent_call then v_l.phone end,
      'postal_code', v_l.postal_code, 'city', v_l.city, 'address_line', v_l.address_line,
      'consent_call', v_l.consent_call
    ) end
  );
end;
$function$;

-- ----------------------------------------------------------------------------
-- 4. Feldnamen der UX-Alerts
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
