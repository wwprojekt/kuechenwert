-- Replace empty table with a proper view that aggregates analytics data
DROP TABLE IF EXISTS analytics_daily_summary;

CREATE OR REPLACE VIEW analytics_daily_summary AS
SELECT
  DATE(s.started_at) AS date,
  COUNT(DISTINCT pv.id) AS page_views,
  COUNT(DISTINCT s.id) AS sessions,
  COUNT(DISTINCT s.session_id) AS unique_visitors,
  COUNT(DISTINCT s.id) FILTER (WHERE s.device_type = 'mobile') AS mobile_sessions,
  COUNT(DISTINCT s.id) FILTER (WHERE s.device_type = 'desktop') AS desktop_sessions,
  COUNT(DISTINCT s.id) FILTER (WHERE s.device_type = 'tablet') AS tablet_sessions
FROM analytics_sessions s
LEFT JOIN analytics_page_views pv ON pv.session_id = s.session_id
WHERE s.started_at IS NOT NULL
GROUP BY DATE(s.started_at)
ORDER BY date DESC;

GRANT SELECT ON analytics_daily_summary TO authenticated;
GRANT SELECT ON analytics_daily_summary TO anon;