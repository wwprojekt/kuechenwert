-- Migration: cron_run_locks (PgBouncer-sichere Cron-Concurrency)
--
-- Phase 3.1 des Marketing-Phase-Rollouts.
--
-- Hintergrund:
--   `check-expired-auctions` läuft als Cron jede Minute. Bei langen Läufen
--   (viele expired auctions, viele E-Mails) kann eine zweite Cron-Instanz
--   triggern, BEVOR die erste fertig ist → doppelte Auto-Relists, doppelte
--   E-Mails, race conditions auf `kaufchance_invitations`.
--
--   Die naheliegende Lösung `pg_advisory_lock()` ist mit Supabase
--   PgBouncer (transaction pooling) UNZUVERLÄSSIG: pg_try_advisory_lock
--   reserviert die Lock auf Session-Ebene, aber jede SQL-Statement von
--   der Edge Function geht potenziell auf eine andere Connection. Die
--   Lock wäre also entweder schon weg oder auf der falschen Connection.
--
--   Stattdessen: persistente Lock-Tabelle mit TTL.
--
--     1. Edge Function ruft try_acquire_cron_lock('check-expired-auctions')
--        → INSERT ON CONFLICT DO UPDATE WHERE locked_at < now()-TTL
--     2. Wenn FALSE zurückkommt → andere Instanz arbeitet noch → Edge
--        Function returnt früh ohne Aktion.
--     3. Sonst: Arbeit ausführen, am Ende release_cron_lock(...).
--     4. Falls Edge Function crasht / OOM bekommt: TTL (default 5 Min)
--        verfällt automatisch → nächster Run kann arbeiten.
--
-- Tabelle ist absichtlich SUPER simpel — kein RLS nötig (nur service_role
-- darf RPCs aufrufen, und die Tabelle selbst ist nur über die RPCs
-- erreichbar). Keine Indizes außer dem PK, da maximal eine Handvoll Rows.

CREATE TABLE IF NOT EXISTS public.cron_run_locks (
  key       TEXT        PRIMARY KEY,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cron_run_locks IS
  'Pessimistische Locks für Cron-Edge-Functions. Eine Row pro Lock-Key. TTL durch Aufrufer (try_acquire_cron_lock) – stale Locks werden bei nächstem Aufruf überschrieben.';

ALTER TABLE public.cron_run_locks ENABLE ROW LEVEL SECURITY;

-- Keine RLS-Policy → nur service_role (BYPASSRLS) kann lesen/schreiben.
-- Edge Functions laufen mit service_role, normale User haben keinen Zugriff.

-- ──────────────────────────────────────────────────────────────────────────
-- try_acquire_cron_lock(key, ttl_minutes) RETURNS BOOLEAN
--
-- Atomisch:
--   * Lock noch nicht existent           → INSERT, return TRUE
--   * Lock existiert, älter als TTL      → UPDATE locked_at = now(), return TRUE
--   * Lock existiert, noch innerhalb TTL → kein Update, return FALSE
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.try_acquire_cron_lock(
  p_key           TEXT,
  p_ttl_minutes   INTEGER DEFAULT 5
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acquired BOOLEAN := FALSE;
BEGIN
  IF p_key IS NULL OR length(p_key) = 0 THEN
    RAISE EXCEPTION 'try_acquire_cron_lock: p_key must not be NULL/empty';
  END IF;

  IF p_ttl_minutes IS NULL OR p_ttl_minutes < 1 THEN
    p_ttl_minutes := 5;
  END IF;

  -- Single-statement upsert mit Stale-Lock-Übernahme.
  --
  -- ON CONFLICT DO UPDATE feuert IMMER bei Konflikt – wir wollen aber nur
  -- updaten, wenn die existierende Lock stale ist. Lösung: WHERE-Klausel
  -- im DO UPDATE. Wenn die Lock noch frisch ist, schlägt der Update fehl
  -- (kein Match) → RETURNING bleibt leer → v_acquired = NULL → wir geben
  -- FALSE zurück.
  --
  -- ON CONFLICT DO NOTHING wäre alternativ – aber dann müssten wir noch
  -- einen separaten UPDATE für den Stale-Fall machen. Single-statement ist
  -- atomarer.
  WITH ins AS (
    INSERT INTO public.cron_run_locks (key, locked_at)
    VALUES (p_key, now())
    ON CONFLICT (key) DO UPDATE
      SET locked_at = now()
      WHERE public.cron_run_locks.locked_at < now() - (p_ttl_minutes || ' minutes')::INTERVAL
    RETURNING 1
  )
  SELECT TRUE INTO v_acquired FROM ins;

  RETURN COALESCE(v_acquired, FALSE);
END;
$$;

COMMENT ON FUNCTION public.try_acquire_cron_lock(TEXT, INTEGER) IS
  'Versucht eine Cron-Lock zu erwerben. TRUE = erfolgreich, FALSE = andere Instanz hält die Lock noch. Stale Locks (älter als TTL) werden automatisch übernommen.';

-- ──────────────────────────────────────────────────────────────────────────
-- release_cron_lock(key) RETURNS VOID
--
-- Entfernt die Lock-Row. Sollte am Ende jedes Cron-Runs aufgerufen werden.
-- Falls die Edge Function crasht und das nicht passiert, übernimmt der
-- nächste Run die Lock via TTL (siehe try_acquire_cron_lock).
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.release_cron_lock(
  p_key TEXT
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.cron_run_locks WHERE key = p_key;
$$;

COMMENT ON FUNCTION public.release_cron_lock(TEXT) IS
  'Gibt eine Cron-Lock frei. Sollte am Ende eines Cron-Runs (auch bei Fehler im Try/Finally-Block) aufgerufen werden.';

-- Berechtigungen: nur service_role (Edge-Functions) darf die RPCs aufrufen.
REVOKE ALL ON FUNCTION public.try_acquire_cron_lock(TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_cron_lock(TEXT)               FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.try_acquire_cron_lock(TEXT, INTEGER) TO service_role;
GRANT  EXECUTE ON FUNCTION public.release_cron_lock(TEXT)               TO service_role;
