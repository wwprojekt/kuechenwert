-- Create value_assessment_leads table for Wertermittlung and Wertrechner landing pages
-- This table captures leads from users interested in getting their motorhome valued

CREATE TABLE value_assessment_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  manufacturer TEXT,
  model TEXT,
  year INTEGER,
  mileage INTEGER,
  condition TEXT,
  body_type TEXT,
  message TEXT,
  source TEXT NOT NULL, -- 'wertermittlung' or 'wertrechner'
  estimated_value_min INTEGER,
  estimated_value_max INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  contacted_at TIMESTAMPTZ,
  status TEXT DEFAULT 'new' -- new, contacted, converted, closed
);

-- Add comments for documentation
COMMENT ON TABLE value_assessment_leads IS 'Leads from Wertermittlung and Wertrechner pages';
COMMENT ON COLUMN value_assessment_leads.source IS 'Source page: wertermittlung or wertrechner';
COMMENT ON COLUMN value_assessment_leads.status IS 'Lead status: new, contacted, converted, closed';
COMMENT ON COLUMN value_assessment_leads.estimated_value_min IS 'Minimum estimated value from calculator';
COMMENT ON COLUMN value_assessment_leads.estimated_value_max IS 'Maximum estimated value from calculator';

-- Enable Row Level Security
ALTER TABLE value_assessment_leads ENABLE ROW LEVEL SECURITY;

-- Admins can manage all leads
CREATE POLICY "Admins can manage leads" ON value_assessment_leads
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Anyone can insert leads (for anonymous form submissions)
CREATE POLICY "Anyone can insert leads" ON value_assessment_leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Create index for efficient querying
CREATE INDEX idx_value_assessment_leads_status ON value_assessment_leads(status);
CREATE INDEX idx_value_assessment_leads_created_at ON value_assessment_leads(created_at DESC);
CREATE INDEX idx_value_assessment_leads_source ON value_assessment_leads(source);
