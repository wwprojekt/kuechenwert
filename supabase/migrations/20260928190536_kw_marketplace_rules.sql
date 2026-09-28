-- ============================================================================
-- KüchenWert Marktplatz-Regeln (28.09.2026)
--
-- 1. Einzugsgebiet serverseitig: Studios sehen offene Projekte, Fotos und
--    Kontakte nur innerhalb ihres Einzugsgebiets (kw_dealer_in_area). Bisher
--    lieferte der Filter "all" jede Ausschreibung bundesweit, und Detail,
--    Angebot und Kontaktkauf prüften keine Entfernung.
-- 2. Kontaktkauf nur mit Einwilligung "share_with_studios" (Funnel B hat sie
--    bisher nicht erfragt). Die Telefonnummer gibt es vor dem Zuschlag nur mit
--    Anruf-Einwilligung.
-- 3. Eigene Projekte (Angebot, Kontaktkauf, Zuschlag) bleiben abrufbar, auch
--    nach Ablauf oder Abbruch und bei eingeschränktem Konto (Mahnstufe).
--    Eingeschränkte Konten können nur keine neuen Angebote abgeben und keine
--    Kontakte kaufen.
-- 4. Der Mindest-Projektwert filtert jetzt auch "Offene Projekte"; "Alle"
--    zeigt alle offenen Projekte im Einzugsgebiet.
-- 5. lead_views höchstens einmal pro Studio und Tag.
-- 6. Projektlinks laufen nach 180 Tagen ab; pro Projekt bleiben höchstens die
--    fünf neuesten Links gültig.
-- 7. kw_studios_covering: Zahl der aktiven Studios, deren Einzugsgebiet eine
--    PLZ abdeckt (ehrliche Texte bei Anfrage, Projektseite und Mails).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Hilfsfunktionen
-- ----------------------------------------------------------------------------
create or replace function public.kw_is_dealer_account(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: liest user_roles/profiles unabhängig von deren RLS. Anders als
  -- kw_is_active_dealer auch für eingeschränkte Konten (Mahnstufe) wahr.
  select exists (
    select 1
    from public.user_roles r
    join public.profiles p on p.id = r.user_id
    where r.user_id = p_uid
      and r.role = 'dealer'::app_role
      and coalesce(p.is_suspended, false) = false
  );
$$;

create or replace function public.kw_dealer_in_area(p_uid uuid, p_postal_code text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: kw_dealer_origin liest Profil und Marktplatz-Profil des Studios.
  -- Ohne Standort gibt es kein Einzugsgebiet; unbekannte PLZ-Bereiche gelten
  -- als erreichbar, damit Tippfehler keine Projekte verstecken.
  select exists (
    select 1
    from public.kw_dealer_origin(p_uid) o
    where o.postal_code is not null
      and coalesce(public.kw_plz_distance_km(o.postal_code, p_postal_code) <= o.radius_km, true)
  );
$$;

create or replace function public.kw_lead_share_consent(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: lead_consents ist nur für Admins lesbar. Maßgeblich ist die
  -- jüngste Erklärung zum Zweck share_with_studios.
  select coalesce((
    select c.granted
    from public.lead_consents c
    where c.lead_id = p_lead_id and c.purpose = 'share_with_studios'
    order by c.created_at desc
    limit 1
  ), false);
$$;

create or replace function public.kw_studios_covering(p_postal_code text)
returns integer
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: zählt freigeschaltete Studios über user_roles/profiles.
  select count(*)::integer
  from public.user_roles r
  join public.profiles p on p.id = r.user_id
  cross join lateral public.kw_dealer_origin(r.user_id) o
  where r.role = 'dealer'::app_role
    and coalesce(p.is_suspended, false) = false
    and coalesce(p.account_restricted, false) = false
    and o.postal_code is not null
    and public.kw_plz_distance_km(o.postal_code, p_postal_code) <= o.radius_km;
$$;

revoke execute on function public.kw_is_dealer_account(uuid) from public, anon, authenticated;
revoke execute on function public.kw_dealer_in_area(uuid, text) from public, anon, authenticated;
revoke execute on function public.kw_lead_share_consent(uuid) from public, anon, authenticated;
revoke execute on function public.kw_studios_covering(text) from public, anon, authenticated;
grant execute on function public.kw_is_dealer_account(uuid) to service_role;
grant execute on function public.kw_dealer_in_area(uuid, text) to service_role;
grant execute on function public.kw_lead_share_consent(uuid) to service_role;
grant execute on function public.kw_studios_covering(text) to service_role;

-- ----------------------------------------------------------------------------
-- Projekt-Börse
-- ----------------------------------------------------------------------------
create or replace function public.kw_dealer_projects(p_scope text default 'open', p_limit integer default 60, p_offset integer default 0)
returns table(auction_id uuid, status text, funnel_type text, published_at timestamp with time zone, ends_at timestamp with time zone, decision_deadline_at timestamp with time zone, postal_prefix text, region text, distance_km numeric, summary jsonb, estimate_min_eur numeric, estimate_max_eur numeric, reference_price_eur numeric, offer_count integer, lowest_offer_eur numeric, my_offer jsonb, contact_unlocked boolean, contact_purchases integer, max_contact_purchases integer, contact_price_cents integer, awarded_to_me boolean, in_service_area boolean)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: Studios haben keine Tabellenrechte auf Leads/Ausschreibungen;
  -- diese Funktion liefert ausschließlich anonymisierte Felder.
  v_uid uuid := auth.uid();
  v_origin text;
  v_radius integer;
  v_min_value integer;
begin
  if not public.kw_is_dealer_account(v_uid) then
    raise exception 'Nur für freigeschaltete Küchenstudios.' using errcode = '42501';
  end if;
  if p_scope <> 'mine' and not public.kw_is_active_dealer(v_uid) then
    raise exception 'Ihr Konto ist derzeit eingeschränkt. Neue Projekte sehen Sie wieder, sobald offene Rechnungen beglichen sind.' using errcode = '42501';
  end if;
  select o.postal_code, o.radius_km into v_origin, v_radius from public.kw_dealer_origin(v_uid) o;
  select mp.min_project_value_eur into v_min_value from public.kw_dealer_market_profiles mp where mp.dealer_id = v_uid;

  return query
  with base as (
    select
      a.*,
      l.funnel_type::text as l_funnel,
      l.postal_code as l_plz,
      l.region as l_region,
      case when v_origin is null then null else public.kw_plz_distance_km(v_origin, l.postal_code) end as dist,
      coalesce(a.reference_price_eur, (a.estimate_min_eur + a.estimate_max_eur) / 2) as value_eur,
      (select count(*)::integer from public.lead_bids b where b.auction_id = a.id and b.status in ('active', 'accepted')) as n_offers,
      (select min(b.price_eur) from public.lead_bids b where b.auction_id = a.id and b.status = 'active') as min_offer,
      (select jsonb_build_object('id', b.id, 'price_eur', b.price_eur, 'status', b.status,
                                 'revision', b.revision, 'updated_at', b.updated_at,
                                 'delivery_weeks', b.delivery_weeks)
         from public.lead_bids b where b.auction_id = a.id and b.dealer_id = v_uid) as mine,
      exists (select 1 from public.lead_match_candidates mc
              where mc.lead_id = a.lead_id and mc.dealer_id = v_uid and mc.is_purchased) as unlocked,
      (select count(*)::integer from public.lead_match_candidates mc
        where mc.lead_id = a.lead_id and mc.is_purchased and mc.access_source = 'purchase') as n_purchases,
      exists (select 1 from public.lead_bids b where b.id = a.won_bid_id and b.dealer_id = v_uid) as won
    from public.lead_auctions a
    join public.leads l on l.id = a.lead_id
    where a.status <> 'draft'
  ),
  scoped as (
    select b.*, (v_origin is not null and (b.dist is null or b.dist <= v_radius)) as in_area
    from base b
  )
  select
    s.id, s.status, s.l_funnel, s.published_at, s.ends_at, s.decision_deadline_at,
    left(s.l_plz, 3) || 'xx', s.l_region, s.dist,
    s.public_summary, s.estimate_min_eur, s.estimate_max_eur, s.reference_price_eur,
    s.n_offers,
    case when s.bid_visibility = 'lowest_price' then s.min_offer end,
    s.mine, s.unlocked, s.n_purchases, s.max_contact_purchases, s.contact_price_cents,
    s.won,
    s.in_area
  from scoped s
  where
    case p_scope
      when 'mine' then (s.mine is not null or s.unlocked or s.won)
      when 'all' then s.status = 'active' and s.in_area
      else s.status = 'active' and s.in_area
        and (v_min_value is null or s.value_eur is null or s.value_eur >= v_min_value)
    end
  order by
    case when p_scope = 'mine' then s.updated_at end desc nulls last,
    s.ends_at asc nulls last
  limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset);
end;
$$;

create or replace function public.kw_dealer_project(p_auction_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
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
    'awarded_to_me', v_won,
    'media', v_media,
    'contact', case when v_unlocked or v_won then jsonb_build_object(
      'first_name', v_l.first_name, 'last_name', v_l.last_name,
      'email', v_l.email,
      'phone', case when v_won or v_l.consent_call then v_l.phone end,
      'postal_code', v_l.postal_code, 'city', v_l.city, 'address_line', v_l.address_line,
      'consent_call', v_l.consent_call
    ) end
  );
end;
$$;

create or replace function public.kw_dealer_place_offer(p_auction_id uuid, p_price_eur numeric, p_delivery_weeks integer default null, p_includes jsonb default '{}'::jsonb, p_valid_until date default null, p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: einzige Stelle, an der Angebote entstehen oder geändert werden.
  v_uid uuid := auth.uid();
  v_settings public.kw_marketplace_settings%rowtype;
  v_a public.lead_auctions%rowtype;
  v_existing public.lead_bids%rowtype;
  v_bid_id uuid;
  v_floor numeric;
  v_is_update boolean := false;
  v_prev_lowest numeric;
  v_rank integer;
begin
  if not public.kw_is_active_dealer(v_uid) then
    raise exception 'Ihr Konto ist derzeit nicht für neue Angebote freigeschaltet.' using errcode = '42501';
  end if;
  if p_price_eur is null or p_price_eur <= 0 then
    raise exception 'Bitte einen gültigen Angebotspreis angeben.' using errcode = '22023';
  end if;
  if p_message is not null and char_length(p_message) > 2000 then
    raise exception 'Die Nachricht ist zu lang (max. 2000 Zeichen).' using errcode = '22023';
  end if;
  if p_includes is not null and octet_length(p_includes::text) > 4000 then
    raise exception 'Der Leistungsumfang ist zu umfangreich.' using errcode = '22023';
  end if;
  if p_valid_until is not null and p_valid_until < current_date then
    raise exception 'Das Gültigkeitsdatum liegt in der Vergangenheit.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_auction_id::text, 0));
  select * into v_settings from public.kw_marketplace_settings where id;
  select * into v_a from public.lead_auctions where id = p_auction_id;
  if v_a.id is null or v_a.status <> 'active' or v_a.ends_at <= now() then
    raise exception 'Für dieses Projekt können keine Angebote mehr abgegeben werden.' using errcode = 'P0001';
  end if;

  v_floor := coalesce(v_a.estimate_min_eur, v_a.reference_price_eur);
  if v_floor is not null and p_price_eur < round(v_floor * v_settings.min_offer_ratio, 2) then
    raise exception 'Der Preis liegt unplausibel weit unter der Projekt-Schätzung. Bitte prüfen.' using errcode = '22023';
  end if;

  select min(price_eur) into v_prev_lowest from public.lead_bids where auction_id = p_auction_id and status = 'active';
  select * into v_existing from public.lead_bids where auction_id = p_auction_id and dealer_id = v_uid for update;

  if v_existing.id is null
     and not public.kw_dealer_in_area(v_uid, (select l.postal_code from public.leads l where l.id = v_a.lead_id)) then
    raise exception 'Dieses Projekt liegt außerhalb Ihres Einzugsgebiets.' using errcode = 'P0001';
  end if;

  if v_existing.id is not null then
    if v_existing.status = 'active' and p_price_eur > v_existing.price_eur then
      raise exception 'Ein abgegebenes Angebot kann nur gesenkt werden.' using errcode = 'P0001';
    end if;
    if v_existing.status in ('accepted', 'declined') then
      raise exception 'Dieses Angebot ist abgeschlossen.' using errcode = 'P0001';
    end if;
    update public.lead_bids
    set price_eur = p_price_eur,
        delivery_weeks = p_delivery_weeks,
        includes = coalesce(p_includes, '{}'::jsonb),
        valid_until = p_valid_until,
        notes = p_message,
        status = 'active',
        revision = v_existing.revision + 1
    where id = v_existing.id
    returning id into v_bid_id;
    v_is_update := v_existing.status = 'active';
  else
    insert into public.lead_bids (auction_id, dealer_id, price_eur, delivery_weeks, includes,
                                  valid_until, notes, montage_included)
    values (p_auction_id, v_uid, p_price_eur, p_delivery_weeks, coalesce(p_includes, '{}'::jsonb),
            p_valid_until, p_message, coalesce((p_includes ->> 'assembly')::boolean, true))
    returning id into v_bid_id;
  end if;

  insert into public.lead_bid_revisions (bid_id, price_eur) values (v_bid_id, p_price_eur);

  select count(*) + 1 into v_rank from public.lead_bids
  where auction_id = p_auction_id and status = 'active' and price_eur < p_price_eur;

  perform public.kw_enqueue('offer_placed', jsonb_build_object(
    'auction_id', p_auction_id, 'bid_id', v_bid_id, 'dealer_id', v_uid,
    'price_eur', p_price_eur, 'is_update', v_is_update,
    'undercut_previous_lowest', v_prev_lowest is not null and p_price_eur < v_prev_lowest
  ));

  return jsonb_build_object('ok', true, 'bid_id', v_bid_id, 'rank', v_rank, 'is_update', v_is_update);
end;
$$;

create or replace function public.kw_dealer_unlock_contact(p_auction_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: Kontaktkauf ist atomar (Limit, Rechnung, Zugriff, Benachrichtigung).
  v_uid uuid := auth.uid();
  v_a public.lead_auctions%rowtype;
  v_l public.leads%rowtype;
  v_count integer;
  v_price integer;
  v_invoice uuid;
begin
  if not public.kw_is_dealer_account(v_uid) then
    raise exception 'Nur für freigeschaltete Küchenstudios.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_auction_id::text, 0));
  select * into v_a from public.lead_auctions where id = p_auction_id;
  if v_a.id is null or v_a.status = 'draft' then
    raise exception 'Projekt nicht gefunden.' using errcode = 'P0002';
  end if;
  select * into v_l from public.leads where id = v_a.lead_id;

  if exists (select 1 from public.lead_match_candidates
             where lead_id = v_l.id and dealer_id = v_uid and is_purchased) then
    return public.kw_dealer_project(p_auction_id);
  end if;

  if not public.kw_is_active_dealer(v_uid) then
    raise exception 'Ihr Konto ist derzeit eingeschränkt. Kontakte können Sie wieder freischalten, sobald offene Rechnungen beglichen sind.' using errcode = '42501';
  end if;
  if v_a.status not in ('active', 'completed') then
    raise exception 'Für dieses Projekt können keine Kontakte mehr freigeschaltet werden.' using errcode = 'P0001';
  end if;
  if not public.kw_dealer_in_area(v_uid, v_l.postal_code) then
    raise exception 'Dieses Projekt liegt außerhalb Ihres Einzugsgebiets.' using errcode = 'P0001';
  end if;
  if not public.kw_lead_share_consent(v_l.id) then
    raise exception 'Für dieses Projekt hat der Kunde keine Weitergabe seiner Kontaktdaten erlaubt. Geben Sie gern ein Angebot ab.' using errcode = 'P0001';
  end if;

  select count(*) into v_count from public.lead_match_candidates
  where lead_id = v_l.id and is_purchased and access_source = 'purchase';
  if v_count >= v_a.max_contact_purchases then
    raise exception 'Das Kontingent für dieses Projekt ist ausgeschöpft.' using errcode = 'P0001';
  end if;

  v_price := coalesce(v_a.contact_price_cents, 0);
  insert into public.lead_match_candidates (lead_id, dealer_id, is_purchased, purchased_at,
                                            price_cents, access_source, auction_id)
  values (v_l.id, v_uid, true, now(), v_price, 'purchase', v_a.id)
  on conflict (lead_id, dealer_id) do update
    set is_purchased = true, purchased_at = now(), price_cents = excluded.price_cents,
        access_source = 'purchase', auction_id = excluded.auction_id;

  v_invoice := public.kw_create_market_invoice(
    v_uid, 'lead_purchase', v_price,
    'Kontaktfreischaltung Küchenprojekt ' || left(v_l.postal_code, 3) || 'xx (Projekt ' || left(v_a.id::text, 8) || ')',
    v_l.id, v_a.id
  );
  update public.lead_match_candidates set invoice_id = v_invoice where lead_id = v_l.id and dealer_id = v_uid;

  perform public.kw_enqueue('contact_unlocked', jsonb_build_object(
    'auction_id', v_a.id, 'lead_id', v_l.id, 'dealer_id', v_uid, 'invoice_id', v_invoice));

  return public.kw_dealer_project(p_auction_id);
end;
$$;

create or replace function public.kw_can_view_planner_media(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: prüft Ausschreibungsstatus, den der Studio-Account nicht lesen darf.
  select
    public.has_role(auth.uid(), 'admin'::app_role)
    or (
      public.kw_is_dealer_account(auth.uid())
      and exists (
        select 1
        from public.lead_auctions a
        join public.leads l on l.id = a.lead_id
        where a.planner_session_id::text = split_part(p_object_name, '/', 1)
          and (
            exists (select 1 from public.lead_bids b
                    where b.auction_id = a.id and b.dealer_id = auth.uid())
            or exists (select 1 from public.lead_match_candidates mc
                       where mc.lead_id = a.lead_id and mc.dealer_id = auth.uid() and mc.is_purchased)
            or (
              a.status in ('active', 'completed')
              and public.kw_is_active_dealer(auth.uid())
              and public.kw_dealer_in_area(auth.uid(), l.postal_code)
            )
          )
      )
    );
$$;

create or replace function public.kw_tender_recipients(p_auction_id uuid)
returns table(dealer_id uuid, email text, company_name text, distance_km numeric, notify_email boolean)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: liest Studio-Profile für die Benachrichtigung neuer Projekte.
  with t as (
    select a.id, l.postal_code, coalesce(a.reference_price_eur, (a.estimate_min_eur + a.estimate_max_eur) / 2) as value_eur
    from public.lead_auctions a
    join public.leads l on l.id = a.lead_id
    where a.id = p_auction_id
  ),
  d as (
    select
      p.id,
      p.email,
      coalesce(nullif(p.company_name, ''), trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''))) as company,
      o.postal_code as origin,
      o.radius_km,
      coalesce(mp.notify_new_projects, true) as notify,
      mp.min_project_value_eur
    from public.user_roles r
    join public.profiles p on p.id = r.user_id
    left join public.kw_dealer_market_profiles mp on mp.dealer_id = p.id
    cross join lateral public.kw_dealer_origin(p.id) o
    where r.role = 'dealer'::app_role
      and coalesce(p.is_suspended, false) = false
      and coalesce(p.account_restricted, false) = false
      and o.postal_code is not null
  )
  select d.id, d.email, d.company,
         public.kw_plz_distance_km(d.origin, t.postal_code),
         d.notify and coalesce(t.value_eur, 0) >= coalesce(d.min_project_value_eur, 0)
  from d, t
  where coalesce(public.kw_plz_distance_km(d.origin, t.postal_code) <= d.radius_km, true);
$$;

-- ----------------------------------------------------------------------------
-- Projektlinks: Ablauf und Begrenzung
-- ----------------------------------------------------------------------------
alter table public.lead_access_tokens add column if not exists expires_at timestamp with time zone;
update public.lead_access_tokens set expires_at = created_at + interval '180 days' where expires_at is null;
alter table public.lead_access_tokens alter column expires_at set default (now() + interval '180 days');
alter table public.lead_access_tokens alter column expires_at set not null;
create index if not exists idx_lead_access_tokens_lead_active
  on public.lead_access_tokens (lead_id, created_at desc) where revoked_at is null;

create or replace function public.kw_project_issue_token(p_lead_id uuid, p_token_hash text)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- DEFINER: lead_access_tokens ist nur für service_role beschreibbar.
  insert into public.lead_access_tokens (lead_id, token_hash) values (p_lead_id, p_token_hash);
  -- Nur die fünf neuesten Links eines Projekts bleiben gültig.
  update public.lead_access_tokens t
     set revoked_at = now()
   where t.lead_id = p_lead_id
     and t.revoked_at is null
     and t.id not in (
       select x.id
       from public.lead_access_tokens x
       where x.lead_id = p_lead_id and x.revoked_at is null
       order by x.created_at desc
       limit 5
     );
end;
$$;

create or replace function public.kw_project_resolve_token(p_token_hash text)
returns uuid
language sql
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: lead_access_tokens ist nur für service_role lesbar.
  update public.lead_access_tokens
  set last_used_at = now()
  where token_hash = p_token_hash and revoked_at is null and expires_at > now()
  returning lead_id;
$$;

-- ----------------------------------------------------------------------------
-- Projektseite: Zahl der Studios im Umkreis
-- ----------------------------------------------------------------------------
create or replace function public.kw_project_view(p_lead_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: Kunden lesen ihr Projekt über den Projektlink ohne Tabellenrechte.
  v_l public.leads%rowtype;
  v_a public.lead_auctions%rowtype;
  v_offers jsonb;
  v_renders jsonb;
  v_session public.planner_sessions%rowtype;
begin
  select * into v_l from public.leads where id = p_lead_id;
  if v_l.id is null then
    return null;
  end if;
  select * into v_a from public.lead_auctions where lead_id = p_lead_id order by created_at desc limit 1;
  select * into v_session from public.planner_sessions where lead_id = p_lead_id order by created_at desc limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
      'bid_id', b.id,
      'price_eur', b.price_eur,
      'delivery_weeks', b.delivery_weeks,
      'includes', b.includes,
      'valid_until', b.valid_until,
      'message', b.notes,
      'revision', b.revision,
      'status', b.status,
      'submitted_at', b.created_at,
      'updated_at', b.updated_at,
      'dealer', jsonb_strip_nulls(jsonb_build_object(
        'company_name', coalesce(nullif(p.company_name, ''), 'Küchenstudio'),
        'city', p.company_city,
        'website', p.website,
        'verified', coalesce(p.is_verified, false),
        'member_since', p.created_at,
        'distance_km', public.kw_plz_distance_km(coalesce(p.company_zip, p.address_zip, ''), v_l.postal_code),
        'rating', rs.average_rating,
        'reviews', coalesce(rs.total_reviews, 0),
        'intro', mp.offer_intro,
        'phone', case when b.status = 'accepted' then p.phone end,
        'email', case when b.status = 'accepted' then p.email end,
        'street', case when b.status = 'accepted' then p.company_street end,
        'postal_code', case when b.status = 'accepted' then p.company_zip end
      ))
    ) order by b.price_eur asc), '[]'::jsonb)
  into v_offers
  from public.lead_bids b
  join public.profiles p on p.id = b.dealer_id
  left join public.dealer_rating_summary rs on rs.dealer_id = b.dealer_id
  left join public.kw_dealer_market_profiles mp on mp.dealer_id = b.dealer_id
  where v_a.id is not null and b.auction_id = v_a.id and b.status in ('active', 'accepted', 'declined');

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'bucket', r.storage_bucket, 'path', r.image_path, 'mode', r.mode,
      'version', r.version, 'variant', r.variant_label, 'created_at', r.created_at
    ) order by r.version desc), '[]'::jsonb)
  into v_renders
  from public.planner_renders r
  where v_session.id is not null and r.session_id = v_session.id and r.status = 'success' and r.image_path is not null;

  return jsonb_build_object(
    'lead', jsonb_build_object(
      'id', v_l.id, 'funnel_type', v_l.funnel_type::text, 'status', v_l.status::text,
      'first_name', v_l.first_name, 'postal_code', v_l.postal_code, 'created_at', v_l.created_at,
      'kitchen_form', v_l.kitchen_form, 'kitchen_style', v_l.kitchen_style,
      'budget_eur', v_l.budget_midpoint, 'timeframe_months', v_l.timeframe_months,
      'has_phone', (v_l.phone is not null and length(trim(v_l.phone)) > 0),
      'studios_in_area', public.kw_studios_covering(v_l.postal_code)
    ),
    'tender', case when v_a.id is null then null else jsonb_build_object(
      'id', v_a.id, 'status', v_a.status, 'published_at', v_a.published_at,
      'ends_at', v_a.ends_at, 'decision_deadline_at', v_a.decision_deadline_at,
      'estimate_min_eur', v_a.estimate_min_eur, 'estimate_max_eur', v_a.estimate_max_eur,
      'reference_price_eur', v_a.reference_price_eur, 'won_bid_id', v_a.won_bid_id,
      'decided_at', v_a.decided_at, 'summary', v_a.public_summary,
      'contact_unlocks', (select count(*) from public.lead_match_candidates mc
                          where mc.lead_id = v_l.id and mc.is_purchased and mc.access_source = 'purchase')
    ) end,
    'offers', v_offers,
    'renders', v_renders,
    'planner', case when v_session.id is null then null else jsonb_build_object(
      'room', v_session.room, 'spec', v_session.spec,
      'estimate', v_session.estimate, 'photo_count', cardinality(v_session.photo_paths)
    ) end
  );
end;
$$;
