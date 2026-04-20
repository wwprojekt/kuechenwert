-- =============================================
-- Fix: approve_dealer_application RPC
-- Problem: account_type blieb 'private' nach Händler-Approval
--          dealer_levels wurde nicht erstellt
-- Fix: Setzt account_type = 'business' und erstellt Bronze dealer_level
-- =============================================

-- Aktualisierte RPC-Funktion
CREATE OR REPLACE FUNCTION public.approve_dealer_application(application_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  app_record RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  SELECT * INTO app_record
  FROM public.dealer_applications
  WHERE id = application_id_param;

  IF app_record IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  -- 1. Application status auf approved setzen
  UPDATE public.dealer_applications
  SET status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
  WHERE id = application_id_param;

  -- 2. User role auf dealer setzen
  DELETE FROM public.user_roles WHERE user_id = app_record.user_id;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (app_record.user_id, 'dealer')
  ON CONFLICT (user_id) DO UPDATE SET role = 'dealer';

  -- 3. NEU: Profil account_type auf business setzen
  UPDATE public.profiles
  SET account_type = 'business'
  WHERE id = app_record.user_id;

  -- 4. NEU: Initialen Bronze dealer_level erstellen (wenn noch nicht vorhanden)
  INSERT INTO public.dealer_levels (dealer_id, level, total_bids, won_auctions, total_volume, points)
  VALUES (app_record.user_id, 'bronze', 0, 0, 0, 0)
  ON CONFLICT (dealer_id) DO NOTHING;
END;
$$;

-- Bestehende Händler korrigieren: account_type auf business setzen
UPDATE profiles
SET account_type = 'business'
WHERE id IN (SELECT user_id FROM user_roles WHERE role = 'dealer')
  AND (account_type IS NULL OR account_type != 'business');

-- Fehlende dealer_levels Bronze-Einträge für bestehende Händler erstellen
INSERT INTO dealer_levels (dealer_id, level, total_bids, won_auctions, total_volume, points)
SELECT ur.user_id, 'bronze', 0, 0, 0, 0
FROM user_roles ur
WHERE ur.role = 'dealer'
  AND ur.user_id NOT IN (SELECT dealer_id FROM dealer_levels)
ON CONFLICT (dealer_id) DO NOTHING;
