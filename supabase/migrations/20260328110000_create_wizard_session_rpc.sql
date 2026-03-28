-- Migration: Create SECURITY DEFINER RPC function for wizard session creation
-- Purpose: Allows anonymous users to create wizard sessions and get the session ID back
-- Without this, the INSERT works but the subsequent SELECT (via .select("id").single())
-- is blocked by the SELECT RLS policy which requires get_request_anonymous_id() header


CREATE OR REPLACE FUNCTION create_wizard_session(
  p_anonymous_id text,
  p_user_id uuid DEFAULT NULL,
  p_customer_name text DEFAULT NULL,
  p_customer_email text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL,
  p_total_steps int DEFAULT 6
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
BEGIN
  INSERT INTO wizard_sessions (
    anonymous_id,
    user_id,
    current_step,
    max_step_reached,
    total_steps,
    status,
    customer_name,
    customer_email,
    customer_phone
  ) VALUES (
    p_anonymous_id,
    p_user_id,
    1,
    1,
    p_total_steps,
    'in_progress',
    p_customer_name,
    p_customer_email,
    p_customer_phone
  )
  RETURNING id INTO v_session_id;

  RETURN v_session_id;
END;
$$;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION create_wizard_session TO anon;
GRANT EXECUTE ON FUNCTION create_wizard_session TO authenticated;
