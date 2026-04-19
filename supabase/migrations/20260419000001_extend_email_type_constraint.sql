-- ─────────────────────────────────────────────────────────────────────────
-- Extend admin_emails.email_type CHECK constraint with two new types
-- introduced by 2026-04-19 fixes:
--
-- 1. 'vehicle_question' – notify-vehicle-question now logs into admin_emails
--    so the Email Center has a record of all admin notifications about
--    incoming vehicle questions.
--
-- 2. 'dealer_documents_request' – request-dealer-documents previously
--    logged with the catch-all 'auto' type, which made it impossible to
--    filter document requests separately. Now it uses its own type.
--
-- This migration is idempotent: it drops the old constraint (regardless of
-- which previous migration created it) and recreates it with the full set
-- of currently-used types plus the two new ones.
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
  -- 2026-04-19 additions
  'vehicle_question',
  'dealer_documents_request'
]));

COMMENT ON CONSTRAINT admin_emails_email_type_check ON admin_emails IS
  'Whitelist of all email types used by Edge Functions and the Email Center. Add new values via a follow-up migration.';
