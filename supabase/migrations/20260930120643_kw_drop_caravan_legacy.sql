-- ============================================================================
-- CaravanWert-Altbestand aus der Datenbank entfernen
--
-- KüchenWert ist aus der Wohnmobil-Auktionsplattform CaravanWert entstanden.
-- Frontend und Edge Functions für Auktionen, Gebote, Kaufchance, Inserate,
-- Stationen/Termine, Kaufverträge, Übergabeprotokolle, Schadensfälle,
-- Verkaufs-Wizard, Suchaufträge, Favoriten, Händlerstufen und -bewertungen,
-- Google-Bewertungsanfragen, Web-Push und Bing-Offline-Uploads sind seit
-- 2026-09-28 entfernt bzw. 410-Tombstones. Diese Migration entfernt, was davon
-- in der Datenbank übrig war:
--   * 39 Tabellen, die View bids_public, 74 Funktionen (inkl. Trigger-
--     Funktionen), 10 Enum-Typen und 2 Sequenzen;
--   * Caravan-Spalten auf KüchenWert-Tabellen (invoices, dealer_notifications,
--     site_settings, user_notification_preferences), die Wohnmobil-Defaults von
--     site_settings und den Trigger trg_sync_kitchens_when_dealer_role auf
--     user_roles (schrieb in kitchens und bräche sonst jede Rollenvergabe ab);
--   * site_settings-Spalten, die weder Frontend, Functions noch DB lesen:
--     Branding (logo_url, favicon_url, primary_color, secondary_color,
--     dark_mode_enabled; Logo und Farben kommen aus dem Code), openai_api_key,
--     google_analytics_id und google_tag_manager_id (Tracking-IDs stehen in
--     tracking_config);
--   * Caravan-Werte in Check-Constraints. Werte, die KüchenWert-Functions heute
--     schreiben, die aber fehlten (Protokollzeilen scheiterten still), kommen
--     dazu;
--   * Studio-Bewertungen (dealer_reviews, review_responses,
--     dealer_rating_summary): nie befüllt, keine Oberfläche mehr;
--   * Storage-Policies der leeren Alt-Buckets.
-- KüchenWert-Funktionen, die Caravan-Tabellen anfassten, werden per
-- CREATE OR REPLACE bereinigt; prevent_invoice_deletion bekommt ihre Umlaute
-- zurück.
--
-- Danach im Dashboard (Storage) löschen, Supabase sperrt direkte Deletes auf
-- storage.buckets/objects: kitchen-photos, branding, purchase-contracts,
-- handover-protocols, planner-renders.
--
-- Datenverlust-Schutz: Die Migration bricht ab, sobald eine zu löschende
-- Tabelle, Spalte oder ein Alt-Bucket Daten enthält. Bewusst mitgelöscht wird
-- nur die leere Wizard-Sitzung f7779e02-69b3-43b9-b1dd-300cbae19da1 vom
-- 2026-04-28 (Schritt 1 von 8, ohne Name, Kontaktdaten, Konto, Formulardaten).
-- Kein CASCADE: Jede unbekannte Abhängigkeit lässt die Migration scheitern.
-- ============================================================================

-- 1) Datenverlust-Schutz ------------------------------------------------------
do $$
declare
  v_table text;
  v_column record;
  v_has_rows boolean;
begin
  if to_regclass('public.wizard_sessions') is not null then
    execute $sql$
      delete from public.wizard_sessions
       where id = 'f7779e02-69b3-43b9-b1dd-300cbae19da1'
         and user_id is null
         and coalesce(customer_name, '') = ''
         and customer_email is null
         and customer_phone is null
         and coalesce(form_data, '{}'::jsonb) = '{}'::jsonb
    $sql$;
  end if;

  foreach v_table in array array[
    'appointments', 'auction_addenda', 'auctions', 'bids', 'bing_oauth_state',
    'bing_offline_conversions_log', 'claim_photos', 'claim_status_history', 'claims',
    'commission_calculations', 'commission_tier_changes', 'commission_tiers',
    'damage_photos', 'dealer_instant_buy_alerts', 'dealer_levels', 'dealer_rating_summary',
    'dealer_reviews', 'dealer_volume_discounts', 'google_offline_conversions_log',
    'google_review_requests', 'instant_buy_alerts_sent', 'kaufchance_invitations',
    'kitchen_photos', 'kitchen_questions', 'kitchens', 'pin_attempts', 'post_auction_offers',
    'price_change_requests', 'purchase_contracts', 'purchase_stations', 'push_subscriptions',
    'review_responses', 'search_alert_matches', 'search_alerts', 'station_availability',
    'station_blocked_dates', 'user_favorites', 'wizard_sessions', 'wizard_step_events'
  ] loop
    if to_regclass('public.' || v_table) is not null then
      execute format('select exists (select 1 from public.%I)', v_table) into v_has_rows;
      if v_has_rows then
        raise exception 'kw_drop_caravan_legacy: public.% enthält Zeilen', v_table;
      end if;
    end if;
  end loop;

  for v_column in
    select c.table_name::text as table_name, c.column_name::text as column_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and (c.table_name::text, c.column_name::text) in (
        ('invoices', 'auction_id'), ('invoices', 'kitchen_id'),
        ('invoices', 'penalty_reason'), ('dealer_notifications', 'auction_id'))
  loop
    execute format('select exists (select 1 from public.%I where %I is not null)',
                   v_column.table_name, v_column.column_name) into v_has_rows;
    if v_has_rows then
      raise exception 'kw_drop_caravan_legacy: public.%.% ist befüllt',
        v_column.table_name, v_column.column_name;
    end if;
  end loop;

  -- Ausgestellte Rechnungen sind GoBD-geschützt und dürfen nicht angepasst
  -- werden; mit Caravan-Rechnungstypen ließe sich der Constraint nicht einengen.
  if exists (select 1 from public.invoices where invoice_type not in ('lead_purchase', 'lead_commission'))
     or exists (select 1 from public.invoice_items where item_type = 'seller_penalty') then
    raise exception 'kw_drop_caravan_legacy: Rechnungen mit Caravan-Rechnungstyp vorhanden';
  end if;

  if exists (
    select 1 from storage.objects
    where bucket_id in ('kitchen-photos', 'branding', 'purchase-contracts', 'handover-protocols', 'planner-renders')
  ) then
    raise exception 'kw_drop_caravan_legacy: Alt-Buckets enthalten Dateien';
  end if;
end $$;

-- 2) Abhängigkeiten, die das Löschen der Tabellen blockieren -----------------
drop view if exists public.bids_public;
-- Rückgabetyp ist der Zeilentyp von wizard_sessions.
drop function if exists public.find_wizard_session_by_anonymous_id(text);
drop function if exists public.find_wizard_session_by_resume_token(text);
drop trigger if exists trg_sync_kitchens_when_dealer_role on public.user_roles;

-- 3) Caravan-Spalten auf KüchenWert-Tabellen ----------------------------------
-- Fremdschlüssel auf auctions/kitchens und die Indizes fallen mit den Spalten.
alter table public.invoices
  drop column if exists auction_id,
  drop column if exists kitchen_id,
  drop column if exists penalty_reason,
  alter column invoice_type drop default;

alter table public.dealer_notifications
  drop column if exists auction_id;

alter table public.user_notification_preferences
  drop column if exists email_new_bid,
  drop column if exists email_outbid,
  drop column if exists email_auction_ending,
  drop column if exists email_auction_won,
  drop column if exists email_new_auction,
  drop column if exists email_price_alerts,
  drop column if exists audio_enabled,
  drop column if exists audio_volume,
  drop column if exists audio_new_bid,
  drop column if exists audio_outbid,
  drop column if exists audio_auction_won,
  drop column if exists push_enabled,
  drop column if exists push_new_bid,
  drop column if exists push_outbid,
  drop column if exists push_auction_ending,
  drop column if exists digest_frequency,
  drop column if exists last_digest_sent_at;

-- get_public_site_settings() liefert to_jsonb(public_site_settings) und passt
-- sich der neuen Spaltenliste ohne Änderung an.
drop view if exists public.public_site_settings;

alter table public.site_settings
  drop column if exists notify_new_auction,
  drop column if exists notify_new_bid,
  drop column if exists default_auction_duration_days,
  drop column if exists soft_close_extension_minutes,
  drop column if exists min_bid_increment_percent,
  drop column if exists commission_rate_percent,
  drop column if exists reserve_price_required,
  drop column if exists autobid_enabled,
  drop column if exists buy_now_enabled,
  drop column if exists tuv_badge_url,
  drop column if exists logo_url,
  drop column if exists favicon_url,
  drop column if exists primary_color,
  drop column if exists secondary_color,
  drop column if exists dark_mode_enabled,
  drop column if exists openai_api_key,
  drop column if exists google_analytics_id,
  drop column if exists google_tag_manager_id,
  alter column site_name set default 'KüchenWert',
  alter column site_tagline set default 'Traumküche planen & Angebote vergleichen',
  alter column site_description set default 'Traumküche im eigenen Raum mit KI visualisieren, Preis sofort schätzen und Angebote geprüfter Küchenstudios vergleichen – kostenlos und unverbindlich.',
  alter column contact_email set default 'info@kuechenwert24.de',
  alter column from_email set default 'noreply@kuechenwert24.de',
  alter column meta_title set default 'KüchenWert – Traumküche mit KI planen & Angebote vergleichen',
  alter column meta_description set default 'Foto Ihres Raums hochladen, Küche konfigurieren und sofort sehen, wie sie aussieht und was sie ungefähr kostet. Geprüfte Küchenstudios machen Ihnen Angebote – Sie wählen. Kostenlos & unverbindlich.',
  alter column meta_keywords set default 'küche planen, küchenplaner online, küche visualisieren, ki küchenplaner, küche preis berechnen, küchenstudio angebote vergleichen, neue küche kaufen, küchen preisvergleich';

create view public.public_site_settings
with (security_invoker = true) as
select
  id, created_at, updated_at, site_name, site_tagline, site_description,
  contact_email, support_phone, maintenance_mode, meta_title, meta_description,
  meta_keywords, sitemap_enabled, whatsapp_number, company_address, company_city,
  company_postal_code, company_country, ust_id, tax_number, managing_director,
  hrb_number, invoice_footer_text, invoice_payment_terms_days, tracking_config
from public.site_settings;

revoke all on public.public_site_settings from public, anon, authenticated;
grant select, maintain on public.public_site_settings to anon, authenticated;
grant all on public.public_site_settings to service_role;

alter table public.planner_renders
  alter column storage_bucket set default 'planner-media';

-- 4) Caravan-Tabellen --------------------------------------------------------
-- Policies, Trigger, Indizes, Fremdschlüssel untereinander und die Sequenz
-- wizard_step_events_id_seq fallen mit.
drop table if exists
  public.appointments, public.auction_addenda, public.auctions, public.bids,
  public.bing_oauth_state, public.bing_offline_conversions_log, public.claim_photos,
  public.claim_status_history, public.claims, public.commission_calculations,
  public.commission_tier_changes, public.commission_tiers, public.damage_photos,
  public.dealer_instant_buy_alerts, public.dealer_levels, public.dealer_rating_summary,
  public.dealer_reviews, public.dealer_volume_discounts, public.google_offline_conversions_log,
  public.google_review_requests, public.instant_buy_alerts_sent, public.kaufchance_invitations,
  public.kitchen_photos, public.kitchen_questions, public.kitchens, public.pin_attempts,
  public.post_auction_offers, public.price_change_requests, public.purchase_contracts,
  public.purchase_stations, public.push_subscriptions, public.review_responses,
  public.search_alert_matches, public.search_alerts, public.station_availability,
  public.station_blocked_dates, public.user_favorites, public.wizard_sessions,
  public.wizard_step_events;

-- 5) Caravan-Funktionen ------------------------------------------------------
-- Erst nach den Tabellen: Trigger und Policies (get_request_anonymous_id)
-- hängen an ihnen.
do $$
declare
  v_fn regprocedure;
begin
  for v_fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and p.proname = any (array[
        -- Auktionen, Gebote, Kaufchance, Inserate, Preise
        'accept_kaufchance_offer_atomic', 'admin_delete_bid', 'admin_search_listings',
        'compute_random_starting_bid', 'disable_dynamic_pricing_on_manual_edit',
        'enforce_seller_price_lower_only', 'generate_listing_number',
        'get_auction_marketing_anchors', 'get_auction_owner_meta', 'get_auctions_owner_meta_bulk',
        'get_public_platform_stats', 'handle_autobid_atomic', 'place_bid_atomic',
        'reset_festpreis_admin_notified_at', 'seller_archive_listing', 'seller_restart_listing',
        'seller_unarchive_listing', 'set_listing_number', 'set_marketing_phase_on_activation',
        'set_post_auction_offer_round', 'sync_auction_reserve_to_lowest_counter_offer',
        'sync_kitchen_reserve_from_auction', 'sync_kitchen_status_from_auction',
        'toggle_auto_relist', 'toggle_dynamic_pricing', 'touch_price_change_requests_updated_at',
        'trg_sync_kitchen_account_type_from_seller', 'trg_sync_kitchens_when_dealer_role',
        'update_listing_prices_in_draft',
        -- Caravan-Rechnungen, Provision, Schadensfälle, Kaufverträge, Termine
        'calculate_commission', 'commission_tier_audit', 'create_auction_invoice',
        'create_claim_status_history', 'create_instant_buy_invoice',
        'create_seller_penalty_invoice', 'generate_contract_number', 'generate_release_pin',
        'generate_sepa_reference', 'process_approved_claim', 'trigger_update_damage_status',
        'update_kitchen_damage_status', 'update_purchase_contracts_updated_at',
        -- Händlerstufen, Händlerbewertungen, Suchaufträge
        'check_search_criteria_match', 'process_search_alerts_for_kitchen',
        'trigger_search_alerts', 'trigger_update_dealer_level_on_bid',
        'trigger_update_dealer_level_on_sale', 'trigger_update_rating_summary',
        'update_dealer_level', 'update_dealer_rating_summary',
        -- Verkaufs-Wizard
        'create_wizard_session', 'get_request_anonymous_id',
        'link_wizard_sessions_to_confirmed_user', 'reactivate_wizard_session_by_resume_token',
        'update_wizard_session_by_anonymous_id', 'update_wizard_session_timestamp',
        'verify_wizard_session_ownership', 'wizard_sessions_set_completed_at',
        -- Google-Bewertungsanfragen, Web-Push, Bing
        'claim_google_review_batch', 'enqueue_google_review_for_email', 'get_google_review_stats',
        'hash_review_ip', 'mark_google_review_delivered', 'mark_google_review_failed',
        'process_google_review_unsubscribe', 'set_google_review_requests_updated_at',
        'track_google_review_click', 'webhook_mark_google_review_delivered',
        'get_vapid_keys', 'bing_oauth_release_lock', 'bing_oauth_state_touch',
        'bing_oauth_try_acquire_lock'
      ])
  loop
    execute format('drop function %s', v_fn);
  end loop;
end $$;

-- 6) Enum-Typen und Sequenzen der Caravan-Tabellen ---------------------------
drop type if exists
  public.air_conditioning_type, public.auction_status, public.emission_class,
  public.fuel_type, public.heating_type, public.kitchen_body_type,
  public.kitchen_condition, public.refrigerator_type, public.sale_channel,
  public.transmission_type;

drop sequence if exists public.contract_number_seq, public.listing_number_seq;

-- 7) KüchenWert-Funktionen ohne Caravan-Bezüge --------------------------------
-- approve_dealer_application legte eine Händlerstufe in dealer_levels an,
-- kw_project_view las Sterne aus dealer_rating_summary (nie befüllt), die
-- beiden Suppression-Funktionen pflegten die Google-Bewertungs-Queue,
-- prevent_dealer_self_edit_profile verwies auf info@caravanwert.de, und
-- prevent_invoice_deletion meldete doppelt kodierte Umlaute.
CREATE OR REPLACE FUNCTION public.approve_dealer_application(application_id_param uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  app_record RECORD;
  v_updated_rows INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  SELECT * INTO app_record
  FROM public.dealer_applications
  WHERE id = application_id_param;

  IF app_record IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  UPDATE public.dealer_applications
  SET status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
  WHERE id = application_id_param
    AND status = 'pending';

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

  IF v_updated_rows = 0 THEN
    RAISE EXCEPTION 'ALREADY_PROCESSED: dealer application % is not in pending state (current: %)',
      application_id_param, app_record.status
      USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO app_record
  FROM public.dealer_applications
  WHERE id = application_id_param;

  DELETE FROM public.user_roles WHERE user_id = app_record.user_id;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (app_record.user_id, 'dealer')
  ON CONFLICT (user_id) DO UPDATE SET role = 'dealer';

  UPDATE public.profiles
  SET
    account_type    = 'business',
    company_name    = COALESCE(NULLIF(app_record.company_name, ''), company_name),
    company_street  = COALESCE(NULLIF(app_record.company_address, '-'), company_street),
    company_zip     = CASE
                        WHEN app_record.company_postal_code = '00000' THEN company_zip
                        ELSE COALESCE(NULLIF(app_record.company_postal_code, ''), company_zip)
                      END,
    company_city    = CASE
                        WHEN app_record.company_city LIKE '%Wird vom%' THEN company_city
                        ELSE COALESCE(NULLIF(app_record.company_city, '-'), company_city)
                      END,
    company_country = CASE
                        WHEN app_record.country IS NOT NULL AND app_record.country != ''
                        THEN app_record.country
                        ELSE COALESCE(company_country, 'DE')
                      END,
    vat_id          = COALESCE(NULLIF(app_record.vat_id, ''), vat_id)
  WHERE id = app_record.user_id;
END;
$function$;

create or replace function public.kw_project_view(p_lead_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_catalog'
as $function$
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
    ) end,
    'details', (select jsonb_build_object('customer', d.customer, 'updated_at', d.customer_updated_at)
                from public.kw_lead_details d where d.lead_id = v_l.id)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_add_email_suppression(p_email text, p_reason text DEFAULT 'manual'::text, p_notes text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.email_suppressions (email, reason, source, notes)
  VALUES (lower(trim(p_email)), COALESCE(p_reason, 'manual'), 'admin', p_notes)
  ON CONFLICT (lower(email)) DO UPDATE
  SET reason = EXCLUDED.reason,
      notes = COALESCE(EXCLUDED.notes, public.email_suppressions.notes),
      source = 'admin';

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.webhook_add_email_suppression(p_email text, p_reason text, p_source text DEFAULT 'resend_webhook'::text, p_notes text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_email TEXT := lower(trim(COALESCE(p_email, '')));
  v_reason TEXT := COALESCE(p_reason, 'bounced');
BEGIN
  IF v_email = '' OR v_email NOT LIKE '%@%' THEN
    RETURN false;
  END IF;

  IF v_reason NOT IN ('unsubscribed', 'bounced', 'complained', 'manual', 'invalid') THEN
    RAISE EXCEPTION 'invalid_reason'
      USING HINT = 'reason must be one of unsubscribed, bounced, complained, manual, invalid';
  END IF;

  INSERT INTO public.email_suppressions (email, reason, source, notes)
  VALUES (v_email, v_reason, COALESCE(p_source, 'resend_webhook'), p_notes)
  ON CONFLICT (lower(email)) DO UPDATE
  SET reason = EXCLUDED.reason,
      notes  = COALESCE(EXCLUDED.notes, public.email_suppressions.notes),
      source = COALESCE(EXCLUDED.source, public.email_suppressions.source);

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_dealer_self_edit_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_is_dealer boolean;
  v_is_admin boolean;
BEGIN
  IF v_caller IS NULL OR v_caller <> NEW.id THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_caller AND role = 'admin'::app_role
  ) INTO v_is_admin;

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_caller AND role = 'dealer'::app_role
  ) INTO v_is_dealer;

  IF NOT v_is_dealer THEN
    RETURN NEW;
  END IF;

  IF NEW.first_name IS DISTINCT FROM OLD.first_name
     OR NEW.last_name IS DISTINCT FROM OLD.last_name
     OR NEW.salutation IS DISTINCT FROM OLD.salutation
     OR NEW.phone IS DISTINCT FROM OLD.phone
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.company_name IS DISTINCT FROM OLD.company_name
     OR NEW.account_type IS DISTINCT FROM OLD.account_type
     OR NEW.address_street IS DISTINCT FROM OLD.address_street
     OR NEW.address_zip IS DISTINCT FROM OLD.address_zip
     OR NEW.address_city IS DISTINCT FROM OLD.address_city
     OR NEW.address_country IS DISTINCT FROM OLD.address_country
     OR NEW.company_street IS DISTINCT FROM OLD.company_street
     OR NEW.company_zip IS DISTINCT FROM OLD.company_zip
     OR NEW.company_city IS DISTINCT FROM OLD.company_city
     OR NEW.company_country IS DISTINCT FROM OLD.company_country
     OR NEW.tax_id IS DISTINCT FROM OLD.tax_id
     OR NEW.vat_id IS DISTINCT FROM OLD.vat_id
     OR NEW.trade_license IS DISTINCT FROM OLD.trade_license
  THEN
    RAISE EXCEPTION 'DEALER_PROFILE_LOCKED: Studio-Stammdaten können nur durch den Support geändert werden (info@kuechenwert24.de).'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_invoice_deletion()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'Rechnungen dürfen nicht gelöscht werden (Aufbewahrungspflicht). Nutzen Sie stattdessen den Status "cancelled".';
  RETURN NULL;
END;
$function$;

-- 8) Check-Constraints auf KüchenWert-Werte ----------------------------------
-- Neue email_type-Werte hier ergänzen, sonst scheitert die Protokollzeile.
-- Neutrale Werte ohne heutigen Schreiber (welcome, scheduled, inactivity,
-- dunning_level_4/5, dealer_welcome …) bleiben erlaubt.
alter table public.admin_emails
  drop constraint if exists admin_emails_email_type_check,
  add constraint admin_emails_email_type_check check (email_type = any (array[
    -- E-Mail-Center
    'single', 'reply', 'broadcast', 'inbound', 'auto', 'auto_response', 'welcome', 'scheduled',
    -- Konten und Registrierung
    'registration_invite', 'dealer_registration_invite', 'email_confirmation_resend',
    'account_suspended', 'account_unsuspended', 'account_deleted', 'inactivity',
    -- Küchenstudios
    'dealer_application_received', 'dealer_application_admin', 'dealer_approved',
    'dealer_rejected', 'dealer_role_upgrade', 'dealer_documents_request',
    'dealer_application_deleted', 'dealer_welcome', 'dealer_suspended', 'dealer_reactivated',
    'dealer_outreach', 'dealer_first_nudge',
    -- Rechnungen und Mahnwesen
    'invoice', 'invoice_cancellation', 'invoice_issue_blocked', 'payment_confirmation',
    'payment_reminder', 'dunning_level_1', 'dunning_level_2', 'dunning_level_3',
    'dunning_level_4', 'dunning_level_5',
    -- Projekte, Ausschreibungen, Reklamationen, Aufträge
    'project_link', 'project_admin_new', 'project_new_dealer', 'project_new_offer',
    'project_contact_unlocked', 'project_tender_ended', 'project_awarded_consumer',
    'project_awarded_dealer', 'project_not_awarded_dealer', 'project_updated_dealer',
    'complaint_admin', 'complaint_decided', 'lead_files_admin', 'order_update_consumer',
    'order_update_dealer', 'order_admin', 'order_reminder',
    -- Kontaktformular und Betrieb
    'contact_admin', 'contact_confirmation', 'ops_health_alert', 'gads_search_terms_report'
  ]));

-- Kein NULL ins Array: x = any(array[…, null]) ergibt NULL und lässt jeden Wert durch.
alter table public.admin_emails
  drop constraint if exists admin_emails_broadcast_group_check,
  add constraint admin_emails_broadcast_group_check check (
    broadcast_group is null
    or broadcast_group = any (array['all', 'customers', 'dealers', 'verified_dealers', 'newsletter', 'custom'])
  );

alter table public.agb_acceptances
  drop constraint if exists agb_acceptances_context_check,
  add constraint agb_acceptances_context_check check (
    context = any (array['registration', 'dealer_registration', 'login'])
  );

alter table public.dealer_notifications
  drop constraint if exists dealer_notifications_type_check,
  add constraint dealer_notifications_type_check check (type = any (array[
    'system', 'payment_reminder', 'project_new', 'project_underbid', 'project_awarded',
    'project_not_awarded', 'project_ended', 'project_cancelled', 'project_updated',
    'contact_unlocked', 'complaint_filed', 'complaint_decided', 'order_reminder', 'order_update'
  ]));

alter table public.invoices
  drop constraint if exists invoices_invoice_type_check,
  add constraint invoices_invoice_type_check check (
    invoice_type = any (array['lead_purchase', 'lead_commission'])
  );

-- 'commission' ist der Positionstyp von kw_create_market_invoice für Provisionen.
alter table public.invoice_items
  drop constraint if exists invoice_items_item_type_check,
  add constraint invoice_items_item_type_check check (
    item_type = any (array['lead_purchase', 'commission', 'fee', 'service', 'other'])
  );

-- 9) Storage-Policies der leeren Alt-Buckets ---------------------------------
-- public-assets (Blog-Bilder) bleibt.
drop policy if exists "Anyone can view kitchen photos" on storage.objects;
drop policy if exists "Authenticated users can upload kitchen photos" on storage.objects;
drop policy if exists "Users can update own kitchen photos" on storage.objects;
drop policy if exists "Users can delete own kitchen photos" on storage.objects;
drop policy if exists "Anyone can view branding assets" on storage.objects;
drop policy if exists "Admins can upload branding assets" on storage.objects;
drop policy if exists "Admins can update branding assets" on storage.objects;
drop policy if exists "Admins can delete branding assets" on storage.objects;
drop policy if exists "Admin full access to purchase-contracts" on storage.objects;
drop policy if exists "Users can read own purchase-contracts" on storage.objects;
drop policy if exists "Admin full access to handover-protocols" on storage.objects;
drop policy if exists "Users can read own handover-protocols" on storage.objects;
drop policy if exists "PlannerRenders Storage: admin all" on storage.objects;

-- 10) Nichts verweist mehr auf entfernte Objekte -----------------------------
-- PL/pgSQL-Körper und Cron-Befehle prüft PostgreSQL beim DROP nicht, sie
-- scheiterten erst zur Laufzeit. In Funktionskörpern bleiben Zeichenketten und
-- Kommentare außen vor. Das Muster umfasst entfernte Tabellen, Views, Typen,
-- Sequenzen, Spalten und Funktionen.
do $$
declare
  v_re constant text :=
    '\m(appointments|auction_addenda|auctions|bids|bids_public|bing_oauth_state'
    '|bing_offline_conversions_log|claim_photos|claim_status_history|claims'
    '|commission_calculations|commission_tier_changes|commission_tiers|damage_photos'
    '|dealer_instant_buy_alerts|dealer_levels|dealer_rating_summary|dealer_reviews'
    '|dealer_volume_discounts|google_offline_conversions_log|google_review_requests'
    '|instant_buy_alerts_sent|kaufchance_invitations|kitchen_photos|kitchen_questions'
    '|kitchens|pin_attempts|post_auction_offers|price_change_requests|purchase_contracts'
    '|purchase_stations|push_subscriptions|review_responses|search_alert_matches'
    '|search_alerts|station_availability|station_blocked_dates|user_favorites'
    '|wizard_sessions|wizard_step_events|air_conditioning_type|auction_status'
    '|emission_class|fuel_type|heating_type|kitchen_body_type|kitchen_condition'
    '|refrigerator_type|sale_channel|transmission_type|contract_number_seq'
    '|listing_number_seq|penalty_reason|notify_new_auction|notify_new_bid'
    '|default_auction_duration_days|soft_close_extension_minutes|min_bid_increment_percent'
    '|commission_rate_percent|reserve_price_required|autobid_enabled|buy_now_enabled'
    '|tuv_badge_url|logo_url|favicon_url|primary_color|secondary_color|dark_mode_enabled'
    '|openai_api_key|google_analytics_id|google_tag_manager_id|email_new_bid|email_outbid'
    '|email_auction_ending|email_auction_won|email_new_auction|email_price_alerts'
    '|audio_enabled|audio_volume|audio_new_bid|audio_outbid|audio_auction_won|push_enabled'
    '|push_new_bid|push_outbid|push_auction_ending|digest_frequency|last_digest_sent_at'
    '|find_wizard_session_by_anonymous_id|find_wizard_session_by_resume_token'
    '|get_request_anonymous_id|calculate_commission|create_auction_invoice'
    '|webhook_mark_google_review_delivered|link_wizard_sessions_to_confirmed_user'
    '|update_dealer_level|enqueue_google_review_for_email)\M';
  v_left text;
begin
  select string_agg(o, ', ' order by o) into v_left
  from (
    select 'Funktion ' || p.oid::regprocedure::text as o
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and regexp_replace(regexp_replace(p.prosrc, '''[^'']*''', '', 'g'), '--[^\n]*', '', 'g') ~ v_re
    union all
    select 'View ' || v.schemaname || '.' || v.viewname
    from pg_views v
    where v.schemaname not in ('pg_catalog', 'information_schema')
      and regexp_replace(v.definition, '''[^'']*''', '', 'g') ~ v_re
    union all
    select 'View ' || m.schemaname || '.' || m.matviewname
    from pg_matviews m
    where regexp_replace(m.definition, '''[^'']*''', '', 'g') ~ v_re
    union all
    select 'Policy ' || po.schemaname || '.' || po.tablename || ': ' || po.policyname
    from pg_policies po
    where regexp_replace(concat_ws(' ', po.qual, po.with_check), '''[^'']*''', '', 'g') ~ v_re
       or (po.schemaname = 'storage'
           and concat_ws(' ', po.qual, po.with_check)
               ~ '''(kitchen-photos|branding|purchase-contracts|handover-protocols|planner-renders)''')
    union all
    select 'Cron-Job ' || j.jobname
    from cron.job j
    where j.command ~ v_re
  ) found;
  if v_left is not null then
    raise exception 'kw_drop_caravan_legacy: Noch Verweise auf entfernte Objekte: %', v_left;
  end if;
end $$;
