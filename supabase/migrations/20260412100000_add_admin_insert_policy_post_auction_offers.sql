-- Allow admins to create post_auction_offers on behalf of any dealer.
-- Without this policy, the existing INSERT CHECK (buyer_id = auth.uid())
-- blocks admin-proxy inserts where buyer_id != admin's own UUID.
CREATE POLICY "Admins can create offers for any user"
  ON post_auction_offers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
