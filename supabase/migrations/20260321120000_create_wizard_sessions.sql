-- Wizard Sessions: Speichert den Fortschritt jedes Inserierungs-Wizards
-- Ermöglicht Wiederaufnahme und Admin-Nachverfolgung bei Abbruch

CREATE TABLE IF NOT EXISTS public.wizard_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_id TEXT,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  current_step INTEGER NOT NULL DEFAULT 1,
  max_step_reached INTEGER NOT NULL DEFAULT 1,
  total_steps INTEGER NOT NULL DEFAULT 10,
  step_name TEXT,
  form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  vehicle_summary TEXT,
  admin_notes TEXT,
  resume_email_sent_at TIMESTAMPTZ,
  admin_called_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wizard_sessions_status ON public.wizard_sessions(status);
CREATE INDEX IF NOT EXISTS idx_wizard_sessions_user_id ON public.wizard_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_wizard_sessions_anonymous_id ON public.wizard_sessions(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_wizard_sessions_last_activity ON public.wizard_sessions(last_activity_at DESC);

ALTER TABLE public.wizard_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY wizard_sessions_user_select ON public.wizard_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY wizard_sessions_user_insert ON public.wizard_sessions
  FOR INSERT WITH CHECK (true);
CREATE POLICY wizard_sessions_user_update ON public.wizard_sessions
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY wizard_sessions_service ON public.wizard_sessions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE OR REPLACE FUNCTION update_wizard_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_activity_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wizard_sessions_updated_at
  BEFORE UPDATE ON public.wizard_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_wizard_session_timestamp();

-- Admin full access policy
CREATE POLICY "Admins full access on wizard_sessions" ON wizard_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'::app_role
    )
  );
