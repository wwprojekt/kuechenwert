
-- Public function that returns platform stats without RLS restrictions
-- Used by /haendler and /wohnmobil-haendler-werden pages for social proof
CREATE OR REPLACE FUNCTION public.get_public_platform_stats()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(
    'active_auctions', (SELECT count(*) FROM auctions WHERE status = 'active'),
    'sold_auctions', (SELECT count(*) FROM auctions WHERE status = 'sold'),
    'approved_dealers', (SELECT count(*) FROM dealer_applications WHERE status = 'approved'),
    'total_motorhomes', (SELECT count(*) FROM motorhomes WHERE status != 'draft'),
    'ending_soon', (SELECT count(*) FROM auctions WHERE status = 'active' AND end_time <= (now() + interval '24 hours')),
    'unique_brands', (SELECT count(DISTINCT manufacturer) FROM motorhomes WHERE status != 'draft' AND manufacturer IS NOT NULL)
  );
$$;

-- Allow anonymous access
GRANT EXECUTE ON FUNCTION public.get_public_platform_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_platform_stats() TO authenticated;
