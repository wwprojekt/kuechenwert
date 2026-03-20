-- ============================================
-- Migration: Create Rate Limits Table
-- Description: Distributed rate limiting using Supabase database
--              Replaces in-memory Map for production use across Edge Function instances
-- Created: 2026-01-14
-- ============================================

-- Rate limits table for distributed rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(key)
);

-- Add comment for documentation
COMMENT ON TABLE rate_limits IS 'Distributed rate limiting table for Edge Functions';
COMMENT ON COLUMN rate_limits.key IS 'Unique identifier: user:{user_id} or ip:{ip_address}';
COMMENT ON COLUMN rate_limits.count IS 'Number of requests in current window';
COMMENT ON COLUMN rate_limits.window_start IS 'Start of the current rate limit window';
COMMENT ON COLUMN rate_limits.window_end IS 'End of the current rate limit window';

-- Index for fast lookups by key
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);

-- Index for cleanup of expired entries
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_end ON rate_limits(window_end);

-- Function to cleanup expired rate limit entries
-- Should be called periodically (e.g., via pg_cron or scheduled function)
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM rate_limits WHERE window_end < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment on cleanup function
COMMENT ON FUNCTION cleanup_expired_rate_limits() IS 'Removes expired rate limit entries. Call periodically to prevent table bloat.';

-- Enable Row Level Security
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only service role can access (Edge Functions use service role key)
CREATE POLICY "Service role can manage rate limits"
  ON rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON rate_limits TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_rate_limits() TO service_role;
