
-- Add 'purchase_contract' to admin_emails email_type constraint
ALTER TABLE admin_emails DROP CONSTRAINT IF EXISTS admin_emails_email_type_check;
ALTER TABLE admin_emails ADD CONSTRAINT admin_emails_email_type_check CHECK (
  email_type = ANY (ARRAY[
    'single'::text, 'broadcast'::text, 'reply'::text, 'inbound'::text, 'auto'::text,
    'welcome'::text, 'auto_response'::text,
    'wizard_resume'::text, 'wizard_recovery_first'::text, 'wizard_recovery_followup'::text,
    'appointment_confirmation'::text, 'appointment_pin'::text, 'appointment_reminder'::text,
    'auction_ending_soon'::text, 'auction_summary'::text, 'auction_winner'::text,
    'auction_new'::text, 'auction_update'::text, 'auction_ended'::text,
    'auction_new_bid'::text, 'auction_outbid'::text, 'auction_won'::text,
    'auction_lost'::text, 'auction_started'::text, 'auction_seller_sold'::text,
    'auction_seller_not_sold'::text, 'auction_kaufchance_invite'::text,
    'auction_seller_kaufchance'::text, 'auction_seller_relisted'::text,
    'auction_new_auction'::text,
    'bid_confirmed'::text, 'bid_outbid'::text,
    'payment_confirmation'::text, 'payment_reminder'::text, 'invoice'::text,
    'purchase_contract'::text,
    'inactivity'::text,
    'favorite_notification'::text, 'favorite_price_change'::text,
    'expert_valuation'::text, 'registration_invite'::text,
    'wrong_number_followup'::text, 'no_answer_followup'::text, 'done_followup'::text,
    'purchase_inquiry_dealer'::text, 'purchase_inquiry_customer'::text,
    'lead_admin_wertermittlung'::text, 'lead_admin_wertrechner'::text,
    'lead_admin_wizard'::text, 'lead_admin_kontakt'::text, 'lead_admin_dealer'::text,
    'lead_user_wertermittlung'::text, 'lead_user_wertrechner'::text,
    'lead_user_wizard'::text, 'lead_user_kontakt'::text, 'lead_user_dealer'::text,
    'dealer_welcome'::text, 'dealer_approved'::text, 'dealer_rejected'::text,
    'dealer_suspended'::text, 'dealer_reactivated'::text, 'dealer_level_change'::text,
    'dealer_auction_digest'::text, 'dealer_first_nudge'::text,
    'dunning_level_1'::text, 'dunning_level_2'::text, 'dunning_level_3'::text,
    'dunning_level_4'::text, 'dunning_level_5'::text,
    'scheduled'::text
  ])
);
