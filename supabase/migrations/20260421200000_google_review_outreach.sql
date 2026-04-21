-- =============================================================================
-- Migration: Google Review Outreach
-- =============================================================================
-- Purpose:
--   One-time email outreach asking past contacts (anyone whose email we have)
--   to leave a Google review for CaravanWert.
--
-- Design decisions:
--   - "Once-ever per email" enforced via UNIQUE(lower(email)) on the queue
--     table. A contact who already received the request will never receive it
--     again, regardless of how many additional touchpoints accrue.
--   - Sourced from a UNION across all customer-email-bearing tables. Suppressed
--     by `email_suppressions` (manual blocks, bounces, complaints) and by
--     `profiles.email_bounced`.
--   - Token-based unsubscribe so recipients can opt-out without auth. GDPR
--     requirement for marketing emails.
--   - Cron + Edge Function batching keeps us under Resend rate limits and
--     reduces spam-folder risk.
--
-- Legal context (DE):
--   - BGH VI ZR 225/17: review-request emails ARE advertising, normally need
--     consent (§7 UWG). User explicitly accepted the broad-scope risk.
--   - We minimize fallout via: visible unsubscribe, immediate honour of
--     opt-out, soft rate limit, suppression on ANY bounce/complaint signal
--     from the inbound webhook.
-- =============================================================================

-- =============================================================================
-- 1) Global email_suppressions table
-- =============================================================================
-- Generic blocklist consultable by ANY future outreach feature, not just this
-- one. Eliminates the one-feature-per-blocklist anti-pattern.

CREATE TABLE IF NOT EXISTS public.email_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribed', 'bounced', 'complained', 'manual', 'invalid')),
  source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-folded uniqueness so 'Foo@Bar.de' and 'foo@bar.de' collapse.
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_suppressions_email_lower
  ON public.email_suppressions (lower(email));

CREATE INDEX IF NOT EXISTS idx_email_suppressions_created
  ON public.email_suppressions (created_at DESC);

ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.email_suppressions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_suppressions TO authenticated;

DROP POLICY IF EXISTS "Admins manage email suppressions" ON public.email_suppressions;
CREATE POLICY "Admins manage email suppressions"
  ON public.email_suppressions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

COMMENT ON TABLE public.email_suppressions IS
  'Global email blocklist. Consulted before sending any outreach mail. Sources: user unsubscribe, Resend bounce/complaint webhook, admin manual.';

-- =============================================================================
-- 2) google_review_requests queue
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.google_review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  recipient_name TEXT,
  source TEXT NOT NULL,
  source_user_id UUID,
  source_first_seen_at TIMESTAMPTZ,
  enqueued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivery_status TEXT NOT NULL DEFAULT 'queued' CHECK (
    delivery_status IN ('queued', 'sent', 'delivered', 'bounced', 'failed', 'suppressed', 'unsubscribed')
  ),
  delivery_error TEXT,
  resend_message_id TEXT,
  unsubscribe_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  unsubscribed_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  click_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Once-ever guarantee. A second enqueue attempt for the same email is a no-op.
CREATE UNIQUE INDEX IF NOT EXISTS uq_google_review_requests_email_lower
  ON public.google_review_requests (lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS uq_google_review_requests_token
  ON public.google_review_requests (unsubscribe_token);

CREATE INDEX IF NOT EXISTS idx_google_review_requests_status_scheduled
  ON public.google_review_requests (delivery_status, scheduled_for)
  WHERE delivery_status = 'queued';

CREATE INDEX IF NOT EXISTS idx_google_review_requests_sent_at
  ON public.google_review_requests (sent_at DESC)
  WHERE sent_at IS NOT NULL;

ALTER TABLE public.google_review_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.google_review_requests FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_review_requests TO authenticated;

DROP POLICY IF EXISTS "Admins manage google review requests" ON public.google_review_requests;
CREATE POLICY "Admins manage google review requests"
  ON public.google_review_requests FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

COMMENT ON TABLE public.google_review_requests IS
  'Outreach queue for Google review request emails. UNIQUE(lower(email)) enforces "once-ever per recipient". Cron-driven send via send-google-review-request Edge Function.';

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_google_review_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_google_review_requests_updated_at
  ON public.google_review_requests;

CREATE TRIGGER trg_google_review_requests_updated_at
  BEFORE UPDATE ON public.google_review_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_google_review_requests_updated_at();

-- =============================================================================
-- 3) RPC: enqueue candidates
-- =============================================================================
-- Pulls emails from ALL known sources, normalises to lowercase, applies all
-- exclusion filters, and inserts new candidates. Idempotent thanks to the
-- UNIQUE index — re-runs will silently skip already-queued addresses.
--
-- Filters:
--   - Email is non-empty + matches simple shape pattern
--   - Not in google_review_requests (UNIQUE handles race)
--   - Not in email_suppressions
--   - Not in profiles where email_bounced=true
--   - Source first-seen-at >= p_min_age_days ago (gives recent contacts a
--     buffer; default 14d so we never ask same-day after a transaction)

CREATE OR REPLACE FUNCTION public.enqueue_google_review_candidates(
  p_min_age_days INT DEFAULT 14,
  p_max_inserts INT DEFAULT 1000
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_inserted INT;
  v_min_seen_before TIMESTAMPTZ := NOW() - (p_min_age_days * INTERVAL '1 day');
  v_max_inserts INT := GREATEST(LEAST(COALESCE(p_max_inserts, 1000), 5000), 0);
BEGIN
  WITH all_emails AS (
    -- profiles
    SELECT
      lower(p.email) AS email,
      COALESCE(
        NULLIF(trim(p.first_name), ''),
        NULLIF(trim(p.first_name || ' ' || p.last_name), ''),
        NULLIF(trim(p.last_name), '')
      ) AS name,
      'profiles'::TEXT AS source,
      p.id AS source_user_id,
      COALESCE(p.created_at, NOW()) AS first_seen_at
    FROM public.profiles p
    WHERE p.email IS NOT NULL
      AND p.email <> ''
      AND COALESCE(p.email_bounced, false) = false

    UNION ALL

    -- wizard_sessions (customer_email)
    SELECT
      lower(w.customer_email),
      NULLIF(trim(w.customer_name), ''),
      'wizard_session'::TEXT,
      w.user_id,
      COALESCE(w.created_at, NOW())
    FROM public.wizard_sessions w
    WHERE w.customer_email IS NOT NULL AND w.customer_email <> ''

    UNION ALL

    -- value_assessment_leads
    SELECT
      lower(v.email),
      NULLIF(trim(v.name), ''),
      'value_assessment_lead'::TEXT,
      NULL::UUID,
      COALESCE(v.created_at, NOW())
    FROM public.value_assessment_leads v
    WHERE v.email IS NOT NULL AND v.email <> ''

    UNION ALL

    -- contact_messages
    SELECT
      lower(c.email),
      NULLIF(trim(c.name), ''),
      'contact_message'::TEXT,
      NULL::UUID,
      COALESCE(c.created_at, NOW())
    FROM public.contact_messages c
    WHERE c.email IS NOT NULL AND c.email <> ''

    UNION ALL

    -- purchase_inquiries (customer_email)
    SELECT
      lower(pi.customer_email),
      NULLIF(trim(pi.customer_name), ''),
      'purchase_inquiry'::TEXT,
      NULL::UUID,
      COALESCE(pi.created_at, NOW())
    FROM public.purchase_inquiries pi
    WHERE pi.customer_email IS NOT NULL AND pi.customer_email <> ''

    UNION ALL

    -- vehicle_questions
    SELECT
      lower(vq.questioner_email),
      NULLIF(trim(vq.questioner_name), ''),
      'vehicle_question'::TEXT,
      vq.questioner_id,
      COALESCE(vq.created_at, NOW())
    FROM public.vehicle_questions vq
    WHERE vq.questioner_email IS NOT NULL AND vq.questioner_email <> ''
  ),
  -- Normalise + filter to plausible shape, deduplicate by email keeping the
  -- earliest first_seen_at to enforce p_min_age_days correctly.
  normalised AS (
    SELECT
      email,
      MIN(first_seen_at) AS first_seen_at,
      (array_agg(name) FILTER (WHERE name IS NOT NULL))[1] AS name,
      (array_agg(source ORDER BY first_seen_at ASC))[1] AS source,
      (array_agg(source_user_id) FILTER (WHERE source_user_id IS NOT NULL))[1] AS source_user_id
    FROM all_emails
    WHERE email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    GROUP BY email
  ),
  filtered AS (
    SELECT n.*
    FROM normalised n
    WHERE n.first_seen_at < v_min_seen_before
      AND NOT EXISTS (
        SELECT 1 FROM public.email_suppressions s
        WHERE lower(s.email) = n.email
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.google_review_requests g
        WHERE lower(g.email) = n.email
      )
    ORDER BY n.first_seen_at ASC
    LIMIT v_max_inserts
  )
  INSERT INTO public.google_review_requests (
    email, recipient_name, source, source_user_id, source_first_seen_at
  )
  SELECT email, name, source, source_user_id, first_seen_at
  FROM filtered
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'min_age_days', p_min_age_days
  );
END;
$$;

COMMENT ON FUNCTION public.enqueue_google_review_candidates(INT, INT) IS
  'SECURITY DEFINER: collects emails from all source tables, applies suppression filters, inserts into queue. Idempotent. Returns insert count.';

REVOKE ALL ON FUNCTION public.enqueue_google_review_candidates(INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_google_review_candidates(INT, INT) TO service_role, authenticated;

-- =============================================================================
-- 4) RPC: claim batch (atomic; prevents double-send when cron retries)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.claim_google_review_batch(p_limit INT DEFAULT 50)
RETURNS TABLE (
  id UUID,
  email TEXT,
  recipient_name TEXT,
  unsubscribe_token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_limit INT := GREATEST(LEAST(COALESCE(p_limit, 50), 500), 1);
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT g.id
    FROM public.google_review_requests g
    WHERE g.delivery_status = 'queued'
      AND g.scheduled_for <= NOW()
      AND g.unsubscribed_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.email_suppressions s
        WHERE lower(s.email) = lower(g.email)
      )
    ORDER BY g.scheduled_for ASC, g.enqueued_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT v_limit
  )
  UPDATE public.google_review_requests g
  SET delivery_status = 'sent', sent_at = NOW()
  FROM picked
  WHERE g.id = picked.id
  RETURNING g.id, g.email, g.recipient_name, g.unsubscribe_token;
END;
$$;

COMMENT ON FUNCTION public.claim_google_review_batch(INT) IS
  'SECURITY DEFINER: atomically claims up to N queued rows by flipping status to sent. Uses FOR UPDATE SKIP LOCKED so concurrent invocations never double-send. Caller MUST actually send and then optionally call mark_google_review_failed if Resend rejects.';

REVOKE ALL ON FUNCTION public.claim_google_review_batch(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_google_review_batch(INT) TO service_role, authenticated;

-- =============================================================================
-- 5) RPC: mark failed (rollback for Resend errors)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.mark_google_review_failed(
  p_id UUID,
  p_error TEXT,
  p_status TEXT DEFAULT 'failed'
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_status TEXT := COALESCE(p_status, 'failed');
BEGIN
  IF v_status NOT IN ('failed', 'bounced', 'suppressed') THEN
    RAISE EXCEPTION 'invalid_status'
      USING HINT = 'Status must be failed, bounced, or suppressed';
  END IF;

  UPDATE public.google_review_requests
  SET delivery_status = v_status,
      delivery_error = p_error,
      sent_at = NULL  -- not actually sent, free for retry/audit
  WHERE id = p_id;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_google_review_failed(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_google_review_failed(UUID, TEXT, TEXT) TO service_role, authenticated;

-- =============================================================================
-- 6) RPC: mark delivered (called by Resend webhook → inbound-webhook)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.mark_google_review_delivered(
  p_email TEXT,
  p_resend_id TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE public.google_review_requests
  SET delivery_status = 'delivered',
      resend_message_id = COALESCE(p_resend_id, resend_message_id)
  WHERE lower(email) = lower(p_email)
    AND delivery_status = 'sent';
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_google_review_delivered(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_google_review_delivered(TEXT, TEXT) TO service_role;

-- =============================================================================
-- 7) RPC: process_google_review_unsubscribe (token → opt-out)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.process_google_review_unsubscribe(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_email TEXT;
  v_id UUID;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  SELECT id, email INTO v_id, v_email
  FROM public.google_review_requests
  WHERE unsubscribe_token = p_token
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'token_not_found';
  END IF;

  UPDATE public.google_review_requests
  SET delivery_status = 'unsubscribed',
      unsubscribed_at = COALESCE(unsubscribed_at, NOW())
  WHERE id = v_id;

  -- Also add to global suppression list so future outreach features respect it.
  INSERT INTO public.email_suppressions (email, reason, source, notes)
  VALUES (lower(v_email), 'unsubscribed', 'google_review_request', 'Recipient clicked unsubscribe link')
  ON CONFLICT (lower(email)) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'email', v_email);
END;
$$;

COMMENT ON FUNCTION public.process_google_review_unsubscribe(TEXT) IS
  'SECURITY DEFINER: token-based opt-out. Marks the queue row as unsubscribed AND adds the email to the global email_suppressions list so other future outreach features respect it.';

REVOKE ALL ON FUNCTION public.process_google_review_unsubscribe(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_google_review_unsubscribe(TEXT) TO anon, authenticated, service_role;

-- =============================================================================
-- 8) RPC: track_google_review_click (optional — counts CTA clicks via redirect)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.track_google_review_click(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE public.google_review_requests
  SET clicked_at = COALESCE(clicked_at, NOW()),
      click_count = click_count + 1
  WHERE unsubscribe_token = p_token;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.track_google_review_click(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_google_review_click(TEXT) TO anon, authenticated, service_role;

-- =============================================================================
-- 9) RPC: admin_add_email_suppression (admin "block this address")
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_add_email_suppression(
  p_email TEXT,
  p_reason TEXT DEFAULT 'manual',
  p_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.email_suppressions (email, reason, source, notes)
  VALUES (
    lower(trim(p_email)),
    COALESCE(p_reason, 'manual'),
    'admin',
    p_notes
  )
  ON CONFLICT (lower(email)) DO UPDATE
  SET reason = EXCLUDED.reason,
      notes = COALESCE(EXCLUDED.notes, public.email_suppressions.notes),
      source = 'admin';

  -- Mark any queued row for this email as suppressed.
  UPDATE public.google_review_requests
  SET delivery_status = 'suppressed'
  WHERE lower(email) = lower(trim(p_email))
    AND delivery_status = 'queued';

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_add_email_suppression(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_add_email_suppression(TEXT, TEXT, TEXT) TO authenticated;

-- =============================================================================
-- 10) RPC: get_google_review_stats (for admin dashboard)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_google_review_stats()
RETURNS JSONB
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
    'total', count(*),
    'queued', count(*) FILTER (WHERE delivery_status = 'queued'),
    'sent', count(*) FILTER (WHERE delivery_status = 'sent'),
    'delivered', count(*) FILTER (WHERE delivery_status = 'delivered'),
    'bounced', count(*) FILTER (WHERE delivery_status = 'bounced'),
    'failed', count(*) FILTER (WHERE delivery_status = 'failed'),
    'unsubscribed', count(*) FILTER (WHERE delivery_status = 'unsubscribed'),
    'suppressed', count(*) FILTER (WHERE delivery_status = 'suppressed'),
    'clicked', count(*) FILTER (WHERE clicked_at IS NOT NULL),
    'sent_today', count(*) FILTER (
      WHERE sent_at >= date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'
    ),
    'sent_last_7d', count(*) FILTER (WHERE sent_at >= NOW() - INTERVAL '7 days')
  )
  INTO v_result
  FROM public.google_review_requests;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_google_review_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_google_review_stats() TO authenticated;
