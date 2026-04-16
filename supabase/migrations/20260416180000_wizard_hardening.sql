-- Wizard Hardening Migration (2026-04-16)
-- =======================================
-- 1. Tighten wizard_sessions RLS so no authenticated session can read PII
--    of other users' wizards. Anonymous access continues to work via the
--    existing SECURITY DEFINER RPCs (create_wizard_session,
--    find_wizard_session_by_anonymous_id, update_wizard_session_by_anonymous_id).
-- 2. Add link_wizard_sessions_to_confirmed_user() RPC so AuthConfirm can
--    link orphaned wizard sessions (user_id IS NULL, customer_email = auth-email)
--    to the newly confirmed user — safely, without opening up SELECT/UPDATE
--    to arbitrary emails.
-- 3. Add verify_wizard_session_ownership() RPC that the public edge functions
--    upload-wizard-photos and auto-convert-wizard use to validate that the
--    caller actually owns the wizard session (anonymous_id OR user_id match).

-- --------------------------------------------------------------------------
-- 1. Tighten wizard_sessions RLS
-- --------------------------------------------------------------------------

-- Drop the overly permissive USING(true) policies from the initial migration.
DROP POLICY IF EXISTS wizard_sessions_user_select ON public.wizard_sessions;
DROP POLICY IF EXISTS wizard_sessions_user_insert ON public.wizard_sessions;
DROP POLICY IF EXISTS wizard_sessions_user_update ON public.wizard_sessions;

-- Recreate with scoped checks.
-- SELECT: only the owner (authenticated) can read their own sessions.
--   Anonymous clients MUST use find_wizard_session_by_anonymous_id (SECURITY DEFINER).
CREATE POLICY wizard_sessions_user_select ON public.wizard_sessions
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- INSERT: allow anyone to create a session, but not one that already claims
-- another user's user_id. Anonymous inserts (user_id IS NULL) stay allowed
-- so the guest submit path in useWizardForm.ts keeps working.
CREATE POLICY wizard_sessions_user_insert ON public.wizard_sessions
  FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- UPDATE: only the owner can update their session.
--   Anonymous clients MUST use update_wizard_session_by_anonymous_id.
CREATE POLICY wizard_sessions_user_update ON public.wizard_sessions
  FOR UPDATE
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- (admin + service_role policies from the initial migration stay untouched.)

-- --------------------------------------------------------------------------
-- 2. link_wizard_sessions_to_confirmed_user()
--    Used by AuthConfirm after email verification to adopt any orphaned
--    wizard sessions (user_id IS NULL, customer_email = auth-email) into
--    the confirmed user. Without this RPC, the AuthConfirm page cannot find
--    or update orphaned sessions once RLS is tightened above.
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.link_wizard_sessions_to_confirmed_user()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_mail text := (auth.jwt() ->> 'email');
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL OR v_mail IS NULL OR v_mail = '' THEN
    RETURN 0;
  END IF;

  WITH updated AS (
    UPDATE public.wizard_sessions
       SET user_id = v_uid
     WHERE user_id IS NULL
       AND lower(customer_email) = lower(v_mail)
       AND status IN ('completed', 'converted', 'in_progress')
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM updated;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_wizard_sessions_to_confirmed_user() TO authenticated;

-- --------------------------------------------------------------------------
-- 3. verify_wizard_session_ownership()
--    Used by public edge functions (upload-wizard-photos, auto-convert-wizard)
--    to validate that the caller is actually the owner of the session.
--    Returns TRUE when:
--      - p_anonymous_id matches the session's anonymous_id, OR
--      - p_user_id matches the session's user_id, OR
--      - the session is recent (< 30 min old) AND its anonymous_id is NULL
--        AND the caller didn't provide any id (fallback for legacy clients).
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.verify_wizard_session_ownership(
  p_session_id uuid,
  p_anonymous_id text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  s RECORD;
BEGIN
  IF p_session_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT id, anonymous_id, user_id, created_at, updated_at
    INTO s
    FROM public.wizard_sessions
   WHERE id = p_session_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Match on anonymous_id (primary path for guest users)
  IF p_anonymous_id IS NOT NULL AND s.anonymous_id IS NOT NULL
     AND p_anonymous_id = s.anonymous_id THEN
    RETURN TRUE;
  END IF;

  -- Match on user_id (authenticated users)
  IF p_user_id IS NOT NULL AND s.user_id IS NOT NULL
     AND p_user_id = s.user_id THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_wizard_session_ownership(uuid, text, uuid) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.verify_wizard_session_ownership(uuid, text, uuid) IS
  'Returns TRUE if the caller owns the wizard session (anonymous_id or user_id match). Used by public edge functions to prevent unauthorized access to wizard sessions.';
