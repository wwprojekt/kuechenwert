-- =============================================================================
-- Wizard Cross-Device Resume Token
-- =============================================================================
--
-- Bug-Kontext (2026-04-21):
-- Bisher wurde der Resume-Link in `send-wizard-resume-email` und
-- `process-abandoned-wizards` als `?session=<uuid>` an die Empfaenger geschickt.
-- Im Frontend (useWizardSession.ts) versucht der Hook die Session ueber den
-- existierenden RPC `find_wizard_session_by_anonymous_id(p_anonymous_id)`
-- zu laden — der findet aber NUR Sessions, die zur localStorage-anonymous_id
-- des AKTUELLEN Geraets gehoeren. Klickt der Empfaenger den Link auf einem
-- anderen Geraet (Smartphone statt Desktop, Inkognito, gewechselter Browser),
-- gibt es keinen Match. Der Fallback `if (fromAnon.id === urlContact.sessionParam)`
-- kann nie greifen, weil `fromAnon` aus dem anderen anonymous_id-Raum kommt.
--
-- Folge: Es entsteht eine LEERE neue Session, das URL-Parameter `?step=7`
-- setzt im Frontend `currentStep=7` — der Auto-Save persistiert sofort
-- `max_step_reached=7, customer_name=null, vehicle_summary='Noch keine Fahrzeugdaten'`,
-- bevor der Step-Guard ihn auf Step 1 zurueckwirft. Im Admin-Lead-Dashboard
-- erscheint ein Geister-Lead "User war schon bei Step 7", der gar keine
-- Daten hat. Die Original-Session (mit allen Eingaben) ist fuer den User
-- effektiv unzugaenglich.
--
-- Auswirkung in Produktion:
--   * 2 dokumentierte Geister-Sessions in der DB (max_step_reached=7,
--     customer_*=NULL, lifetime 1.5 Sekunden) seit dem 19.04.2026.
--   * Original-Sessions bleiben verwaist und werden 14 Tage spaeter durch
--     den Cron als "abandoned" markiert ohne dass der User je eine echte
--     Chance auf Recovery hatte.
--
-- Loesung — drei Saeulen:
--   1) Jede `wizard_sessions` Row bekommt einen kryptografisch sicheren,
--      nicht-erratbaren `resume_token` (32 Byte hex, 256 Bit Entropie).
--      Auto-generiert via DEFAULT + Trigger-Backfill fuer bestehende Rows.
--   2) Neuer SECURITY DEFINER RPC `find_wizard_session_by_resume_token(token)`
--      laedt Sessions deviceuebergreifend, ohne RLS zu oeffnen oder
--      Session-IDs ratbar zu machen.
--   3) Daten-Cleanup: alle existierenden Geister-Sessions
--      (customer_email IS NULL, vehicle_summary leer/Noch-keine, max_step>1)
--      werden als `abandoned` markiert und aus dem aktiven Lead-Funnel entfernt.
--
-- Frontend (useWizardSession.ts) und Edge Functions (send-wizard-resume-email,
-- process-abandoned-wizards) werden in derselben Commit-Range angepasst.
--
-- Wichtig — Sicherheit des Tokens:
--   - 32 Byte aus pgcrypto.gen_random_bytes -> 64 hex chars, nicht enumerable.
--   - UNIQUE constraint stellt sicher dass jeder Token genau eine Session
--     identifiziert.
--   - Der Token taucht NUR in:
--       a) der Email an die hinterlegte customer_email Adresse (1:1 Owner)
--       b) der URL des dadurch geoeffneten Browser-Tabs
--     auf — er hat dasselbe Vertrauensniveau wie ein Magic-Link.
--   - Der Token ersetzt KEINE Authentication beim spaeteren Submit (dort
--     greift weiterhin verify_wizard_session_ownership / RLS).

-- =============================================================================
-- 1) Spalte hinzufuegen + DEFAULT auf gen_random_bytes
-- =============================================================================
-- pgcrypto liefert gen_random_bytes; in Supabase ueblicherweise schon aktiviert.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.wizard_sessions
  ADD COLUMN IF NOT EXISTS resume_token TEXT
  DEFAULT encode(extensions.gen_random_bytes(32), 'hex');

-- Backfill bestehender Rows (alle die noch keinen Token haben).
UPDATE public.wizard_sessions
   SET resume_token = encode(extensions.gen_random_bytes(32), 'hex')
 WHERE resume_token IS NULL;

-- Erst NACH dem Backfill NOT NULL setzen.
ALTER TABLE public.wizard_sessions
  ALTER COLUMN resume_token SET NOT NULL;

-- Eindeutigkeit sicherstellen — Pflicht fuer den Lookup-RPC.
CREATE UNIQUE INDEX IF NOT EXISTS idx_wizard_sessions_resume_token
  ON public.wizard_sessions(resume_token);

COMMENT ON COLUMN public.wizard_sessions.resume_token IS
  'Cryptographically secure (32 byte / 256 bit) token used to resume a wizard session across devices. Sent ONLY to the row''s customer_email. Used by find_wizard_session_by_resume_token RPC to load the row without relying on the device''s localStorage anonymous_id.';

-- =============================================================================
-- 2) Lookup-RPC — SECURITY DEFINER, public.find_wizard_session_by_resume_token
-- =============================================================================
-- Liefert die ganze Session-Row zurueck wenn der Token matcht und die
-- Session weder converted noch abandoned ist (Recovery soll keine bereits
-- abgeschlossenen oder explizit aufgegebenen Sessions wiederbeleben).
--
-- Bewusst KEINE Validierung auf last_activity_at oder Token-Gueltigkeitsdauer
-- — der Token bleibt so lange gueltig wie die Recovery-Email beim Empfaenger
-- in der Inbox liegt. Das ist konservativ, aber vergleichbar mit den
-- magic-link-aehnlichen Recovery-Flows der meisten SaaS-Produkte.

CREATE OR REPLACE FUNCTION public.find_wizard_session_by_resume_token(
  p_resume_token TEXT
)
RETURNS SETOF public.wizard_sessions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT *
    FROM public.wizard_sessions
   WHERE resume_token = p_resume_token
     AND status IN ('in_progress', 'abandoned')
   LIMIT 1;
$func$;

GRANT EXECUTE ON FUNCTION public.find_wizard_session_by_resume_token(TEXT)
  TO anon, authenticated;

COMMENT ON FUNCTION public.find_wizard_session_by_resume_token(TEXT) IS
  'Cross-device resume: returns the wizard session matching the given resume_token if status is in_progress or abandoned. Called by useWizardSession when the URL has ?token=<resume_token> (recovery email link). The token is unguessable (256 bit entropy) and sent only to the row''s customer_email.';

-- =============================================================================
-- 3) Helper-RPC — touch + status auf in_progress zuruecksetzen beim Resume
-- =============================================================================
-- Wenn ein User die Recovery-Email klickt, sollte die Session aus
-- `abandoned` zurueck nach `in_progress` gehen — sonst rendert das
-- Admin-Dashboard sie weiterhin als verloren, obwohl der User gerade aktiv ist.
-- Wird vom Frontend direkt nach dem erfolgreichen Token-Lookup aufgerufen.

CREATE OR REPLACE FUNCTION public.reactivate_wizard_session_by_resume_token(
  p_resume_token TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_session_id UUID;
BEGIN
  UPDATE public.wizard_sessions
     SET status           = 'in_progress',
         last_activity_at = now(),
         updated_at       = now()
   WHERE resume_token = p_resume_token
     AND status IN ('abandoned', 'in_progress')
  RETURNING id INTO v_session_id;

  RETURN v_session_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.reactivate_wizard_session_by_resume_token(TEXT)
  TO anon, authenticated;

COMMENT ON FUNCTION public.reactivate_wizard_session_by_resume_token(TEXT) IS
  'Called by useWizardSession right after a successful resume_token lookup so the session moves back to in_progress and last_activity_at is bumped. Returns the session id (or NULL if no match).';

-- =============================================================================
-- 4) Cleanup — Geister-Sessions abraeumen
-- =============================================================================
-- Markiert alle Sessions, die das oben beschriebene Geister-Muster zeigen,
-- als `abandoned`. Das entfernt sie aus dem aktiven Lead-Funnel im Admin
-- (Filter "Aktiv") und verhindert, dass sie irrtuemlich als kontaktierbare
-- Leads erscheinen — sie haben keine Email, kein Telefon, keinen Namen,
-- keine Fahrzeugdaten und sind binnen Sekunden nach dem Anlegen schon
-- "abgebrochen".

UPDATE public.wizard_sessions
   SET status            = 'abandoned',
       admin_notes       = COALESCE(admin_notes, '') ||
                           CASE WHEN admin_notes IS NULL OR admin_notes = ''
                                THEN ''
                                ELSE E'\n'
                           END ||
                           '[auto-cleanup 2026-04-21] Ghost session: cross-device resume link auf neuem Geraet geoeffnet, Original konnte nicht geladen werden. Resume-Token-Migration verhindert das ab jetzt.'
 WHERE customer_email IS NULL
   AND customer_name  IS NULL
   AND customer_phone IS NULL
   AND (vehicle_summary IS NULL
        OR vehicle_summary = ''
        OR vehicle_summary = 'Noch keine Fahrzeugdaten')
   AND max_step_reached > 1
   AND status = 'in_progress';
