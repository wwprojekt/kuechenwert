# Anbindung an Küchenplanungs-Software

Stand: 26.09.2026

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

Ein Küchenplanungsprodukt dieses Namens gibt es nicht (Recherche 26.09.2026).
Wahrscheinlich gemeint ist eines dieser Produkte:

| Produkt | Was es kann | Passt für |
|---|---|---|
| **CARAT planner** (CARAT GmbH) | Browser-3D-Planer zum Einbetten, neutraler Katalog, KI-Planungsvorschläge (CARAT guide), Lead-Workflow, Übergabe an CARAT | Online-Vorplanung durch Kund:innen, Übergabe an CARAT-Studios |
| **K:PLAN** (RMTSoft) | E-Commerce-Küchenkonfigurator mit Produktkatalog und Warenkorb-API („konfigurieren, kaufen, liefern“), Einrichtung ca. 4.900 €, dazu Cloud-Software WorkX | Direkter Online-Verkauf fester Küchenprogramme |
| **IDM Küche 3.1** (DCC e. V.) | Branchenstandard für Herstellerkataloge; zusätzlich Web-Services für Bestellabwicklung und Planungsprüfung | Verbindliche Preise aus echten Herstellerdaten |
| **Winner Flex** (Compusoft) | Enterprise-API nach Freischaltung | Studios, die mit Winner planen |
| **KüchenDesk** | Cloud-Warenwirtschaft für Studios mit Schnittstellen zu CARAT, KPS, Winner, eOPUS, Hammes | Auftragsabwicklung im Studio, nicht Endkundenplanung |

### 4. Einordnung für KüchenWert

KüchenWert ist Vermittler: Der Kaufvertrag entsteht nach dem Aufmaß zwischen
Kund:in und Studio (siehe Auftragsverlauf `kw_orders`). Ein Warenkorb-Planer
wie K:PLAN passt deshalb nur für ein künftiges eigenes Festpreis-Sortiment. Für
den Marktplatz zählt, dass Studios ohne Abtippen weiterplanen können – das
leisten JSON-Briefing und DXF heute, ein CARAT-Projektimport wäre der nächste
Schritt.

## Empfehlung

1. **Jetzt:** JSON + DXF nutzen (fertig, ohne Lizenzkosten). Feedback der
   ersten Studios einholen, welche Felder im Import fehlen.
2. **Mit CARAT sprechen** (Partnerprogramm/Schnittstellen): Gibt es einen
   dokumentierten Import für Projekt-/Raumdaten (z. B. XML) statt nur DXF?
   Lässt sich der CARAT planner als Plattform-Lizenz (statt pro Studio)
   einbetten, sodass die Vorplanung mehrerer Studios bedient?
3. **Erst danach** Herstellerkataloge (IDM) direkt einbinden – das ist nur
   sinnvoll, wenn wir Preise verbindlich rechnen wollen. Für die heutige
   Preisspanne reicht die parametrische Preis-Engine
   (`supabase/functions/_shared/kitchen-pricing.ts`, Rate-Card in
   `kitchen_pricing_rate_cards`), die sich über Overrides kalibrieren lässt.

## Schema-Versionierung

Das JSON-Schema trägt eine Version (`kuechenwert.planungsbriefing/1`).
Felder dürfen nur ergänzt werden; Umbenennungen oder Entfernungen erfordern
`/2`, damit Import-Skripte von Studios nicht brechen.
