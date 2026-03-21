-- ============================================================================
-- Enhance quick_leads table for comprehensive lead tracking
-- Adds page_url, wizard tracking, and form data snapshot
-- ============================================================================

-- Add new columns for better lead tracking
ALTER TABLE quick_leads
  ADD COLUMN IF NOT EXISTS page_url TEXT,
  ADD COLUMN IF NOT EXISTS last_wizard_step INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_wizard_step INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS form_data_snapshot JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS referrer TEXT,
  ADD COLUMN IF NOT EXISTS lead_quality TEXT DEFAULT 'cold' CHECK (lead_quality IN ('hot', 'warm', 'cold')),
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Index for lead quality filtering
CREATE INDEX IF NOT EXISTS idx_quick_leads_quality ON quick_leads(lead_quality);
CREATE INDEX IF NOT EXISTS idx_quick_leads_source ON quick_leads(source);
CREATE INDEX IF NOT EXISTS idx_quick_leads_wizard_step ON quick_leads(max_wizard_step DESC);

-- Comments
COMMENT ON COLUMN quick_leads.page_url IS 'Die Seite von der der Lead kam (Landing Page URL)';
COMMENT ON COLUMN quick_leads.last_wizard_step IS 'Letzter Wizard-Schritt den der Nutzer erreicht hat';
COMMENT ON COLUMN quick_leads.max_wizard_step IS 'Höchster Wizard-Schritt den der Nutzer erreicht hat';
COMMENT ON COLUMN quick_leads.form_data_snapshot IS 'Snapshot der eingegebenen Formulardaten (JSON)';
COMMENT ON COLUMN quick_leads.lead_quality IS 'Lead-Qualität: hot (Kontaktdaten + viele Schritte), warm (Kontaktdaten), cold (nur Fahrzeugdaten)';
COMMENT ON COLUMN quick_leads.notes IS 'Admin-Notizen zum Lead';
