-- KRITISCHER FIX (Production): anon und authenticated hatten keine
-- Table-Privileges auf public.leads, public.lead_files, public.planner_sessions
-- und public.lead_match_candidates. RLS-Policies waren zwar definiert,
-- aber Postgres prueft ZUERST die Table-Privileges -> jeder Funnel-Insert
-- von der Webseite aus (Funnel A + B) bekam '42501 permission denied'.
--
-- Funnel C ging als einziger durch, weil dort eine Edge Function mit
-- service_role den Insert macht.
--
-- Folge: 0 Leads in der Tabelle seit Launch. Dieser Fix repariert das.
-- RLS-Policies kuemmern sich um die Spezifik (welcher User darf was).
--
-- Verifiziert via curl + RLS-Simulation am 2026-05-11:
--   - anon  + Funnel-A POST -> 201 Created
--   - authenticated + INSERT mit user_id = auth.uid() -> erfolgreich
--   - authenticated + SELECT eigene leads -> erfolgreich

-- leads: anon darf via Funnel inserten, authenticated darf eigene leads
-- inserten + lesen (RLS-Policies bestehen bereits, siehe
-- 20260429000400_kw_lead_insert_policies.sql).
GRANT INSERT ON public.leads TO anon;
GRANT INSERT, SELECT ON public.leads TO authenticated;

-- lead_files: gleicher Hintergrund (Funnel C / Funnel B Anhaenge).
GRANT INSERT ON public.lead_files TO anon;
GRANT INSERT, SELECT ON public.lead_files TO authenticated;

-- planner_sessions: anon erstellt sie (Funnel C startet ohne Login),
-- authenticated darf eigene Sessions ueber lead-Join lesen
-- (Policy "PlannerSessions: user reads own" aus 20260501000100).
GRANT SELECT ON public.planner_sessions TO authenticated;

-- lead_match_candidates: die Policy "Leads: dealers read purchased full"
-- macht ein EXISTS auf dieser Tabelle. Postgres prueft Table-Privileges,
-- bevor RLS evaluiert wird. authenticated User die einen Lead inserten
-- (RETURNING ...) bekamen daher '42501 permission denied for table
-- lead_match_candidates'. RLS sorgt dafuer dass Dealers nur ihre eigenen
-- Match-Rows sehen (Policy "LeadMatches: dealer self read").
ALTER TABLE public.lead_match_candidates ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.lead_match_candidates TO authenticated;
