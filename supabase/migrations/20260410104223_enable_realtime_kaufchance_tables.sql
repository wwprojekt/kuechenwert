
-- Enable Realtime for post_auction_offers and kaufchance_invitations
-- Required for live Kaufchance updates in dealer dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE post_auction_offers;
ALTER PUBLICATION supabase_realtime ADD TABLE kaufchance_invitations;
