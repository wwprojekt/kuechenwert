-- Grants fuer Funnel-C-Tabellen an service_role (Edge Functions).
--
-- Die Planner-Tabellen wurden in 20260429000100_kw_lead_funnel_schema.sql
-- angelegt, aber es fehlten die expliziten GRANTs fuer service_role. Ohne
-- diese Grants wirft PostgREST beim Aufruf aus den Edge Functions
-- "permission denied for table planner_sessions".
--
-- Diese Migration gibt der service_role volle CRUD-Rechte auf die Funnel-C-
-- Tabellen + Lesen von kitchen_price_brackets (Preis-Range-Berechnung).
-- RLS greift dabei weiterhin nicht fuer service_role.

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.planner_sessions     TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.planner_renders      TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.planner_rate_limits  TO service_role;
GRANT SELECT                          ON TABLE public.kitchen_price_brackets TO service_role;

-- Auch Lead-Insert aus Edge Functions (kw-planner-submit-lead)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.leads       TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lead_files  TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

GRANT EXECUTE ON FUNCTION public.planner_rate_limit_increment(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.planner_rate_limits_cleanup(integer)                 TO service_role;
