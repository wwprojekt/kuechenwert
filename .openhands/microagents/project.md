# CaravanWert – Vollständige Projektanalyse

## 🏗️ Projektübersicht

**CaravanWert** ist eine deutschsprachige Online-Plattform zum **Verkauf und Ankauf von Wohnmobilen und Wohnwagen**. Die Plattform verbindet private Verkäufer mit professionellen Händlern über ein **Auktionssystem** mit zusätzlichen Sofortkauf- und Ankaufstationen-Optionen.

- **URL:** caravanwert.de
- **Supabase-Projekt:** `zcrwqxsyptjwkuxfacvq` (Region: eu-west-1)
- **Status:** ACTIVE_HEALTHY, Postgres 17.6

---

## 🛠️ Tech-Stack

| Kategorie | Technologie |
|-----------|------------|
| **Frontend** | React 18 + TypeScript + Vite 5 |
| **Styling** | Tailwind CSS 3 + shadcn/ui (Radix UI Primitives) |
| **State Management** | TanStack React Query v5 |
| **Routing** | React Router DOM v6 |
| **Forms** | React Hook Form + Zod Validation |
| **Backend** | Supabase (Auth, Database, Storage, Edge Functions) |
| **Rich Text** | TipTap (ProseMirror) |
| **Charts** | Recharts |
| **E-Mails** | Resend API (via Edge Functions) |
| **AI** | OpenAI (Beschreibungsgenerierung, Bewertung) |
| **Analytics** | Google Ads, Meta Pixel, Custom Analytics |
| **Testing** | Vitest + Testing Library + Playwright (E2E) |
| **Deployment** | Netlify + Docker (nginx) |
| **CI/CD** | Lighthouse CI |

---

## 📁 Projektstruktur

```
caravanwert/
├── src/
│   ├── App.tsx                  # Haupt-Router mit allen Routes
│   ├── main.tsx                 # Entry Point
│   ├── pages/                   # 40+ Seiten
│   │   ├── Index.tsx            # Homepage
│   │   ├── Verkaufen*.tsx       # Verkaufs-Flow (Wizard)
│   │   ├── Kaufen.tsx           # Auktions-Marktplatz
│   │   ├── AuctionDetail.tsx    # Einzelne Auktion
│   │   ├── Wertermittlung.tsx   # Wertermittlungs-Lead
│   │   ├── Wertrechner.tsx      # KI-basierter Wertrechner
│   │   ├── admin/               # 30+ Admin-Seiten
│   │   ├── dashboard/           # Seller/Dealer Dashboard
│   │   ├── dealer/              # Händler-Bereich
│   │   ├── landing/             # 6 SEO-Landing-Pages
│   │   └── ratgeber/            # Ratgeber-Artikel (15+ Marken)
│   ├── components/
│   │   ├── ui/                  # shadcn/ui Komponenten
│   │   ├── admin/               # Admin-spezifische Komponenten
│   │   ├── dashboard/           # Dashboard-Komponenten
│   │   ├── wizard/              # Verkaufs-Wizard Steps
│   │   └── skeletons/           # Loading Skeletons
│   ├── hooks/                   # 15+ Custom Hooks
│   ├── lib/                     # 25+ Utility-Module
│   ├── contexts/                # AuthContext, SettingsContext
│   ├── integrations/supabase/   # Client + TypeScript-Types (3865 Zeilen)
│   └── data/                    # Landing-Page & Ratgeber-Daten
├── supabase/
│   ├── functions/               # 55 Edge Functions
│   ├── migrations/              # 65+ Migrationen
│   └── config.toml
├── worker/                      # Cloudflare Worker (wrangler)
├── docker/                      # Nginx Konfiguration
├── tests/e2e/                   # Playwright E2E Tests
└── docs/                        # Projekt-Dokumentation
```

---

## 👥 Benutzerrollen (Enum: `app_role`)

| Rolle | Beschreibung |
|-------|-------------|
| **admin** | Vollzugriff auf Admin-Panel, Nutzerverwaltung, Auktionen, Finanzen |
| **dealer** | Händler – kann bieten, Auktionen gewinnen, hat eigenes Dashboard |
| **seller** | Privater Verkäufer – kann Fahrzeuge eintragen und verkaufen |

---

## 🗄️ Datenbank-Schema (60+ Tabellen)

### Kern-Tabellen (mit Daten)

| Tabelle | Zeilen | Beschreibung |
|---------|--------|-------------|
| `analytics_page_views` | 11.663 | Seiten-Tracking |
| `analytics_sessions` | 4.475 | Session-Tracking |
| `admin_emails` | 1.494 | E-Mail-System (in/outbound) |
| `motorhome_photos` | 660 | Fahrzeugbilder |
| `rate_limits` | 411 | API Rate-Limiting |
| `wizard_sessions` | 270 | Verkaufs-Wizard Fortschritt |
| `value_assessment_leads` | 248 | Wertermittlungs-Leads |
| `dealer_notifications` | 153 | Händler-Benachrichtigungen |
| `profiles` | 113 | Benutzerprofile |
| `user_roles` | 113 | Rollenzuweisungen |
| `bids` | 94 | Gebote auf Auktionen |
| `motorhomes` | 67 | Wohnmobile/Wohnwagen |
| `auctions` | 56 | Auktionen |
| `dealer_applications` | 45 | Händler-Bewerbungen |
| `dealer_levels` | 36 | Händler-Level (Bronze/Silber/Gold/Platin) |
| `legal_documents` | 17 | Rechtliche Dokumente |
| `kaufchance_invitations` | 16 | Kaufchance-Einladungen |

### Weitere Tabellen (teils noch leer)

- `appointments` – Besichtigungstermine
- `blog_posts` – Blog-Artikel
- `claims` / `claim_photos` / `claim_status_history` – Reklamationen
- `commission_tiers` / `commission_calculations` – Provisions-System
- `contact_messages` – Kontaktformular
- `cookie_consent` – Cookie-Einwilligungen
- `damage_photos` – Schadensfotos
- `dealer_reviews` / `dealer_rating_summary` / `review_responses` – Bewertungen
- `dealer_payment_history` / `dealer_volume_discounts` – Zahlungen & Rabatte
- `email_templates` – E-Mail-Vorlagen
- `error_logs` – Frontend-Error-Tracking
- `invoices` / `invoice_items` – Rechnungssystem
- `legal_pages` – Impressum, AGB, Datenschutz (CMS)
- `payment_reminders` – Zahlungserinnerungen
- `post_auction_offers` – Nachauktions-Angebote
- `purchase_contracts` – Kaufverträge
- `purchase_stations` / `purchase_inquiries` – Ankaufstationen
- `quick_leads` – Schnell-Leads
- `search_alerts` / `search_alert_matches` – Suchalarme
- `sepa_mandates` / `sepa_mandate_templates` – SEPA-Mandate
- `site_settings` – Globale Einstellungen
- `station_availability` / `station_blocked_dates` – Station-Verfügbarkeit
- `support_messages` – Support-Nachrichten
- `user_favorites` – Merkliste
- `vehicle_questions` – Fahrzeug-Fragen
- `audit_logs` – Audit-Trail
- `push_subscriptions` – Push-Benachrichtigungen

### Enum-Typen

| Enum | Werte |
|------|-------|
| `app_role` | admin, dealer, seller |
| `auction_status` | draft, active, ended, sold, cancelled, kaufchance |
| `motorhome_body_type` | Teilintegriert, Alkoven, Vollintegriert, Kastenwagen, Campingbus, Wohnwagen, Faltcaravan, Mobilheim |
| `motorhome_condition` | Neuwertig, Sehr gut, Gut, Befriedigend, Reparaturbedürftig, Sehr gepflegt, Gepflegt, Gebrauchsspuren |
| `fuel_type` | Diesel, Benzin, Elektro, Hybrid |
| `transmission_type` | Schaltgetriebe, Automatik |
| `emission_class` | Euro 3–6d |
| `heating_type` | Gas, Diesel, Elektrisch, Kombiniert |
| `air_conditioning_type` | Keine, Fahrerhaus, Wohnraum, Beides |
| `refrigerator_type` | Kompressor, Absorber, Thermoelektrisch |
| `sale_channel` | instant_price, auction, station |

---

## ⚡ Edge Functions (55 deployed)

### Auktions-System
- `place-bid` – Gebot abgeben (atomar)
- `handle-autobid` – Automatisches Bieten
- `close-auction` – Auktion abschließen
- `check-expired-auctions` – Abgelaufene Auktionen prüfen (Cron: alle 5 Min)
- `instant-buy` – Sofortkauf
- `accept-kaufchance-offer` – Kaufchance-Angebot annehmen
- `notify-auction-winner` – Auktionsgewinner benachrichtigen

### E-Mail-System
- `send-admin-email` – Admin-E-Mail versenden
- `send-broadcast-email` – Massen-E-Mail
- `send-welcome-email` – Willkommens-E-Mail
- `send-appointment-confirmation` – Terminbestätigung
- `send-appointment-reminder` – Terminerinnerung (Cron: täglich 8:00)
- `send-auction-ending-notification` – Auktionsende-Warnung (Cron: alle 15 Min)
- `send-auction-notification` – Auktions-Benachrichtigung
- `send-auction-summary` – Auktions-Zusammenfassung (Cron: täglich 18:00)
- `send-bid-notification` – Gebots-Benachrichtigung
- `send-dealer-notification` – Händler-Benachrichtigung
- `send-expert-valuation` – Experten-Bewertung per E-Mail
- `send-favorite-notification` – Favoriten-Benachrichtigung
- `send-inactivity-email` – Inaktivitäts-E-Mail (Cron: Montags 9:00)
- `send-invoice-email` – Rechnungs-E-Mail
- `send-lead-notification` – Lead-Benachrichtigung
- `send-payment-confirmation` – Zahlungsbestätigung
- `send-payment-reminder` – Zahlungserinnerung (Cron: täglich 10:00)
- `send-purchase-inquiry-notification` – Ankauf-Anfrage
- `send-push-notification` – Push-Benachrichtigung
- `send-registration-invite` – Registrierungseinladung
- `send-wizard-resume-email` – Wizard-Fortsetzungs-E-Mail
- `send-wrong-number-email` – Falsche-Nummer-E-Mail
- `send-auto-response` – Auto-Antwort
- `inbound-webhook` – Eingehende E-Mails
- `process-scheduled-emails` – Geplante E-Mails (Cron: alle 5 Min)

### Händler-Management
- `register-dealer` – Händler-Registrierung
- `dealer-document-upload` – Dokumenten-Upload
- `get-dealer-auth-status` – Auth-Status prüfen
- `request-dealer-documents` – Dokumente anfordern

### Termin & Übergabe
- `generate-appointment-pin` – PIN generieren
- `verify-appointment-pin` – PIN verifizieren
- `complete-handover` – Übergabe abschließen
- `generate-handover-pdf` – Übergabe-PDF

### Finanzen & Dokumente
- `generate-invoice-pdf` – Rechnungs-PDF
- `generate-purchase-contract` – Kaufvertrag-PDF
- `process-dunning` – Mahnwesen (Cron: täglich 9:00)

### KI & Automation
- `ai-valuation` – KI-Wertermittlung
- `generate-ai-description` – KI-Beschreibung
- `auto-convert-wizard` – Wizard automatisch konvertieren
- `process-abandoned-wizards` – Abgebrochene Wizards (Cron: alle 30 Min)

### Sonstige
- `admin-create-user` / `admin-delete-user` – Benutzerverwaltung
- `log-error` – Frontend-Error-Logging
- `track-conversion` – Conversion-Tracking (Google Ads)
- `resend-confirmation-email` – Bestätigungs-E-Mail erneut senden
- `sitemap` – Dynamische Sitemap
- `fetch-attachment-url` – Anhänge abrufen
- `backfill-email-content` – E-Mail-Content nachfüllen
- `get-recipient-count` – Empfänger-Anzahl
- `upload-wizard-photos` – Wizard-Fotos hochladen
- `notify-vehicle-question` – Fahrzeug-Fragen

---

## ⏰ Cron Jobs (9 aktiv)

| Job | Intervall | Edge Function |
|-----|-----------|---------------|
| `check-expired-auctions` | Alle 5 Min | `check-expired-auctions` |
| `send-auction-ending-notifications` | Alle 15 Min | `send-auction-ending-notification` |
| `process-scheduled-emails` | Alle 5 Min | `process-scheduled-emails` |
| `process-abandoned-wizards` | Alle 30 Min | `process-abandoned-wizards` |
| `send-appointment-reminders` | Täglich 8:00 | `send-appointment-reminder` |
| `process-payment-reminders` | Täglich 9:00 | `process-dunning` |
| `send-payment-reminders` | Täglich 10:00 | `send-payment-reminder` |
| `send-auction-summaries` | Täglich 18:00 | `send-auction-summary` |
| `send-inactivity-emails` | Montags 9:00 | `send-inactivity-email` |

---

## 🗃️ Storage Buckets (5)

| Bucket | Public | Max Size | Formate |
|--------|--------|----------|---------|
| `branding` | ✅ | 5 MB | JPEG, PNG, SVG, WebP, ICO |
| `motorhome-photos` | ✅ | 100 MB | JPEG, PNG, WebP, GIF, HEIC, AVIF |
| `dealer-documents` | ❌ | 10 MB | PDF, JPEG, PNG, HEIC |
| `invoices` | ❌ | 10 MB | PDF |
| `purchase-contracts` | ❌ | – | – |

---

## 🔒 Sicherheit

- **RLS**: Alle 60+ Tabellen haben RLS aktiviert mit insgesamt ~170 Policies
- **Auth**: Supabase Auth mit E-Mail/Passwort, Session Persistence, Auto-Refresh
- **Rate Limiting**: Eigene `rate_limits`-Tabelle
- **Input Validation**: Zod-basierte Frontend-Validierung + DB-Check-Constraints
- **Security Headers**: via Nginx (Docker)
- **Honeypot Fields**: Spam-Schutz in Formularen
- **DOMPurify**: XSS-Schutz für HTML-Content
- **Session Guard**: Session-Überwachung

---

## 🔑 Datenbank-Funktionen (RPCs) – 50+

### Geschäftslogik
- `place_bid_atomic` – Atomares Bieten mit Soft-Close
- `handle_autobid_atomic` – Automatisches Nachbieten
- `create_auction_invoice` / `create_instant_buy_invoice` – Rechnungserstellung
- `calculate_commission` – Provisionsberechnung
- `approve_dealer_application` – Händler freischalten
- `restrict_dealer_account` / `lift_dealer_restriction` – Händler sperren/entsperren
- `update_dealer_level` – Händler-Level aktualisieren
- `process_approved_claim` – Reklamation bearbeiten

### Wizard & Leads
- `create_wizard_session` – Verkaufs-Wizard starten
- `update_wizard_session_by_anonymous_id` – Wizard-Session aktualisieren
- `update_max_wizard_step` – Wizard-Fortschritt
- `find_wizard_session_by_anonymous_id` – Wizard finden

### Hilfsfunktionen
- `generate_invoice_number` / `generate_listing_number` / `generate_contract_number` / `generate_customer_number` – Nummern generieren
- `has_role` / `get_primary_role` – Rollenprüfung
- `ensure_profile_exists` – Profil sicherstellen
- `log_error` / `log_audit_event` – Logging
- `admin_search_listings` – Admin-Suche
- `clean_old_analytics_data` / `cleanup_expired_rate_limits` / `cleanup_old_error_logs` / `cleanup_old_notifications` – Cleanup

---

## 🔄 Trigger (29)

Automatische Aktionen bei Datenbankänderungen:
- `updated_at`-Felder automatisch setzen (11 Tabellen)
- `trg_auto_customer_number` – Kundennummer bei Profil-Erstellung
- `trigger_set_listing_number` – Inserat-Nummer bei Motorhome-Erstellung
- `on_bid_update_dealer_level` – Dealer-Level bei neuem Gebot aktualisieren
- `on_sale_update_dealer_level` – Dealer-Level bei Verkauf aktualisieren
- `process_search_alerts_trigger` – Suchalarme bei neuem Fahrzeug prüfen
- `update_damage_status_trigger` – Schadensstatus bei Foto-Änderung
- `update_rating_summary_trigger` – Bewertungs-Zusammenfassung aktualisieren
- `claim_status_history_trigger` – Reklamations-Historie
- `increment_event_count_trigger` – Analytics-Event-Zähler
- `update_session_metrics_trigger` – Session-Metriken

---

## 🌐 Seiten & Routes

### Öffentlich
- `/` – Homepage
- `/verkaufen` – Verkaufs-Info → `/verkaufen/wizard` (10-Step Wizard)
- `/kaufen` – Marktplatz mit Auktionen
- `/auktion/:id` – Auktions-Detail
- `/wertermittlung` – Lead-Formular
- `/wertrechner` – KI-Wertrechner
- `/ankaufstationen` – Ankaufstationen-Finder
- `/haendler` – Händler-Info
- `/ratgeber` + `/ratgeber/:slug` – 15+ Ratgeber-Artikel
- `/blog` + `/blog/:slug` – Blog
- `/ueber-uns`, `/kontakt`, `/faq`, `/preise`
- `/impressum`, `/datenschutz`, `/agb`

### SEO Landing Pages
- `/wohnmobil-verkaufen`
- `/wohnwagen-verkaufen`
- `/was-ist-mein-wohnmobil-wert`
- `/wohnmobil-wertermittlung-kostenlos`
- `/wir-kaufen-dein-wohnmobil`
- `/wieviel-ist-mein-wohnmobil-wert`

### Auth
- `/login`, `/login/haendler`, `/register`, `/register/privat`, `/register/haendler`
- `/forgot-password`, `/reset-password`, `/auth/confirm`

### Dashboard (rollenbasiert via SmartDashboard)
- `/dashboard/*` – Automatische Weiterleitung je nach Rolle

### Admin (30+ Seiten unter `/admin`)
- Dashboard, Analytics, Leads, Auktionen, Motorhomes, Nutzer, Händler
- Provisionen, Verträge, Finanzen, Stationen, Termine, Übergaben
- Claims, Angebote, Reviews, Blog, Legal, E-Mail-Center
- Error-Logs, Audit-Log, Nachrichten, Fragen, Einstellungen

---

## 📋 Geschäftsprozesse

### 1. Verkaufs-Flow (Seller)
1. Seller füllt 6–10-Step Wizard aus (Fahrzeugdaten, Fotos, Kontakt)
2. Wizard-Session wird gespeichert (auch ohne Login, via anonymous_id)
3. Abgebrochene Wizards werden per Cron nachverfolgt und per E-Mail erinnert
4. Admin prüft und erstellt Motorhome + Auktion

### 2. Auktions-Flow (Dealer)
1. Aktive Auktionen werden auf `/kaufen` angezeigt
2. Dealer geben Gebote ab (atomare `place_bid_atomic` Funktion)
3. Auto-Bid System (`handle_autobid_atomic`) bietet automatisch nach
4. Soft-Close: Auktion wird um 1 Minute verlängert bei Last-Second-Geboten
5. `check-expired-auctions` Cron schließt abgelaufene Auktionen
6. Gewinner wird benachrichtigt, Rechnung wird erstellt

### 3. Kaufchance
- Wenn eine Auktion endet ohne Verkauf → Status `kaufchance`
- Top-Bieter werden eingeladen, zu ihrem Höchstgebot zu kaufen

### 4. Sofortkauf (Instant Buy)
- Admin setzt Sofortkauf-Preis
- Dealer kann sofort kaufen → Auktion wird geschlossen

### 5. Mahnwesen (5 Stufen)
1. Stufe 1: Freundliche Erinnerung
2. Stufe 2: Zweite Mahnung
3. Stufe 3: Letzte Mahnung
4. Stufe 4: Kontosperrung
5. Stufe 5: Inkasso-Ankündigung

### 6. Händler-Registrierung
1. Bewerbung über `/register/haendler`
2. Dokumente hochladen (Gewerbeschein, etc.)
3. Admin prüft und genehmigt/lehnt ab
4. Bei Genehmigung: Dealer-Level wird erstellt (startet bei Bronze)

### 7. Händler-Level-System
- **Bronze** → **Silber** → **Gold** → **Platin**
- Basiert auf: Gebote, gewonnene Auktionen, Umsatz, Punkte

---

## 🧪 Testing

- **Unit Tests**: Vitest + Testing Library (`npm run test`)
- **E2E Tests**: Playwright (`npm run test:e2e`)
- **Test-Dateien**: `*.test.ts(x)` neben den Source-Dateien
- **Setup**: `src/test/setup.ts`, `src/test/utils.tsx`

## 📦 Build & Dev

```bash
npm run dev          # Vite dev server (Port 8080)
npm run build        # Production build
npm run preview      # Preview production build
npm run test         # Vitest watch mode
npm run test:run     # Vitest single run
npm run test:e2e     # Playwright tests
npm run lint         # ESLint
```

## 🔧 Konfiguration

- **Env-Variablen**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (siehe `env.example`)
- **Aliases**: `@` → `./src/`
- **Code Splitting**: Manuell konfigurierte Chunks (vendor-react, vendor-supabase, etc.)
- **Lazy Loading**: Alle Pages außer Index werden lazy-loaded mit Auto-Retry

---

---

## 🔧 Edge Functions – Detailanalyse (Shared Utilities)

### `_shared/cors.ts`
- Erlaubte Origins: `caravanwert.de`, `*.netlify.app`, `localhost`
- `getCorsHeaders(req)` + `handleCorsPreflightRequest(req)`

### `_shared/auth.ts`
- `checkServiceRoleOrAdmin(req, corsHeaders)` – 3-stufiger Auth-Check:
  1. Direkter String-Vergleich mit SUPABASE_SERVICE_ROLE_KEY
  2. JWT-Payload decode → role === 'service_role'
  3. User-basierter Admin-Check via user_roles-Tabelle

### `_shared/email-builder.ts`
- Professionelles HTML-E-Mail-Template-System mit CaravanWert-Branding
- Farben: Primary `#1f8aa2` (Teal), Dark `#0f4f5c`
- Logo aus Supabase Storage: `branding/logo-email.png`
- Helper: `buildEmailLayout()`, `infoBox()`, `detailRow()`, `button()`, `paragraph()`, `list()`, `pinDisplay()`, `amountDisplay()`, `warningBox()`, `divider()`, `customerBadge()`, `greeting()`
- Responsive HTML-E-Mail mit MSO-Outlook-Fallbacks

### `_shared/rate-limiter.ts`
- IP-basiertes Rate-Limiting über `rate_limits`-Tabelle
- Konfigurierbare Limits pro Endpoint (windowMs, maxRequests)
- Vordefinierte Limits: `RATE_LIMITS.BIDDING`, `RATE_LIMITS.AUTH`

### `_shared/edgeLogger.ts`
- Einfacher Logger mit `[Edge]`-Prefix

### `_shared/turnstile.ts`
- Cloudflare Turnstile CAPTCHA-Validierung

---

## ⚙️ Edge Functions – Geschäftslogik-Details

### Bieten: `place-bid`
- **Zod-Validierung** der Eingabe (auctionId UUID, amount > 0, max 100M)
- **Dealer-Validierung**: Prüft user_roles.role = 'dealer' UND dealer_applications.status = 'approved'
- **Atomares Bieten** via `place_bid_atomic` RPC (pg_advisory_xact_lock)
- **Soft-Close**: Letzte 1 Minute → Verlängerung um 1 Minute
- **Post-Bid**: Trigger `handle-autobid`, In-App-Notification, E-Mail-Notifications (Bieter-Bestätigung, Outbid-Benachrichtigung, Seller-Benachrichtigung)
- **Rate-Limiting**: RATE_LIMITS.BIDDING

### Auto-Bid: `handle-autobid`
- `handle_autobid_atomic` RPC mit Advisory Lock
- Findet höchsten aktiven Autobidder (≠ aktueller Bieter)
- Platziert Counter-Bid (current + min_increment)
- Soft-Close Erweiterung bei Autobids

### Auktion schließen: `close-auction`
- **3 Ausgänge**: SOLD (Reserve erreicht) / KAUFCHANCE (Gebote aber Reserve nicht erreicht) / ENDED (keine Gebote)
- **SOLD-Flow**: Motorhome → sold, Invoice erstellen, PDF generieren, Kaufvertrag generieren, E-Mails an Gewinner/Verlierer/Verkäufer/Admin
- **KAUFCHANCE-Flow**: Top-2 Bieter identifizieren, 72h Frist, Einladungen erstellen, E-Mails senden
- **Reserve-Price-Fix**: Verwendet `auction.reserve_price ?? motorhome.reserve_price`
- Optimistic Locking auf Auktionsstatus

### Sofortkauf: `instant-buy`
- Dealer-only, Rate-Limited
- Prüft: Auktion aktiv, instant_buy_price gesetzt, Dealer ≠ Seller
- Atomares Update: Auktion → sold, Motorhome → sold
- Vollständiger Sale-Flow: Invoice + PDF + Kaufvertrag + E-Mails

### Kaufchance: `accept-kaufchance-offer`
- Race-Condition-Schutz: Optimistic Locking auf auction.status = 'kaufchance'
- Prüft ob bereits ein anderes Angebot accepted wurde
- Counter-Offer-Support: Bei status='countered' wird counter_offer_amount verwendet
- Auth: Seller, Buyer (nur für Counter-Offers), oder Admin

### Wizard-Konvertierung: `auto-convert-wizard`
- Prüft ob Benutzer existiert (Auth), sonst erstellt neuen mit `admin.createUser()`
- Erstellt Motorhome aus Wizard-Daten
- Überträgt Fotos von `wizard_temp/{sessionId}/` nach `{sellerId}/`
- Erstellt Draft-Auktion wenn sale_channel = 'auction'
- Sendet Registration-Invite-E-Mail

### Foto-Upload: `upload-wizard-photos`
- Kein Auth erforderlich (Wizard läuft anonym)
- Max 30 Fotos, max 100MB pro Foto
- Erlaubte Typen: JPEG, PNG, WebP, HEIC, AVIF, GIF
- **Race-Condition-Fix**: Wenn Session bereits konvertiert, werden Fotos direkt dem Motorhome zugewiesen

### Mahnwesen: `process-dunning`
- 5-stufiges Mahnwesen mit konfigurierbaren Tagen/Gebühren
- Stufe 4: Account-Sperre via `restrict_dealer_account` RPC
- Stufe 5: Inkasso-Ankündigung
- Jede Stufe: E-Mail + admin_emails-Logging

### KI-Bewertung: `ai-valuation`
- OpenAI GPT-4o für Fahrzeugbewertung
- Prompt mit Fahrzeugdaten → geschätzter Marktwert + Begründung
- Rate-Limited

### Händler-Registrierung: `register-dealer`
- Erstellt Auth-User + Profil + Dealer-Application
- Validierung aller Pflichtfelder
- E-Mail-Bestätigung via Supabase Auth

### PIN-System: `generate-appointment-pin` / `verify-appointment-pin`
- 6-stelliger numerischer PIN
- Max 5 Fehlversuche → 60 Minuten Sperre
- PIN gültig für 24 Stunden
- PIN-Versand per E-Mail mit `pinDisplay()` Template

---

## 🗄️ Datenbank-RPCs – Detaillogik

### `place_bid_atomic(p_auction_id, p_bidder_id, p_bid_amount, p_is_autobid, p_max_autobid_amount, p_min_increment)`
- `pg_advisory_xact_lock(hashtext(auction_id))` für Concurrency
- `SELECT ... FOR UPDATE OF a` auf Auktion
- Validiert: aktiv, nicht abgelaufen, nicht verkauft, nicht eigene Auktion
- Berechnet minimum_bid aus DB-State (nicht Client!)
- Soft-Close: Letzte 1 Minute → +1 Minute Verlängerung
- Returns: JSONB mit success, bid_id, amount, auction_extended, etc.

### `handle_autobid_atomic(p_auction_id, p_new_bid_amount, p_new_bidder_id, p_min_increment)`
- Gleicher Advisory-Lock-Mechanismus
- Findet höchsten Autobidder ≠ trigger-Bidder
- Counter = current + min_increment (max = autobidder's max)
- Soft-Close Verlängerung bei Auto-Geboten

### `create_auction_invoice(auction_id, winner_id)`
- Auth: service_role oder admin
- Berechnet Provision via `calculate_commission()`
- 19% MwSt berechnen
- Erstellt Invoice + Invoice_Items
- Returns: invoice UUID

### `calculate_commission(sale_amount, dealer_id)`
- Findet passende commission_tier (Staffelpreise)
- Prüft dealer_volume_discounts für Mengenrabatt
- final_commission = base * (1 - discount/100)
- Returns: base_rate, volume_discount, final_rate, commission_amount

### `update_dealer_level(p_dealer_id)`
- Punkte = total_bids + (won_auctions × 10) + floor(total_volume / 1000)
- Platin ≥ 200, Gold ≥ 100, Silber ≥ 30, Bronze < 30
- UPSERT in dealer_levels

### Nummern-Generierung
- `generate_invoice_number()` → `CA2026-000001` (Sequenz)
- `generate_listing_number()` → `WM26000001`
- `generate_contract_number()` → `KV-2026-00001`
- `generate_customer_number()` → `KD-1`

---

## 🎨 Frontend-Architektur – Detailanalyse

### State Management
- **React Query v5** als primärer Server-State-Cache
  - staleTime: 5 Min, gcTime: 10 Min, retry: 2
  - refetchOnWindowFocus: true, refetchOnReconnect: 'always'
- **AuthContext**: Session, User, signOut, Lock-Error-Handling
- **SettingsContext**: Site Settings mit Realtime-Updates via Supabase Channel
  - Dynamisches Branding: CSS-Variablen werden aus DB-Settings generiert

### Routing (React Router v6)
- **Smart Dashboard**: `/dashboard/*` → rollenbasierte Weiterleitung
- **Admin**: Nested Routes unter `/admin` mit AdminLayout (Sidebar)
- **Lazy Loading**: Alle Pages außer Index, mit `lazyRetry()` für Chunk-Error-Recovery
- **Error Boundaries**: Global, Auction-spezifisch, Form-spezifisch
- **ScrollRestoration**: Automatisch bei Route-Wechsel

### Sicherheit (Frontend)
- `SecurityManager`: CSRF-Token, Input-Sanitization, File-Validation, Rate-Limiting
- `HoneypotField`: Spam-Schutz in Formularen
- `DOMPurify`: XSS-Schutz für HTML-Content
- `sessionGuard`: Session-Monitoring mit Auto-Recovery

### Analytics & Tracking
- `analyticsService.ts`: Custom Analytics → analytics_sessions, analytics_page_views, analytics_events
- `gadsConversionService.ts`: Google Ads Server-Side Conversion Tracking (770 Zeilen!)
  - GCLID/GBRAID/WBRAID Click-ID-Erfassung
  - GA4 Measurement Protocol API
  - Traffic-Type-Detection (google_ads, organic, direct, etc.)
- `metaPixelService.ts`: Meta/Facebook Pixel mit Consent-Management
- `clickIdService.ts`: Click-ID-Persistence in localStorage
- `leadTrackingService.ts`: Lead-Tracking mit Conversion-Attribution

### Wizard-System (988 Zeilen in useWizardForm.ts)
- 6-8 Steps: Fahrzeugtyp → Fahrzeugdaten → Details → Ausstattung → Kontakt → Fotos → Verkaufsweg → Standort
- `useWizardSession`: Server-seitige Session-Persistence (anonymous_id-basiert)
- Auto-Save mit Debouncing (Timeout-basiert)
- URL-Parameter-Support für Quick-Lead-Übernahme
- Foto-Upload via `upload-wizard-photos` Edge Function

### Vehicle Data (vehicle-data.ts)
- 70+ Wohnmobil-Hersteller mit Modell-Listen
- 25+ Wohnwagen-Hersteller mit Modell-Listen
- Body-Types: Teilintegriert, Alkoven, Vollintegriert, Kastenwagen, Campingbus, Wohnwagen, Faltcaravan, Mobilheim

### Hooks
- `useUserRole`: Einzelne Quelle der Wahrheit für Benutzerrollen (admin/dealer/seller)
- `usePermissions`: Granulare Berechtigungsprüfungen
- `useFavorites`: Merkliste mit React Query
- `useWizardForm` + `useWizardSession`: Wizard-State + DB-Persistence
- `useAudioNotification`: Audio-Benachrichtigung bei neuen Geboten
- `useDealerPending`: Prüft Dealer-Freischaltungsstatus
- `useExport`: CSV/JSON-Export für Admin-Tabellen
- `useTableSort`: Generisches Table-Sorting
- `useTurnstile`: Cloudflare Turnstile CAPTCHA
- `useUserLocation`: Geolocation für Ankaufstationen

### Key Libraries
- `commissionCalculator.ts`: Provisions-Kalkulation (Frontend-Vorschau + DB-RPC)
- `invoiceGenerator.ts`: Client-seitige Rechnungs-Vorschau (629 Zeilen)
- `plzCoordinates.ts`: PLZ → GPS-Koordinaten-Mapping für ~700 deutsche PLZ
- `euCountries.ts`: EU-Länderliste für Händler-Registrierung
- `germanErrors.ts`: Deutsche Fehlermeldungen für Supabase-Errors
- `dealerRegistrationTranslations.ts`: Mehrsprachige Texte für Händler-Registrierung
- `imageOptimization.ts`: Client-seitige Bildoptimierung vor Upload

---

## 🏛️ Datenbankdesign-Patterns

### Nummern-Sequenzen
- `invoice_number_seq` → `CA2026-000001`
- `listing_number_seq` → `WM26000001`
- `contract_number_seq` → `KV-2026-00001`
- `customer_number_seq` → `KD-1`

### Audit & Logging
- `audit_logs`: Allgemeiner Audit-Trail
- `admin_emails`: Jede gesendete E-Mail wird protokolliert (In+Outbound)
- `error_logs`: Frontend-Error-Tracking mit Deduplication (error_hash)

### Realtime
- `site_settings`: SettingsContext subscribed auf postgres_changes

### Views
- `public_site_settings`: Sicherheits-View (nur öffentliche Felder)

### E-Mail-Absender
- Alle E-Mails von: `info@caravanwert.de` via Resend API
- Domain: caravanwert.de

---

## 65 Migrationen (Oct 2025 – Apr 2026)

Chronologisch von der initialen Schema-Erstellung bis zu den neuesten Features wie Kaufchance-Aktivierung und Dealer-Country-Support.

---

## 9. 🔐 Umgebungsvariablen

| Variable | Beschreibung | Pflicht |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | Supabase Projekt-URL (https://zcrwqxsyptjwkuxfacvq.supabase.co) | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Supabase Public/Anon Key | ✅ |
| `VITE_GOOGLE_ANALYTICS_ID` | Google Analytics Measurement ID | ❌ |
| `VITE_SENTRY_DSN` | Sentry Error Tracking DSN | ❌ |
| `VITE_ENABLE_DEVELOPMENT_FEATURES` | Dev-Features aktivieren | ❌ |
| `NODE_ENV` | development / production | ✅ |

### Edge Function Secrets (Supabase Vault):
| Secret | Beschreibung |
|--------|-------------|
| `SUPABASE_URL` | Auto-injected |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected |
| `RESEND_API_KEY` | Resend.com API Key für E-Mail-Versand |
| `ADMIN_EMAIL` | Fallback Admin-E-Mail (kontakt@caravanwert.de) |
| `service_role_key` | In Vault für Cron-Jobs |
| `project_url` | In Vault für Cron-Jobs |

---

## 10. 🌐 Externe Dienste und Integrationen

| Dienst | Zweck | Konfiguration |
|--------|-------|---------------|
| **Supabase** | Auth, DB, Storage, Edge Functions, Realtime | Projekt: zcrwqxsyptjwkuxfacvq, Region: eu-west-1 |
| **Resend** | E-Mail-Versand (alle 20+ E-Mail-Typen) | API Key in Vault, Domain: caravanwert.de |
| **OpenAI** | KI-Bewertung (ai-valuation), Beschreibungsgenerierung | API Key in site_settings.openai_api_key |
| **Google Ads** | Conversion Tracking (GCLID/GBRAID/WBRAID) | GA4 Measurement Protocol |
| **Meta/Facebook Pixel** | Marketing Pixel mit Consent-Management | Pixel ID in index.html |
| **Cloudflare** | DNS, Worker (Prerendering für SEO) | Worker: caravanwert-prerender |
| **Netlify** | Hosting, CDN, Deployment | Auto-Deploy von main Branch |
| **Cloudflare Turnstile** | CAPTCHA für Formulare | Site Key im Frontend |

---

## 11. 🚀 Deployment und Build

### Frontend (Netlify)
```bash
npm run build        # Vite Production Build → dist/
# Auto-deployed via Netlify Git-Integration
# Redirects: /* → /index.html (SPA)
# Headers: CSP, HSTS, X-Frame-Options (netlify.toml)
```

### Edge Functions (Supabase)
```bash
# Via Supabase CLI:
supabase functions deploy <function-name> --project-ref zcrwqxsyptjwkuxfacvq --no-verify-jwt

# Oder via MCP-Tool:
supabase_deploy_edge_function(project_id, name, entrypoint_path, files)
```

### Docker (Optional)
```bash
docker-compose up app          # Production (Port 80)
docker-compose --profile development up app-dev  # Dev (Port 8080)
```

### Datenbank-Migrationen
```bash
# Via Supabase MCP-Tool:
supabase_apply_migration(project_id, name, query)
# Migrationen liegen in supabase/migrations/
```

---

## 12. ⚠️ Bekannte Probleme und TODOs

### Unfertige Features (gebaut aber nie angebunden):
| Feature | Status | Details |
|---------|--------|---------|
| `analytics_events` Tracking | Infrastruktur steht, nie angebunden | `trackEvent()` wird von keiner Komponente aufgerufen, nur `trackPageView()` funktioniert (11.663 Einträge) |
| `analytics_daily_summary` | Tabelle existiert, nie befüllt | Sollte Materialized View oder Cron-Aggregation sein |
| `audit_logs` / `useAuditLog` | Hook + RPC existieren, nie importiert | Audit-Trail gebaut aber nie verdrahtet |
| `DashboardLayout.tsx` | Dead Code | Wurde durch SmartDashboard ersetzt, wird nie importiert |
| Blog | Tabelle + Seiten existieren, 0 Artikel | Content-Feature nie befüllt |
| Push Notifications | Edge Function + Tabelle existieren | `push_subscriptions` hat 0 Einträge |
| Cookie Consent DB | ✅ GEFIXT (07.04.2026) | Wird jetzt in DB gespeichert |

### Migration Edge Functions (Einmal-Tools, sollten deaktiviert werden):
- `import-table-data` – Einmal-Datenmigration
- `import-photos` – Einmal-Fotomigration  
- `migrate-storage` – Einmal-Storage-Migration
- `backfill-email-content` – Einmal-E-Mail-Nachfüllung

### Behobene Bugs (07.04.2026):
1. ✅ `create_instant_buy_invoice` audit_log → audit_logs Typo
2. ✅ Cookie-Consent DB-Speicherung (CookieBanner + CookieSettingsModal)
3. ✅ Gesperrte Dealer konnten bieten/kaufen (place-bid + instant-buy)
4. ✅ MyBids zählte ended-Auktionen als gewonnen
5. ✅ 7 kaputte E-Mail-URLs (/unsubscribe, /abmelden, /auktionen)
6. ✅ Unused ProtectedRoute Import
7. ✅ 4 Cleanup-Cron-Jobs eingerichtet
8. ✅ Rechnungen Lösch-Schutz (Trigger)
9. ✅ Soft-Delete für quick_leads + contact_messages
10. ✅ 15 fehlende DB-Indizes

### Sequenz-Lücken (nicht kritisch):
- `invoice_number_seq`: Stand 1013, 0 aktive Rechnungen → Tests/Rollbacks
- `customer_number_seq`: Stand 100243, 113 Profile → Übermäßig aufgerufen
- `listing_number_seq`: Stand 10139, 67 Motorhomes

### 32 Analyse-Markdown-Dateien im Root:
Alte Reports wie AUDIT_REPORT.md, BUG_REVIEW.md, RLS_AUDIT.md etc. – sollten nach docs/archive/ verschoben werden.

---

## Supabase-Projekt Referenz

- **Projekt-ID:** `zcrwqxsyptjwkuxfacvq`
- **Region:** eu-west-1
- **DB Host:** db.zcrwqxsyptjwkuxfacvq.supabase.co
- **Postgres:** 17.6
- **Organisation:** wpsnoicmcchjhmvpvxai
- **E-Mail-Domain:** info@caravanwert.de
- **Logo (E-Mail):** https://zcrwqxsyptjwkuxfacvq.supabase.co/storage/v1/object/public/branding/logo-email.png
