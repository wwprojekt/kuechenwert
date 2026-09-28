-- Unterlagen aus Funnel B (Angebot, Planung, Fotos) für Küchenstudios.
--
-- Die Einwilligung erlaubt, das Angebot "ohne Namen und Kontaktdaten" an
-- Studios weiterzugeben. Deshalb sieht ein Studio eine Datei nur,
--   - wenn das KüchenWert-Team sie nach Prüfung freigegeben hat
--     (shared_with_studios, ggf. als geschwärzte Fassung), oder
--   - nachdem es den Kontakt gekauft oder den Zuschlag erhalten hat; dann
--     kennt es Namen und Kontaktdaten ohnehin.
-- Freigegebene Dateien erscheinen vor dem Kontaktkauf ohne Dateinamen, weil
-- Dateinamen oft den Kundennamen enthalten.

alter table public.lead_files
  add column if not exists shared_with_studios boolean not null default false,
  add column if not exists shared_at timestamptz,
  add column if not exists shared_by uuid references auth.users (id) on delete set null;

comment on column public.lead_files.shared_with_studios is
  'Vom Team geprüft und für Studios im Einzugsgebiet freigegeben (keine Namen/Kontaktdaten sichtbar).';

create or replace function public.kw_lead_files_share_stamp()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.shared_with_studios is distinct from old.shared_with_studios then
    new.shared_at := case when new.shared_with_studios then now() end;
    new.shared_by := case when new.shared_with_studios then auth.uid() end;
  end if;
  return new;
end;
$$;

drop trigger if exists kw_lead_files_share_stamp on public.lead_files;
create trigger kw_lead_files_share_stamp
  before update of shared_with_studios on public.lead_files
  for each row execute function public.kw_lead_files_share_stamp();

revoke execute on function public.kw_lead_files_share_stamp() from public, anon, authenticated;

create or replace function public.kw_can_view_lead_file(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: prüft Freigabe, Ausschreibungsstatus und Kontaktkauf, die das
  -- Studio-Konto nicht lesen darf. Admins deckt die Policy "LeadFiles Storage: admin all" ab.
  select public.kw_is_dealer_account(auth.uid())
    and exists (
      select 1
      from public.lead_files f
      join public.leads l on l.id = f.lead_id
      join public.lead_auctions a on a.lead_id = f.lead_id
      where f.file_url = p_object_name
        and a.status <> 'draft'
        and (
          exists (select 1 from public.lead_match_candidates mc
                  where mc.lead_id = f.lead_id and mc.dealer_id = auth.uid() and mc.is_purchased)
          or exists (select 1 from public.lead_bids b
                     where b.id = a.won_bid_id and b.dealer_id = auth.uid())
          or (
            f.shared_with_studios
            and (
              exists (select 1 from public.lead_bids b
                      where b.auction_id = a.id and b.dealer_id = auth.uid())
              or (
                a.status in ('active', 'completed')
                and public.kw_is_active_dealer(auth.uid())
                and public.kw_dealer_in_area(auth.uid(), l.postal_code)
              )
            )
          )
        )
    );
$$;

revoke execute on function public.kw_can_view_lead_file(text) from public, anon;
grant execute on function public.kw_can_view_lead_file(text) to authenticated;

drop policy if exists "LeadFiles: dealer read released" on storage.objects;
create policy "LeadFiles: dealer read released"
  on storage.objects for select to authenticated
  using (bucket_id = 'lead-files' and public.kw_can_view_lead_file(name));

-- kw-lead-b nimmt HEIF an; der Bucket lehnte es bisher ab.
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
 where id = 'lead-files';

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
$function$;
