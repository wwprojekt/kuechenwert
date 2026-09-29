-- ============================================================================
-- Google Ads: Firmenname, Logo und Bild-Assets automatisch nachholen
-- ============================================================================
--
-- Der Kampagnenplan (supabase/functions/_shared/google-ads-plan.ts) enthält
-- Firmenname, Logo und Bilder. Google lässt sie erst zu, wenn die Überprüfung
-- des Werbetreibenden abgeschlossen ist (Firmenname, Logo) bzw. das Konto
-- mindestens 60 Tage alt ist und Search-Ausgaben hat (Bilder). Bis dahin
-- lehnt Google die Pakete „brand“ und „images“ ab (CUSTOMER_NOT_VERIFIED,
-- UNSUPPORTED_FIELD_TYPE), die Function antwortet mit { ok: false } und
-- HTTP 200, es passiert nichts.
--
-- Dieser Cron versucht beide Pakete täglich; sobald Google sie annimmt,
-- werden sie verknüpft. Das Hauptpaket (Anzeigen, Keywords, Sitelinks …)
-- wird hier nie angefasst, es bleibt eine bewusste manuelle Ausführung.
-- ============================================================================

do $$
begin
  if exists (select 1 from cron.job where jobname = 'kw-gads-assets-catchup') then
    perform cron.unschedule('kw-gads-assets-catchup');
  end if;
end $$;

select cron.schedule('kw-gads-assets-catchup', '15 6 * * *', $cmd$
  select net.http_post(
    url := 'https://gzqayoalwtmypndrmqes.supabase.co/functions/v1/kw-google-ads',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-kw-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'kw_cron_secret')),
    body := '{"action":"campaigns","mode":"apply","batches":["brand","images"]}'::jsonb,
    timeout_milliseconds := 120000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'kw_cron_secret');
$cmd$);
