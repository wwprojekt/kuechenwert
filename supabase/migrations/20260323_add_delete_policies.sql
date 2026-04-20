-- Add missing DELETE policies for admin users
-- These are needed for the delete functionality added to the admin dashboard
-- Idempotent: each CREATE POLICY is preceded by DROP POLICY IF EXISTS so the
-- migration can safely be re-run (e.g. when supabase db push --include-all
-- replays it on an environment that already has the policies).

-- Error Logs
DROP POLICY IF EXISTS "Admins can delete error logs" ON error_logs;
CREATE POLICY "Admins can delete error logs" ON error_logs
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  ));

-- Wizard Sessions (Leads)
DROP POLICY IF EXISTS "Admins can delete wizard sessions" ON wizard_sessions;
CREATE POLICY "Admins can delete wizard sessions" ON wizard_sessions
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  ));

-- Quick Leads
DROP POLICY IF EXISTS "Admins can delete quick leads" ON quick_leads;
CREATE POLICY "Admins can delete quick leads" ON quick_leads
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  ));

-- Contact Messages
DROP POLICY IF EXISTS "Admins can delete contact messages" ON contact_messages;
CREATE POLICY "Admins can delete contact messages" ON contact_messages
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  ));

-- Vehicle Questions
DROP POLICY IF EXISTS "Admins can delete vehicle questions" ON vehicle_questions;
CREATE POLICY "Admins can delete vehicle questions" ON vehicle_questions
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  ));

-- Auctions
DROP POLICY IF EXISTS "Admins can delete auctions" ON auctions;
CREATE POLICY "Admins can delete auctions" ON auctions
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  ));

-- Bids (needed when deleting auctions with bids)
DROP POLICY IF EXISTS "Admins can delete bids" ON bids;
CREATE POLICY "Admins can delete bids" ON bids
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  ));

-- Profiles (needed for admin user deletion)
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
CREATE POLICY "Admins can delete profiles" ON profiles
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  ));

-- Admin Emails (needed for email management)
DROP POLICY IF EXISTS "Admins can delete admin emails" ON admin_emails;
CREATE POLICY "Admins can delete admin emails" ON admin_emails
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  ));
