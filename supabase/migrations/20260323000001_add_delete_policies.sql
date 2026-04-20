-- Add missing DELETE policies for admin users
-- These are needed for the delete functionality added to the admin dashboard
--
-- 2026-04-20: Wrapped each policy block in a `to_regclass` guard so the
-- migration can be re-applied on environments where some of the originally
-- referenced tables (quick_leads, vehicle_questions) have already been
-- dropped by a later migration.

DO $$
BEGIN
  -- Error Logs
  IF to_regclass('public.error_logs') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can delete error logs" ON public.error_logs';
    EXECUTE $POL$
      CREATE POLICY "Admins can delete error logs" ON public.error_logs
        FOR DELETE TO authenticated
        USING (EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'::app_role
        ))
    $POL$;
  END IF;

  -- Wizard Sessions (Leads)
  IF to_regclass('public.wizard_sessions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can delete wizard sessions" ON public.wizard_sessions';
    EXECUTE $POL$
      CREATE POLICY "Admins can delete wizard sessions" ON public.wizard_sessions
        FOR DELETE TO authenticated
        USING (EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'::app_role
        ))
    $POL$;
  END IF;

  -- Quick Leads (table dropped 20260416222220 — guard required)
  IF to_regclass('public.quick_leads') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can delete quick leads" ON public.quick_leads';
    EXECUTE $POL$
      CREATE POLICY "Admins can delete quick leads" ON public.quick_leads
        FOR DELETE TO authenticated
        USING (EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'::app_role
        ))
    $POL$;
  END IF;

  -- Contact Messages
  IF to_regclass('public.contact_messages') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can delete contact messages" ON public.contact_messages';
    EXECUTE $POL$
      CREATE POLICY "Admins can delete contact messages" ON public.contact_messages
        FOR DELETE TO authenticated
        USING (EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'::app_role
        ))
    $POL$;
  END IF;

  -- Vehicle Questions
  IF to_regclass('public.vehicle_questions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can delete vehicle questions" ON public.vehicle_questions';
    EXECUTE $POL$
      CREATE POLICY "Admins can delete vehicle questions" ON public.vehicle_questions
        FOR DELETE TO authenticated
        USING (EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'::app_role
        ))
    $POL$;
  END IF;

  -- Auctions
  IF to_regclass('public.auctions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can delete auctions" ON public.auctions';
    EXECUTE $POL$
      CREATE POLICY "Admins can delete auctions" ON public.auctions
        FOR DELETE TO authenticated
        USING (EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'::app_role
        ))
    $POL$;
  END IF;

  -- Bids (needed when deleting auctions with bids)
  IF to_regclass('public.bids') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can delete bids" ON public.bids';
    EXECUTE $POL$
      CREATE POLICY "Admins can delete bids" ON public.bids
        FOR DELETE TO authenticated
        USING (EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'::app_role
        ))
    $POL$;
  END IF;

  -- Profiles (needed for admin user deletion)
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles';
    EXECUTE $POL$
      CREATE POLICY "Admins can delete profiles" ON public.profiles
        FOR DELETE TO authenticated
        USING (EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'::app_role
        ))
    $POL$;
  END IF;

  -- Admin Emails (needed for email management)
  IF to_regclass('public.admin_emails') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can delete admin emails" ON public.admin_emails';
    EXECUTE $POL$
      CREATE POLICY "Admins can delete admin emails" ON public.admin_emails
        FOR DELETE TO authenticated
        USING (EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'::app_role
        ))
    $POL$;
  END IF;
END $$;
