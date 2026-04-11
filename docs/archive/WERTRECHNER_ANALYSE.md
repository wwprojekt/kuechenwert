# Wertrechner Analyse - Visuell + Funktional

## Aktuelle Probleme

### Visuell
- Hero-Bereich hat zu viel Leerraum, wirkt leer
- Fortschrittsbalken ist zu dünn und unauffällig (h-2), keine Step-Indikatoren
- Karte hat nur einfachen Border, wirkt flach und langweilig
- Optionen-Buttons sind nur Text mit Border, keine Icons, keine visuelle Differenzierung
- Kein Trust-Element im Formular selbst (Trust-Badges sind ganz unten im Footer)
- "Zurück" Button ist auf Schritt 1 sichtbar aber disabled - sieht kaputt aus
- Kein visueller Hinweis was in den nächsten Schritten kommt
- Progress zeigt "Schritt X von 5" als Text - keine visuelle Step-Leiste

### Funktional
- Keine Keyboard-Navigation (Enter zum Weiter)
- Hersteller-Feld ist Freitext statt Dropdown/Autocomplete - unprofessionell
- Kein Zurück-Schutz (Browser Back verliert alle Daten)
- Keine Zwischenspeicherung (Seite reload = alles weg)
- Baujahr ist Freitext-Number statt Dropdown (einfacher für User)
- Kilometerstand hat keine Formatierung (45000 statt 45.000)
- Keine Zusammenfassung der bisherigen Eingaben sichtbar während man weiter ausfüllt
- Auto-Proceed bei Schritt 1 und 4 aber nicht bei 2 und 3 - inkonsistent
- Keine Fehler-Animation bei Validierung
- Kein "Wert wird berechnet" Loading-State vor Kontaktformular

### Conversion-Probleme
- "Lieber eine professionelle Bewertung?" CTA unter dem Formular lenkt ab
- Kein Social Proof (z.B. "Über 5.000 Bewertungen durchgeführt")
- Keine Dringlichkeit/FOMO
- Trust-Badges (SSL, TÜV, 24h, Kostenlos) sind im Footer, nicht im Formular

## Verbesserungsplan

### Visuell
1. Step-Indikator mit Kreisen und Verbindungslinien statt nur Progress-Bar
2. Icons für Fahrzeugtypen (Wohnmobil-Silhouetten)
3. Karte mit Schatten und subtiler Gradient-Border
4. Trust-Badges direkt unter/im Formular
5. Social Proof Counter ("12.847 Bewertungen durchgeführt")
6. Bessere Animations/Transitions zwischen Steps
7. Zurück-Button nur anzeigen wenn step > 1

### Funktional
1. Hersteller als Dropdown mit den gängigsten Marken + "Sonstige" Freitext
2. Baujahr als Dropdown (aktuelles Jahr bis 1980)
3. Kilometerstand mit Tausender-Formatierung
4. Enter-Taste zum Weiter
5. Fake-Berechnung-Animation (2-5 Sek) mit Fortschrittsbalken und Statusmeldungen
6. Session Storage für Zwischenspeicherung
7. Mini-Zusammenfassung der bisherigen Eingaben

### Conversion
1. Trust-Badges im Formular
2. Social Proof
3. Micro-Commitments (kleine Häkchen bei jedem abgeschlossenen Schritt)
