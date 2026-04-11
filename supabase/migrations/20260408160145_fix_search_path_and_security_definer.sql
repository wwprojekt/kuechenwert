
-- Fix 1: Set search_path on all flagged functions
ALTER FUNCTION public.get_request_anonymous_id() SET search_path = public;
ALTER FUNCTION public.update_dealer_status_changed_at() SET search_path = public;
ALTER FUNCTION public.update_max_wizard_step(uuid, integer) SET search_path = public;
ALTER FUNCTION public.update_purchase_contracts_updated_at() SET search_path = public;
ALTER FUNCTION public.find_wizard_session_by_anonymous_id(text) SET search_path = public;
ALTER FUNCTION public.update_wizard_session_by_anonymous_id(text, uuid, jsonb) SET search_path = public;
ALTER FUNCTION public.prevent_invoice_deletion() SET search_path = public;
ALTER FUNCTION public.calculate_commission(numeric, uuid) SET search_path = public;
ALTER FUNCTION public.update_error_logs_updated_at() SET search_path = public;
ALTER FUNCTION public.update_wizard_session_timestamp() SET search_path = public;
ALTER FUNCTION public.update_admin_emails_updated_at() SET search_path = public;

-- Fix 2: Recreate public_site_settings as SECURITY INVOKER (same columns)
DROP VIEW IF EXISTS public.public_site_settings;
CREATE VIEW public.public_site_settings 
WITH (security_invoker = true)
AS SELECT 
  id, created_at, updated_at,
  site_name, site_tagline, site_description,
  contact_email, support_phone,
  maintenance_mode, logo_url, favicon_url,
  primary_color, secondary_color, dark_mode_enabled,
  meta_title, meta_description, meta_keywords,
  google_analytics_id, google_tag_manager_id, sitemap_enabled,
  default_auction_duration_days, soft_close_extension_minutes,
  min_bid_increment_percent, commission_rate_percent,
  reserve_price_required, autobid_enabled, buy_now_enabled,
  whatsapp_number, tuv_badge_url,
  company_address, company_city, company_postal_code, company_country,
  ust_id, tax_number, managing_director, hrb_number,
  invoice_footer_text, invoice_payment_terms_days
FROM site_settings;

GRANT SELECT ON public.public_site_settings TO anon;
GRANT SELECT ON public.public_site_settings TO authenticated;

-- Fix 3: RLS policies for tables flagged with "RLS enabled, no policy"
CREATE POLICY "Admins can read daily summaries" 
  ON public.analytics_daily_summary FOR SELECT 
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read page performance"
  ON public.analytics_page_performance FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
