
ALTER TABLE admin_emails DROP CONSTRAINT admin_emails_email_type_check;
ALTER TABLE admin_emails ADD CONSTRAINT admin_emails_email_type_check CHECK (email_type = ANY (ARRAY[
  'single','broadcast','reply','inbound','auto','welcome','auto_response',
  'wizard_resume','wizard_recovery_first','wizard_recovery_followup',
  'appointment_confirmation','appointment_pin','appointment_reminder',
  'auction_ending_soon','auction_summary','auction_winner','auction_new','auction_update','auction_ended',
  'auction_new_bid','auction_outbid','auction_won','auction_lost','auction_started',
  'auction_seller_sold','auction_seller_not_sold','auction_kaufchance_invite',
  'auction_seller_kaufchance','auction_seller_relisted','auction_new_auction',
  'bid_confirmed','bid_outbid',
  'payment_confirmation','payment_reminder','invoice',
  'inactivity','favorite_notification','favorite_price_change',
  'expert_valuation','registration_invite','wrong_number_followup',
  'purchase_inquiry_dealer','purchase_inquiry_customer',
  'lead_admin_wertermittlung','lead_admin_wertrechner','lead_admin_wizard','lead_admin_kontakt','lead_admin_dealer',
  'lead_user_wertermittlung','lead_user_wertrechner','lead_user_wizard','lead_user_kontakt','lead_user_dealer',
  'dealer_welcome','dealer_approved','dealer_rejected','dealer_suspended','dealer_reactivated','dealer_level_change',
  'dealer_auction_digest','dealer_first_nudge',
  'dunning_level_1','dunning_level_2','dunning_level_3','dunning_level_4','dunning_level_5',
  'scheduled'
]));
