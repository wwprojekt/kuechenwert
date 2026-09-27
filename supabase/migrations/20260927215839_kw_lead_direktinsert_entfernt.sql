-- Leads entstehen nur noch über die Edge Functions kw-lead, kw-lead-b und
-- kw-planner (Turnstile, Rate-Limit, Lead und Einwilligung in einer
-- Transaktion). Direkte Inserts mit dem öffentlichen Schlüssel oder einem
-- beliebigen Konto umgingen diese Prüfungen.
-- Funnel-B-Dateien kommen über signierte Upload-URLs, die keine
-- Insert-Policy auf storage.objects brauchen.

drop policy if exists "Leads: anon insert via funnel" on public.leads;
drop policy if exists "Leads: authenticated insert own" on public.leads;
drop policy if exists "LeadFiles: anon/auth insert" on public.lead_files;
drop policy if exists "LeadFiles Storage: funnel upload" on storage.objects;

drop function if exists public.kw_lead_accepts_uploads(uuid);

revoke insert on public.leads, public.lead_files, public.lead_consents from anon;
