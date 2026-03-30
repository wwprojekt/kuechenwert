-- Create update_max_wizard_step RPC function
CREATE OR REPLACE FUNCTION public.update_max_wizard_step(
  p_lead_id UUID,
  p_step INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE quick_leads
  SET max_wizard_step = GREATEST(COALESCE(max_wizard_step, 0), p_step),
      updated_at = NOW()
  WHERE id = p_lead_id;
END;
$$;

-- Grant execute to authenticated and anon
GRANT EXECUTE ON FUNCTION public.update_max_wizard_step(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_max_wizard_step(UUID, INTEGER) TO anon;
