-- ============================================================================
-- Datenschutzerklärung: KI-Visualisierung und lernende Preisschätzung (28.09.2026)
--
-- Abschnitt 4 (Traumküchen-Planer) ergänzt um
--   - die Bildmodelle verschiedener Hersteller hinter fal.ai (Hauptmodell,
--     Ausweichmodell bei Störungen, A/B-Vergleich),
--   - Bewertungen einer Visualisierung (Qualitätsvergleich der Modelle),
--   - die freiwillige Einwilligung, Raumfotos ohne Kontaktdaten zur
--     Verbesserung der KI zu speichern (36 Monate, Widerruf auf der Projektseite),
--   - den statistischen Abgleich der Preisschätzung mit Studio-Angeboten.
-- Bricht ab, wenn der Text zwischenzeitlich geändert wurde.
-- ============================================================================

do $$
declare
  v_old_models text := 'das daraus die Visualisierung Ihrer neuen Küche erzeugt.';
  v_new_models text := 'das daraus die Visualisierung Ihrer neuen Küche erzeugt. fal.ai nutzt dafür Bildmodelle verschiedener Hersteller (etwa Google, Black Forest Labs oder Alibaba), die das Foto zur Bilderzeugung verarbeiten; welches Modell eine Visualisierung erzeugt, wählen wir nach Qualität und Verfügbarkeit.';
  v_old_photos text := 'Planungen, aus denen keine Anfrage wird, 30 Tage nach der letzten Änderung.</p>';
  v_new_photos text := 'Planungen, aus denen keine Anfrage wird, 30 Tage nach der letzten Änderung. Wenn Sie eine Visualisierung bewerten, speichern wir die Bewertung mit der Visualisierung, um die Qualität der Bildmodelle zu vergleichen (Art. 6 Abs. 1 lit. f DSGVO).</p>'
    || '<p><strong>Verbesserung der KI (freiwillig):</strong> Wenn Sie beim Absenden zustimmen, speichern wir eine Kopie Ihrer Raumfotos zusammen mit Ihrer Planung und Ihren Bewertungen – ohne Namen und Kontaktdaten – getrennt von Ihrer Anfrage. Damit prüfen und verbessern wir die Visualisierung, etwa durch Modellvergleiche und das Training eigener Bildmodelle; dafür können die Daten an Auftragsverarbeiter wie fal.ai übermittelt werden. Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Die Kopien löschen wir nach spätestens 36 Monaten, bei Widerruf sofort. Widerrufen können Sie jederzeit auf Ihrer Projektseite oder formlos per E-Mail.</p>'
    || '<p><strong>Preisschätzung:</strong> Unsere Preisschätzungen im Planer und im Anfrageformular gleichen wir regelmäßig statistisch mit den Angeboten ab, die Küchenstudios auf der Plattform abgeben. Gespeichert werden nur zusammengefasste Faktoren je Formular, Qualitätsstufe und Postleitzahlregion (erste Ziffer), ohne Bezug zu einzelnen Personen (Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse sind realistische Preisangaben).</p>';
  v_content text;
begin
  select content into v_content from public.legal_pages where slug = 'datenschutz';
  if v_content is null then
    raise exception 'Datenschutzerklärung fehlt';
  end if;
  if strpos(v_content, v_old_models) = 0 or strpos(v_content, v_old_photos) = 0 then
    raise exception 'Datenschutzerklärung wurde zwischenzeitlich geändert – Ersetzung abgebrochen';
  end if;
  update public.legal_pages
     set content = replace(replace(v_content, v_old_models, v_new_models), v_old_photos, v_new_photos),
         updated_at = now(),
         published_at = now(),
         version = version + 1
   where slug = 'datenschutz';
end $$;
