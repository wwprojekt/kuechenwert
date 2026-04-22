-- ============================================================================
-- Bing Ads OAuth Refresh Token Persistence
-- ============================================================================
-- Microsoft rotates the OAuth refresh token on every use.
-- If we kept the token in env-vars only, the Edge Function would work exactly
-- ONCE per Supabase deploy and then 401 forever. This table persists the
-- *current* refresh token in the DB, so the Edge Function can:
--   1. read the latest refresh token from this table
--   2. exchange it for an access token
--   3. write the *rotated* refresh token back to this table
-- before doing the actual Bing Ads API call.
--
-- Storage rules:
--   * Only ONE row exists; PK is a fixed text key ('bing_ads_main')
--   * RLS: SELECT/INSERT/UPDATE only by service_role; no anon, no authenticated.
--   * No defaults — caller must explicitly set client_id + initial token.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bing_oauth_state (
    id                 TEXT         PRIMARY KEY,
    refresh_token      TEXT         NOT NULL,
    access_token       TEXT         NULL,
    access_token_expires_at TIMESTAMPTZ NULL,
    last_refreshed_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_error         TEXT         NULL,
    last_error_at      TIMESTAMPTZ  NULL,
    rotation_count     INTEGER      NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.bing_oauth_state IS
    'Persistent storage for the rotating Microsoft Advertising OAuth refresh token. Microsoft rotates the refresh token on every refresh, so we cannot rely on env-vars.';
COMMENT ON COLUMN public.bing_oauth_state.id IS
    'Fixed key, currently always ''bing_ads_main''. Reserved for future multi-tenant support.';
COMMENT ON COLUMN public.bing_oauth_state.refresh_token IS
    'CURRENT refresh token. Updated atomically after every successful access-token refresh.';
COMMENT ON COLUMN public.bing_oauth_state.access_token IS
    'Cached access token (lifetime ~1h). Re-used across requests inside the lifetime.';
COMMENT ON COLUMN public.bing_oauth_state.access_token_expires_at IS
    'When the cached access token expires. We refresh proactively when <5min remain.';
COMMENT ON COLUMN public.bing_oauth_state.rotation_count IS
    'How often we have rotated the refresh token. Useful for debugging stuck flows.';

CREATE INDEX IF NOT EXISTS bing_oauth_state_last_refreshed_idx
    ON public.bing_oauth_state (last_refreshed_at DESC);

ALTER TABLE public.bing_oauth_state ENABLE ROW LEVEL SECURITY;

-- service_role only — no policy for anon/authenticated, defaults deny.
DROP POLICY IF EXISTS bing_oauth_state_service_role_all ON public.bing_oauth_state;
CREATE POLICY bing_oauth_state_service_role_all
    ON public.bing_oauth_state
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

REVOKE ALL ON public.bing_oauth_state FROM PUBLIC;
REVOKE ALL ON public.bing_oauth_state FROM anon;
REVOKE ALL ON public.bing_oauth_state FROM authenticated;
GRANT  ALL ON public.bing_oauth_state TO   service_role;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.bing_oauth_state_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bing_oauth_state_touch_trg ON public.bing_oauth_state;
CREATE TRIGGER bing_oauth_state_touch_trg
    BEFORE UPDATE ON public.bing_oauth_state
    FOR EACH ROW
    EXECUTE FUNCTION public.bing_oauth_state_touch();
