-- Performance optimization migration
-- Adds indexes, views, and query optimizations for better performance

-- ============================================================================
-- COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- ============================================================================

-- Auction queries with status and time filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auctions_status_end_time 
ON public.auctions(status, end_time) 
WHERE status = 'active';

-- Auction queries with status and creation time
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auctions_status_created 
ON public.auctions(status, created_at DESC) 
WHERE status IN ('active', 'ended');

-- Motorhome search by sale channel and status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_motorhomes_sale_channel_status 
ON public.motorhomes(sale_channel, status, created_at DESC) 
WHERE status = 'active';

-- Motorhome search by manufacturer and year
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_motorhomes_manufacturer_year 
ON public.motorhomes(manufacturer, year DESC) 
WHERE status = 'active';

-- Motorhome search by body type and price range
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_motorhomes_body_type_price 
ON public.motorhomes(body_type, instant_price) 
WHERE status = 'active' AND instant_price IS NOT NULL;

-- Bids by auction with amount ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bids_auction_amount 
ON public.bids(auction_id, amount DESC, created_at DESC);

-- Bids by bidder with recent first
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bids_bidder_recent 
ON public.bids(bidder_id, created_at DESC);

-- Appointments by seller and date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_seller_date 
ON public.appointments(seller_id, appointment_date DESC);

-- Appointments by station and date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_station_date 
ON public.appointments(station_id, appointment_date) 
WHERE status IN ('scheduled', 'confirmed');

-- User roles lookup optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_roles_user_role 
ON public.user_roles(user_id, role);

-- ============================================================================
-- FULL-TEXT SEARCH INDEXES
-- ============================================================================

-- Full-text search for motorhomes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_motorhomes_search 
ON public.motorhomes USING gin(
  to_tsvector('german', 
    coalesce(manufacturer, '') || ' ' ||
    coalesce(model, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    coalesce(additional_equipment, '')
  )
) WHERE status = 'active';

-- Full-text search for blog posts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blog_posts_search 
ON public.blog_posts USING gin(
  to_tsvector('german', 
    coalesce(title, '') || ' ' ||
    coalesce(excerpt, '') || ' ' ||
    coalesce(content, '')
  )
) WHERE published = true;

-- ============================================================================
-- PARTIAL INDEXES FOR FILTERED QUERIES
-- ============================================================================

-- Active auctions only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auctions_active_end_time 
ON public.auctions(end_time) 
WHERE status = 'active';

-- Published blog posts only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blog_posts_published_date 
ON public.blog_posts(published_at DESC) 
WHERE published = true;

-- Active motorhomes by creation date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_motorhomes_active_created 
ON public.motorhomes(created_at DESC) 
WHERE status = 'active';

-- Pending dealer applications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dealer_applications_pending 
ON public.dealer_applications(submitted_at DESC) 
WHERE status = 'pending';

-- ============================================================================
-- COVERING INDEXES FOR COMMON SELECTS
-- ============================================================================

-- Auction list with basic info
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auctions_list_covering 
ON public.auctions(status, created_at DESC) 
INCLUDE (id, motorhome_id, current_bid, starting_bid, end_time)
WHERE status IN ('active', 'ended');

-- Motorhome list with basic info
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_motorhomes_list_covering 
ON public.motorhomes(status, created_at DESC) 
INCLUDE (id, manufacturer, model, year, mileage, sale_channel, instant_price)
WHERE status = 'active';

-- ============================================================================
-- MATERIALIZED VIEWS FOR EXPENSIVE QUERIES
-- ============================================================================

-- Dashboard statistics view
CREATE MATERIALIZED VIEW IF NOT EXISTS public.dashboard_stats AS
SELECT 
  COUNT(*) FILTER (WHERE status = 'active') as active_auctions,
  COUNT(*) FILTER (WHERE status = 'ended') as ended_auctions,
  AVG(current_bid) FILTER (WHERE status = 'ended' AND current_bid IS NOT NULL) as avg_sale_price,
  MAX(current_bid) FILTER (WHERE status = 'ended') as highest_sale,
  COUNT(DISTINCT motorhome_id) as total_vehicles,
  DATE_TRUNC('day', NOW()) as calculated_at
FROM public.auctions;

-- Create unique index for materialized view refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_stats_date 
ON public.dashboard_stats(calculated_at);

-- Popular manufacturers view
CREATE MATERIALIZED VIEW IF NOT EXISTS public.popular_manufacturers AS
SELECT 
  manufacturer,
  COUNT(*) as listing_count,
  AVG(instant_price) FILTER (WHERE instant_price IS NOT NULL) as avg_price,
  MIN(year) as oldest_year,
  MAX(year) as newest_year,
  DATE_TRUNC('day', NOW()) as calculated_at
FROM public.motorhomes 
WHERE status = 'active'
GROUP BY manufacturer
HAVING COUNT(*) >= 3
ORDER BY listing_count DESC, avg_price DESC;

-- Create unique index for materialized view refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_popular_manufacturers_name_date 
ON public.popular_manufacturers(manufacturer, calculated_at);

-- ============================================================================
-- FUNCTIONS FOR MATERIALIZED VIEW REFRESH
-- ============================================================================

-- Function to refresh dashboard stats
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.dashboard_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.popular_manufacturers;
END;
$$;

-- ============================================================================
-- QUERY OPTIMIZATION FUNCTIONS
-- ============================================================================

-- Optimized function to get active auctions with motorhome details
CREATE OR REPLACE FUNCTION get_active_auctions(
  limit_count integer DEFAULT 20,
  offset_count integer DEFAULT 0
)
RETURNS TABLE (
  auction_id uuid,
  motorhome_id uuid,
  manufacturer text,
  model text,
  year integer,
  current_bid numeric,
  starting_bid numeric,
  end_time timestamptz,
  photo_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    a.id as auction_id,
    a.motorhome_id,
    m.manufacturer,
    m.model,
    m.year,
    a.current_bid,
    a.starting_bid,
    a.end_time,
    (
      SELECT mp.photo_url 
      FROM public.motorhome_photos mp 
      WHERE mp.motorhome_id = m.id 
      ORDER BY mp.display_order 
      LIMIT 1
    ) as photo_url
  FROM public.auctions a
  JOIN public.motorhomes m ON a.motorhome_id = m.id
  WHERE a.status = 'active' 
    AND a.end_time > NOW()
    AND m.status = 'active'
  ORDER BY a.end_time ASC
  LIMIT limit_count
  OFFSET offset_count;
$$;

-- Optimized function to search motorhomes
CREATE OR REPLACE FUNCTION search_motorhomes(
  search_query text DEFAULT '',
  manufacturer_filter text DEFAULT '',
  min_year integer DEFAULT NULL,
  max_year integer DEFAULT NULL,
  min_price numeric DEFAULT NULL,
  max_price numeric DEFAULT NULL,
  body_type_filter text DEFAULT '',
  sale_channel_filter text DEFAULT '',
  limit_count integer DEFAULT 20,
  offset_count integer DEFAULT 0
)
RETURNS TABLE (
  motorhome_id uuid,
  manufacturer text,
  model text,
  year integer,
  mileage integer,
  instant_price numeric,
  sale_channel text,
  photo_url text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id as motorhome_id,
    m.manufacturer,
    m.model,
    m.year,
    m.mileage,
    m.instant_price,
    m.sale_channel::text,
    (
      SELECT mp.photo_url 
      FROM public.motorhome_photos mp 
      WHERE mp.motorhome_id = m.id 
      ORDER BY mp.display_order 
      LIMIT 1
    ) as photo_url,
    m.created_at
  FROM public.motorhomes m
  WHERE m.status = 'active'
    AND (search_query = '' OR to_tsvector('german', 
        coalesce(m.manufacturer, '') || ' ' ||
        coalesce(m.model, '') || ' ' ||
        coalesce(m.description, '') || ' ' ||
        coalesce(m.additional_equipment, '')
      ) @@ plainto_tsquery('german', search_query))
    AND (manufacturer_filter = '' OR m.manufacturer ILIKE manufacturer_filter)
    AND (min_year IS NULL OR m.year >= min_year)
    AND (max_year IS NULL OR m.year <= max_year)
    AND (min_price IS NULL OR m.instant_price >= min_price)
    AND (max_price IS NULL OR m.instant_price <= max_price)
    AND (body_type_filter = '' OR m.body_type::text = body_type_filter)
    AND (sale_channel_filter = '' OR m.sale_channel::text = sale_channel_filter)
  ORDER BY 
    CASE WHEN search_query != '' THEN
      ts_rank(to_tsvector('german', 
        coalesce(m.manufacturer, '') || ' ' ||
        coalesce(m.model, '') || ' ' ||
        coalesce(m.description, '') || ' ' ||
        coalesce(m.additional_equipment, '')
      ), plainto_tsquery('german', search_query))
    ELSE 0 END DESC,
    m.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- ============================================================================
-- PERFORMANCE MONITORING
-- ============================================================================

-- Function to get slow queries (requires pg_stat_statements extension)
CREATE OR REPLACE FUNCTION get_slow_queries()
RETURNS TABLE (
  query text,
  calls bigint,
  total_time double precision,
  mean_time double precision,
  rows bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    query,
    calls,
    total_exec_time as total_time,
    mean_exec_time as mean_time,
    rows
  FROM pg_stat_statements 
  WHERE query NOT LIKE '%pg_stat_statements%'
    AND query NOT LIKE '%information_schema%'
    AND calls > 10
  ORDER BY mean_exec_time DESC
  LIMIT 20;
$$;

-- ============================================================================
-- SCHEDULED TASKS FOR MAINTENANCE
-- ============================================================================

-- Create a function to run periodic maintenance
CREATE OR REPLACE FUNCTION run_maintenance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Refresh materialized views
  PERFORM refresh_dashboard_stats();
  
  -- Update table statistics
  ANALYZE public.auctions;
  ANALYZE public.motorhomes;
  ANALYZE public.bids;
  ANALYZE public.appointments;
  
  -- Clean up old pin attempts (older than 30 days)
  DELETE FROM public.pin_attempts 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Log maintenance completion
  INSERT INTO public.maintenance_log (task, completed_at) 
  VALUES ('run_maintenance', NOW())
  ON CONFLICT DO NOTHING;
END;
$$;

-- Create maintenance log table if not exists
CREATE TABLE IF NOT EXISTS public.maintenance_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(task, DATE_TRUNC('day', completed_at))
);

-- ============================================================================
-- GRANTS AND PERMISSIONS
-- ============================================================================

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_active_auctions TO authenticated;
GRANT EXECUTE ON FUNCTION search_motorhomes TO authenticated;
GRANT EXECUTE ON FUNCTION get_slow_queries TO service_role;
GRANT EXECUTE ON FUNCTION refresh_dashboard_stats TO service_role;
GRANT EXECUTE ON FUNCTION run_maintenance TO service_role;

-- Grant select on materialized views
GRANT SELECT ON public.dashboard_stats TO authenticated;
GRANT SELECT ON public.popular_manufacturers TO authenticated;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON INDEX idx_auctions_status_end_time IS 'Optimizes queries for active auctions ordered by end time';
COMMENT ON INDEX idx_motorhomes_search IS 'Full-text search index for motorhome listings in German';
COMMENT ON MATERIALIZED VIEW dashboard_stats IS 'Cached dashboard statistics, refreshed periodically';
COMMENT ON FUNCTION get_active_auctions IS 'Optimized function to retrieve active auctions with motorhome details';
COMMENT ON FUNCTION search_motorhomes IS 'Full-text search function for motorhomes with filters';
COMMENT ON FUNCTION run_maintenance IS 'Periodic maintenance function for database optimization';
