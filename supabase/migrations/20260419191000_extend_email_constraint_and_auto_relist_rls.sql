-- ─────────────────────────────────────────────────────────────────────────
-- Two related fixes that prepare the ground for the festpreis-listing
-- lifecycle work:
--
-- 1) Extend admin_emails.email_type CHECK constraint
--    Five offer-related email types were silently dropped from the
--    admin_emails log because they were never added to the check
--    constraint after the offer flow was introduced. Add them, plus the
--    four new types we need for festpreis auto-extend + soft brake:
--      • auction_seller_new_offer
--      • auction_admin_new_offer
--      • auction_buyer_offer_rejected
--      • auction_buyer_counter_offer
--      • auction_seller_buyer_rejected
--      • auction_seller_festpreis_extended      (festpreis 7d auto-extend)
--      • auction_admin_festpreis_needs_price    (festpreis price=NULL alert)
--      • auction_seller_festpreis_round_warning (soft brake, festpreis)
--      • auction_seller_auction_round_warning   (soft brake, auction)
--
-- 2) Extend "Seller can toggle auto_relist" RLS policy
--    The original policy only allowed sellers to flip auto_relist while
--    the auction was in 'kaufchance'. For festpreis listings we now also
--    auto-extend on expiry, and the seller must be able to opt out while
--    the listing is still 'active'. We extend the predicate but stay
--    restrictive: 'kaufchance' for any auction, OR 'active' only when the
--    underlying motorhome is sale_channel='instant_price'.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE admin_emails DROP CONSTRAINT IF EXISTS admin_emails_email_type_check;

ALTER TABLE admin_emails ADD CONSTRAINT admin_emails_email_type_check
CHECK (email_type = ANY (ARRAY[
  -- Manual / generic
  'single', 'broadcast', 'reply', 'inbound', 'auto',
  'welcome', 'auto_response',
  -- Wizard flow
  'wizard_resume', 'wizard_recovery_first', 'wizard_recovery_followup',
  -- Appointments
  'appointment_confirmation', 'appointment_pin', 'appointment_reminder',
  -- Auctions / Bidding
  'auction_ending_soon', 'auction_summary', 'auction_winner',
  'auction_new', 'auction_update', 'auction_ended',
  'auction_new_auction', 'auction_new_bid', 'auction_outbid',
  'auction_won', 'auction_lost', 'auction_auction_started',
  'auction_seller_sold', 'auction_seller_not_sold',
  'auction_kaufchance_invite', 'auction_seller_kaufchance',
  'auction_seller_relisted', 'auction_kaufchance_expired',
  'auction_seller_auto_relisted', 'auction_auction_relisted',
  -- Offer flow (previously missing → silently dropped)
  'auction_seller_new_offer', 'auction_admin_new_offer',
  'auction_buyer_offer_rejected', 'auction_buyer_counter_offer',
  'auction_seller_buyer_rejected',
  -- Festpreis lifecycle (new with festpreis auto-extend + soft brake)
  'auction_seller_festpreis_extended',
  'auction_admin_festpreis_needs_price',
  'auction_seller_festpreis_round_warning',
  'auction_seller_auction_round_warning',
  'bid_confirmed', 'bid_outbid',
  -- Payments / Invoices / Dunning
  'payment_confirmation', 'payment_reminder',
  'invoice', 'inactivity', 'favorite_notification', 'favorite_price_change',
  'expert_valuation', 'registration_invite',
  'wrong_number_followup',
  'no_answer_followup', 'considering_followup', 'done_followup',
  'purchase_inquiry_dealer', 'purchase_inquiry_customer', 'purchase_contract',
  -- Lead emails
  'lead_admin_wertermittlung', 'lead_admin_wertrechner', 'lead_admin_wizard',
  'lead_admin_kontakt', 'lead_admin_dealer',
  'lead_user_wertermittlung', 'lead_user_wertrechner', 'lead_user_wizard',
  'lead_user_kontakt', 'lead_user_dealer',
  -- Dealer lifecycle
  'dealer_welcome', 'dealer_approved', 'dealer_rejected', 'dealer_suspended',
  'dealer_reactivated', 'dealer_level_change',
  'dealer_registration_invite',
  'dealer_first_nudge', 'dealer_auction_digest',
  -- Dunning
  'dunning_level_1', 'dunning_level_2', 'dunning_level_3',
  'dunning_level_4', 'dunning_level_5',
  -- Scheduled placeholder
  'scheduled',
  -- 2026-04-19 prior additions
  'vehicle_question',
  'dealer_documents_request'
]));

COMMENT ON CONSTRAINT admin_emails_email_type_check ON admin_emails IS
  'Whitelist of all email types used by Edge Functions and the Email Center. Add new values via a follow-up migration.';

-- ─── Auto-relist policy ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Seller can toggle auto_relist" ON auctions;

CREATE POLICY "Seller can toggle auto_relist"
  ON auctions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM motorhomes m
      WHERE m.id = auctions.motorhome_id
        AND m.seller_id = (SELECT auth.uid())
    )
    AND (
      auctions.status = 'kaufchance'
      OR (
        auctions.status = 'active'
        AND EXISTS (
          SELECT 1 FROM motorhomes m2
          WHERE m2.id = auctions.motorhome_id
            AND m2.sale_channel = 'instant_price'
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM motorhomes m
      WHERE m.id = auctions.motorhome_id
        AND m.seller_id = (SELECT auth.uid())
    )
    AND (
      auctions.status = 'kaufchance'
      OR (
        auctions.status = 'active'
        AND EXISTS (
          SELECT 1 FROM motorhomes m2
          WHERE m2.id = auctions.motorhome_id
            AND m2.sale_channel = 'instant_price'
        )
      )
    )
  );

COMMENT ON POLICY "Seller can toggle auto_relist" ON auctions IS
  'Sellers can flip auto_relist on their own listings during kaufchance phase, or on active festpreis listings (so they can opt out before the next 7-day auto-extension).';
