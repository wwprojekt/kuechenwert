-- ============================================================================
-- UX-Alerts an den neuen Funnel C anpassen (30.09.2026)
--
-- Seit 20260930081500 sieht niemand die KI-Visualisierung vor der
-- Kontakterfassung: Planungen mit fertigem Bild ohne Lead sind Abbrüche an
-- den Lead-Fragen, „visualisierung“ ist nur noch der Lade-Bildschirm (4,5 s)
-- und der erste Schritt ist die Küchenform statt Foto und Maße. Nur Titel und
-- „Was tun?“-Texte in kw_ux_detect_alerts() ändern sich, die Erkennung nicht.
-- Die Funktion wird aus ihrer eigenen Definition neu angelegt; fehlt ein
-- alter Text, bricht die Migration ab.
-- ============================================================================

do $$
declare
  v_def text := pg_get_functiondef('public.kw_ux_detect_alerts()'::regprocedure);
  v_pairs text[][] := array[
    array[
      '''KI-Bilder ohne Anfrage''',
      '''Visualisierung ohne Kontakt'''
    ],
    array[
      '''Wer sein KI-Bild sieht, fragt kaum an: „Angebote erhalten“ direkt unter dem Bild anbieten, Preisrahmen und Nutzen (kostenlos, unverbindlich, geprüfte Studios) daneben zeigen und den Kontaktschritt kurz halten.''',
      '''Das Bild ist fertig, aber Name, E-Mail oder Telefon fehlen: In der Funnel-Auswertung prüfen, bei welcher Lead-Frage (Angebote, Zeitrahmen, Name, Kontakt) abgebrochen wird, und dort kürzen oder den Nutzen am Button klarer nennen.'''
    ],
    array[
      '''Nach dem KI-Bild fehlt der Anstoß: „Angebote erhalten“ prominent unter dem Bild, Preisrahmen und nächste Schritte zeigen, Wartezeit beim Erzeugen überbrücken.''',
      '''Abbruch auf dem Lade-Bildschirm: Er wechselt nach 4,5 Sekunden von selbst zu den Lead-Fragen. Steigt der Wert, Ladezeit und Fehler beim Start der Visualisierung prüfen (Admin → KI & Preis-Engine).'''
    ],
    array[
      '''Der Einstieg wirkt aufwendig: Foto als freiwillig kennzeichnen, Maße vorbelegt lassen und „ohne Foto weiter“ betonen.''',
      '''Schon die erste Frage (Küchenform) verliert Besucher: Anzeige, Landingpage und Ladezeit passen vermutlich nicht zusammen.'''
    ]
  ];
  v_pair text[];
begin
  if strpos(v_def, '''Visualisierung ohne Kontakt''') > 0 then
    return;
  end if;
  foreach v_pair slice 1 in array v_pairs loop
    if strpos(v_def, v_pair[1]) = 0 then
      raise exception 'kw_ux_detect_alerts wurde zwischenzeitlich geändert – Text nicht gefunden: %', left(v_pair[1], 60);
    end if;
    v_def := replace(v_def, v_pair[1], v_pair[2]);
  end loop;
  execute v_def;
end $$;
