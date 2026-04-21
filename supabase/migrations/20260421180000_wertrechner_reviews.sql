-- =============================================================================
-- Migration: Wertrechner Reviews System
-- =============================================================================
-- Purpose:
--   Collect and display user reviews of the Wertrechner (value calculator) for
--   SEO rich snippets (AggregateRating on WebApplication schema) and social
--   proof (star badges across calculator entry points).
--
-- Design decisions:
--   - All submissions land in status='pending'. Admin MUST approve before
--     reviews become public. Protects against spam, fake reviews, and §5b UWG
--     (German Omnibus Directive) violations.
--   - Rate-limited via ip_hash (3/24h) + session_id (1/ever). Honeypot field
--     silently swallows obvious bot submissions.
--   - GDPR: raw IP never stored, only SHA256(ip || pepper). Pepper from
--     vault.decrypted_secrets with fallback. ip_hash + user_agent auto-purged
--     after 30 days via cron.
--   - Public RPCs return only APPROVED reviews with redacted columns
--     (no email / ip_hash / user_agent / session_id).
--   - Direct table SELECT is revoked for anon/authenticated. Reads go through
--     get_wertrechner_review_stats() and get_wertrechner_reviews_public() RPCs.
--   - Admins access the full table via RLS policies (has_role check).
-- =============================================================================

-- =============================================================================
-- 1) Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.wertrechner_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT CHECK (
    comment IS NULL
    OR char_length(comment) BETWEEN 3 AND 1000
  ),
  reviewer_name TEXT CHECK (
    reviewer_name IS NULL
    OR char_length(reviewer_name) BETWEEN 1 AND 80
  ),
  reviewer_email TEXT CHECK (
    reviewer_email IS NULL
    OR reviewer_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  reviewer_location TEXT CHECK (
    reviewer_location IS NULL
    OR char_length(reviewer_location) BETWEEN 1 AND 80
  ),
  vehicle_type TEXT CHECK (
    vehicle_type IS NULL
    OR vehicle_type IN ('wohnmobil', 'wohnwagen')
  ),
  session_id TEXT,
  ip_hash TEXT,
  user_agent TEXT CHECK (
    user_agent IS NULL
    OR char_length(user_agent) <= 300
  ),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected', 'spam')
  ),
  rejection_reason TEXT,
  moderated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  moderated_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.wertrechner_reviews IS
  'User reviews of the Wertrechner tool. Used for SEO rich snippets (AggregateRating on WebApplication schema) and social proof across calculator entry points. All new reviews land in status=pending for admin moderation.';

COMMENT ON COLUMN public.wertrechner_reviews.ip_hash IS
  'SHA256(ip || pepper) via hash_review_ip(). Used only for rate-limit anti-abuse; purged after 30 days by cleanup_wertrechner_review_pii() cron.';

COMMENT ON COLUMN public.wertrechner_reviews.session_id IS
  'Client-side UUID stored in localStorage. Prevents same user leaving multiple reviews from one browser. Purged with ip_hash after 30 days is NOT applied here; session_id is retained for duplicate detection.';

COMMENT ON COLUMN public.wertrechner_reviews.reviewer_email IS
  'Admin-only column (never returned by public RPCs). For moderation follow-up only.';

-- =============================================================================
-- 2) Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_wertrechner_reviews_status_created
  ON public.wertrechner_reviews (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wertrechner_reviews_approved_published
  ON public.wertrechner_reviews (published_at DESC)
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_wertrechner_reviews_ip_hash
  ON public.wertrechner_reviews (ip_hash, created_at DESC)
  WHERE ip_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wertrechner_reviews_session
  ON public.wertrechner_reviews (session_id)
  WHERE session_id IS NOT NULL;

-- =============================================================================
-- 3) updated_at Trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_wertrechner_reviews_updated_at()
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

DROP TRIGGER IF EXISTS trg_wertrechner_reviews_updated_at
  ON public.wertrechner_reviews;

CREATE TRIGGER trg_wertrechner_reviews_updated_at
  BEFORE UPDATE ON public.wertrechner_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.set_wertrechner_reviews_updated_at();

-- =============================================================================
-- 4) Row Level Security
-- =============================================================================

ALTER TABLE public.wertrechner_reviews ENABLE ROW LEVEL SECURITY;

-- Public (anon + authenticated) have NO direct table access. All reads go
-- through RPCs, all writes go through submit_wertrechner_review RPC.
REVOKE ALL ON public.wertrechner_reviews FROM anon, authenticated;

-- Admins have full access via RLS policies.
DROP POLICY IF EXISTS "Admins can read all reviews" ON public.wertrechner_reviews;
CREATE POLICY "Admins can read all reviews"
  ON public.wertrechner_reviews FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can insert reviews" ON public.wertrechner_reviews;
CREATE POLICY "Admins can insert reviews"
  ON public.wertrechner_reviews FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update reviews" ON public.wertrechner_reviews;
CREATE POLICY "Admins can update reviews"
  ON public.wertrechner_reviews FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can delete reviews" ON public.wertrechner_reviews;
CREATE POLICY "Admins can delete reviews"
  ON public.wertrechner_reviews FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Grant minimum rights needed for admin policies to work.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wertrechner_reviews TO authenticated;

-- =============================================================================
-- 5) IP Hash Helper (SECURITY DEFINER — accesses vault)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.hash_review_ip(p_ip TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_pepper TEXT;
BEGIN
  IF p_ip IS NULL OR p_ip = '' THEN
    RETURN NULL;
  END IF;

  -- Pepper lookup is best-effort; any failure falls back to static pepper.
  -- Static fallback still makes the hash irreversible; pepper rotation only
  -- strengthens against rainbow-table attacks on leaked database snapshots.
  BEGIN
    SELECT decrypted_secret INTO v_pepper
    FROM vault.decrypted_secrets
    WHERE name = 'REVIEW_IP_PEPPER'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_pepper := NULL;
  END;

  v_pepper := COALESCE(v_pepper, 'cw-review-default-pepper-2026-04');
  RETURN encode(extensions.digest(p_ip || v_pepper, 'sha256'), 'hex');
END;
$$;

COMMENT ON FUNCTION public.hash_review_ip(TEXT) IS
  'SECURITY DEFINER: salts + SHA256-hashes IP. Pepper from vault.decrypted_secrets (REVIEW_IP_PEPPER) with static fallback. Called only by service_role from submit Edge Function or backfill scripts.';

REVOKE ALL ON FUNCTION public.hash_review_ip(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hash_review_ip(TEXT) TO service_role;

-- =============================================================================
-- 6) Public RPC: submit_wertrechner_review
-- =============================================================================

CREATE OR REPLACE FUNCTION public.submit_wertrechner_review(
  p_rating INT,
  p_comment TEXT DEFAULT NULL,
  p_reviewer_name TEXT DEFAULT NULL,
  p_reviewer_email TEXT DEFAULT NULL,
  p_reviewer_location TEXT DEFAULT NULL,
  p_vehicle_type TEXT DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL,
  p_ip_hash TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_honeypot TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_recent_by_ip INT;
  v_recent_by_session INT;
  v_review_id UUID;
BEGIN
  -- Honeypot: silently drop bot submissions.
  IF p_honeypot IS NOT NULL AND trim(p_honeypot) <> '' THEN
    RETURN jsonb_build_object('success', true, 'status', 'pending');
  END IF;

  -- Validation
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'invalid_rating'
      USING HINT = 'Rating must be an integer 1-5';
  END IF;

  IF p_comment IS NOT NULL THEN
    IF char_length(trim(p_comment)) > 0 AND char_length(trim(p_comment)) < 3 THEN
      RAISE EXCEPTION 'comment_too_short';
    END IF;
    IF char_length(p_comment) > 1000 THEN
      RAISE EXCEPTION 'comment_too_long';
    END IF;
  END IF;

  -- Rate limit by IP hash (max 3 / 24h)
  IF p_ip_hash IS NOT NULL AND p_ip_hash <> '' THEN
    SELECT count(*)::INT
    INTO v_recent_by_ip
    FROM public.wertrechner_reviews
    WHERE ip_hash = p_ip_hash
      AND created_at > NOW() - INTERVAL '24 hours';

    IF v_recent_by_ip >= 3 THEN
      RAISE EXCEPTION 'rate_limit_ip'
        USING HINT = 'Too many review submissions from this IP address';
    END IF;
  END IF;

  -- Rate limit by session (max 1 ever)
  IF p_session_id IS NOT NULL AND p_session_id <> '' THEN
    SELECT count(*)::INT
    INTO v_recent_by_session
    FROM public.wertrechner_reviews
    WHERE session_id = p_session_id;

    IF v_recent_by_session >= 1 THEN
      RAISE EXCEPTION 'rate_limit_session'
        USING HINT = 'This browser has already submitted a review';
    END IF;
  END IF;

  INSERT INTO public.wertrechner_reviews (
    rating,
    comment,
    reviewer_name,
    reviewer_email,
    reviewer_location,
    vehicle_type,
    session_id,
    ip_hash,
    user_agent,
    status
  ) VALUES (
    p_rating,
    NULLIF(trim(p_comment), ''),
    NULLIF(trim(p_reviewer_name), ''),
    NULLIF(trim(lower(p_reviewer_email)), ''),
    NULLIF(trim(p_reviewer_location), ''),
    p_vehicle_type,
    NULLIF(trim(p_session_id), ''),
    NULLIF(p_ip_hash, ''),
    NULLIF(substring(trim(p_user_agent) from 1 for 300), ''),
    'pending'
  )
  RETURNING id INTO v_review_id;

  RETURN jsonb_build_object(
    'success', true,
    'review_id', v_review_id,
    'status', 'pending'
  );
END;
$$;

COMMENT ON FUNCTION public.submit_wertrechner_review IS
  'SECURITY DEFINER: bypasses RLS to insert pending review. Rate-limited by ip_hash (3/24h) and session_id (1/ever). Honeypot-protected. Always returns status=pending; admin must approve via admin_moderate_wertrechner_review.';

REVOKE ALL ON FUNCTION public.submit_wertrechner_review(
  INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_wertrechner_review(
  INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO anon, authenticated;

-- =============================================================================
-- 7) Public RPC: get_wertrechner_review_stats (aggregate, approved only)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_wertrechner_review_stats()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT jsonb_build_object(
    'count', COALESCE(count(*), 0),
    'average', COALESCE(ROUND(avg(rating)::numeric, 2), 0),
    'distribution', jsonb_build_object(
      '1', COUNT(*) FILTER (WHERE rating = 1),
      '2', COUNT(*) FILTER (WHERE rating = 2),
      '3', COUNT(*) FILTER (WHERE rating = 3),
      '4', COUNT(*) FILTER (WHERE rating = 4),
      '5', COUNT(*) FILTER (WHERE rating = 5)
    )
  )
  FROM public.wertrechner_reviews
  WHERE status = 'approved';
$$;

COMMENT ON FUNCTION public.get_wertrechner_review_stats IS
  'SECURITY DEFINER: returns aggregate stats (count, average, distribution 1-5) of APPROVED reviews only. Publicly callable.';

REVOKE ALL ON FUNCTION public.get_wertrechner_review_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_wertrechner_review_stats() TO anon, authenticated;

-- =============================================================================
-- 8) Public RPC: get_wertrechner_reviews_public (paginated, redacted)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_wertrechner_reviews_public(
  p_limit INT DEFAULT 10,
  p_offset INT DEFAULT 0
) RETURNS TABLE (
  id UUID,
  rating INT,
  comment TEXT,
  reviewer_name TEXT,
  reviewer_location TEXT,
  vehicle_type TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    id,
    rating,
    comment,
    reviewer_name,
    reviewer_location,
    vehicle_type,
    COALESCE(published_at, created_at) AS created_at
  FROM public.wertrechner_reviews
  WHERE status = 'approved'
  ORDER BY COALESCE(published_at, created_at) DESC
  LIMIT LEAST(COALESCE(p_limit, 10), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

COMMENT ON FUNCTION public.get_wertrechner_reviews_public(INT, INT) IS
  'SECURITY DEFINER: returns paginated list of APPROVED reviews with redacted columns (no email/ip_hash/user_agent/session_id). Publicly callable. Limit capped at 100.';

REVOKE ALL ON FUNCTION public.get_wertrechner_reviews_public(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_wertrechner_reviews_public(INT, INT) TO anon, authenticated;

-- =============================================================================
-- 9) Admin RPC: admin_moderate_wertrechner_review
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_moderate_wertrechner_review(
  p_review_id UUID,
  p_action TEXT,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_new_status TEXT;
  v_user UUID;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL OR NOT public.has_role(v_user, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'unauthorized'
      USING HINT = 'Admin role required';
  END IF;

  IF p_action NOT IN ('approve', 'reject', 'spam', 'pending') THEN
    RAISE EXCEPTION 'invalid_action'
      USING HINT = 'Action must be one of: approve, reject, spam, pending';
  END IF;

  v_new_status := CASE p_action
    WHEN 'approve' THEN 'approved'
    WHEN 'reject'  THEN 'rejected'
    WHEN 'spam'    THEN 'spam'
    WHEN 'pending' THEN 'pending'
  END;

  UPDATE public.wertrechner_reviews
  SET
    status = v_new_status,
    rejection_reason = CASE
      WHEN p_action IN ('reject', 'spam') THEN p_reason
      ELSE NULL
    END,
    moderated_by = v_user,
    moderated_at = NOW(),
    published_at = CASE
      WHEN p_action = 'approve' AND published_at IS NULL THEN NOW()
      ELSE published_at
    END
  WHERE id = p_review_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'review_not_found';
  END IF;

  RETURN jsonb_build_object('success', true, 'status', v_new_status);
END;
$$;

COMMENT ON FUNCTION public.admin_moderate_wertrechner_review(UUID, TEXT, TEXT) IS
  'SECURITY DEFINER: admin-only (has_role enforced inside). Moderates review status: approve/reject/spam/pending. Sets moderated_by/moderated_at. On first approve, sets published_at to NOW().';

REVOKE ALL ON FUNCTION public.admin_moderate_wertrechner_review(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_moderate_wertrechner_review(UUID, TEXT, TEXT) TO authenticated;

-- =============================================================================
-- 10) PII Cleanup (cron, 30-day retention on ip_hash + user_agent)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_wertrechner_review_pii()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_updated INT;
BEGIN
  UPDATE public.wertrechner_reviews
  SET
    ip_hash = NULL,
    user_agent = NULL
  WHERE created_at < NOW() - INTERVAL '30 days'
    AND (ip_hash IS NOT NULL OR user_agent IS NOT NULL);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION public.cleanup_wertrechner_review_pii IS
  'SECURITY DEFINER: cron-triggered daily. Nulls ip_hash and user_agent on reviews older than 30 days (GDPR data minimization). Does NOT delete the review itself.';

REVOKE ALL ON FUNCTION public.cleanup_wertrechner_review_pii() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_wertrechner_review_pii() TO service_role;

-- Daily at 01:30 UTC (03:30 Berlin CEST / 02:30 CET). Unschedule prior variants
-- to make this migration idempotent.
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-wertrechner-review-pii') THEN
    PERFORM cron.unschedule('cleanup-wertrechner-review-pii');
  END IF;
  PERFORM cron.schedule(
    'cleanup-wertrechner-review-pii',
    '30 1 * * *',
    'SELECT public.cleanup_wertrechner_review_pii();'
  );
END
$cron$;
