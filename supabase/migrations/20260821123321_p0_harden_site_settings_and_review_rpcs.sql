-- P0: Lock site_settings secrets + restrict Google-review RPCs.
-- Production still had SELECT USING (true) on site_settings (smtp_password,
-- openai_api_key, bank details). Public UI must use public_site_settings.
-- Google-review enqueue/claim were SECURITY DEFINER and executable by anon.

-- ---------------------------------------------------------------------------
-- 1) site_settings: admin-only table access
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.site_settings FROM anon;
REVOKE ALL ON TABLE public.site_settings FROM PUBLIC;
REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.site_settings FROM authenticated;

GRANT SELECT, UPDATE ON TABLE public.site_settings TO authenticated;
GRANT ALL ON TABLE public.site_settings TO service_role;

DROP POLICY IF EXISTS "Anyone can view site settings" ON public.site_settings;

DROP POLICY IF EXISTS "Admins can view site settings" ON public.site_settings;
CREATE POLICY "Admins can view site settings"
  ON public.site_settings
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Owner-security view stays readable by anon/authenticated (no secrets).
GRANT SELECT ON TABLE public.public_site_settings TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Google-review RPCs: admin or service_role only (except token-based)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_google_review_for_email(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_email TEXT := lower(trim(COALESCE(p_email, '')));
  v_id UUID;
  v_status TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF v_email = '' OR v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'invalid_email_format';
  END IF;
  IF EXISTS (SELECT 1 FROM public.email_suppressions s WHERE lower(s.email) = v_email) THEN
    RAISE EXCEPTION 'suppressed';
  END IF;
  SELECT id, delivery_status INTO v_id, v_status
  FROM public.google_review_requests
  WHERE lower(email) = v_email
  LIMIT 1;
  IF v_id IS NOT NULL THEN
    UPDATE public.google_review_requests
    SET delivery_status = 'queued', sent_at = NULL, delivery_error = NULL, scheduled_for = NOW()
    WHERE id = v_id;
    RETURN jsonb_build_object('id', v_id, 'created', false, 'previous_status', v_status);
  END IF;
  INSERT INTO public.google_review_requests (email, recipient_name, source, source_first_seen_at)
  VALUES (v_email, NULL, 'admin_test', NOW())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'created', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_google_review_batch(p_limit integer DEFAULT 50)
RETURNS TABLE(id uuid, email text, recipient_name text, unsubscribe_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_limit INT := GREATEST(LEAST(COALESCE(p_limit, 50), 500), 1);
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

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
$function$;

REVOKE ALL ON FUNCTION public.enqueue_google_review_for_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_google_review_for_email(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.claim_google_review_batch(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_google_review_batch(integer) TO service_role;

REVOKE ALL ON FUNCTION public.get_google_review_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_google_review_stats() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.mark_google_review_failed(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_google_review_failed(uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.mark_google_review_delivered(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_google_review_delivered(text, text) TO service_role;

REVOKE ALL ON FUNCTION public.webhook_mark_google_review_delivered(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.webhook_mark_google_review_delivered(text) TO service_role;

-- ---------------------------------------------------------------------------
-- 3) Pause broken Google-review cron (edge function was deleted in Phase 2.3a)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT jobid FROM cron.job WHERE jobname = 'send-google-review-batch'
  LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
  WHEN undefined_function THEN
    NULL;
END $$;

COMMENT ON FUNCTION public.enqueue_google_review_for_email(text) IS
  'Admin/service-role only. Queues a single Google-review request. DEFINER needed to write the queue table.';
COMMENT ON FUNCTION public.claim_google_review_batch(integer) IS
  'Service-role only. Claims a send batch. DEFINER needed to update queued rows atomically.';
