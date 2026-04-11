
-- =============================================================================
-- FIX 5: Allow rejected dealers to re-apply
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reapply_dealer_application(application_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app_record RECORD;
BEGIN
  -- Must be the owning user
  SELECT * INTO app_record
  FROM public.dealer_applications
  WHERE id = application_id_param;

  IF app_record IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  IF app_record.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: can only reapply your own application';
  END IF;

  IF app_record.status != 'rejected' THEN
    RAISE EXCEPTION 'Can only reapply for rejected applications';
  END IF;

  -- Reset to pending
  UPDATE public.dealer_applications
  SET
    status = 'pending',
    rejection_reason = NULL,
    reviewed_at = NULL,
    reviewed_by = NULL
  WHERE id = application_id_param;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.reapply_dealer_application(UUID) TO authenticated;
