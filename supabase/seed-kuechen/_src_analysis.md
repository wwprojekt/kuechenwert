# Caravanwert / kuechenwert-v2 – Source-Code-Analyse (read-only)

**Stand:** `kuechenwert-v2` (Kopie von Caravanwert)
**Pfad:** `C:\Users\PCUser\Projects\kuechenwert-v2\src`
**Scope:** Framework, Routen, Pages, Components, Hooks, Lib/Utils, Types, Rename-Aufwand.

---

## 1. Framework (package.json + vite.config.ts)

| Element | Befund |
|---------|--------|
| **Vite** | `vite` ^5.4.19, `@vitejs/plugin-react-swc` |
| **React** | ^18.3.1 |
| **React Router** | `react-router-dom` ^6.30.1 — Routing in `src/App.tsx` + Sub-Routing in `src/components/SmartDashboard.tsx` |
| **TanStack Query** | `@tanstack/react-query` ^5.83.0 |
| **shadcn/ui** | Kein NPM-Paket; klassischer Stack: Radix-UI + `class-variance-authority` + `tailwind-merge` + `tailwindcss-animate`; `src/components/ui/` (51 Dateien) |

---

## 2. Metriken

| Metrik | Wert |
|--------|------|
| **LOC gesamt (`src/**/*.ts(x)`)** | **130.446** |
| **Pages LOC (`src/pages`)** | 63.492 |
| **Components LOC (`src/components`)** | 36.549 |
| **Hooks LOC (`src/hooks`)** | ~4.667 (20 Produktions-Dateien) |
| **Page-Dateien** | 102 |
| **Component-Dateien** | 162 |
| **`src/types/**`** | 0 (Ordner leer/nicht genutzt) |
| **Generierte Supabase-Types** | 5.761 Zeilen (`src/integrations/supabase/types.ts`) |
| **`src/utils/**`, `src/services/**`** | 0 (nicht vorhanden) |

---

## 3. Routen (aus `src/App.tsx`)

### Public (ohne `ProtectedRoute`; Schutz über `SmartDashboard` / RLS)

| Pfad | Komponente |
|------|-----------|
| `/` | Index |
| `/login`, `/login/haendler` | Login, LoginHaendler |
| `/register`, `/register/privat`, `/register/haendler` | RegisterChoice, Register, RegisterHaendler |
| `/forgot-password`, `/reset-password`, `/auth/confirm` | ForgotPassword, ResetPassword, AuthConfirm |
| `/verkaufen`, `/verkaufen/wizard`, `/verkaufen/danke` | Verkaufen, VerkaufenWizard, VerkaufenDanke |
| `/ankaufstationen` | Ankaufstationen |
| `/wertermittlung`, `/wertrechner` | Wertermittlung, Wertrechner |
| `/kaufen` | Kaufen |
| `/auktion/:id` | AuctionDetail (via AuctionRoute) |
| `/ratgeber`, `/ratgeber/:slug` | Ratgeber, RatgeberPage |
| `/ueber-uns`, `/kontakt`, `/haendler`, `/impressum`, `/datenschutz`, `/agb`, `/faq`, `/preise` | … |
| `/blog`, `/blog/:slug` | Blog, BlogPost |
| `/wohnmobil-verkaufen`, …, `/finanzierten-wohnwagen-verkaufen` | Landing Pages |
| `*` | NotFound |

### Admin (`/admin/*` via `AdminLayout`)

Nested Routes u. a.: `analytics`, `motorhomes`, `motorhomes/:id`, `auctions`, `users`, `dealers`, `claims`, `invoices`, `email-center`, `post-auction-offers`, etc.

### Dashboard (`/dashboard/*` via `SmartDashboard`)

**Seller:** Overview, Listings (List/Detail/Edit), Messages, Documents, Profile
**Dealer:** DealerDashboard, Auctions, Sofortkauf, Inventory, Bids, Favorites, Kaufchancen, Appointments, Messages, Contracts, Invoices, Claims, Search-Alerts, Listings/new, Settings
**Admin-User** werden von `/dashboard/*` nach `/admin` redirected.

---

## 4. Pages — Buckets

| Bucket | Dateien |
|--------|---------|
| `admin` | 34 |
| `public-marketing` | 31 |
| `dealer-portal` | 12 |
| `seller-funnel` | 11 |
| `seller-auth` | 7 |
| `dealer-auth` | 2 |
| `legal` | 3 |
| `auction-ui` | 1 |
| `unknown` | 1 |

### Hot-Spot-Pages nach Motorhome-Refs

| Page | LOC | Motorhome-Refs |
|------|-----|----------------|
| AuctionDetail.tsx | 3146 | 264 |
| dashboard/ListingDetail.tsx | 2250 | 197 |
| Wertrechner.tsx | 1639 | 106 |
| Kaufen.tsx | 1137 | 127 |
| dashboard/MyListings.tsx | 453 | 56 |
| dashboard/DashboardOverview.tsx | 1427 | 50 |
| dashboard/ListingEdit.tsx | 1061 | 102 |
| VerkaufenWizard.tsx | 993 | 33 |
| Haendler.tsx | 561 | 34 |
| admin/AdminMotorhomeDetail.tsx | — | 253 |
| admin/AdminMotorhomes.tsx | — | 135 |

---

## 5. Components — pro Unterordner

| Ordner | Dateien | Zeilen |
|--------|---------|--------|
| `(root)` | 60 | 13.653 |
| `admin/` | 22 | 10.561 |
| `ui/` | 51 | 3.992 |
| `dashboard/` | 10 | 3.698 |
| `wizard/` | 9 | 3.154 |
| `wertrechner/` | 5 | 1.164 |
| `skeletons/` | 5 | 327 |

### Top 10 größte Komponenten

1. `admin/ConvertToMotorhomeDialog.tsx` — 1166 LOC
2. `admin/AdminTrackingTab.tsx` — 932
3. `admin/MotorhomeEditDialog.tsx` — 792
4. `admin/AdminPhotoManager.tsx` — 765
5. `dashboard/SellerPhotoManager.tsx` — 760
6. `dashboard/NewOfferAlert.tsx` — 703
7. `wizard/VehicleInfoStep.tsx` — 659
8. `admin/UserEditDialog.tsx` — 654
9. `NotificationPreferences.tsx` — 624
10. `admin/DealerEditDialog.tsx` — 597

---

## 6. Hooks (`src/hooks/**`) — 20 Dateien

| Datei | Zweck |
|-------|--------|
| useUrlFilters.ts | Filterzustand synchron mit URL-Params (generic) |
| useUserLocation.ts | Geolocation + Cache (generic) |
| useFavorites.ts | TanStack-Query: Favoriten, Toggle per `motorhome_id` (rename nötig) |
| useUserRole.ts | Single source of truth für Rolle (admin/dealer/seller) |
| use-mobile.tsx | matchMedia Breakpoint 768px (generic) |
| usePushNotifications.ts | Web-Push: Permission, Subscription, VAPID (generic) |
| useWizardSession.ts | Anonyme/User-Wizard-Session in `wizard_sessions` |
| useExport.ts | CSV-Export-Helper (generic) |
| useWizardTelemetry.ts | Wizard-Analytics-Binding |
| useDealerPending.ts | Pending/Rejected-Dealer-Status |
| useWertrechnerReviewStats.ts | Review-Stats Wertrechner-UI (caravan-specific) |
| useAuditLog.ts | Audit-Log Read/Write |
| useWizardForm.ts | Zentrales Wizard-Form (Zod + Supabase) — caravan-heavy |
| useAudioNotification.ts | Notification-Sounds (generic) |
| useTurnstile.ts | Cloudflare Turnstile (generic) |
| useAnalytics.ts | Page-Tracking / User-Properties (generic) |
| useLiveData.ts | Supabase Realtime (generic) |
| useNow.ts | Countdown/Relative-Time |
| useTableSort.ts | Generische Tabellen-Sortierung |
| use-toast.ts | Toast-API (shadcn, generic) |

**~15 von 20 Hooks sind generisch** und können 1:1 übernommen werden.

---

## 7. Lib / Utils (`src/lib/**`)

Keine `src/utils/` oder `src/services/` vorhanden.

### api-wrapper

`integrations/supabase/client.ts`, `types.ts`, `sessionGuard.ts`, `errorLogService.ts`, `activate-auction.ts`, `adminAuctionCancel.ts`, `adminManualSale.ts`, `adminSuspendUser.ts`, `invoiceStorage.ts`, `dealerApplications.ts`

### domain-logic (Caravan-spezifisch — **müssen angefasst werden**)

- `valuation/algorithm.ts`, `schema.ts`, `bodyTypes.ts`, `manufacturers.ts`, `modelFactors.ts`, `modelYearRanges.ts`, `tiers.ts`, `depreciation.ts`, `conditions.ts`
- `vehicle-data.ts`
- `commissionCalculator.ts`, `invoiceDerived.ts`, `invoiceStatus.ts`, `invoiceGenerator.ts`
- `auction-columns.ts`, `freshBadge.ts`
- `wizardTelemetry.ts`
- `marketing-config.ts`, `pendingDealerTranslations.ts`, `dealerRegistrationTranslations.ts`

### generic-util

`utils.ts`, `lazyRetry.ts`, `logger.ts`, `parseGermanNumber.ts`, `security.ts`, `validation.ts`, `germanErrors.ts`, `geolocation.ts`, `plzCoordinates.ts`, `euCountries.ts`, `imageTransform.ts`, `imageOptimization.ts`, `imageMagicDetect.ts`, `serviceWorker.ts`, `seo.ts`, `storageUtils.ts`, `clickIdService.ts`, `trackingConfig.ts`, `analyticsService.ts`, `metaPixelService.ts`, `gadsConversionService.ts`, `uetService.ts`

---

## 8. Types

- `src/types/**`: leer
- `src/integrations/supabase/types.ts`: **5.761 Zeilen** generiert (enthält `motorhome*`-Tabellen/Spalten)
  → muss nach der DB-Rename-Migration neu generiert werden (`supabase gen types typescript`)

---

## 9. Rename-Aufwand (ripgrep `src`, case-insensitive)

| Begriff | Matches | Dateien |
|---------|---------|---------|
| motorhome | 2783 | 99 |
| wohnmobil | 2403 | 139 |
| wohnwagen | 630 | 56 |
| caravan | 467 | 109 |
| hymer | 402 | 30 |
| knaus | 297 | 25 |
| tuev/tüv | 211 | 31 |
| kastenwagen | 166 | 30 |
| teilintegriert | 113 | 43 |
| vollintegriert | 106 | 30 |
| alkoven | 86 | 35 |
| \bps\b | 78 | 25 |
| pkw | 16 | 6 |
| \bau\b | 12 | 3 |
| hubraum | 6 | 5 |
| kfz-brief | 4 | 1 |
| **Summe (nicht dedupliziert)** | **~7.780** | — |

### Top-Dateien nach Treffer-Summe (Fahrzeug-Begriffe ohne tüv/ps/au/kfz)

| Summe | Datei |
|-------|--------|
| 419 | `src/data/ratgeber/ratgeber-meta.ts` |
| 292 | `src/data/ratgeber/ratgeber-hymer.ts` |
| 266 | `src/pages/AuctionDetail.tsx` |
| 261 | `src/data/ratgeber/ratgeber-knaus.ts` |
| 253 | `src/pages/admin/AdminMotorhomeDetail.tsx` |
| 197 | `src/pages/dashboard/ListingDetail.tsx` |
| 180 | `src/data/ratgeber/ratgeber-poessl.ts` |
| 138 | `src/data/ratgeber/ratgeber-condition-situation.ts` |
| 135 | `src/pages/admin/AdminMotorhomes.tsx` |
| 128 | `src/pages/Kaufen.tsx` |

---

## 10. Schluss-Empfehlung

1. **1:1 übernehmen:** `src/components/ui/**`, ~15 von 20 Hooks, `lib/utils.ts`, `lazyRetry`, Logger, Geolocation, Tracking-Hüllen, alle SEPA/Invoice-Utilities. → **~30-40k LOC** quasi unverändert.

2. **Caravan-only / komplett löschen oder neu:** `src/lib/valuation/**`, `vehicle-data.ts`, Wizard-Steps (`VehicleTypeStep`, `VehicleInfoStep`, `EquipmentStep`), Admin-`Motorhome*`-Dialoge/Pages, `src/data/ratgeber/*`, `src/data/landing-page*.ts`. → **~30-40k LOC** neu oder massiv angepasst.

3. **Generalisierbar (Rename + Schema-Migration):** Wizard-Framework (`useWizardForm`, `useWizardSession`, `useWizardTelemetry`), Auktions-UI (`AuctionDetail`, Bids/Favoriten), Dashboard-Shell (`SmartDashboard`, Sidebars), TanStack-Query-Patterns. → **~50-60k LOC** werden durch Entity-Rename verändert (grep-/codemod-basiert).

4. **Backend-Types / API:** `integrations/supabase/types.ts` wird nach der DB-Rename-Migration regeneriert. Alle `motorhome_id`/Tabellennamen-Referenzen im Code-Level brauchen einen **find-and-replace pass**.

5. **Stunden-Schätzung:**
   - **Reiner Rename** (nur Frontend-Wortlaut + Routing SEO, bestehende Logik bleibt): **80–160 h**
   - **Inkl. DB-Rename-Migration, neue Bewertungslogik, Content-Neuaufbau**: **200–400+ h**
   - Stark abhängig davon, wieviel von der Caravan-Funnel-Logik (`VerkaufenWizard`, `Wertrechner`, `Wertermittlung`) durch die vorhandenen KüchenWert-Funnels A/B/C ersetzt wird.

---

### Routing-Referenz

```typescript
// src/App.tsx – nested admin-Routing (zur Orientierung)
<Route path="/admin" element={<AdminLayout />}>
  <Route path="motorhomes" element={<AdminMotorhomes />} />
  <Route path="motorhomes/:id" element={<AdminMotorhomeDetail />} />
  ...
</Route>
<Route path="/dashboard/*" element={<SmartDashboard />} />
```

→ `AdminMotorhomes` / `AdminMotorhomeDetail` werden später `AdminKitchens` / `AdminKitchenDetail`.

---

*Erstellt rein lesend; keine Repo-Änderungen.*
