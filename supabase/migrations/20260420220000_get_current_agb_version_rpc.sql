-- Migration: get_current_agb_version RPC
--
-- Phase 3.0 (Korrektur eines Phase-2-Versehens).
--
-- Hintergrund:
--   useWizardForm.ts und auto-convert-wizard/index.ts rufen seit Phase 2
--   `supabase.rpc('get_current_agb_version')` auf, um die aktuell gültige
--   AGB-Version beim Erstellen einer Auktion in `agb_version_at_start`
--   zu snapshotten. Die RPC selbst wurde in Phase 1 vergessen → der Call
--   schlug stillschweigend fehl (Try/Catch), `agb_version_at_start` blieb
--   NULL.
--
-- Diese Migration liefert die fehlende RPC nach. Implementierung bewusst
-- einfach: hartcodierte Konstante als Single Source of Truth. Wenn AGB
-- später versioniert werden (eigene Tabelle `agb_versions`), wird hier
-- nur die Lookup-Logik ausgetauscht – Aufrufer müssen nicht angefasst
-- werden.

CREATE OR REPLACE FUNCTION public.get_current_agb_version()
RETURNS TEXT
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
STABLE
AS $$
  -- 2026-04-20: erste AGB-Version mit Marketingphase (§6 NEU).
  -- Bei jeder rechtlich relevanten AGB-Änderung muss diese Konstante
  -- inkrementiert werden, damit Neu-Inserate den korrekten Stand snapshotten.
  SELECT '2026-04-20'::TEXT;
$$;

COMMENT ON FUNCTION public.get_current_agb_version() IS
  'Gibt die aktuelle AGB-Version als ISO-Datum zurück. Wird beim Erstellen einer Auktion in `auctions.agb_version_at_start` gespeichert (juristischer Snapshot, welche AGB der Verkäufer akzeptiert hat).';

REVOKE ALL ON FUNCTION public.get_current_agb_version() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_agb_version() TO anon, authenticated, service_role;
