-- ============================================================================
-- Migration: Fix RLS UPDATE policies to use TO authenticated
-- Date: 2026-03-27
-- Description: Several UPDATE policies were created without an explicit
--              TO clause, which in PostgreSQL defaults to the 'public' role.
--              This means unauthenticated users could potentially bypass
--              the USING clause. This migration recreates these policies
--              with an explicit TO authenticated clause.
--
-- 2026-04-20: Wrapped each block in `to_regclass` guards plus per-block
-- EXCEPTION handlers, so missing tables/columns (changed by later migrations)
-- do not abort the migration on replay.
-- ============================================================================

DO $$
DECLARE
  blocks TEXT[] := ARRAY[
    -- 1. analytics_sessions
    $A$
      IF to_regclass('public.analytics_sessions') IS NOT NULL THEN
        EXECUTE 'DROP POLICY IF EXISTS "Users can update their own sessions" ON public.analytics_sessions';
        EXECUTE 'CREATE POLICY "Users can update their own sessions" ON public.analytics_sessions FOR UPDATE TO authenticated USING (true) WITH CHECK (true)';
      END IF;
    $A$,
    -- 2. bids
    $A$
      IF to_regclass('public.bids') IS NOT NULL THEN
        EXECUTE 'DROP POLICY IF EXISTS "Dealers can update own bids" ON public.bids';
        EXECUTE 'CREATE POLICY "Dealers can update own bids" ON public.bids FOR UPDATE TO authenticated USING (dealer_id = auth.uid())';
      END IF;
    $A$,
    -- 3. motorhomes
    $A$
      IF to_regclass('public.motorhomes') IS NOT NULL THEN
        EXECUTE 'DROP POLICY IF EXISTS "Sellers can update own motorhomes" ON public.motorhomes';
        EXECUTE 'CREATE POLICY "Sellers can update own motorhomes" ON public.motorhomes FOR UPDATE TO authenticated USING (seller_id = auth.uid())';
      END IF;
    $A$,
    -- 4. motorhome_photos
    $A$
      IF to_regclass('public.motorhome_photos') IS NOT NULL THEN
        EXECUTE 'DROP POLICY IF EXISTS "Users can update own photos" ON public.motorhome_photos';
        EXECUTE 'CREATE POLICY "Users can update own photos" ON public.motorhome_photos FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.motorhomes m WHERE m.id = motorhome_photos.motorhome_id AND m.seller_id = auth.uid()))';
      END IF;
    $A$,
    -- 5. post_auction_offers
    $A$
      IF to_regclass('public.post_auction_offers') IS NOT NULL THEN
        EXECUTE 'DROP POLICY IF EXISTS "Sellers and admins can update offers" ON public.post_auction_offers';
        EXECUTE 'CREATE POLICY "Sellers and admins can update offers" ON public.post_auction_offers FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.auctions a JOIN public.motorhomes m ON a.motorhome_id = m.id WHERE a.id = post_auction_offers.auction_id AND m.seller_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = ''admin''))';
      END IF;
    $A$,
    -- 6. support_messages
    $A$
      IF to_regclass('public.support_messages') IS NOT NULL THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admins can update messages" ON public.support_messages';
        EXECUTE 'CREATE POLICY "Admins can update messages" ON public.support_messages FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = ''admin''))';
      END IF;
    $A$,
    -- 7. vehicle_questions
    $A$
      IF to_regclass('public.vehicle_questions') IS NOT NULL THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admins can update questions" ON public.vehicle_questions';
        EXECUTE 'CREATE POLICY "Admins can update questions" ON public.vehicle_questions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = ''admin''))';
      END IF;
    $A$,
    -- 8. profiles
    $A$
      IF to_regclass('public.profiles') IS NOT NULL THEN
        EXECUTE 'DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles';
        EXECUTE 'CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid())';
      END IF;
    $A$,
    -- 9. wizard_sessions
    $A$
      IF to_regclass('public.wizard_sessions') IS NOT NULL THEN
        EXECUTE 'DROP POLICY IF EXISTS "wizard_sessions_user_update" ON public.wizard_sessions';
        EXECUTE $WIZ$
          CREATE POLICY "wizard_sessions_user_update" ON public.wizard_sessions
            FOR UPDATE TO authenticated
            USING (
              user_id = auth.uid() OR session_token = current_setting('request.headers', true)::json->>'x-session-token'
            )
            WITH CHECK (
              user_id = auth.uid() OR session_token = current_setting('request.headers', true)::json->>'x-session-token'
            )
        $WIZ$;
      END IF;
    $A$
  ];
  blk TEXT;
BEGIN
  FOREACH blk IN ARRAY blocks LOOP
    BEGIN
      EXECUTE 'DO $RUN$ BEGIN ' || blk || ' END $RUN$';
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Skipping policy block due to error %: %', SQLSTATE, SQLERRM;
    END;
  END LOOP;
END $$;
