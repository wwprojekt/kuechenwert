-- Phase 2.2: Droppt Caravan-spezifische Tabellen + abhaengige Funktionen.
--
-- Betroffene Tabellen:
--   * public.purchase_inquiries       (Kaufanfragen fuer RVs)
--   * public.value_assessment_leads   (Wohnmobil-Wertrechner-Leads)
--   * public.wertrechner_reviews      (Caravan-Wertrechner-Reviews)
--
-- Betroffene Funktionen (alle nur auf o.g. Tabellen angewiesen):
--   * admin_moderate_wertrechner_review
--   * cleanup_wertrechner_review_pii
--   * enqueue_google_review_candidates   (sammelt Emails u.a. aus purchase_inquiries + value_assessment_leads;
--                                         Kuechen-Aequivalent folgt in Phase 2.3)
--   * get_wertrechner_review_stats
--   * get_wertrechner_reviews_public
--   * insert_value_assessment_lead
--   * set_wertrechner_reviews_updated_at  (Trigger-Function auf wertrechner_reviews)
--   * submit_wertrechner_review
--   * update_ai_valuation
--
-- Alle Tabellen wurden vor Migration geprueft: row_count = 0 (Nuke in Phase 0).
-- Keine Foreign Keys, keine Views, keine Cron-Jobs, keine Enums haengen dran.
-- RLS-Policies + Triggers + Indexes werden per DROP TABLE CASCADE automatisch entfernt.

-- 1. Funktionen droppen (exakte Signaturen). Reihenfolge egal, CASCADE entfernt Abhaengigkeiten.
drop function if exists public.admin_moderate_wertrechner_review(p_review_id uuid, p_action text, p_reason text) cascade;
drop function if exists public.cleanup_wertrechner_review_pii() cascade;
drop function if exists public.enqueue_google_review_candidates(p_min_age_days integer, p_max_inserts integer) cascade;
drop function if exists public.get_wertrechner_review_stats() cascade;
drop function if exists public.get_wertrechner_reviews_public(integer, integer) cascade;
drop function if exists public.insert_value_assessment_lead(
  p_name text, p_email text, p_source text, p_phone text,
  p_manufacturer text, p_model text, p_year integer, p_mileage integer,
  p_condition text, p_body_type text, p_message text,
  p_estimated_value_min integer, p_estimated_value_max integer,
  p_algorithm_value_min numeric, p_algorithm_value_max numeric,
  p_brand_tier text, p_vehicle_type text
) cascade;
drop function if exists public.set_wertrechner_reviews_updated_at() cascade;
drop function if exists public.submit_wertrechner_review(
  p_rating integer, p_comment text, p_reviewer_name text, p_reviewer_email text,
  p_reviewer_location text, p_vehicle_type text, p_session_id text,
  p_ip_hash text, p_user_agent text, p_honeypot text
) cascade;
drop function if exists public.update_ai_valuation(
  p_lead_id uuid, p_ai_value numeric, p_ai_confidence numeric,
  p_ai_reasoning text, p_ai_source text, p_comparable_count integer
) cascade;

-- 2. Tabellen droppen (CASCADE entfernt RLS-Policies, Triggers, Indexes).
drop table if exists public.wertrechner_reviews cascade;
drop table if exists public.value_assessment_leads cascade;
drop table if exists public.purchase_inquiries cascade;
