-- Add missing DELETE policies for admin users
-- These are needed for the delete functionality added to the admin dashboard

-- Error Logs
CREATE POLICY "Admins can delete error logs" ON error_logs
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  ));

-- Wizard Sessions (Leads)
CREATE POLICY "Admins can delete wizard sessions" ON wizard_sessions
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  ));

-- Quick Leads
CREATE POLICY "Admins can delete quick leads" ON quick_leads
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  ));

-- Contact Messages
CREATE POLICY "Admins can delete contact messages" ON contact_messages
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  ));

-- Vehicle Questions
CREATE POLICY "Admins can delete vehicle questions" ON vehicle_questions
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  ));

-- Auctions
CREATE POLICY "Admins can delete auctions" ON auctions
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  ));

-- Bids (needed when deleting auctions with bids)
CREATE POLICY "Admins can delete bids" ON bids
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  ));
