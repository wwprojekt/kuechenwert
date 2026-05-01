-- Erlaube eingeloggten Usern, ihre eigenen planner_sessions zu lesen.
-- Verknuepfung: planner_sessions.lead_id -> leads.user_id = auth.uid().
-- Ohne diese Policy sehen Customers ihre Traumkueche-Renders im
-- Dashboard nicht (nur admin hatte bis jetzt SELECT).
--
-- Zusammen mit "Leads: user reads own" (bereits aktiv) baut das den
-- "Meine Küchen-Journey"-Block im Customer-Dashboard.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'PlannerSessions: user reads own'
      AND polrelid = 'public.planner_sessions'::regclass
  ) THEN
    CREATE POLICY "PlannerSessions: user reads own" ON public.planner_sessions
      FOR SELECT
      TO authenticated
      USING (
        lead_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.leads l
          WHERE l.id = planner_sessions.lead_id
            AND l.user_id = auth.uid()
        )
      );
  END IF;
END $$;
