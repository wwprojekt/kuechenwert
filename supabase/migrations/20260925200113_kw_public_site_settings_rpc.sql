-- Öffentliche Site-Settings wieder lesbar machen.
--
-- Seit 20260821123321 ist site_settings nur für Admins lesbar (Secrets wie
-- smtp_password, openai_api_key, Bankdaten). Die View public_site_settings
-- läuft aber mit security_invoker=true und damit mit den Rechten des
-- Aufrufers → anon bekommt 401, eingeloggte Nicht-Admins 0 Zeilen. Folge:
-- Frontend und Structured Data liefen seitdem nur mit Fallback-Texten.
--
-- Eine Definer-View würde der Linter als Sicherheitsfehler melden; stattdessen
-- liefert eine Definer-Funktion genau die Spaltenliste der View.

create or replace function public.get_public_site_settings()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- DEFINER: site_settings ist nur für Admins lesbar; zurückgegeben werden
  -- ausschließlich die Spalten der View public_site_settings (keine Secrets).
  select to_jsonb(p)
  from public.public_site_settings p
  where p.id = '00000000-0000-0000-0000-000000000000';
$$;

revoke all on function public.get_public_site_settings() from public;
grant execute on function public.get_public_site_settings() to anon, authenticated, service_role;
