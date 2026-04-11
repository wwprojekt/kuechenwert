
-- Secure function to retrieve VAPID keys from vault for Edge Functions
CREATE OR REPLACE FUNCTION get_vapid_keys()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  pub text;
  priv text;
BEGIN
  SELECT decrypted_secret INTO pub FROM vault.decrypted_secrets WHERE name = 'VAPID_PUBLIC_KEY';
  SELECT decrypted_secret INTO priv FROM vault.decrypted_secrets WHERE name = 'VAPID_PRIVATE_KEY';
  
  IF pub IS NULL OR priv IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN jsonb_build_object('public_key', pub, 'private_key', priv);
END;
$$;

-- Only service_role should call this (Edge Functions use service_role)
REVOKE ALL ON FUNCTION get_vapid_keys() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_vapid_keys() TO service_role;
