-- ============================================================================
-- Bing Ads OAuth State — Lease Lock for Race-Safe Token Rotation
-- ============================================================================
-- Adds an auto-expiring "lease lock" column so that concurrent Edge Function
-- invocations (e.g. cron `check-expired-auctions` closing 5 auctions in the
-- same second) cannot stomp on each other's refresh-token rotation.
--
-- Pattern: optimistic CAS on `lock_holder_until`. The Edge Function holds
-- the lease for max 30s. If the function crashes before releasing, the
-- lease auto-expires and the next call takes over.
-- ============================================================================

ALTER TABLE public.bing_oauth_state
    ADD COLUMN IF NOT EXISTS lock_holder_until TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.bing_oauth_state.lock_holder_until IS
    'Lease lock for OAuth refresh. While > now(), another Edge Function is mid-refresh — wait and re-read instead of double-rotating. Auto-expires after 30s if function crashes.';

-- Helper RPC: try to acquire the lease lock atomically.
-- Returns TRUE if we got the lock, FALSE if someone else holds it.
-- Lock duration is hardcoded at 30s — long enough for OAuth + write,
-- short enough that a crashed function doesn't deadlock the system.
CREATE OR REPLACE FUNCTION public.bing_oauth_try_acquire_lock(p_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_updated INTEGER;
BEGIN
    -- Atomic CAS: only acquire if currently unheld OR expired.
    UPDATE public.bing_oauth_state
       SET lock_holder_until = now() + interval '30 seconds'
     WHERE id = p_id
       AND (lock_holder_until IS NULL OR lock_holder_until <= now());

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$;

COMMENT ON FUNCTION public.bing_oauth_try_acquire_lock(TEXT) IS
    'Atomically try to acquire the OAuth refresh lease lock. Returns TRUE on success, FALSE if another worker holds it. SECURITY DEFINER because edge functions call it with anon JWT but bypass RLS via the Edge service role anyway — this just enforces the lock semantics in the DB.';

-- Helper RPC: release the lock explicitly (success path).
CREATE OR REPLACE FUNCTION public.bing_oauth_release_lock(p_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    UPDATE public.bing_oauth_state
       SET lock_holder_until = NULL
     WHERE id = p_id;
END;
$$;

COMMENT ON FUNCTION public.bing_oauth_release_lock(TEXT) IS
    'Release the OAuth refresh lease lock. Called after a successful refresh+persist.';

-- Grants: only service_role can use these (matches table grants).
REVOKE ALL ON FUNCTION public.bing_oauth_try_acquire_lock(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bing_oauth_release_lock(TEXT)     FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bing_oauth_try_acquire_lock(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.bing_oauth_release_lock(TEXT)     TO service_role;
