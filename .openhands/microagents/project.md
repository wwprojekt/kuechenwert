# CaravanWert – Vollständige Projektanalyse

## Projektübersicht

**CaravanWert** ist eine deutschsprachige Online-Plattform zum **Verkauf und Ankauf von Wohnmobilen und Wohnwagen**. Die Plattform verbindet private Verkäufer mit professionellen Händlern über ein **Auktionssystem** mit zusätzlichen Sofortkauf- und Ankaufstationen-Optionen.

- **URL:** caravanwert.de
- **Supabase-Projekt:** `zcrwqxsyptjwkuxfacvq` (Region: eu-west-1)
- **Status:** ACTIVE_HEALTHY, Postgres 17.6

---

## WICHTIG: Aufgaben-Management

### Regeln für den Agent
1. **Vor jeder Aufgabe**: Lies diese TODO-Liste und prüfe ob die Aufgabe bereits erledigt ist
2. **Nach jeder erledigten Aufgabe**: Aktualisiere diese Liste (markiere als erledigt mit `[x]` und Datum)
3. **Bei neuen Aufgaben**: Füge sie unter "Offen" hinzu
4. **NIEMALS** eine bereits erledigte Aufgabe erneut bearbeiten

### Erledigte Aufgaben (nicht erneut bearbeiten!)
- [x] Session-Expired Fix: `ensureValidRLSSession()`, `invokeWithAuth()`, periodic refresh (10.04.2026)
- [x] Live-Gebots-Update: Optimistic Update + Realtime Dedup in AuctionDetail (10.04.2026)
- [x] Bid-Increment-Display: `bids[index + 1]` statt `bids[index]` (10.04.2026)
- [x] Auction-Realtime: Zweiter `.on("postgres_changes")` Handler für `auctions` Tabelle (10.04.2026)
- [x] React Hooks Violation: `useCommissionFromTiers` vor early return verschoben (10.04.2026)
- [x] AuctionDetail Architektur: Commission-Hook in Child-Component verschoben (10.04.2026)
- [x] Email Anti-Spam Phase 1+2: bid_confirmed entfernt, ending_soon Dedup, favorite throttle, wizard_recovery throttle, seller new_bid throttle (08.04.2026)
- [x] Email Center Bugfixes: send-admin-email v13, fetch-attachment-url v9, place-bid v25 (10.04.2026)
- [x] Push-Notification Integration: SW registriert, UI-Toggle, VAPID/ECDH (08.04.2026)
- [x] Google Tracking Fixes: 7 critical bugs, trackEvent in 12 Dateien (08.04.2026)
- [x] Wertrechner Kalibrierung: Basispreise, Tiers, Abschreibungskurven (09.04.2026)
- [x] Dealer Activation: send-dealer-auction-digest, /haendler Rewrite, first-nudge (08.04.2026)
- [x] Dealer Flow Audit: RLS Stats Bug, Wrong Column Names, Platform Stats RPC (08.04.2026)
- [x] Dealer Flow Fixes: DB Migrations, Invoice Fixes, Reverse Charge (08.04.2026)
- [x] Händler-Verkauf Features: DealerListingCreate, Privat/Händler Badge, Eigene-Auktionen-Filter (08.04.2026)
- [x] UX-Audit Fixes: DealerListingCreate Bugs, MotorhomeCard Badges, Sidebar Icons (08.04.2026)
- [x] Conversion Optimizations Phase 1-6: Wizard Redesign, Progressive Disclosure, Zero-Friction (08.04.2026)
- [x] Security: 11x search_path, SECURITY INVOKER, RLS Policies, audit_logs cleanup (08.04.2026)

### Offene Aufgaben
- [ ] Blog-System: Tabelle + Seiten existieren, 0 Artikel (Content fehlt)
- [ ] Migration Edge Functions deaktivieren (harmlos, niedrige Priorität)
- [ ] 32 Analyse-Markdown-Dateien im Root nach docs/archive/ verschieben
- [ ] Baujahr-Ranges per Model implementieren
- [ ] Fuzzy-Search für Tippfehler (z.B. "Exzellent" → "Excellent")
- [ ] GA4_API_SECRET erstellen (Google Analytics Admin → Data Streams)
- [ ] Google Ads: LANDING_PAGE_LEAD von Primary auf Secondary umstellen

---

## Tech-Stack

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

## Projektstruktur

```
caravanwert/
├── src/
│   ├── App.tsx                  # Haupt-Router mit allen Routes
│   ├── main.tsx                 # Entry Point
│   ├── pages/                   # 40+ Seiten
│   ├── components/              # UI + Admin + Dashboard + Wizard + Skeletons
│   ├── hooks/                   # 15+ Custom Hooks
│   ├── lib/                     # 25+ Utility-Module
│   ├── contexts/                # AuthContext, SettingsContext
│   ├── integrations/supabase/   # Client + TypeScript-Types (3865 Zeilen)
│   └── data/                    # Landing-Page & Ratgeber-Daten
├── supabase/
│   ├── functions/               # 57 Edge Functions
│   ├── migrations/              # 65+ Migrationen
│   └── config.toml
├── worker/                      # Cloudflare Worker (wrangler)
├── docker/                      # Nginx Konfiguration
├── tests/e2e/                   # Playwright E2E Tests
└── docs/                        # Projekt-Dokumentation
```

---

## Benutzerrollen (Enum: `app_role`)

| Rolle | Beschreibung |
|-------|-------------|
| **admin** | Vollzugriff auf Admin-Panel, Nutzerverwaltung, Auktionen, Finanzen |
| **dealer** | Händler – kann bieten, Auktionen gewinnen, hat eigenes Dashboard |
| **seller** | Privater Verkäufer – kann Fahrzeuge eintragen und verkaufen |

---

## Datenbank-Schema (60+ Tabellen)

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

---

## Edge Functions (57 deployed)

### Auktions-System
`place-bid`, `handle-autobid`, `close-auction`, `check-expired-auctions`, `instant-buy`, `accept-kaufchance-offer`, `notify-auction-winner`

### E-Mail-System
`send-admin-email`, `send-broadcast-email`, `send-welcome-email`, `send-appointment-confirmation`, `send-appointment-reminder`, `send-auction-ending-notification`, `send-auction-notification`, `send-auction-summary`, `send-bid-notification`, `send-dealer-notification`, `send-dealer-auction-digest`, `send-expert-valuation`, `send-favorite-notification`, `send-inactivity-email`, `send-invoice-email`, `send-lead-notification`, `send-payment-confirmation`, `send-payment-reminder`, `send-purchase-inquiry-notification`, `send-push-notification`, `send-registration-invite`, `send-wizard-resume-email`, `send-wrong-number-email`, `send-auto-response`, `inbound-webhook`, `process-scheduled-emails`

### Händler-Management
`register-dealer`, `dealer-document-upload`, `get-dealer-auth-status`, `request-dealer-documents`

### Finanzen & Dokumente
`generate-invoice-pdf`, `generate-purchase-contract`, `process-dunning`

### KI & Automation
`ai-valuation`, `generate-ai-description`, `auto-convert-wizard`, `process-abandoned-wizards`

### Sonstige
`admin-create-user`, `admin-delete-user`, `log-error`, `track-conversion`, `resend-confirmation-email`, `sitemap`, `fetch-attachment-url`, `upload-wizard-photos`, `notify-vehicle-question`, `generate-appointment-pin`, `verify-appointment-pin`, `complete-handover`, `generate-handover-pdf`, `get-recipient-count`

---

## Cron Jobs (9 aktiv)

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

## Storage Buckets (5)

| Bucket | Public | Max Size | Formate |
|--------|--------|----------|---------|
| `branding` | Ja | 5 MB | JPEG, PNG, SVG, WebP, ICO |
| `motorhome-photos` | Ja | 100 MB | JPEG, PNG, WebP, GIF, HEIC, AVIF |
| `dealer-documents` | Nein | 10 MB | PDF, JPEG, PNG, HEIC |
| `invoices` | Nein | 10 MB | PDF |
| `purchase-contracts` | Nein | – | – |

---

## Geschäftsprozesse

### 1. Verkaufs-Flow (Seller)
Seller füllt 6-10 Step Wizard aus → Wizard-Session wird gespeichert (auch ohne Login) → Abgebrochene Wizards werden per Cron erinnert → Admin prüft und erstellt Motorhome + Auktion.

### 2. Auktions-Flow (Dealer)
Aktive Auktionen auf `/kaufen` → Dealer bieten (atomar) → Auto-Bid System → Soft-Close → Cron schließt abgelaufene Auktionen → Gewinner wird benachrichtigt + Rechnung erstellt.

### 3. Kaufchance
Auktion endet ohne Verkauf → Status `kaufchance` → Top-Bieter werden eingeladen, zu ihrem Höchstgebot zu kaufen.

### 4. Mahnwesen (5 Stufen)
Freundliche Erinnerung → Zweite Mahnung → Letzte Mahnung → Kontosperrung → Inkasso-Ankündigung.

### 5. Händler-Level-System
Bronze → Silber → Gold → Platin (basiert auf Gebote, gewonnene Auktionen, Umsatz, Punkte).

---

## Deployment

### Frontend (Netlify)
```bash
npm run build        # Vite Production Build → dist/
# Auto-deployed via Netlify Git-Integration
```

### Edge Functions (Supabase)
```bash
# Via MCP-Tool (IMMER mit files-Parameter!):
supabase_deploy_edge_function(project_id, name, entrypoint_path, files=[{name, content}])
```

### Datenbank-Migrationen
```bash
# Via Supabase MCP-Tool:
supabase_apply_migration(project_id, name, query)
```

---

## Umgebungsvariablen

| Variable | Beschreibung | Pflicht |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | Supabase Projekt-URL | Ja |
| `VITE_SUPABASE_ANON_KEY` | Supabase Public/Anon Key | Ja |

### Edge Function Secrets (Supabase Vault)

| Secret | Beschreibung |
|--------|-------------|
| `RESEND_API_KEY` | Resend.com API Key für E-Mail-Versand |
| `ADMIN_EMAIL` | Fallback Admin-E-Mail (kontakt@caravanwert.de) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push VAPID Keys |

---

## Supabase-Projekt Referenz

- **Projekt-ID:** `zcrwqxsyptjwkuxfacvq`
- **Region:** eu-west-1
- **DB Host:** db.zcrwqxsyptjwkuxfacvq.supabase.co
- **Postgres:** 17.6
- **E-Mail-Domain:** info@caravanwert.de
