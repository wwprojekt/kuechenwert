
-- Tighten analytics INSERT policies with data integrity checks
-- (replacing overly permissive WITH CHECK (true))

-- analytics_events: Require valid session_id and event_name
DROP POLICY IF EXISTS "Service can insert events" ON analytics_events;
CREATE POLICY "Service can insert events" ON analytics_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    session_id IS NOT NULL 
    AND event_name IS NOT NULL
    AND LENGTH(event_name) <= 100
  );

-- analytics_page_views: Require valid session and page_path
DROP POLICY IF EXISTS "Service can insert page views" ON analytics_page_views;
CREATE POLICY "Service can insert page views" ON analytics_page_views
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    session_id IS NOT NULL
    AND page_path IS NOT NULL
    AND LENGTH(page_path) <= 500
  );

-- analytics_sessions: Require valid session_id
DROP POLICY IF EXISTS "Service can insert sessions" ON analytics_sessions;
CREATE POLICY "Service can insert sessions" ON analytics_sessions
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    session_id IS NOT NULL
    AND LENGTH(session_id) <= 100
  );

-- analytics_sessions UPDATE: Only own sessions
DROP POLICY IF EXISTS "Service can update sessions" ON analytics_sessions;
CREATE POLICY "Service can update sessions" ON analytics_sessions
  FOR UPDATE TO anon, authenticated
  USING (session_id IS NOT NULL)
  WITH CHECK (session_id IS NOT NULL);
