# Wertrechner Redesign-Konzept

## Neuer Flow (6 Schritte + Lade-Animation)

### Schritt 1: Fahrzeugtyp (Karten mit Icons)
- Große Karten statt flache Buttons
- Jede Karte hat ein Emoji/Icon für den Fahrzeugtyp
- Auto-Proceed nach Auswahl (wie bisher)
- Animierter Übergang

### Schritt 2: Hersteller & Modell
- Hersteller als Dropdown mit den 25 gängigsten Marken + "Sonstige"
- Modell bleibt Freitext (zu viele Varianten)
- Optional, aber "verbessert die Genauigkeit" als Hinweis

### Schritt 3: Baujahr & Kilometerstand
- Baujahr als Dropdown (2026 bis 1980)
- Kilometerstand mit Tausender-Formatierung und "km" Suffix
- Beide Pflichtfelder

### Schritt 4: Zustand (Karten mit Beschreibung)
- Karten mit kurzem Beschreibungstext pro Zustand
- Auto-Proceed nach Auswahl

### LADE-ANIMATION (2-5 Sekunden)
- Fullscreen-Overlay in der Card
- Animierter Kreis-Fortschritt
- Wechselnde Statusmeldungen:
  1. "Fahrzeugdaten werden analysiert..." (0-30%)
  2. "Marktdaten werden abgeglichen..." (30-60%)
  3. "Vergleichbare Fahrzeuge werden gesucht..." (60-85%)
  4. "Wert wird berechnet..." (85-100%)
- Am Ende: Kurzer Checkmark-Animation, dann weiter zu Schritt 5

### Schritt 5: Kontaktdaten (Gate vor Ergebnis)
- "Ihr Ergebnis ist fertig!" mit Checkmark
- Verschwommene Wert-Vorschau (wie implementiert)
- Name, E-Mail, Telefon (alle Pflicht)
- Trust-Badges unter dem Formular
- CTA: "Wert jetzt anzeigen"

### Schritt 6: Ergebnis
- Großer Wert mit Animation (Counter von 0 hochzählen)
- Zusammenfassung
- CTA: "Jetzt kostenlos verkaufen"

## Globale Verbesserungen

### Visuell
- Step-Indikator: Kreise mit Nummern, verbunden durch Linien
- Card mit subtiler Shadow und Gradient-Border
- Trust-Leiste unter dem Formular: "Kostenlos | Unverbindlich | Datenschutz"
- FOMO: "X Bewertungen heute" Counter
- Social Proof: "Über 5.000 Fahrzeuge bewertet"

### Funktional
- Enter-Taste zum Weiter bei Textfeldern
- Session Storage für Zwischenspeicherung
- Mini-Zusammenfassung der bisherigen Eingaben (Sidebar/Chip-Leiste)
- Bessere Validierung mit Inline-Fehlern
- Smooth Scroll to Top bei Step-Wechsel
