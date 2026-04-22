-- ─────────────────────────────────────────────────────────────────────────────
-- Add 'handover_protocol_blank' to admin_emails.email_type CHECK constraint.
--
-- Why: the shared helper supabase/functions/_shared/sendBlankHandoverProtocol.ts
-- writes audit rows with email_type='handover_protocol_blank' for every blank
-- Übergabeprotokoll mail. The previous CHECK rejected the value, which in turn
-- was silently swallowed by the helper's try/catch — so successful protocol
-- mails left no trail in admin_emails (no way to see/dedupe sends).
--
-- After this migration the audit row will succeed and the dedup logic in
-- downstream consumers (e.g. admin email inbox, support workflows) sees the
-- protocol mails like any other system mail.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.admin_emails DROP CONSTRAINT IF EXISTS admin_emails_email_type_check;

ALTER TABLE public.admin_emails ADD CONSTRAINT admin_emails_email_type_check
CHECK (email_type = ANY (ARRAY[
  'single', 'broadcast', 'reply', 'inbound', 'auto', 'welcome', 'auto_response',
  'wizard_resume', 'wizard_recovery_first', 'wizard_recovery_followup',
  'appointment_confirmation', 'appointment_pin', 'appointment_reminder',
  'auction_ending_soon', 'auction_summary', 'auction_winner', 'auction_new',
  'auction_update', 'auction_ended', 'auction_new_auction', 'auction_new_bid',
  'auction_outbid', 'auction_won', 'auction_lost', 'auction_auction_started',
  'auction_seller_sold', 'auction_seller_not_sold', 'auction_kaufchance_invite',
  'auction_seller_kaufchance', 'auction_seller_relisted',
  'auction_kaufchance_expired', 'auction_seller_auto_relisted',
  'auction_auction_relisted', 'auction_seller_new_offer',
  'auction_admin_new_offer', 'auction_buyer_offer_rejected',
  'auction_buyer_counter_offer', 'auction_seller_buyer_rejected',
  'auction_seller_festpreis_extended', 'auction_admin_festpreis_needs_price',
  'auction_seller_festpreis_round_warning',
  'auction_seller_auction_round_warning', 'auction_seller_soft_brake',
  'auction_seller_festpreis_cap_reached',
  'auction_seller_existing_listing_optin',
  'bid_confirmed', 'bid_outbid', 'payment_confirmation', 'payment_reminder',
  'invoice', 'inactivity', 'favorite_notification', 'favorite_price_change',
  'expert_valuation', 'registration_invite', 'wrong_number_followup',
  'no_answer_followup', 'considering_followup', 'done_followup',
  'purchase_inquiry_dealer', 'purchase_inquiry_customer', 'purchase_contract',
  'purchase_contract_notification', 'handover_protocol_blank',
  'lead_admin_wertermittlung', 'lead_admin_wertrechner', 'lead_admin_wizard',
  'lead_admin_kontakt', 'lead_admin_dealer', 'lead_user_wertermittlung',
  'lead_user_wertrechner', 'lead_user_wizard', 'lead_user_kontakt',
  'lead_user_dealer', 'dealer_welcome', 'dealer_approved', 'dealer_rejected',
  'dealer_suspended', 'dealer_reactivated', 'dealer_level_change',
  'dealer_registration_invite', 'dealer_first_nudge', 'dealer_auction_digest',
  'dunning_level_1', 'dunning_level_2', 'dunning_level_3', 'dunning_level_4',
  'dunning_level_5', 'scheduled', 'vehicle_question', 'dealer_documents_request',
  'google_review_request'
]));
