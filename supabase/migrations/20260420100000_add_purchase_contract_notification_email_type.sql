-- Add 'purchase_contract_notification' to admin_emails.email_type constraint.
-- This is the short, attachment-free follow-up email sent right after the
-- main purchase contract email (with PDF attachment). It gives the recipient
-- a download link as a fallback when the original email is filtered as spam
-- by their mail server (e.g. Hornetsecurity, NoSpamProxy, Outlook Junk).

ALTER TABLE public.admin_emails
  DROP CONSTRAINT IF EXISTS admin_emails_email_type_check;

ALTER TABLE public.admin_emails
  ADD CONSTRAINT admin_emails_email_type_check CHECK (
    email_type = ANY (ARRAY[
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
      'auction_seller_new_offer', 'auction_admin_new_offer',
      'auction_buyer_offer_rejected', 'auction_buyer_counter_offer',
      'auction_seller_buyer_rejected', 'auction_seller_festpreis_extended',
      'auction_admin_festpreis_needs_price',
      'auction_seller_festpreis_round_warning',
      'auction_seller_auction_round_warning',
      'bid_confirmed', 'bid_outbid',
      'payment_confirmation', 'payment_reminder', 'invoice',
      'inactivity',
      'favorite_notification', 'favorite_price_change',
      'expert_valuation', 'registration_invite',
      'wrong_number_followup', 'no_answer_followup',
      'considering_followup', 'done_followup',
      'purchase_inquiry_dealer', 'purchase_inquiry_customer',
      'purchase_contract', 'purchase_contract_notification',
      'lead_admin_wertermittlung', 'lead_admin_wertrechner',
      'lead_admin_wizard', 'lead_admin_kontakt', 'lead_admin_dealer',
      'lead_user_wertermittlung', 'lead_user_wertrechner',
      'lead_user_wizard', 'lead_user_kontakt', 'lead_user_dealer',
      'dealer_welcome', 'dealer_approved', 'dealer_rejected',
      'dealer_suspended', 'dealer_reactivated', 'dealer_level_change',
      'dealer_registration_invite', 'dealer_first_nudge',
      'dealer_auction_digest',
      'dunning_level_1', 'dunning_level_2', 'dunning_level_3',
      'dunning_level_4', 'dunning_level_5',
      'scheduled', 'vehicle_question', 'dealer_documents_request'
    ])
  );
