-- Fix: Add gclid/gbraid/wbraid fields to update_wizard_session_by_anonymous_id RPC
-- Without this, anonymous users (majority of wizard visitors from Google Ads)
-- would silently lose their Click-IDs because the RPC has a fixed field whitelist.

CREATE OR REPLACE FUNCTION update_wizard_session_by_anonymous_id(
  p_anonymous_id TEXT,
  p_session_id UUID,
  p_updates JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  UPDATE wizard_sessions SET
    current_step = COALESCE((p_updates->>'current_step')::int, current_step),
    max_step_reached = COALESCE((p_updates->>'max_step_reached')::int, max_step_reached),
    total_steps = COALESCE((p_updates->>'total_steps')::int, total_steps),
    step_name = COALESCE(p_updates->>'step_name', step_name),
    form_data = COALESCE((p_updates->>'form_data')::jsonb, form_data),
    status = COALESCE(p_updates->>'status', status),
    customer_name = COALESCE(p_updates->>'customer_name', customer_name),
    customer_email = COALESCE(p_updates->>'customer_email', customer_email),
    customer_phone = COALESCE(p_updates->>'customer_phone', customer_phone),
    vehicle_summary = COALESCE(p_updates->>'vehicle_summary', vehicle_summary),
    user_id = COALESCE((p_updates->>'user_id')::uuid, user_id),
    gclid = COALESCE(p_updates->>'gclid', gclid),
    gbraid = COALESCE(p_updates->>'gbraid', gbraid),
    wbraid = COALESCE(p_updates->>'wbraid', wbraid),
    updated_at = now(),
    last_activity_at = now()
  WHERE id = p_session_id AND anonymous_id = p_anonymous_id;
END;
$func$;
