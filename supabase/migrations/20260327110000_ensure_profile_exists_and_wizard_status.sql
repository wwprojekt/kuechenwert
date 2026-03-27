-- ============================================================
-- 1) RPC: ensure_profile_exists
--    Called by the wizard after signup to guarantee a profiles
--    row exists even if the handle_new_user trigger failed.
-- ============================================================
DROP FUNCTION IF EXISTS public.ensure_profile_exists(uuid,text,text,text,text);

CREATE OR REPLACE FUNCTION public.ensure_profile_exists(
  p_user_id UUID,
  p_email TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, phone)
  VALUES (p_user_id, p_email, p_first_name, p_last_name, p_phone)
  ON CONFLICT (id) DO UPDATE
    SET email      = COALESCE(EXCLUDED.email, profiles.email),
        first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
        last_name  = COALESCE(EXCLUDED.last_name, profiles.last_name),
        phone      = COALESCE(EXCLUDED.phone, profiles.phone),
        updated_at = NOW();

  -- Also ensure the user has a seller role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'seller')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Grant execute to authenticated users (needed for RPC calls)
GRANT EXECUTE ON FUNCTION public.ensure_profile_exists TO authenticated;

-- ============================================================
-- 2) Extend wizard_sessions status CHECK constraint
--    to allow 'converted' (used by ConvertToMotorhomeDialog)
-- ============================================================
ALTER TABLE public.wizard_sessions
  DROP CONSTRAINT IF EXISTS wizard_sessions_status_check;

ALTER TABLE public.wizard_sessions
  ADD CONSTRAINT wizard_sessions_status_check
  CHECK (status IN ('in_progress', 'completed', 'abandoned', 'converted'));
