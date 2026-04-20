-- ============================================================================
-- Migration: Fix search_path for all SECURITY DEFINER functions
-- Date: 2026-03-27
-- Description: Sets an immutable search_path on all SECURITY DEFINER functions
--              to prevent potential privilege escalation via search_path manipulation.
--              See: https://supabase.com/docs/guides/database/database-advisors
--
-- 2026-04-20: Wrapped each ALTER in a try/catch so missing functions/views
-- (which were renamed or removed in later migrations) do not abort the
-- migration on replay.
-- ============================================================================

DO $$
DECLARE
  stmts TEXT[] := ARRAY[
    'ALTER FUNCTION public.log_audit_event(text, text, text, jsonb) SET search_path = public',
    'ALTER FUNCTION public.update_dealer_level(uuid) SET search_path = public',
    'ALTER FUNCTION public.trigger_update_dealer_level_on_bid() SET search_path = public',
    'ALTER FUNCTION public.trigger_update_dealer_level_on_sale() SET search_path = public',
    'ALTER FUNCTION public.generate_contract_number() SET search_path = public',
    'ALTER FUNCTION public.auto_assign_customer_number() SET search_path = public',
    'ALTER FUNCTION public.create_auction_invoice(uuid, uuid) SET search_path = public',
    'ALTER FUNCTION public.create_instant_buy_invoice(uuid, uuid, numeric) SET search_path = public',
    'ALTER FUNCTION public.generate_customer_number() SET search_path = public',
    'ALTER FUNCTION public.clean_old_analytics_data(integer) SET search_path = public',
    'ALTER FUNCTION public.increment_event_count() SET search_path = public',
    'ALTER FUNCTION public.update_session_metrics() SET search_path = public',
    'ALTER FUNCTION public.trigger_welcome_email() SET search_path = public',
    'ALTER FUNCTION public.cleanup_old_error_logs() SET search_path = public',
    'ALTER VIEW public.error_logs_grouped SET (security_invoker = on)',
    'ALTER VIEW public.error_logs_stats SET (security_invoker = on)'
  ];
  s TEXT;
BEGIN
  FOREACH s IN ARRAY stmts LOOP
    BEGIN
      EXECUTE s;
    EXCEPTION
      WHEN undefined_function THEN
        RAISE NOTICE 'Skipping (function missing): %', s;
      WHEN undefined_table THEN
        RAISE NOTICE 'Skipping (relation missing): %', s;
      WHEN undefined_object THEN
        RAISE NOTICE 'Skipping (object missing): %', s;
    END;
  END LOOP;
END $$;
