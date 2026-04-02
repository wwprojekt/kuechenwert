-- Add DELETE policy for post_auction_offers table
-- This was missing, preventing admins from deleting entries via the admin dashboard

CREATE POLICY "Admins can delete post auction offers" ON post_auction_offers
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  ));
