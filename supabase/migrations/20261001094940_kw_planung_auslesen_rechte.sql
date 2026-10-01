-- Triggerfunktion kw_lead_files_after_insert (20261001094902) wie die übrigen
-- Triggerfunktionen nur für postgres und service_role ausführbar; Trigger
-- prüfen EXECUTE nur beim Anlegen, nicht beim Auslösen.

revoke all on function public.kw_lead_files_after_insert() from public, anon, authenticated;
grant execute on function public.kw_lead_files_after_insert() to service_role;
