# Microsoft Advertising (Bing) — Conversion-Goals Setup

**Status (zuletzt aktualisiert: 2026-04-21):**

| Item | Wert | Status |
|---|---|---|
| UET Tag Name | `caravanwert.de Main Tag` | ✅ Erstellt |
| UET Tag ID | `97241201` | ✅ Im Backend gespeichert (`site_settings.tracking_config.microsoft_ads.uet_tag_id`) |
| Microsoft Clarity | aktiviert | ✅ |
| Consent Mode | aktiviert | ✅ |
| Conversion-Goals 1–9 | siehe Tabelle unten | ⏳ Manuell anlegen |

---

## Warum diese Doku im Repo liegt

Die 9 Conversion-Goals werden **einmal manuell** in der Microsoft-Ads-UI angelegt
und dann jahrelang benutzt. Sie ändern sich nur, wenn ein neues Funnel-Event
eingeführt wird (1–2× pro Jahr). Diese Doku ist die **Single Source of Truth**:

- Wenn jemals ein Mitarbeiter onboarden, ein neues Konto eröffnet oder ein
  Backup-Setup nötig wird, hat er hier die exakten Werte zum Copy-Paste.
- Die Event-Action-Strings sind **case-sensitive** und müssen 1:1 mit den
  Defaults in `src/lib/trackingConfig.ts` (`DEFAULT_TRACKING_CONFIG.microsoft_ads.conversion_goals`)
  übereinstimmen — sonst feuert das Frontend ins Leere.

---

## Wo werden die Goals angelegt?

Microsoft Advertising → **Ziele → Conversion-Ziele → + Erstellen**

> Wichtig: NICHT „Automatische Conversion-Ziele erstellen" wählen — das überspringt
> die Custom-Event-Konfiguration. Der manuelle Pfad heißt **„Manuelles Setup"**.

---

## Master-Tabelle: alle 9 Goals

| # | Goal-Name | Zielkategorie | Goal-Typ | **Event Action** (case-sensitive!) | Wert € | Primary? | Zähl­methode |
|---|---|---|---|---|---|---|---|
| 1 | `Wizard Abgeschlossen` | Lead-Formular absenden | Ereignis | `wizard_completed` | 9.00 | YES | Individuell |
| 2 | `Terminbuchung` | Termin reservieren | Ereignis | `terminbuchung` | 9.00 | YES | Individuell |
| 3 | `Kontaktformular gesendet` | Lead-Formular absenden | Ereignis | `kontakt_lead` | 1.00 | YES | Individuell |
| 4 | `Wertermittlung Lead` | Lead-Formular absenden | Ereignis | `wertermittlung_lead` | 2.50 | YES | Individuell |
| 5 | `Wertrechner Lead` | Lead-Formular absenden | Ereignis | `wertrechner_lead` | 2.50 | YES | Individuell |
| 6 | `Landing Page Funnel Start` | Sonstige | Ereignis | `landing_funnel_start` | 1.00 | YES | Individuell |
| 7 | `Wizard Gestartet` | Sonstige | Ereignis | `wizard_started` | 1.00 | NO (sekundär) | Individuell |
| 8 | `Wizard Fahrzeugdaten` | Sonstige | Ereignis | `wizard_vehicle_data` | 1.00 | NO (sekundär) | Individuell |
| 9 | `Bewertung abgeschlossen` | Sonstige | Ereignis | `bewertung_abgeschlossen` | 0.00 | NO (sekundär) | Individuell |

---

## Standard-Einstellungen für JEDES Goal (gleich für alle 9)

Diese Felder sind für alle Goals identisch:

| Feld | Wert |
|---|---|
| Datenquelle | Website des Unternehmens |
| Setup-Methode | Manuelles Setup |
| Zeitraum nach Klick | 30 Tage |
| Zeitraum nach Anzeige (View-through) | 1 Tag |
| In „Conversions" einbeziehen | ja |
| Erweiterte Conversions | aktiviert (Default) |
| UET-Tag | `caravanwert.de Main Tag` (97241201) |
| Tagging-Methode | Tag selbst installieren → Manuelle Installation |
| Track event on | `inline action` (nicht `page load`) |
| Umsatz | „Gleicher Wert für jede Conversion" + Wert aus Tabelle, EUR |
| Zähl­methode | Individuell (= eine Conversion pro Klick) |

---

## Schritt-für-Schritt-Anleitung pro Goal

> Diese Anleitung **am Beispiel von Goal #1 „Wizard Abgeschlossen"**.
> Für die anderen 8 die gleichen Schritte mit den Werten aus der Master-Tabelle.

1. Tools → **Conversion-Ziele** → **+ Erstellen**
2. „Welche Conversions wollen Sie verfolgen?" → **Website des Unternehmens** → Weiter
3. „Wie wollen Sie es einrichten?" → **Manuelles Setup** → Weiter
4. **Zielkategorie** (Dropdown): „Lead-Formular absenden" (oder Wert aus Tabelle Spalte „Zielkategorie")
5. **Goal-Typ**: Kachel **„Ereignis"** anklicken
6. **Goal-Name**: `Wizard Abgeschlossen` (exakt wie in Tabelle)
7. **Umsatz**: Radio „Gleicher Wert für jede Conversion" → Wert: `9` → Währung: EUR
8. **Erweiterte Einstellungen** ausklappen:
   - Zeitraum nach Klick: **30 Tage**
   - Zeitraum nach Anzeige: **1 Tag**
   - Zähl­methode: **„Individuell"** (= 1 Conversion pro Klick)
   - In „Conversions" einbeziehen: **AN**
   - Als primäres Conversion-Ziel festlegen: **AN** (oder AUS für Goals 7–9)
9. → Weiter
10. **Erweiterte Conversions**: „Erweiterte Conversions aktivieren" → AN → Weiter
11. **Tag auswählen**: `caravanwert.de Main Tag` markieren → Frage „Ist dieses UET-Tag installiert?" → **Ja** → Speichern und weiter
12. **Tagging einrichten**: „Das Tag selbst installieren" → Weiter
13. **Wie installieren?**: „Manuelle Installation" → Weiter
14. ⚠️ **JETZT KOMMT DAS WICHTIGE FELD** ⚠️
    **Benutzerdefinierte Ereignisparameter** (Custom Event Parameters):
    - Action: `wizard_completed` ← **EXAKT diesen String aus Spalte „Event Action" der Master-Tabelle**
    - Operator: `Equals` (Gleich)
    - Category: leer lassen (oder `Lead`)
    - Label: leer lassen
    - Value: leer lassen (Wert kommt automatisch aus dem Frontend mit)
15. **Wann das Ereignis verfolgen?** → „Track event on inline action"
16. Den angezeigten JavaScript-Codeschnipsel **ignorieren** (unser Frontend
    feuert das Event bereits automatisch via `src/lib/uetService.ts`)
17. **Speichern und weiter** → **Fertig**

---

## Verifikation nach Anlegen aller 9 Goals

1. Tools → Conversion-Ziele → Liste muss alle 9 Goals zeigen, Status „Aktiv"
2. caravanwert.de in Inkognito-Fenster öffnen, Cookies akzeptieren
3. Wizard durchklicken bis Schritt „QuickContact" → Spur in Microsoft Clarity
   sollte sichtbar werden (Real-Time-Daten 5–15 Min Verzögerung)
4. Browser-DevTools → Console: `window.uetq` → muss Object mit `.push()` sein
5. UET Tag Helper Browser Extension installieren → muss alle 9 Custom Events
   erkennen wenn sie im Funnel feuern
6. Microsoft Ads → Tools → UET-Tags → Tag öffnen → Reiter „Ereignisse"
   → nach 24–48h müssen die 9 Action-Strings auftauchen
7. Microsoft Ads → Conversions-Spalte in Kampagnen-Reporting → nach 7 Tagen
   sollten Conversion-Counts erscheinen

---

## Mapping Frontend ↔ Microsoft Ads Goal

Wenn ein Conversion-Goal nicht zündet, Mapping prüfen:

| Frontend-Aufruf | DEFAULT_TRACKING_CONFIG.microsoft_ads.conversion_goals.X | Microsoft Ads Event Action |
|---|---|---|
| `sendBingConversion('WIZARD_ABGESCHLOSSEN', ...)` | `WIZARD_ABGESCHLOSSEN: 'wizard_completed'` | muss `wizard_completed` heißen |
| `sendBingConversion('TERMINBUCHUNG', ...)` | `TERMINBUCHUNG: 'terminbuchung'` | muss `terminbuchung` heißen |
| `sendBingConversion('KONTAKTFORMULAR_GESENDET', ...)` | `KONTAKTFORMULAR_GESENDET: 'kontakt_lead'` | muss `kontakt_lead` heißen |
| `sendBingConversion('WERTERMITTLUNG_LEAD', ...)` | `WERTERMITTLUNG_LEAD: 'wertermittlung_lead'` | muss `wertermittlung_lead` heißen |
| `sendBingConversion('WERTRECHNER_LEAD', ...)` | `WERTRECHNER_LEAD: 'wertrechner_lead'` | muss `wertrechner_lead` heißen |
| `sendBingConversion('LANDING_PAGE_LEAD', ...)` | `LANDING_PAGE_LEAD: 'landing_funnel_start'` | muss `landing_funnel_start` heißen |
| `sendBingConversion('WIZARD_GESTARTET', ...)` | `WIZARD_GESTARTET: 'wizard_started'` | muss `wizard_started` heißen |
| `sendBingConversion('WIZARD_FAHRZEUGDATEN', ...)` | `WIZARD_FAHRZEUGDATEN: 'wizard_vehicle_data'` | muss `wizard_vehicle_data` heißen |
| `sendBingConversion('BEWERTUNG_ABGESCHLOSSEN', ...)` | `BEWERTUNG_ABGESCHLOSSEN: 'bewertung_abgeschlossen'` | muss `bewertung_abgeschlossen` heißen |

Werte können im Admin-Backend (`/admin` → Tab Tracking → Karte Microsoft
Advertising) jederzeit überschrieben werden, ohne Deploy.

---

## Architektur-Hintergrund (für Devs)

- **Frontend Pixel-Loader**: `index.html` → `loadUet(tagId)` lädt
  `https://bat.bing.com/bat.js` consent-conditional (nur nach Marketing-Cookie-Accept)
- **Frontend Service**: `src/lib/uetService.ts` (`sendBingConversion`,
  `sendBingCustomEvent`, `setBingEnhancedConversionData`)
- **Frontend Aufrufe**: `src/lib/gadsConversionService.ts` ruft parallel zu
  Google Ads auch die Bing-Funktionen — non-blocking, schluckt alle Fehler intern
- **Frontend Click-ID-Capture**: `src/lib/clickIdService.ts` liest `?msclkid=`
  aus der URL und persistiert in `localStorage`
- **DB-Persistenz**: `wizard_sessions.msclkid` und `motorhomes.msclkid` (Migration
  `20260421100000_add_bing_microsoft_ads_tracking.sql`)
- **Admin-Konfiguration**: `src/components/admin/AdminTrackingTab.tsx` →
  Karte „Microsoft Advertising (Bing)" → speichert in
  `site_settings.tracking_config.microsoft_ads`
- **Default-Werte**: `src/lib/trackingConfig.ts` →
  `DEFAULT_TRACKING_CONFIG.microsoft_ads`

---

## Phase 2 (später, separat — noch nicht implementiert)

Server-Side Conversions API für offline Sales (analog
`gads-sale-conversion.ts`). Voraussetzung:

1. Microsoft Developer Token beantragen (~2 Tage Approval)
2. OAuth Refresh Token einrichten
3. Edge Function `bing-sale-conversion` analog
   `supabase/functions/track-conversion/index.ts` bauen
4. In `close-auction` und `accept-kaufchance-offer` aufrufen mit
   `msclkid` aus dem Motorhome/Auction-Record

Bei 500 €/Tag Spend lohnt sich Phase 2 nach ca. 2–4 Wochen, sobald genug Daten
zum Vergleich Client-Side vs. Server-Side gesammelt sind.
