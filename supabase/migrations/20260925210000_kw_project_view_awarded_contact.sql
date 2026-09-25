-- ============================================================================
-- Projektseite: Kontaktdaten des gewaehlten Studios fuer den Kunden
--
-- Nach dem Zuschlag braucht der Kunde Telefon, E-Mail und Adresse "seines"
-- Studios. Diese Felder erscheinen ausschliesslich beim angenommenen
-- Angebot; alle anderen Studios bleiben auf Name/Ort/Bewertung beschraenkt.
-- ============================================================================

create or replace function public.kw_project_view(p_lead_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
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
      'budget_eur', v_l.budget_midpoint, 'timeframe_months', v_l.timeframe_months
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
revoke execute on function public.kw_project_view(uuid) from public, anon, authenticated;
grant execute on function public.kw_project_view(uuid) to service_role;
