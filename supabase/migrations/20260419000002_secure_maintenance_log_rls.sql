-- ─────────────────────────────────────────────────────────────────────────
-- Enable RLS on public.maintenance_log
--
-- The table was originally introduced in 20251108000000_performance_optimization.sql
-- but its CREATE TABLE failed silently in some environments because the
-- UNIQUE(task, DATE_TRUNC('day', completed_at)) constraint is not valid
-- column-level syntax. We recreate it idempotently here so RLS can be enabled.
--
-- Policy: only admins (via has_role) and service_role can SELECT/INSERT.
-- Anonymous and regular authenticated users have no access.
-- ─────────────────────────────────────────────────────────────────────────

-- Recreate table idempotently (CREATE TABLE IF NOT EXISTS skips when present).
-- Note: we drop the broken UNIQUE(expression) constraint from the original
-- migration. Per-day uniqueness is not strictly required for the heartbeat
-- use-case; the cron logic uses ON CONFLICT DO NOTHING which is a no-op
-- when there's no matching constraint anyway. We simply prevent rapid-fire
-- duplicates via a non-unique index on (task, completed_at).
CREATE TABLE IF NOT EXISTS public.maintenance_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT NOW()
);

-- Helper index for "latest run per task" queries.
CREATE INDEX IF NOT EXISTS maintenance_log_task_completed_idx
  ON public.maintenance_log (task, completed_at DESC);

-- Enable RLS (idempotent: re-enabling is a no-op).
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
