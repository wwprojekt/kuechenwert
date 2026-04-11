-- Add new disposition follow-up email types to admin_emails constraint.
-- These are used by the new send-disposition-email Edge Function
-- to send follow-up emails for leads with status: no_answer, considering, done.

-- Drop the existing constraint
ALTER TABLE admin_emails DROP CONSTRAINT IF EXISTS admin_emails_email_type_check;

-- Recreate with ALL email types including the new disposition follow-up types
ALTER TABLE admin_emails ADD CONSTRAINT admin_emails_email_type_check
CHECK (email_type = ANY (ARRAY[
  -- Manual email types (admin-sent)
  'single', 'broadcast', 'reply', 'inbound', 'auto',
  -- System email types (Edge Functions)
  'welcome', 'auto_response',
  'wizard_resume', 'wizard_recovery_first', 'wizard_recovery_followup',
  'appointment_confirmation', 'appointment_pin', 'appointment_reminder',
  'auction_ending_soon', 'auction_summary', 'auction_winner',
  'auction_new', 'auction_update', 'auction_ended',
  'auction_new_auction', 'auction_new_bid', 'auction_outbid',
  'auction_won', 'auction_lost', 'auction_auction_started',
  'auction_seller_sold', 'auction_seller_not_sold',
  'auction_kaufchance_invite', 'auction_seller_kaufchance',
  'bid_confirmed', 'bid_outbid',
  'payment_confirmation', 'payment_reminder',
  'invoice', 'inactivity', 'favorite_notification', 'favorite_price_change',
  'expert_valuation', 'registration_invite',
  'wrong_number_followup',
  -- NEW: Disposition follow-up email types
  'no_answer_followup', 'considering_followup', 'done_followup',
  'purchase_inquiry_dealer', 'purchase_inquiry_customer', 'purchase_contract',
  -- Dynamic types (lead notifications)
  'lead_admin_wertermittlung', 'lead_admin_wertrechner', 'lead_admin_wizard',
  'lead_admin_kontakt', 'lead_admin_dealer',
  'lead_user_wertermittlung', 'lead_user_wertrechner', 'lead_user_wizard',
  'lead_user_kontakt', 'lead_user_dealer',
  -- Dynamic types (dealer notifications)
  'dealer_welcome', 'dealer_approved', 'dealer_rejected', 'dealer_suspended',
  'dealer_reactivated', 'dealer_level_change',
  'dealer_registration_invite',
  -- Dynamic types (dunning)
  'dunning_level_1', 'dunning_level_2', 'dunning_level_3',
  'dunning_level_4', 'dunning_level_5',
  -- Scheduled
  'scheduled'
]));
