
-- Function to clean up expired auth sessions (refresh token > 8 days old)
-- This prevents zombie sessions from causing Lock conflicts
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM auth.sessions 
  WHERE (refreshed_at IS NULL AND created_at < NOW() - INTERVAL '8 days')
     OR (refreshed_at IS NOT NULL AND refreshed_at < NOW() - INTERVAL '8 days'::interval);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log to audit
  IF deleted_count > 0 THEN
    INSERT INTO public.audit_logs (action, entity_type, details)
    VALUES ('cleanup_sessions', 'auth.sessions', 
            jsonb_build_object('deleted_count', deleted_count, 'threshold', '8 days'));
  END IF;
  
  RETURN deleted_count;
END;
$$;

-- Grant execute to service_role (for cron jobs)
GRANT EXECUTE ON FUNCTION public.cleanup_expired_sessions() TO service_role;
