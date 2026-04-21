-- ============================================================================
-- Google Review Outreach – Bug-Fixes (Self-Audit 2026-04-21)
-- ============================================================================
-- 1) admin_emails.email_type CHECK accepts 'google_review_request'
--    (without this every send is logged as failed)
-- 2) get_google_review_stats() returns the fields the admin UI expects:
--    click_total, click_unique, oldest_queued_at, last_sent_at
-- 3) New helper RPC webhook_add_email_suppression() so the inbound-webhook
--    (running as service_role, no auth.uid()) can add bounces/complaints
--    via a function that knows the functional unique index on lower(email).
-- ============================================================================

-- ── 1) Extend admin_emails.email_type CHECK ─────────────────────────────────
ALTER TABLE public.admin_emails
  DROP CONSTRAINT IF EXISTS admin_emails_email_type_check;

ALTER TABLE public.admin_emails
  ADD CONSTRAINT admin_emails_email_type_check CHECK (email_type = ANY (ARRAY[
    'single','broadcast','reply','inbound','auto','welcome','auto_response',
    'wizard_resume','wizard_recovery_first','wizard_recovery_followup',
    'appointment_confirmation','appointment_pin','appointment_reminder',
    'auction_ending_soon','auction_summary','auction_winner','auction_new',
    'auction_update','auction_ended','auction_new_auction','auction_new_bid',
    'auction_outbid','auction_won','auction_lost','auction_auction_started',
    'auction_seller_sold','auction_seller_not_sold','auction_kaufchance_invite',
    'auction_seller_kaufchance','auction_seller_relisted','auction_kaufchance_expired',
    'auction_seller_auto_relisted','auction_auction_relisted','auction_seller_new_offer',
    'auction_admin_new_offer','auction_buyer_offer_rejected','auction_buyer_counter_offer',
    'auction_seller_buyer_rejected','auction_seller_festpreis_extended',
    'auction_admin_festpreis_needs_price','auction_seller_festpreis_round_warning',
    'auction_seller_auction_round_warning','auction_seller_soft_brake',
    'auction_seller_festpreis_cap_reached','auction_seller_existing_listing_optin',
    'bid_confirmed','bid_outbid','payment_confirmation','payment_reminder','invoice',
    'inactivity','favorite_notification','favorite_price_change','expert_valuation',
    'registration_invite','wrong_number_followup','no_answer_followup',
    'considering_followup','done_followup','purchase_inquiry_dealer',
    'purchase_inquiry_customer','purchase_contract','purchase_contract_notification',
    'lead_admin_wertermittlung','lead_admin_wertrechner','lead_admin_wizard',
    'lead_admin_kontakt','lead_admin_dealer','lead_user_wertermittlung',
    'lead_user_wertrechner','lead_user_wizard','lead_user_kontakt','lead_user_dealer',
    'dealer_welcome','dealer_approved','dealer_rejected','dealer_suspended',
    'dealer_reactivated','dealer_level_change','dealer_registration_invite',
    'dealer_first_nudge','dealer_auction_digest','dunning_level_1','dunning_level_2',
    'dunning_level_3','dunning_level_4','dunning_level_5','scheduled',
    'vehicle_question','dealer_documents_request',
    -- NEW: Google review outreach
    'google_review_request'
  ]));

COMMENT ON CONSTRAINT admin_emails_email_type_check ON public.admin_emails IS
  'Whitelist of recognised email_type values. Extend here when adding new mailers.';


-- ── 2) Stats RPC: align return shape with AdminGoogleReviews UI ─────────────
CREATE OR REPLACE FUNCTION public.get_google_review_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT jsonb_build_object(
    'total',            count(*),
    'queued',           count(*) FILTER (WHERE delivery_status = 'queued'),
    'sent',             count(*) FILTER (WHERE delivery_status = 'sent'),
    'delivered',        count(*) FILTER (WHERE delivery_status = 'delivered'),
    'bounced',          count(*) FILTER (WHERE delivery_status = 'bounced'),
    'failed',           count(*) FILTER (WHERE delivery_status = 'failed'),
    'unsubscribed',     count(*) FILTER (WHERE delivery_status = 'unsubscribed'),
    'suppressed',       count(*) FILTER (WHERE delivery_status = 'suppressed'),
    -- legacy fields kept for backwards compat
    'clicked',          count(*) FILTER (WHERE clicked_at IS NOT NULL),
    'sent_today',       count(*) FILTER (WHERE sent_at >= date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'),
    'sent_last_7d',     count(*) FILTER (WHERE sent_at >= NOW() - INTERVAL '7 days'),
    -- new: shape that AdminGoogleReviews.tsx expects
    'click_total',      COALESCE(sum(click_count), 0),
    'click_unique',     count(*) FILTER (WHERE clicked_at IS NOT NULL),
    'oldest_queued_at', MIN(enqueued_at) FILTER (WHERE delivery_status = 'queued'),
    'last_sent_at',     MAX(sent_at)
  )
  INTO v_result
  FROM public.google_review_requests;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;


-- ── 3) Service-role helper for inbound-webhook bounces/complaints ───────────
-- Why a dedicated RPC: the webhook runs with the service_role key and has
-- no auth.uid(), so it cannot call admin_add_email_suppression (which checks
-- for admin role). PostgREST upsert with onConflict='email' also fails
-- because email_suppressions only has a *functional* unique index on
-- lower(email), not a real UNIQUE constraint on the email column.
-- This RPC bridges both gaps with a plain INSERT … ON CONFLICT (lower(email)).

CREATE OR REPLACE FUNCTION public.webhook_add_email_suppression(
  p_email TEXT,
  p_reason TEXT,
  p_source TEXT DEFAULT 'resend_webhook',
  p_notes  TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_email TEXT := lower(trim(COALESCE(p_email, '')));
  v_reason TEXT := COALESCE(p_reason, 'bounced');
BEGIN
  IF v_email = '' OR v_email NOT LIKE '%@%' THEN
    RETURN false;
  END IF;

  IF v_reason NOT IN ('unsubscribed', 'bounced', 'complained', 'manual', 'invalid') THEN
    RAISE EXCEPTION 'invalid_reason'
      USING HINT = 'reason must be one of unsubscribed, bounced, complained, manual, invalid';
  END IF;

  INSERT INTO public.email_suppressions (email, reason, source, notes)
  VALUES (v_email, v_reason, COALESCE(p_source, 'resend_webhook'), p_notes)
  ON CONFLICT (lower(email)) DO UPDATE
  SET reason = EXCLUDED.reason,
      notes  = COALESCE(EXCLUDED.notes, public.email_suppressions.notes),
      source = COALESCE(EXCLUDED.source, public.email_suppressions.source);

  -- Cancel any in-flight Google review request for this email
  UPDATE public.google_review_requests
  SET delivery_status = CASE
        WHEN v_reason = 'bounced'    THEN 'bounced'
        WHEN v_reason = 'complained' THEN 'suppressed'
        ELSE delivery_status
      END,
      delivery_error = CASE
        WHEN v_reason IN ('bounced','complained') THEN 'resend_' || v_reason
        ELSE delivery_error
      END
  WHERE lower(email) = v_email
    AND delivery_status IN ('queued', 'sent');

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.webhook_add_email_suppression(text, text, text, text) IS
  'Service-role helper called from inbound-webhook to suppress an email after a Resend bounce or complaint. Bypasses admin_add_email_suppression''s admin check and uses ON CONFLICT (lower(email)) to satisfy the functional unique index.';

-- Locked down: only service_role can call (no anon/authenticated grant)
REVOKE ALL ON FUNCTION public.webhook_add_email_suppression(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.webhook_add_email_suppression(text, text, text, text) TO service_role;


-- ── Smoke-test ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Verify CHECK accepts new value
  PERFORM 1 FROM pg_constraint
   WHERE conname = 'admin_emails_email_type_check'
     AND pg_get_constraintdef(oid) ILIKE '%google_review_request%';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHECK constraint did not pick up google_review_request';
  END IF;

  -- Verify webhook RPC is callable + idempotent
  PERFORM public.webhook_add_email_suppression(
    '__migration_test__@example.invalid', 'bounced', 'migration_smoketest', 'remove me'
  );
  PERFORM public.webhook_add_email_suppression(
    '__migration_test__@example.invalid', 'bounced', 'migration_smoketest', 'remove me'
  );
  DELETE FROM public.email_suppressions
   WHERE email = '__migration_test__@example.invalid';

  RAISE NOTICE 'google_review_outreach_fixes: smoketest passed';
END;
$$;
