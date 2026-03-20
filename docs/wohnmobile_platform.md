# context.md

## Projektname: **CamperAnker24**

## Ziel des Projekts
Entwicklung einer hochmodernen Plattform für den An- und Verkauf von **Wohnmobilen** – sowohl für private Anbieter als auch professionelle Händler.

Das Projekt basiert auf dem Konzept von "Auto-Anker-Deal", ist jedoch exklusiv auf **Wohnmobile** fokussiert. Sowohl die UI, als auch das Wording, Funktionen und Prozesse werden für den Wohnmobilmarkt optimiert.

## Zielgruppen
- **Privatpersonen**, die ihr gebrauchtes Wohnmobil verkaufen möchten
- **Händler**, die gezielt Wohnmobile aufkaufen oder verkaufen
- **Ankaufstationen**, die als neutrale Abgabepunkte fungieren

## Verkaufskanäle
1. **Sofortpreis-Ankauf** – direktes Angebot nach Bewertung
2. **Online-Auktion** – Händler bieten auf gelistete Wohnmobile
3. **Ankaufstationen** – Übergabe & Barzahlung vor Ort

## Module

### 1. Wohnmobil-Verkauf (Frontend-Flow für Privatverkufer)
- Schrittweiser Wizard für Fahrzeugdetails
  - Hersteller, Modell, Baujahr, Kilometerstand, Zustand
  - Zusätzliche Wohnmobil-spezifische Felder:
    - Aufbauart (Teilintegriert, Alkoven, etc.)
    - Schlafplätze, Nasszelle, Solaranlage, Markise
- Foto-Upload (min. 12 Bilder)
- Sofortpreis mit Range oder Option für Auktion
- Auswahl des Verkaufskanals
- Terminvereinbarung (bei Ankaufstation)
- Abschluss mit Bestätigungsmail (via Resend)

### 2. Händler-Portal
- Registrierung mit Firmenangaben, USt-ID, SEPA-Mandat
- Übersicht über Auktionen und Sofortkäufe
- Autobid + Soft-Ending-Logik bei Auktionen
- Kalenderintegration für Abholtermine
- Transparente Gebührenanzeige
- Dashboard für Bestellungen, Rechnungen, Zahlungsstatus
- Merkliste, Margenrechner, Filtern nach Aufbauart etc.

### 3. Ankaufstationen
- Kalenderverwaltung (Verfügbarkeiten)
- Auswahl Barzahlung oder SEPA Instant
- Release-PIN Logik nach Zahlungseingang
- PDF-Protokolle für Übergabe (mit Unterschrift)

### 4. Admin Backend
- Bewerbungsprüfung für Händler (KYC/KYB)
- Mahnwesen (z. B. D+7, D+14, D+30)
- Statistik- und Risikobewertung (z. B. No-Pay-Rates)
- Boost Engine (z. B. für Auktionen)
- DSGVO Tools: Export, Löschanforderung
- PDF-Rechnungserstellung, Export nach DATEV
- Modul für A/B Tests

### 5. Mobile App (Optional)
- React Native App für iOS & Android
- Verkaufsschritte mobil starten oder fortsetzen
- Live-Bieten für Händler
- Push-Notifications bei Geboten, Bestellungen etc.

## Tech Stack
| Bereich          | Technologie                         |
|------------------|--------------------------------------|
| Frontend         | React + TypeScript + Tailwind (shadcn) |
| Backend          | Node.js (Express)                   |
| Auth             | Supabase Auth / OAuth2              |
| Datenbank        | PostgreSQL (Supabase gehostet)      |
| Datei-Uploads    | Supabase Buckets                    |
| Deployment       | Coolify / Docker / Vercel           |
| Mail             | Resend                              |
| Payment          | SEPA Instant / Barzahlung (stationär) |
| PDF              | PDFKit / Puppeteer                  |
| Charts / Reports | Recharts / Chart.js                 |

## Design
- **Modernes, professionelles UI** im Stil von Wohnmobil24, Mobile.de Premium
- **Dark/Light Mode** optional
- **Hauptschriftart:** Plus Jakarta Sans
- **Brandingfarben:** Orange / Dunkelgrau
- Alle Komponenten modular mit Shadcn implementiert

## Besonderheiten
- Der Fokus liegt nicht auf Autos, sondern **ausschließlich auf Wohnmobilen**
- Alle Texte, Bezeichnungen und Formulare werden speziell auf den Wohnmobilverkauf zugeschnitten
- Ziel ist maximale Conversion durch Vertrauen, Einfachheit und mobile-first Design

## Projektziel
Die Plattform **CamperAnker24** wird Deutschlands modernste digitale Ankaufslösung für gebrauchte Wohnmobile, mit Fokus auf
- schnelle Verkaufsabwicklung
- professionelle Händlerbindung
- skalierbare Technologie und exzellentes UI/UX

