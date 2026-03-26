-- ============================================================================
-- Add disposition field to all lead tables for call outcome tracking
-- Disposition values: wrong_number, no_answer, considering
-- ============================================================================

-- Add disposition column to quick_leads
ALTER TABLE quick_leads ADD COLUMN IF NOT EXISTS disposition text DEFAULT NULL;
COMMENT ON COLUMN quick_leads.disposition IS 'Anruf-Ergebnis: wrong_number (Falsche Nummer), no_answer (Nicht rangegangen), considering (Überlegt sich das)';

-- Add disposition column to wizard_sessions
ALTER TABLE wizard_sessions ADD COLUMN IF NOT EXISTS disposition text DEFAULT NULL;
COMMENT ON COLUMN wizard_sessions.disposition IS 'Anruf-Ergebnis: wrong_number (Falsche Nummer), no_answer (Nicht rangegangen), considering (Überlegt sich das)';

-- Add disposition column to value_assessment_leads
ALTER TABLE value_assessment_leads ADD COLUMN IF NOT EXISTS disposition text DEFAULT NULL;
COMMENT ON COLUMN value_assessment_leads.disposition IS 'Anruf-Ergebnis: wrong_number (Falsche Nummer), no_answer (Nicht rangegangen), considering (Überlegt sich das)';

-- Create indexes for fast filtering by disposition
CREATE INDEX IF NOT EXISTS idx_quick_leads_disposition ON quick_leads(disposition);
CREATE INDEX IF NOT EXISTS idx_wizard_sessions_disposition ON wizard_sessions(disposition);
CREATE INDEX IF NOT EXISTS idx_value_assessment_leads_disposition ON value_assessment_leads(disposition);
