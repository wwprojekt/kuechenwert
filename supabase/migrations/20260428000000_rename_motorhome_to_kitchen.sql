-- Rename-Migration: Caravanwert -> KuechenWert
--
-- Diese Migration benennt alle DB-Objekte mit "motorhome"/"vehicle"-Namen in
-- "kitchen"-Namen um. Die Datenstruktur und die Enum-WERTE bleiben unveraendert;
-- nur die Namen werden angepasst. Caravan-spezifische Felder (base_vehicle,
-- vehicle_identification_number) und Enum-Werte (Teilintegriert, Alkoven,...)
-- werden in einer spaeteren Migration separat behandelt.
--
-- Umfang: 3 Tabellen, 2 Enum-Types, 6 Functions, 5 Trigger, 18 Spalten,
-- 21 Indexe, 23 Constraints, 9 Policies, 1 View.
--
-- Reversible: ja (alle Renames sind einzeln rueckgaengig zu machen).
-- In einer einzigen Transaktion.

begin;

-- ----------------------------------------------------------------
-- 1) View droppen (wird am Ende mit neuen Spaltennamen neu erstellt)
-- ----------------------------------------------------------------
drop view if exists public.auctions_public;

-- ----------------------------------------------------------------
-- 2) Enum-Types umbenennen
-- ----------------------------------------------------------------
alter type public.motorhome_body_type rename to kitchen_body_type;
alter type public.motorhome_condition rename to kitchen_condition;

-- ----------------------------------------------------------------
-- 3) Tabellen umbenennen
-- ----------------------------------------------------------------
alter table public.motorhomes       rename to kitchens;
alter table public.motorhome_photos rename to kitchen_photos;
alter table public.vehicle_questions rename to kitchen_questions;

-- ----------------------------------------------------------------
-- 4) Spalten umbenennen: motorhome_id -> kitchen_id
-- ----------------------------------------------------------------
alter table public.appointments                    rename column motorhome_id to kitchen_id;
alter table public.auctions                        rename column motorhome_id to kitchen_id;
alter table public.bing_offline_conversions_log    rename column motorhome_id to kitchen_id;
alter table public.claims                          rename column motorhome_id to kitchen_id;
alter table public.damage_photos                   rename column motorhome_id to kitchen_id;
alter table public.google_offline_conversions_log  rename column motorhome_id to kitchen_id;
alter table public.invoices                        rename column motorhome_id to kitchen_id;
alter table public.kitchen_photos                  rename column motorhome_id to kitchen_id;
alter table public.price_change_requests           rename column motorhome_id to kitchen_id;
alter table public.purchase_contracts              rename column motorhome_id to kitchen_id;
alter table public.search_alert_matches            rename column motorhome_id to kitchen_id;
alter table public.user_favorites                  rename column motorhome_id to kitchen_id;
alter table public.kitchen_questions               rename column motorhome_id to kitchen_id;

-- ----------------------------------------------------------------
-- 5) Weitere Spalten-Renames (vehicle_* -> kitchen_*/item_*)
-- ----------------------------------------------------------------
alter table public.purchase_inquiries      rename column vehicle_type to kitchen_type;
alter table public.value_assessment_leads  rename column vehicle_type to kitchen_type;
alter table public.wertrechner_reviews     rename column vehicle_type to kitchen_type;
alter table public.purchase_contracts      rename column vehicle_description to item_description;
alter table public.wizard_sessions         rename column vehicle_summary to kitchen_summary;

-- Anmerkung: kitchens.base_vehicle und kitchens.vehicle_identification_number
-- werden hier NICHT umbenannt. Das sind caravan-spezifische Felder die spaeter
-- entweder geloescht oder durch kuechen-spezifische Aequivalente ersetzt werden.

-- ----------------------------------------------------------------
-- 6) Functions umbenennen
-- ----------------------------------------------------------------
alter function public.process_search_alerts_for_motorhome             rename to process_search_alerts_for_kitchen;
alter function public.sync_motorhome_reserve_from_auction             rename to sync_kitchen_reserve_from_auction;
alter function public.sync_motorhome_status_from_auction              rename to sync_kitchen_status_from_auction;
alter function public.trg_sync_motorhome_account_type_from_seller     rename to trg_sync_kitchen_account_type_from_seller;
alter function public.trg_sync_motorhomes_when_dealer_role            rename to trg_sync_kitchens_when_dealer_role;
alter function public.update_motorhome_damage_status                  rename to update_kitchen_damage_status;

-- ----------------------------------------------------------------
-- 7) Trigger umbenennen (Trigger liegen auf verschiedenen Tabellen)
-- ----------------------------------------------------------------
alter trigger trg_sync_motorhome_account_type_from_seller on public.kitchens   rename to trg_sync_kitchen_account_type_from_seller;
alter trigger update_motorhomes_updated_at                on public.kitchens   rename to update_kitchens_updated_at;
alter trigger trg_sync_motorhome_reserve                  on public.auctions   rename to trg_sync_kitchen_reserve;
alter trigger trg_sync_motorhome_status                   on public.auctions   rename to trg_sync_kitchen_status;
alter trigger trg_sync_motorhomes_when_dealer_role        on public.user_roles rename to trg_sync_kitchens_when_dealer_role;

-- ----------------------------------------------------------------
-- 8) Indexe umbenennen
-- ----------------------------------------------------------------
alter index public.auctions_motorhome_id_key                   rename to auctions_kitchen_id_key;
alter index public.idx_appointments_motorhome_id               rename to idx_appointments_kitchen_id;
alter index public.idx_auctions_motorhome_id                   rename to idx_auctions_kitchen_id;
alter index public.idx_claims_motorhome_id                     rename to idx_claims_kitchen_id;
alter index public.idx_damage_photos_motorhome_id              rename to idx_damage_photos_kitchen_id;
alter index public.idx_motorhome_photos_motorhome_id           rename to idx_kitchen_photos_kitchen_id;
alter index public.idx_motorhome_photos_unprocessed            rename to idx_kitchen_photos_unprocessed;
alter index public.idx_motorhomes_available_from               rename to idx_kitchens_available_from;
alter index public.idx_motorhomes_country                      rename to idx_kitchens_country;
alter index public.idx_motorhomes_created_at                   rename to idx_kitchens_created_at;
alter index public.idx_motorhomes_has_damage                   rename to idx_kitchens_has_damage;
alter index public.idx_motorhomes_listing_number               rename to idx_kitchens_listing_number;
alter index public.idx_motorhomes_sale_channel_status          rename to idx_kitchens_sale_channel_status;
alter index public.idx_motorhomes_seller_id                    rename to idx_kitchens_seller_id;
alter index public.idx_motorhomes_sold_to                      rename to idx_kitchens_sold_to;
alter index public.idx_purchase_contracts_motorhome_id         rename to idx_purchase_contracts_kitchen_id;
alter index public.idx_search_alert_matches_motorhome_id       rename to idx_search_alert_matches_kitchen_id;
alter index public.idx_user_favorites_motorhome                rename to idx_user_favorites_kitchen;
alter index public.idx_vehicle_questions_motorhome             rename to idx_kitchen_questions_kitchen;
alter index public.motorhome_photos_pkey                       rename to kitchen_photos_pkey;
alter index public.motorhomes_is_archived_true_idx             rename to kitchens_is_archived_true_idx;
alter index public.motorhomes_listing_number_key               rename to kitchens_listing_number_key;
alter index public.motorhomes_pkey                             rename to kitchens_pkey;
alter index public.search_alert_matches_alert_id_motorhome_id_key rename to search_alert_matches_alert_id_kitchen_id_key;
alter index public.uniq_pcr_motorhome_pending                  rename to uniq_pcr_kitchen_pending;
alter index public.user_favorites_user_id_motorhome_id_key     rename to user_favorites_user_id_kitchen_id_key;

-- ----------------------------------------------------------------
-- 9) Constraints umbenennen (nur FK + CHECK;
--    UNIQUE- und PK-Constraints wurden bereits ueber die zugehoerigen
--    Indexe in Schritt 8 mitumbenannt, da sie denselben Namen teilen.)
-- ----------------------------------------------------------------
alter table public.appointments                    rename constraint appointments_motorhome_id_fkey                    to appointments_kitchen_id_fkey;
alter table public.auctions                        rename constraint auctions_motorhome_id_fkey                        to auctions_kitchen_id_fkey;
alter table public.bing_offline_conversions_log    rename constraint bing_offline_conversions_log_motorhome_id_fkey    to bing_offline_conversions_log_kitchen_id_fkey;
alter table public.claims                          rename constraint claims_motorhome_id_fkey                          to claims_kitchen_id_fkey;
alter table public.damage_photos                   rename constraint damage_photos_motorhome_id_fkey                   to damage_photos_kitchen_id_fkey;
alter table public.google_offline_conversions_log  rename constraint google_offline_conversions_log_motorhome_id_fkey  to google_offline_conversions_log_kitchen_id_fkey;
alter table public.invoices                        rename constraint invoices_motorhome_id_fkey                        to invoices_kitchen_id_fkey;
alter table public.kitchen_photos                  rename constraint motorhome_photos_motorhome_id_fkey                to kitchen_photos_kitchen_id_fkey;
alter table public.kitchens                        rename constraint motorhomes_auction_requires_reserve               to kitchens_auction_requires_reserve;
alter table public.kitchens                        rename constraint motorhomes_instant_price_positive                 to kitchens_instant_price_positive;
alter table public.kitchens                        rename constraint motorhomes_sale_type_check                        to kitchens_sale_type_check;
alter table public.kitchens                        rename constraint motorhomes_seller_id_fkey                         to kitchens_seller_id_fkey;
alter table public.kitchens                        rename constraint motorhomes_sold_to_fkey                           to kitchens_sold_to_fkey;
alter table public.kitchens                        rename constraint motorhomes_status_check                           to kitchens_status_check;
alter table public.price_change_requests           rename constraint price_change_requests_motorhome_id_fkey           to price_change_requests_kitchen_id_fkey;
alter table public.purchase_contracts              rename constraint purchase_contracts_motorhome_id_fkey              to purchase_contracts_kitchen_id_fkey;
alter table public.search_alert_matches            rename constraint search_alert_matches_motorhome_id_fkey            to search_alert_matches_kitchen_id_fkey;
alter table public.user_favorites                  rename constraint user_favorites_motorhome_id_fkey                  to user_favorites_kitchen_id_fkey;
alter table public.kitchen_questions               rename constraint vehicle_questions_motorhome_id_fkey               to kitchen_questions_kitchen_id_fkey;
-- Zusaetzlich: Constraints/Indexe von vehicle_questions (jetzt kitchen_questions) die nicht motorhome_id betreffen
alter table public.kitchen_questions               rename constraint vehicle_questions_answered_by_fkey                to kitchen_questions_answered_by_fkey;
alter table public.kitchen_questions               rename constraint vehicle_questions_pkey                            to kitchen_questions_pkey;
alter table public.kitchen_questions               rename constraint vehicle_questions_questioner_id_fkey              to kitchen_questions_questioner_id_fkey;
alter index public.idx_vehicle_questions_answered_by                rename to idx_kitchen_questions_answered_by;
alter index public.idx_vehicle_questions_questioner_id              rename to idx_kitchen_questions_questioner_id;
-- vehicle_type check-constraints
alter table public.value_assessment_leads          rename constraint value_assessment_leads_vehicle_type_check         to value_assessment_leads_kitchen_type_check;
alter table public.wertrechner_reviews             rename constraint wertrechner_reviews_vehicle_type_check            to wertrechner_reviews_kitchen_type_check;

-- ----------------------------------------------------------------
-- 10) RLS-Policies umbenennen
-- ----------------------------------------------------------------
alter policy "Admins can manage all motorhomes"                        on public.kitchens       rename to "Admins can manage all kitchens";
alter policy "Anyone can view available motorhomes"                    on public.kitchens       rename to "Anyone can view available kitchens";
alter policy "Anyone can view damage photos for available motorhomes"  on public.damage_photos  rename to "Anyone can view damage photos for available kitchens";
alter policy "Anyone can view motorhome photos"                        on public.kitchen_photos rename to "Anyone can view kitchen photos";
alter policy "Motorhome owners can create auctions"                    on public.auctions       rename to "Kitchen owners can create auctions";
alter policy "Motorhome owners can manage damage photos"               on public.damage_photos  rename to "Kitchen owners can manage damage photos";
alter policy "Sellers can create motorhomes"                           on public.kitchens       rename to "Sellers can create kitchens";
alter policy "Sellers can manage own motorhome photos"                 on public.kitchen_photos    rename to "Sellers can manage own kitchen photos";
alter policy "Sellers can update own motorhomes"                       on public.kitchens          rename to "Sellers can update own kitchens";
alter policy "Admins can delete vehicle questions"                     on public.kitchen_questions rename to "Admins can delete kitchen questions";
alter policy "Sellers can view claims about their vehicles"            on public.claims            rename to "Sellers can view claims about their kitchens";

-- ----------------------------------------------------------------
-- 11) View "auctions_public" mit neuen Spaltennamen neu erstellen
-- ----------------------------------------------------------------
create view public.auctions_public as
select
  id,
  kitchen_id,
  status,
  starting_bid,
  current_bid,
  reserve_price,
  start_time,
  end_time,
  kaufchance_expires_at,
  kaufchance_min_price,
  auction_round,
  marketing_phase_started_at,
  last_price_reduction_at,
  soft_close_extension_minutes,
  created_at,
  updated_at
from public.auctions;

commit;
