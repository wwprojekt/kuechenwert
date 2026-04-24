-- Wertrechner v2: KI-Persistenz, Dedup-Index, Reasoning-Feld
--
-- Kontext:
-- 1. Public-Wertrechner speichert bisher KI-Ergebnisse NICHT in der DB (nur React-State).
--    Das blockiert Analytics, Admin-Nachbearbeitung und zukuenftige Modell-Kalibrierung.
-- 2. Fehlende Dedup-Infrastruktur fuehrt zu Lead-Verschmutzung bei Page-Reload.
-- 3. KI-Reasoning-Text wird von der Edge Function bereits zurueckgegeben, hatte aber
--    keine Spalte.
--
-- Aenderungen:
-- - NEUE SPALTE `ai_reasoning TEXT` (nullable)
-- - NEUE SPALTE `ai_comparable_count INTEGER` (Anzahl Trainingsdaten + Market-Comps zur Zeit der KI-Bewertung)
-- - NEUE SPALTE `ai_source TEXT` (z.B. 'openai-gpt-4.1-mini')
-- - INDEX fuer Dedup-Checks (email + manufacturer + created_at)
-- - SECURITY DEFINER RPC `update_ai_valuation(...)` damit die ai-valuation Edge Function
--   (ohne JWT) den KI-Wert in die DB schreiben kann, OHNE die anon INSERT-Policy zu
--   lockern oder eine breitere anon UPDATE-Policy zu oeffnen.
--   Die RPC akzeptiert nur das erste Setzen (kein Ueberschreiben) und nur fuer Leads,
--   die innerhalb der letzten 30 Minuten erstellt wurden (Race-Safety).

ALTER TABLE public.value_assessment_leads
  ADD COLUMN IF NOT EXISTS ai_reasoning TEXT,
  ADD COLUMN IF NOT EXISTS ai_comparable_count INTEGER,
  ADD COLUMN IF NOT EXISTS ai_source TEXT;

COMMENT ON COLUMN public.value_assessment_leads.ai_reasoning IS
  'Kurze KI-Begruendung (DE, max 2 Saetze), vom LLM generiert.';
COMMENT ON COLUMN public.value_assessment_leads.ai_comparable_count IS
  'Anzahl der Vergleichsdaten (Admin-Expertenwerte + Market-Comps), die die KI gesehen hat.';
COMMENT ON COLUMN public.value_assessment_leads.ai_source IS
  'Modell-Bezeichner, z.B. "openai-gpt-4.1-mini".';

-- Dedup-Index: beschleunigt den "gleicher Kunde / gleiches Fahrzeug / letzte 60 Minuten"
-- Check in der Edge Function. created_at DESC damit der Latest-Eintrag schnell gefunden wird.
CREATE INDEX IF NOT EXISTS idx_value_assessment_leads_dedup
  ON public.value_assessment_leads (lower(email), manufacturer, year, created_at DESC);

-- SECURITY DEFINER RPC: erlaubt der anon-Rolle (via Edge Function mit service_role,
-- oder direkt von anon nach Policy) den KI-Wert auf einem frisch angelegten Lead zu
-- setzen. Race-Safety:
--   - Nur first-set (wenn ai_estimated_at IS NULL)
--   - Nur wenn der Lead juenger als 30 Minuten ist
--   - Gibt TRUE zurueck bei Erfolg, FALSE wenn nichts geupdatet wurde
--
-- Wir rufen die RPC aus der Edge Function mit dem service_role Key auf, um eine
-- offene anon UPDATE-Policy zu vermeiden.
CREATE OR REPLACE FUNCTION public.update_ai_valuation(
  p_lead_id UUID,
  p_ai_value NUMERIC,
  p_ai_confidence NUMERIC,
  p_ai_reasoning TEXT,
  p_ai_source TEXT,
  p_comparable_count INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Guardrails
  IF p_ai_value IS NULL OR p_ai_value < 0 OR p_ai_value > 10000000 THEN
    RETURN FALSE;
  END IF;

  IF p_ai_confidence IS NULL OR p_ai_confidence < 0 OR p_ai_confidence > 100 THEN
    RETURN FALSE;
  END IF;

  UPDATE public.value_assessment_leads
  SET
    ai_estimated_value = p_ai_value,
    ai_confidence = p_ai_confidence,
    ai_reasoning = p_ai_reasoning,
    ai_source = COALESCE(p_ai_source, 'openai'),
    ai_comparable_count = p_comparable_count,
    ai_estimated_at = now()
  WHERE id = p_lead_id
    AND ai_estimated_at IS NULL
    AND created_at > (now() - INTERVAL '30 minutes');

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count > 0;
END;
$$;

COMMENT ON FUNCTION public.update_ai_valuation IS
  'Wertrechner: setzt erstmalig den KI-Bewertungswert auf einem frisch angelegten Lead. Race-safe: nur first-set, nur innerhalb 30 Min nach Erstellung. SECURITY DEFINER, damit die ai-valuation Edge Function (Service Role) schreiben kann ohne eine breite anon UPDATE-Policy.';

-- Nur service_role soll diese RPC aufrufen duerfen (defense in depth; Edge Function
-- nutzt service_role key). anon/authenticated sollen NICHT direkt schreiben koennen.
REVOKE ALL ON FUNCTION public.update_ai_valuation FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_ai_valuation FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_ai_valuation TO service_role;
