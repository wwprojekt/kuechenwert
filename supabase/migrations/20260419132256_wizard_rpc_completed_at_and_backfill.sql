-- Bug-Fix: update_wizard_session_by_anonymous_id ignorierte das Feld completed_at
-- aus dem Frontend (markCompleted + submitForm). Das hatte zur Folge, dass 94% aller
-- anonymen Wizard-Abschlüsse status='completed' aber completed_at IS NULL hatten.
-- Auswirkungen:
--   * AdminDashboard / AdminLeads sortieren nach completed_at -> Reihenfolge falsch
--   * ageDays-Berechnung fiel auf 0 zurück
--   * Safety-Net Auto-Convert in process-abandoned-wizards greift nur, wenn
--     completed_at IS NOT NULL
-- Fix: completed_at via COALESCE in das UPDATE aufnehmen + einmaliger Backfill
-- (sicher, weil status='completed' Sessions niemals Recovery-Mails bekommen).

CREATE OR REPLACE FUNCTION public.update_wizard_session_by_anonymous_id(
  p_anonymous_id text,
  p_session_id uuid,
  p_updates jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    completed_at = COALESCE((p_updates->>'completed_at')::timestamptz, completed_at),
    updated_at = now(),
    last_activity_at = now()
  WHERE id = p_session_id AND anonymous_id = p_anonymous_id;
END;
$function$;

-- Backfill: Setze completed_at = updated_at für alle bereits abgeschlossenen
-- Sessions, bei denen completed_at fehlt. Recovery-Mails werden NICHT ausgelöst,
-- weil process-abandoned-wizards explizit nach status IN ('in_progress','abandoned')
-- filtert und 'completed' ignoriert.
UPDATE wizard_sessions
SET completed_at = updated_at
WHERE status = 'completed'
  AND completed_at IS NULL;
