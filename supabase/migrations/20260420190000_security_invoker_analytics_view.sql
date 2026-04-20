-- ─────────────────────────────────────────────────────────────────────────
-- Security-Hardening: analytics_daily_summary auf SECURITY INVOKER stellen
-- ─────────────────────────────────────────────────────────────────────────
-- Problem (Supabase Linter "security_definer_view"):
--
-- Die View `public.analytics_daily_summary` aggregiert Daten aus
-- `analytics_sessions` + `analytics_page_views`. Beide Tabellen haben RLS
-- aktiviert mit Policies, die SELECT NUR für Admins erlauben:
--
--    "Admins can view all sessions"   ON analytics_sessions
--    "Admins can view all page views" ON analytics_page_views
--
-- Eine View in Postgres läuft per Default mit den Rechten ihres OWNERS
-- (hier: postgres). Das ist effektiv SECURITY DEFINER-Verhalten und
-- bypassed die RLS der Underlying-Tables. Da die View zudem
-- `GRANT SELECT TO anon, authenticated` hat, könnte JEDER anonyme
-- Besucher die aggregierten Daily-Stats lesen — entgegen der
-- ausdrücklichen Intent der RLS-Policies auf den Underlying-Tables.
--
-- Fix: SECURITY INVOKER aktivieren. Damit gilt für jede Abfrage die
-- Berechtigung des AUFRUFENDEN Users. Da die Underlying-Tables nur für
-- Admins SELECT-bar sind, wird die View damit automatisch
-- "admin-only" — was die ursprünglich beabsichtigte Berechtigung ist.
--
-- Postgres-Version-Anforderung:  ≥ 15  (Supabase nutzt 15+)
--
-- Auswirkung auf User: Keine. Die View wird im aktuellen Frontend-Code
-- gar nicht aufgerufen (nur in supabase/types.ts als generierter Typ).
-- Falls in Zukunft ein Admin-Dashboard die View nutzt, funktioniert sie
-- weiterhin — nur eben korrekt geschützt.
-- ─────────────────────────────────────────────────────────────────────────

ALTER VIEW public.analytics_daily_summary SET (security_invoker = true);

COMMENT ON VIEW public.analytics_daily_summary IS
  'Tagesweise Aggregation der Analytics-Daten. SECURITY INVOKER seit 2026-04-20: '
  'die RLS der Underlying-Tables (analytics_sessions, analytics_page_views) '
  'gilt auch für Abfragen über diese View. Effektiv: nur Admins können lesen.';
