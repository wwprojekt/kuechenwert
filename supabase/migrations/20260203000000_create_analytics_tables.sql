-- ============================================================================
-- Analytics and Cookie Consent Tables for DSGVO Compliance
-- ============================================================================

-- Cookie Consent Preferences
-- Stores user consent choices for DSGVO compliance
CREATE TABLE IF NOT EXISTS cookie_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Anonymous identifier for non-logged-in users (stored in cookie)
  consent_id TEXT UNIQUE NOT NULL,
  -- User ID if logged in (optional)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Consent categories
  essential BOOLEAN NOT NULL DEFAULT true, -- Always true, cannot be disabled
  functional BOOLEAN NOT NULL DEFAULT false,
  analytics BOOLEAN NOT NULL DEFAULT false,
  marketing BOOLEAN NOT NULL DEFAULT false,
  -- Metadata
  ip_hash TEXT, -- Hashed IP for audit (not personally identifiable)
  user_agent TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Consent version for tracking policy changes
  consent_version TEXT NOT NULL DEFAULT '1.0'
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_cookie_consent_consent_id ON cookie_consent(consent_id);
CREATE INDEX IF NOT EXISTS idx_cookie_consent_user_id ON cookie_consent(user_id);

-- Analytics Sessions
-- Tracks visitor sessions (only when analytics consent given)
CREATE TABLE IF NOT EXISTS analytics_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  consent_id TEXT NOT NULL, -- Links to client-side consent, no FK to allow client-side consent storage
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Session data
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  -- Device info
  device_type TEXT, -- desktop, mobile, tablet
  browser TEXT,
  browser_version TEXT,
  os TEXT,
  os_version TEXT,
  -- Location (country level only for DSGVO compliance)
  country TEXT,
  region TEXT,
  -- Referrer info
  referrer_url TEXT,
  referrer_domain TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  -- Metrics
  page_views_count INTEGER DEFAULT 0,
  events_count INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  -- Landing and exit pages
  landing_page TEXT,
  exit_page TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for sessions
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_session_id ON analytics_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_consent_id ON analytics_sessions(consent_id);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_started_at ON analytics_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_user_id ON analytics_sessions(user_id);

-- Analytics Page Views
-- Tracks individual page views (only when analytics consent given)
CREATE TABLE IF NOT EXISTS analytics_page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES analytics_sessions(session_id) ON DELETE CASCADE,
  consent_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Page data
  page_path TEXT NOT NULL,
  page_title TEXT,
  page_url TEXT,
  -- Referrer within site
  referrer_path TEXT,
  -- Device type (denormalized for faster queries)
  device_type TEXT,
  -- Location (denormalized)
  country TEXT,
  -- Timing
  time_on_page_seconds INTEGER,
  scroll_depth_percent INTEGER,
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for page views
CREATE INDEX IF NOT EXISTS idx_analytics_page_views_session_id ON analytics_page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_page_views_created_at ON analytics_page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_page_views_page_path ON analytics_page_views(page_path);
CREATE INDEX IF NOT EXISTS idx_analytics_page_views_device_type ON analytics_page_views(device_type);
CREATE INDEX IF NOT EXISTS idx_analytics_page_views_country ON analytics_page_views(country);

-- Analytics Events
-- Tracks custom events (only when analytics consent given)
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES analytics_sessions(session_id) ON DELETE CASCADE,
  consent_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Event data
  event_name TEXT NOT NULL,
  event_category TEXT,
  event_action TEXT,
  event_label TEXT,
  event_value NUMERIC,
  -- Custom properties (JSONB for flexibility)
  properties JSONB DEFAULT '{}',
  -- Page context
  page_path TEXT,
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for events
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);

-- ============================================================================
-- Row Level Security Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE cookie_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Cookie Consent Policies
-- Users can manage their own consent
CREATE POLICY "Users can view own consent" ON cookie_consent
  FOR SELECT USING (
    auth.uid() = user_id OR
    consent_id = current_setting('app.consent_id', true)
  );

CREATE POLICY "Anyone can insert consent" ON cookie_consent
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own consent" ON cookie_consent
  FOR UPDATE USING (
    auth.uid() = user_id OR
    consent_id = current_setting('app.consent_id', true)
  );

-- Admin can view all analytics (for dashboard)
CREATE POLICY "Admins can view all sessions" ON analytics_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can view all page views" ON analytics_page_views
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can view all events" ON analytics_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Service role can insert analytics data
CREATE POLICY "Service can insert sessions" ON analytics_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can insert page views" ON analytics_page_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can insert events" ON analytics_events
  FOR INSERT WITH CHECK (true);

-- Service role can update sessions
CREATE POLICY "Service can update sessions" ON analytics_sessions
  FOR UPDATE USING (true);

-- ============================================================================
-- Functions for Analytics
-- ============================================================================

-- Function to update session metrics
CREATE OR REPLACE FUNCTION update_session_metrics()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE analytics_sessions
  SET 
    page_views_count = page_views_count + 1,
    exit_page = NEW.page_path,
    ended_at = NEW.created_at,
    duration_seconds = EXTRACT(EPOCH FROM (NEW.created_at - started_at))::INTEGER
  WHERE session_id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update session on new page view
DROP TRIGGER IF EXISTS trigger_update_session_on_page_view ON analytics_page_views;
CREATE TRIGGER trigger_update_session_on_page_view
  AFTER INSERT ON analytics_page_views
  FOR EACH ROW
  EXECUTE FUNCTION update_session_metrics();

-- Function to increment event count
CREATE OR REPLACE FUNCTION increment_event_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE analytics_sessions
  SET events_count = events_count + 1
  WHERE session_id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update event count
DROP TRIGGER IF EXISTS trigger_increment_event_count ON analytics_events;
CREATE TRIGGER trigger_increment_event_count
  AFTER INSERT ON analytics_events
  FOR EACH ROW
  EXECUTE FUNCTION increment_event_count();

-- ============================================================================
-- Data Retention (DSGVO Compliance)
-- Analytics data should be deleted after retention period
-- ============================================================================

-- Function to clean old analytics data (run via cron)
CREATE OR REPLACE FUNCTION clean_old_analytics_data(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete old page views
  DELETE FROM analytics_page_views
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
  
  -- Delete old events
  DELETE FROM analytics_events
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
  
  -- Delete old sessions (will cascade to page views and events via FK)
  DELETE FROM analytics_sessions
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Delete old consent records (optional - consent records can be kept longer for audit)
  DELETE FROM cookie_consent
  WHERE updated_at < NOW() - (retention_days * 2 || ' days')::INTERVAL;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup to run daily (requires pg_cron)
-- SELECT cron.schedule('clean-analytics-daily', '0 3 * * *', 'SELECT clean_old_analytics_data(90)');

-- ============================================================================
-- Helper Views for Analytics Dashboard
-- ============================================================================

-- View for daily analytics summary
CREATE OR REPLACE VIEW analytics_daily_summary AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) as page_views,
  COUNT(DISTINCT session_id) as sessions,
  COUNT(DISTINCT consent_id) as unique_visitors,
  COUNT(DISTINCT CASE WHEN device_type = 'mobile' THEN session_id END) as mobile_sessions,
  COUNT(DISTINCT CASE WHEN device_type = 'desktop' THEN session_id END) as desktop_sessions,
  COUNT(DISTINCT CASE WHEN device_type = 'tablet' THEN session_id END) as tablet_sessions
FROM analytics_page_views
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- View for page performance
CREATE OR REPLACE VIEW analytics_page_performance AS
SELECT 
  page_path,
  COUNT(*) as views,
  COUNT(DISTINCT session_id) as unique_sessions,
  AVG(time_on_page_seconds) as avg_time_on_page,
  AVG(scroll_depth_percent) as avg_scroll_depth
FROM analytics_page_views
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY page_path
ORDER BY views DESC;

-- Grant access to views for authenticated users with admin role
GRANT SELECT ON analytics_daily_summary TO authenticated;
GRANT SELECT ON analytics_page_performance TO authenticated;

COMMENT ON TABLE cookie_consent IS 'Stores user cookie consent preferences for DSGVO compliance';
COMMENT ON TABLE analytics_sessions IS 'Visitor sessions - only tracked with analytics consent';
COMMENT ON TABLE analytics_page_views IS 'Page view tracking - only tracked with analytics consent';
COMMENT ON TABLE analytics_events IS 'Custom event tracking - only tracked with analytics consent';
