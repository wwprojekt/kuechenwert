-- ============================================================================
-- Drop quick_leads table and related objects
-- ============================================================================
-- The quick_leads system was redundant to wizard_sessions (full wizard state)
-- and value_assessment_leads (dedicated Wertrechner leads).
--
-- Frontend references were removed in commit 816d6f9 on 2026-04-16.
-- Edge Function "quick" code paths were removed in the same commit series.
-- No FK references, no views, no triggers depend on this table.
--
-- Verified before drop:
--   - SELECT COUNT(*) FROM quick_leads: 1 row (test entry with email='a')
--   - wizard_sessions contains the same customer data with full detail
--   - FK scan: 0 references
--   - View scan: 0 references
--   - Trigger scan: 0 external references
--   - Function scan: only update_max_wizard_step (dropped below)
-- ============================================================================

-- 1. Drop the RPC that operated on quick_leads
DROP FUNCTION IF EXISTS public.update_max_wizard_step(UUID, INTEGER);

-- 2. Drop the table (CASCADE removes any remaining policies/indexes/constraints)
DROP TABLE IF EXISTS public.quick_leads CASCADE;
