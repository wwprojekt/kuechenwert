-- Auto-Relist nach erfolgloser Kaufchance
-- Neue Spalten: auction_round (Rundenzähler), auto_relist (Seller-Opt-out)

ALTER TABLE auctions ADD COLUMN auction_round INTEGER NOT NULL DEFAULT 1;
ALTER TABLE auctions ADD COLUMN auto_relist BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN auctions.auction_round IS 'Current auction round number (incremented on each auto-relist)';
COMMENT ON COLUMN auctions.auto_relist IS 'When true, auction is automatically relisted after failed Kaufchance. Seller can set to false during Kaufchance.';

-- RLS: Seller can update auto_relist on their own auctions (during Kaufchance)
CREATE POLICY "Seller can toggle auto_relist"
  ON auctions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM motorhomes m
      WHERE m.id = auctions.motorhome_id
        AND m.seller_id = auth.uid()
    )
    AND status = 'kaufchance'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM motorhomes m
      WHERE m.id = auctions.motorhome_id
        AND m.seller_id = auth.uid()
    )
    AND status = 'kaufchance'
  );

-- Update admin_emails CHECK constraint to include new email types
ALTER TABLE admin_emails DROP CONSTRAINT IF EXISTS admin_emails_email_type_check;
ALTER TABLE admin_emails ADD CONSTRAINT admin_emails_email_type_check
CHECK (email_type = ANY (ARRAY[
  'single', 'broadcast', 'reply', 'inbound', 'auto',
  'welcome', 'auto_response',
  'wizard_resume', 'wizard_recovery_first', 'wizard_recovery_followup',
  'appointment_confirmation', 'appointment_pin', 'appointment_reminder',
  'auction_ending_soon', 'auction_summary', 'auction_winner',
  'auction_new', 'auction_update', 'auction_ended',
  'auction_new_auction', 'auction_new_bid', 'auction_outbid',
  'auction_won', 'auction_lost', 'auction_auction_started',
  'auction_seller_sold', 'auction_seller_not_sold',
  'auction_kaufchance_invite', 'auction_seller_kaufchance',
  'auction_seller_relisted', 'auction_kaufchance_expired',
  'auction_seller_auto_relisted', 'auction_auction_relisted',
  'bid_confirmed', 'bid_outbid',
  'payment_confirmation', 'payment_reminder',
  'invoice', 'inactivity', 'favorite_notification', 'favorite_price_change',
  'expert_valuation', 'registration_invite',
  'wrong_number_followup',
  'no_answer_followup', 'considering_followup', 'done_followup',
  'purchase_inquiry_dealer', 'purchase_inquiry_customer', 'purchase_contract',
  'lead_admin_wertermittlung', 'lead_admin_wertrechner', 'lead_admin_wizard',
  'lead_admin_kontakt', 'lead_admin_dealer',
  'lead_user_wertermittlung', 'lead_user_wertrechner', 'lead_user_wizard',
  'lead_user_kontakt', 'lead_user_dealer',
  'dealer_welcome', 'dealer_approved', 'dealer_rejected', 'dealer_suspended',
  'dealer_reactivated', 'dealer_level_change',
  'dealer_registration_invite',
  'dealer_first_nudge', 'dealer_auction_digest',
  'dunning_level_1', 'dunning_level_2', 'dunning_level_3',
  'dunning_level_4', 'dunning_level_5',
  'scheduled'
]));
