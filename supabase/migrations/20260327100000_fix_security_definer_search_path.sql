-- ============================================================================
-- Migration: Fix search_path for all SECURITY DEFINER functions
-- Date: 2026-03-27
-- Description: Sets an immutable search_path on all SECURITY DEFINER functions
--              to prevent potential privilege escalation via search_path manipulation.
--              See: https://supabase.com/docs/guides/database/database-advisors
-- ============================================================================

-- 1. log_audit_event(p_action text, p_entity_type text, p_entity_id text, p_details jsonb)
ALTER FUNCTION public.log_audit_event(text, text, text, jsonb) SET search_path = public;

-- 2. update_dealer_level(p_dealer_id uuid)
ALTER FUNCTION public.update_dealer_level(uuid) SET search_path = public;

-- 3. trigger_update_dealer_level_on_bid()
ALTER FUNCTION public.trigger_update_dealer_level_on_bid() SET search_path = public;

-- 4. trigger_update_dealer_level_on_sale()
ALTER FUNCTION public.trigger_update_dealer_level_on_sale() SET search_path = public;

-- 5. generate_contract_number()
ALTER FUNCTION public.generate_contract_number() SET search_path = public;

-- 6. auto_assign_customer_number()
ALTER FUNCTION public.auto_assign_customer_number() SET search_path = public;

-- 7. create_auction_invoice(auction_id_param uuid, dealer_id_param uuid)
ALTER FUNCTION public.create_auction_invoice(uuid, uuid) SET search_path = public;

-- 8. create_instant_buy_invoice(auction_id_param uuid, dealer_id_param uuid, sale_price_param numeric)
ALTER FUNCTION public.create_instant_buy_invoice(uuid, uuid, numeric) SET search_path = public;

-- 9. generate_customer_number()
ALTER FUNCTION public.generate_customer_number() SET search_path = public;

-- 10. clean_old_analytics_data(retention_days integer)
ALTER FUNCTION public.clean_old_analytics_data(integer) SET search_path = public;

-- 11. increment_event_count()
ALTER FUNCTION public.increment_event_count() SET search_path = public;

-- 12. update_session_metrics()
ALTER FUNCTION public.update_session_metrics() SET search_path = public;

-- 13. trigger_welcome_email()
ALTER FUNCTION public.trigger_welcome_email() SET search_path = public;

-- 14. cleanup_old_error_logs()
ALTER FUNCTION public.cleanup_old_error_logs() SET search_path = public;

-- ============================================================================
-- Fix SECURITY DEFINER Views
-- These views run with the privileges of the view creator (definer).
-- Change them to SECURITY INVOKER so they run with the caller's privileges,
-- respecting RLS policies.
-- ============================================================================

-- 15. error_logs_grouped view
ALTER VIEW public.error_logs_grouped SET (security_invoker = on);

-- 16. error_logs_stats view
ALTER VIEW public.error_logs_stats SET (security_invoker = on);
