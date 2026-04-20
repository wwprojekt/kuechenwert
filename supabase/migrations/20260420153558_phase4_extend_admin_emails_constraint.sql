-- Phase-4 Audit follow-up: 3 neue email_types in admin_emails CHECK-Constraint aufnehmen.
-- send-auction-notification.ts loggt jede Mail in admin_emails fuer den System-Tab
-- und das Dedup. Ohne diese drei Werte schlaegt der INSERT silent fehl (try/catch),
-- die Mail geht zwar via Resend raus, aber das Dedup funktioniert nicht und die
-- Mail erscheint nicht im Admin-System-Tab.
--
-- Hinzugefuegt:
--   * auction_seller_soft_brake          (Audit-Fix #6)
--   * auction_seller_festpreis_cap_reached (Audit-Fix #10)
--   * auction_seller_existing_listing_optin (Audit-Fix #8)

ALTER TABLE public.admin_emails DROP CONSTRAINT IF EXISTS admin_emails_email_type_check;

ALTER TABLE public.admin_emails
  ADD CONSTRAINT admin_emails_email_type_check CHECK (
    email_type = ANY (ARRAY[
      'single', 'broadcast', 'reply', 'inbound', 'auto', 'welcome', 'auto_response',
      'wizard_resume', 'wizard_recovery_first', 'wizard_recovery_followup',
      'appointment_confirmation', 'appointment_pin', 'appointment_reminder',
      'auction_ending_soon', 'auction_summary', 'auction_winner', 'auction_new',
      'auction_update', 'auction_ended', 'auction_new_auction', 'auction_new_bid',
      'auction_outbid', 'auction_won', 'auction_lost', 'auction_auction_started',
      'auction_seller_sold', 'auction_seller_not_sold', 'auction_kaufchance_invite',
      'auction_seller_kaufchance', 'auction_seller_relisted', 'auction_kaufchance_expired',
      'auction_seller_auto_relisted', 'auction_auction_relisted', 'auction_seller_new_offer',
      'auction_admin_new_offer', 'auction_buyer_offer_rejected', 'auction_buyer_counter_offer',
      'auction_seller_buyer_rejected', 'auction_seller_festpreis_extended',
      'auction_admin_festpreis_needs_price', 'auction_seller_festpreis_round_warning',
      'auction_seller_auction_round_warning',
      -- NEU (Phase-4 Audit-Fixes):
      'auction_seller_soft_brake',
      'auction_seller_festpreis_cap_reached',
      'auction_seller_existing_listing_optin',
      'bid_confirmed', 'bid_outbid', 'payment_confirmation', 'payment_reminder',
      'invoice', 'inactivity', 'favorite_notification', 'favorite_price_change',
      'expert_valuation', 'registration_invite', 'wrong_number_followup',
      'no_answer_followup', 'considering_followup', 'done_followup',
      'purchase_inquiry_dealer', 'purchase_inquiry_customer', 'purchase_contract',
      'purchase_contract_notification', 'lead_admin_wertermittlung', 'lead_admin_wertrechner',
      'lead_admin_wizard', 'lead_admin_kontakt', 'lead_admin_dealer',
      'lead_user_wertermittlung', 'lead_user_wertrechner', 'lead_user_wizard',
      'lead_user_kontakt', 'lead_user_dealer', 'dealer_welcome', 'dealer_approved',
      'dealer_rejected', 'dealer_suspended', 'dealer_reactivated', 'dealer_level_change',
      'dealer_registration_invite', 'dealer_first_nudge', 'dealer_auction_digest',
      'dunning_level_1', 'dunning_level_2', 'dunning_level_3', 'dunning_level_4',
      'dunning_level_5', 'scheduled', 'vehicle_question', 'dealer_documents_request'
    ])
  );

-- Backfill der 8 schon versendeten Opt-in-Mails: damit Dedup funktioniert
-- und sie im Admin-System-Tab erscheinen. Wir markieren sie mit dem dedup-Marker
-- den die Edge Function bei Re-Runs prueft.
INSERT INTO public.admin_emails (
  recipient_email, recipient_name, subject, body_html, body_text, email_type,
  sender_email, sender_name, status, created_at
)
SELECT
  p.email,
  COALESCE(NULLIF(p.company_name, ''), NULLIF(p.first_name, ''), split_part(p.email, '@', 1)),
  'Wichtige Information zu Ihrem Inserat: ' || COALESCE(m.manufacturer || ' ' || m.model, 'Inserat'),
  'Backfill nach versendeter Opt-in-Mail (CHECK-Constraint blockierte initialen Insert).',
  'dedup:opt-in:' || a.id::text || ' | Backfill nach versendeter Opt-in-Mail (CHECK-Constraint blockierte initialen Insert).',
  'auction_seller_existing_listing_optin',
  'info@caravanwert.de',
  'CaravanWert',
  'sent',
  now() - INTERVAL '5 minutes'
FROM public.auctions a
JOIN public.motorhomes m ON m.id = a.motorhome_id
JOIN public.profiles p ON p.id = m.seller_id
WHERE a.id IN (
  '937a1de4-55c3-401a-b2a9-754d89a11008','6497a6a7-bcaf-41d3-9811-87d1267dcfe2','a9d4646e-9e79-48d4-8ed6-0c346e231be8',
  '01605ae0-a67d-4e58-ae6b-7f13986f1e0a','37906ef1-5acf-4847-b1c0-31b2f32f2899','533ff102-3855-4cc5-ad1d-e5057b7a627d',
  'c94dc1af-6906-4c9d-b454-f9be1db931b0','27571106-09a2-42a4-966f-c4dfe69b4db5'
);
