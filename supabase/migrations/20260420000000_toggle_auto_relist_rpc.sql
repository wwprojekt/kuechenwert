-- Bug-fix #2 (Critical): replace over-permissive RLS policy
-- "Seller can toggle auto_relist" with a column-scoped SECURITY DEFINER RPC.
--
-- The previous policy granted UPDATE on the entire auctions row whenever the
-- caller owned the underlying motorhome AND the auction was in 'kaufchance'
-- OR ('active' AND sale_channel = 'instant_price'). RLS controls row access,
-- not which columns the row is allowed to mutate, so a malicious seller could
-- set reserve_price = 1, end_time = now(), current_bid = 99999, etc. via the
-- public anon client.
--
-- New design:
--   1. Drop the seller UPDATE policy on auctions completely. Only admins
--      retain UPDATE through "Admins can manage all auctions".
--   2. Expose a single SECURITY DEFINER function toggle_auto_relist that
--      writes ONLY the auto_relist column after verifying ownership,
--      auction status, and listing channel.
--   3. Anon clients call .rpc('toggle_auto_relist', ...) instead of .update().
--
-- The function returns the new auto_relist value so the frontend can use it
-- for optimistic UI without a follow-up SELECT.

DROP POLICY IF EXISTS "Seller can toggle auto_relist" ON public.auctions;

CREATE OR REPLACE FUNCTION public.toggle_auto_relist(
  p_auction_id uuid,
  p_value boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_seller uuid;
  v_status text;
  v_channel text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Anmeldung erforderlich' USING ERRCODE = '42501';
  END IF;

  IF p_value IS NULL THEN
    RAISE EXCEPTION 'auto_relist darf nicht NULL sein' USING ERRCODE = '22004';
  END IF;

  SELECT m.seller_id, a.status::text, m.sale_channel
    INTO v_seller, v_status, v_channel
    FROM public.auctions a
    JOIN public.motorhomes m ON m.id = a.motorhome_id
   WHERE a.id = p_auction_id;

  IF v_seller IS NULL THEN
    RAISE EXCEPTION 'Auktion nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  IF v_seller <> v_caller THEN
    -- Admins go through the standard admin policy + direct UPDATE; this RPC
    -- is exclusively for sellers managing their own listing.
    RAISE EXCEPTION 'Sie sind nicht der Verkäufer dieses Inserats' USING ERRCODE = '42501';
  END IF;

  -- Mirror the previous policy semantics: toggle is only allowed while the
  -- listing can still be auto-extended / auto-relisted.
  IF NOT (
    v_status = 'kaufchance'
    OR (v_status = 'active' AND v_channel = 'instant_price')
  ) THEN
    RAISE EXCEPTION
      'Auto-Relist kann nur in der Kaufchance-Phase oder bei aktiven Festpreis-Inseraten umgeschaltet werden'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.auctions
     SET auto_relist = p_value,
         updated_at  = now()
   WHERE id = p_auction_id;

  RETURN p_value;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_auto_relist(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.toggle_auto_relist(uuid, boolean) TO authenticated;

COMMENT ON FUNCTION public.toggle_auto_relist(uuid, boolean) IS
  'Sicheres Toggle für auto_relist auf eigenen Auktionen. Ersetzt die Spalten-unspezifische RLS-Policy "Seller can toggle auto_relist", die einem Verkäufer Schreibzugriff auf alle Spalten der Auktion gegeben hätte.';
