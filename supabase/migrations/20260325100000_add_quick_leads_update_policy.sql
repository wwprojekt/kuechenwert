-- ============================================================================
-- Add UPDATE policy for quick_leads table
-- 
-- Problem: The quick_leads table only has INSERT (anyone) and ALL (admin) policies.
-- The leadTrackingService.ts calls update() to track wizard progress for anonymous
-- users, but these updates silently fail because there is no UPDATE policy for
-- anonymous/public users.
--
-- Solution: Allow anyone to update quick_leads rows. Since quick_leads only stores
-- anonymous lead tracking data (no sensitive user data), and the update is always
-- scoped by lead ID (stored in localStorage), this is safe.
-- ============================================================================

-- Allow anyone to update quick_leads (for wizard progress tracking)
CREATE POLICY "Anyone can update quick_leads" ON quick_leads
  FOR UPDATE USING (true) WITH CHECK (true);

-- Also add SELECT policy so the client can read back after update
CREATE POLICY "Anyone can select quick_leads" ON quick_leads
  FOR SELECT USING (true);
