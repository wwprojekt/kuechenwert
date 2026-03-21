-- ============================================================================
-- Error Logs Table for Admin Dashboard
-- Logs all user-facing errors with page context, user role, and details
-- ============================================================================

-- Error Logs Table
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Error details
  error_code TEXT NOT NULL,                    -- Interner Fehlercode (z.B. 'VALIDATION_SEATS_REQUIRED')
  error_message TEXT NOT NULL,                 -- Deutsche Fehlermeldung die dem Nutzer angezeigt wurde
  error_category TEXT NOT NULL DEFAULT 'unknown', -- 'validation', 'auth', 'api', 'business', 'system', 'ui'
  severity TEXT NOT NULL DEFAULT 'low',        -- 'low', 'medium', 'high', 'critical'
  
  -- Context: Wo ist der Fehler aufgetreten?
  page_url TEXT NOT NULL,                      -- Volle URL der Seite
  page_path TEXT NOT NULL,                     -- Pfad ohne Domain (z.B. '/verkaufen/wizard')
  page_title TEXT,                             -- Seitentitel / Landing Page Name
  component_name TEXT,                         -- React-Komponente wo der Fehler auftrat
  
  -- Wer hat den Fehler ausgelöst?
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_role TEXT,                              -- 'customer', 'dealer', 'admin', 'anonymous'
  user_email TEXT,                             -- E-Mail (falls verfügbar)
  
  -- Technische Details
  stack_trace TEXT,                            -- Stack Trace (nur für Entwickler)
  original_error TEXT,                         -- Original englische Fehlermeldung
  metadata JSONB DEFAULT '{}'::jsonb,          -- Zusätzliche Kontextdaten
  
  -- Browser/Device Info
  user_agent TEXT,
  browser TEXT,
  device_type TEXT,                            -- 'desktop', 'mobile', 'tablet'
  
  -- Status
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes für schnelle Abfragen im Admin Dashboard
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_category ON error_logs(error_category);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_page_path ON error_logs(page_path);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_role ON error_logs(user_role);
CREATE INDEX IF NOT EXISTS idx_error_logs_is_resolved ON error_logs(is_resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_code ON error_logs(error_code);

-- Composite Index für häufige Admin-Filterungen
CREATE INDEX IF NOT EXISTS idx_error_logs_category_severity ON error_logs(error_category, severity, created_at DESC);

-- RLS aktivieren
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Jeder authentifizierte Nutzer kann Fehler loggen (INSERT)
CREATE POLICY "Users can insert error logs"
  ON error_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Anonyme Nutzer können auch Fehler loggen (INSERT)
CREATE POLICY "Anonymous users can insert error logs"
  ON error_logs FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy: Nur Admins können Fehler-Logs lesen
CREATE POLICY "Admins can read error logs"
  ON error_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Policy: Nur Admins können Fehler-Logs aktualisieren (z.B. als gelöst markieren)
CREATE POLICY "Admins can update error logs"
  ON error_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Updated_at Trigger
CREATE OR REPLACE FUNCTION update_error_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_error_logs_updated_at
  BEFORE UPDATE ON error_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_error_logs_updated_at();

-- View für Admin Dashboard Statistiken
CREATE OR REPLACE VIEW error_logs_stats AS
SELECT
  error_category,
  severity,
  page_path,
  user_role,
  COUNT(*) as error_count,
  COUNT(*) FILTER (WHERE NOT is_resolved) as unresolved_count,
  MAX(created_at) as last_occurrence,
  MIN(created_at) as first_occurrence
FROM error_logs
GROUP BY error_category, severity, page_path, user_role;

-- Cleanup-Funktion: Alte gelöste Fehler nach 90 Tagen löschen
CREATE OR REPLACE FUNCTION cleanup_old_error_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM error_logs
  WHERE is_resolved = true
  AND resolved_at < now() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
