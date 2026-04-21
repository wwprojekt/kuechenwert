-- =============================================================================
-- Wizard-Completion Robustheit (Defense-in-Depth gegen verlorene Leads)
-- =============================================================================
--
-- Hintergrund / Root Cause
-- ------------------------
-- Heute (2026-04-21) hat die additive Bing-Migration 20260421100000
-- update_wizard_session_by_anonymous_id() recreated und dabei VERSEHENTLICH
-- den `completed_at`-Fix aus 20260419132256 überschrieben. Folge:
--
--   * Frontend submitForm() / markCompleted() schicken `completed_at = now()`
--     im JSONB-Update-Payload mit, der RPC verwirft das Feld stillschweigend.
--   * Sessions stehen damit auf status='completed' AND completed_at IS NULL.
--   * Safety-Net `process-abandoned-wizards` filtert auf
--     `.lt("completed_at", tenMinutesAgo)` -- NULL-Zeilen sind unsichtbar.
--   * Wenn der client-seitige auto-convert-wizard-Aufruf (auf der Danke-Seite)
--     durch Tab-Close / Mobile-Background / Network-Drop abgebrochen wird,
--     bleibt der Lead PERMANENT verloren.
--
-- Erstes Opfer: schoenerth@gmx.de (manuell recovered, separater Schritt).
--
-- Drei Fixes, alle additiv und idempotent:
--
--   1) RPC erneut korrigieren (completed_at + msclkid in einer Definition).
--   2) BEFORE-UPDATE-Trigger als Backstop: sobald status auf 'completed'
--      kippt, wird completed_at automatisch auf now() gesetzt -- selbst wenn
--      irgendeine zukünftige Codeänderung das wieder vergisst. Das ist der
--      "Belt-and-Suspenders"-Schutz gegen weitere Regressions.
--   3) Cron-Frequenz von 30 min auf 5 min senken. Recovery-Window wird damit
--      kleiner als die Ungeduld eines abgebrochenen Mobile-Users.
--
-- Backfill der existierenden NULL-Zeile ist NICHT nötig (Schöner ist bereits
-- 'converted'; weitere completed-NULL-Sessions existieren laut Audit nicht).
-- Defensiv führen wir den Backfill trotzdem aus -- er ist idempotent.

-- =====================================================================
-- 1) RPC: completed_at zurück in die Whitelist (zusätzlich zu msclkid)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.update_wizard_session_by_anonymous_id(
  p_anonymous_id TEXT,
  p_session_id   UUID,
  p_updates      JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  UPDATE wizard_sessions SET
    current_step      = COALESCE((p_updates->>'current_step')::int,         current_step),
    max_step_reached  = COALESCE((p_updates->>'max_step_reached')::int,     max_step_reached),
    total_steps       = COALESCE((p_updates->>'total_steps')::int,          total_steps),
    step_name         = COALESCE(p_updates->>'step_name',                   step_name),
    form_data         = COALESCE((p_updates->>'form_data')::jsonb,          form_data),
    status            = COALESCE(p_updates->>'status',                      status),
    customer_name     = COALESCE(p_updates->>'customer_name',               customer_name),
    customer_email    = COALESCE(p_updates->>'customer_email',              customer_email),
    customer_phone    = COALESCE(p_updates->>'customer_phone',              customer_phone),
    vehicle_summary   = COALESCE(p_updates->>'vehicle_summary',             vehicle_summary),
    user_id           = COALESCE((p_updates->>'user_id')::uuid,             user_id),
    gclid             = COALESCE(p_updates->>'gclid',                       gclid),
    gbraid            = COALESCE(p_updates->>'gbraid',                      gbraid),
    wbraid            = COALESCE(p_updates->>'wbraid',                      wbraid),
    msclkid           = COALESCE(p_updates->>'msclkid',                     msclkid),
    completed_at      = COALESCE((p_updates->>'completed_at')::timestamptz, completed_at),
    updated_at        = now(),
    last_activity_at  = now()
  WHERE id = p_session_id AND anonymous_id = p_anonymous_id;
END;
$func$;

COMMENT ON FUNCTION public.update_wizard_session_by_anonymous_id IS
  'Whitelist-basierter Update für anonyme Wizard-Sessions. completed_at und msclkid sind aufgenommen (Bug-Fix 2026-04-21).';

-- =====================================================================
-- 2) Backstop-Trigger: status -> ''completed'' garantiert completed_at
-- =====================================================================
-- Selbst wenn ein zukünftiger Code-Pfad (RPC, Direktupdate, Edge Function)
-- vergisst completed_at zu setzen: dieser Trigger setzt es automatisch.
-- Das macht den Safety-Net deterministisch und immun gegen Regressions.

CREATE OR REPLACE FUNCTION public.wizard_sessions_set_completed_at()
RETURNS trigger
LANGUAGE plpgsql
AS $trg$
BEGIN
  -- Nur wenn der Status JETZT erstmals 'completed' wird (egal ob via Insert
  -- oder Update) UND der Caller completed_at nicht selbst gesetzt hat.
  IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END;
$trg$;

DROP TRIGGER IF EXISTS wizard_sessions_set_completed_at ON public.wizard_sessions;
CREATE TRIGGER wizard_sessions_set_completed_at
  BEFORE INSERT OR UPDATE OF status, completed_at
  ON public.wizard_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.wizard_sessions_set_completed_at();

COMMENT ON FUNCTION public.wizard_sessions_set_completed_at IS
  'Stellt sicher dass status=''completed'' immer ein completed_at hat. Schutz gegen RPC-Regressions die das Feld vergessen.';

-- =====================================================================
-- 3) Backfill: vorhandene NULL-Sessions reparieren (idempotent)
-- =====================================================================
-- Audit zeigt aktuell 0 betroffene Zeilen (Schöner ist bereits 'converted'),
-- aber defensiv ausgeführt -- harmlos und macht Migration self-healing wenn
-- in der Zwischenzeit weitere Sessions reingespült wurden.

UPDATE public.wizard_sessions
SET completed_at = COALESCE(updated_at, created_at)
WHERE status = 'completed'
  AND completed_at IS NULL;

-- =====================================================================
-- 4) Cron-Schedule: process-abandoned-wizards von 30 min auf 5 min
-- =====================================================================
-- Begründung: das Recovery-Fenster muss kleiner sein als die typische
-- Ungeduld eines Users der eine Aktivierungs-Email erwartet. 30 min ist
-- inakzeptabel (User glaubt es ist kaputt, schreibt Support an, Lead kalt).
-- 5 min ist ein guter Kompromiss zwischen Frische und Cron-Last.
--
-- cron.schedule überschreibt einen existierenden Job mit gleichem Namen
-- automatisch (kein DROP nötig).

SELECT cron.schedule(
  'process-abandoned-wizards',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url     := 'https://zcrwqxsyptjwkuxfacvq.supabase.co/functions/v1/process-abandoned-wizards',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || (
                   SELECT decrypted_secret
                   FROM vault.decrypted_secrets
                   WHERE name = 'service_role_key'
                 )
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $cron$
);
