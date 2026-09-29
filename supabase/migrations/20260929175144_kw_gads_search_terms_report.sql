-- ============================================================================
-- Google Ads: Wochenbericht der Suchbegriffe per Mail
-- ============================================================================
--
-- Montags 06:30 UTC ruft der Cron kw-google-ads { action: "search-terms-report" }
-- auf: Suchbegriffe der letzten 7 Tage mit Kosten und Conversions, Vorschläge
-- für Ausschlüsse (keine Conversion, ab 3 Klicks oder 10 €) und für neue
-- Keywords (mit Conversion, noch kein Keyword), an die Betreiber-Adresse.
-- Übernommen wird nichts automatisch, Änderungen laufen über google-ads-plan.ts.
-- admin_emails (email_type gads_search_terms_report) sperrt doppelte Mails
-- desselben Laufs für 20 Stunden.
--
-- Außerdem: Die Standard-Absender von admin_emails stammten noch aus dem
-- CaravanWert-Fork. Alle Functions setzen den Absender selbst; die Standards
-- zeigen trotzdem auf KüchenWert, damit keine Zeile mit fremder Marke entsteht.
-- ============================================================================

alter table public.admin_emails alter column sender_email set default 'info@kuechenwert24.de';
alter table public.admin_emails alter column sender_name set default 'KüchenWert';

do $$
begin
  if exists (select 1 from cron.job where jobname = 'kw-gads-search-terms-report') then
    perform cron.unschedule('kw-gads-search-terms-report');
  end if;
end $$;

select cron.schedule('kw-gads-search-terms-report', '30 6 * * 1', $cmd$
  select net.http_post(
    url := 'https://gzqayoalwtmypndrmqes.supabase.co/functions/v1/kw-google-ads',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-kw-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'kw_cron_secret')),
    body := '{"action":"search-terms-report"}'::jsonb,
    timeout_milliseconds := 120000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'kw_cron_secret');
$cmd$);
