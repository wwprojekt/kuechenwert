-- ============================================================================
-- Google-Review-Outreach: delivery status propagation fix
-- ----------------------------------------------------------------------------
-- Problem: the Resend webhook (inbound-webhook) correctly flipped
-- admin_emails.status from 'sent' → 'delivered' when Resend fired
-- email.delivered, but the mirror row in google_review_requests was never
-- touched. Result in /admin/google-reviews: "Versendet 197 / Zugestellt 0"
-- even though 194 messages had been confirmed delivered by Resend.
--
-- This migration does two things:
--   1. Adds a SECURITY DEFINER RPC `webhook_mark_google_review_delivered()`
--      so the webhook (runs with anon key) can flip the queue row without
--      needing a broad RLS policy on google_review_requests.
--   2. Backfills historical rows: any google_review_requests row whose
--      resend_message_id matches an admin_emails row in status 'delivered'
--      gets flipped from 'sent' → 'delivered'.
-- ============================================================================

-- 1. RPC --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.webhook_mark_google_review_delivered(
  p_resend_message_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_affected integer;
BEGIN
  IF p_resend_message_id IS NULL OR length(trim(p_resend_message_id)) = 0 THEN
    RETURN false;
  END IF;

  UPDATE public.google_review_requests
  SET delivery_status = 'delivered',
      updated_at = now()
  WHERE resend_message_id = p_resend_message_id
    AND delivery_status = 'sent';

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RETURN v_affected > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.webhook_mark_google_review_delivered(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.webhook_mark_google_review_delivered(text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.webhook_mark_google_review_delivered(text) IS
  'Called from inbound-webhook Edge Function on Resend email.delivered events. '
  'Flips google_review_requests.delivery_status from sent → delivered for the '
  'row with the matching resend_message_id. SECURITY DEFINER because the '
  'webhook runs without an authenticated user.';

-- 2. Backfill ---------------------------------------------------------------
UPDATE public.google_review_requests grr
SET delivery_status = 'delivered',
    updated_at = now()
FROM public.admin_emails ae
WHERE ae.resend_id = grr.resend_message_id
  AND ae.email_type = 'google_review_request'
  AND ae.status = 'delivered'
  AND grr.delivery_status = 'sent';
