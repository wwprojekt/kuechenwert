-- Add explicit service-role-only RLS policy for bing_offline_conversions_log.
-- The table already had RLS enabled and only `service_role`/`postgres` grants
-- (so it's already locked down because service_role bypasses RLS), but the
-- Supabase advisor flags "RLS enabled, no policies" as INFO and silently
-- relying on the bypass is brittle: if someone ever adds a SELECT/INSERT grant
-- to anon/authenticated by accident, the table would suddenly become public.
--
-- Adding the same `service_role`-only policy pattern that we already use for
-- `bing_oauth_state` (see migration 20260422151525_bing_oauth_state.sql) makes
-- the security intent explicit AND preserves it under future grant changes.

CREATE POLICY bing_offline_conversions_log_service_role_all
    ON public.bing_offline_conversions_log
    AS PERMISSIVE
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
