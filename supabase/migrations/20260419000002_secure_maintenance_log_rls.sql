-- ─────────────────────────────────────────────────────────────────────────
-- Enable RLS on public.maintenance_log
--
-- The table was introduced in 20251108000000_performance_optimization.sql
-- without RLS. While the contents (task name + timestamp) are not directly
-- sensitive, leaving any public table without RLS is bad hygiene and trips
-- Supabase's Security Advisor.
--
-- Policy: only admins (via has_role) and service_role can SELECT/INSERT.
-- Anonymous and regular authenticated users have no access.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.maintenance_log ENABLE ROW LEVEL SECURITY;

-- Service role (cron / Edge Functions) bypasses RLS automatically, but we
-- still grant an explicit policy in case the row is queried via an admin
-- client that uses the service-role key as bearer.
DROP POLICY IF EXISTS "service_role full access" ON public.maintenance_log;
CREATE POLICY "service_role full access"
  ON public.maintenance_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can view maintenance log entries from the dashboard.
DROP POLICY IF EXISTS "admins can view maintenance log" ON public.maintenance_log;
CREATE POLICY "admins can view maintenance log"
  ON public.maintenance_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Lock down INSERT/UPDATE/DELETE to service_role only.
-- (No additional policy needed; default is deny.)

COMMENT ON TABLE public.maintenance_log IS
  'Cron/maintenance task heartbeats. RLS enabled 2026-04-19: SELECT for admins only, writes via service_role only.';
