-- ============================================================================
-- Datenschutzerklärung: Google Ads Remarketing (29.09.2026)
--
-- Abschnitt 7 („Werbung und Erfolgsmessung“) ergänzt: Mit Marketing-
-- Einwilligung meldet das Google-Tag Seitenaufrufe an Google Ads, daraus
-- entstehen Remarketing-Listen (google-ads-plan.ts: alle Besucher, Planer,
-- Formular und KüchenRechner ohne Anfrage, Anfrage gesendet; höchstens
-- 540 Tage). Der Cookie-Banner nennt diesen Zweck bereits („ermöglicht
-- Werbung auf anderen Websites“), bestehende Einwilligungen gelten weiter.
-- Bricht ab, wenn der Text zwischenzeitlich geändert wurde.
-- ============================================================================

do $$
declare
  v_old text := 'um zu erkennen, welche Anzeige zu welcher Anfrage geführt hat.</p>';
  v_new text := 'um zu erkennen, welche Anzeige zu welcher Anfrage geführt hat.</p>'
    || '<p>Außerdem nutzen wir <strong>Google Ads Remarketing</strong>: Das Google-Tag meldet Google, welche unserer Seiten Sie aufrufen, etwa den Küchenplaner, den KüchenRechner oder die Bestätigung nach einer Anfrage. Daraus entstehen Zielgruppen, mit denen wir Anzeigen und Gebote in der Google-Suche auf frühere Besucher abstimmen und Ihnen gegebenenfalls Anzeigen von KüchenWert auf anderen Websites zeigen. Google erkennt Sie dabei an einer Online-Kennung in einem Cookie; Ihren Namen oder Ihre Kontaktdaten erhält Google hierfür nicht. Die Zugehörigkeit zu einer Zielgruppe endet spätestens nach 540 Tagen. Personalisierte Werbung von Google können Sie zusätzlich in Ihren Google-Einstellungen unter myadcenter.google.com abschalten.</p>';
  v_content text;
begin
  select content into v_content from public.legal_pages where slug = 'datenschutz';
  if v_content is null then
    raise exception 'Datenschutzerklärung fehlt';
  end if;
  if strpos(v_content, 'Google Ads Remarketing') > 0 then
    return;
  end if;
  if strpos(v_content, v_old) = 0 then
    raise exception 'Datenschutzerklärung wurde zwischenzeitlich geändert – Ersetzung abgebrochen';
  end if;
  update public.legal_pages
     set content = replace(v_content, v_old, v_new),
         updated_at = now(),
         published_at = now(),
         version = version + 1
   where slug = 'datenschutz';
end $$;
