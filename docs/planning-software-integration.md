# Anbindung an Küchenplanungs-Software

Stand: 25.09.2026

## Ziel

Studios sollen ein KüchenWert-Projekt ohne Abtippen in ihr Planungsprogramm
übernehmen und daraus ein verbindliches Angebot rechnen können. Kund:innen
sehen vorab eine KI-Visualisierung und eine Preisspanne – die verbindliche
Planung mit echten Herstellerdaten entsteht im Studio.

## Was heute umgesetzt ist

Im Studio-Portal (`/dashboard/projekte/:id`) gibt es für jedes Projekt drei
Exporte (Code: `src/features/marketplace/briefing-export.ts`, Tests in
`src/features/marketplace/__tests__/briefing-export.test.ts`):

| Export | Format | Inhalt |
|---|---|---|
| Planungsbriefing | JSON, Schema `kuechenwert.planungsbriefing/1` | Raumform, Wandmaße, Deckenhöhe, Zeilenlängen, Konfiguration (Linie, Stil, Fronten, Griffe, Arbeitsplatte, Geräte, Spüle, Extras, Leistungen), Wünsche, Preisschätzung, Links auf Raumfoto und Visualisierung (1 h gültig), Kontakt nach Freischaltung |
| Grundriss | DXF R12 (AC1009), Millimeter, Layer `KUECHE` und `BESCHRIFTUNG` | Schrankzeilen als Rechtecke mit Wandbeschriftung; reines ASCII |
| Druckansicht | Browser-Druck | Projektblatt für die Beratung |

DXF R12 ist der kleinste gemeinsame Nenner: CARAT, Winner Flex (Compusoft),
KPS, pCon.planner und jedes CAD-Programm importieren es als Grundriss-Unterlage.
Die Maße sind Kundenangaben – Aufmaß vor Ort bleibt Pflicht (steht im DXF).

## Optionen für eine tiefere Integration

### 1. CARAT

In deutschen Küchenstudios weit verbreitet; Herstellerdaten über den
IDM-Datenstandard des DCC (Daten Competence Center).

- **Grundriss-Import:** DXF-Import ist Standard → funktioniert mit dem
  heutigen Export.
- **CARAT planner / Web-Konfigurator:** CARAT bietet einen lizenzpflichtigen
  Online-Planer mit Herstellerkatalogen. Eine Einbettung in KüchenWert wäre
  möglich, erfordert aber einen Lizenz- und Partnervertrag mit CARAT und
  bindet die Planung an CARAT-Kataloge.
- **Automatische Übergabe (Projekt → CARAT-Auftrag):** Nur über eine von CARAT
  freigegebene Schnittstelle; Spezifikation liegt uns nicht vor.

### 2. Winner Flex / Compusoft, KPS, pCon

- Alle lesen DXF. pCon (EasternGraphics) bietet mit pCon.basket/OFML eine
  offene Katalogschiene, vor allem für Objekt- und Möbelhandel.
- Winner Flex hat ein eigenes Katalogformat; Anbindung ebenfalls nur über
  einen Partnervertrag.

### 3. „DataX“

Unter diesem Namen haben wir kein Küchenplanungsprodukt mit öffentlicher
Schnittstelle gefunden. Vermutlich ist ein anderes Produkt gemeint (z. B.
Daten über DCC/IDM oder ein Warenwirtschafts-Connector). Bitte Hersteller/Link
nennen, dann prüfen wir die Anbindung konkret.

## Empfehlung

1. **Jetzt:** JSON + DXF nutzen (fertig, ohne Lizenzkosten). Feedback der
   ersten Studios einholen, welche Felder im Import fehlen.
2. **Mit CARAT sprechen** (Partnerprogramm/Schnittstellen): Gibt es einen
   dokumentierten Import für Projekt-/Raumdaten (z. B. XML) statt nur DXF?
   Kosten eines Web-Planers pro Studio bzw. pro Plattform?
3. **Erst danach** Herstellerkataloge (IDM) direkt einbinden – das ist nur
   sinnvoll, wenn wir Preise verbindlich rechnen wollen. Für die heutige
   Preisspanne reicht die parametrische Preis-Engine
   (`supabase/functions/_shared/kitchen-pricing.ts`, Rate-Card in
   `kitchen_pricing_rate_cards`), die sich über Overrides kalibrieren lässt.

## Schema-Versionierung

Das JSON-Schema trägt eine Version (`kuechenwert.planungsbriefing/1`).
Felder dürfen nur ergänzt werden; Umbenennungen oder Entfernungen erfordern
`/2`, damit Import-Skripte von Studios nicht brechen.
