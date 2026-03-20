-- Create quick_leads table for capturing leads from hero form
-- This captures user data when they click "Jetzt kostenlos starten" before wizard

CREATE TABLE IF NOT EXISTS quick_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  manufacturer TEXT,
  model TEXT,
  body_type TEXT,
  sale_channel TEXT,
  source TEXT DEFAULT 'hero_form',
  wizard_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE quick_leads ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins full access on quick_leads" ON quick_leads
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- Anyone can insert (for anonymous lead capture)
CREATE POLICY "Anyone can insert quick_leads" ON quick_leads
  FOR INSERT WITH CHECK (true);

-- Create indexes for admin queries
CREATE INDEX IF NOT EXISTS idx_quick_leads_created ON quick_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quick_leads_email ON quick_leads(email);

-- Add comment
COMMENT ON TABLE quick_leads IS 'Captures lead data from hero form before wizard completion';
