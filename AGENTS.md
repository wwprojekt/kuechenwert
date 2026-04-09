# AGENTS.md – CaravanWert Repository Knowledge

## Project Overview
- German-language Wohnmobil/Wohnwagen sales platform with auction system
- Supabase project ID: `zcrwqxsyptjwkuxfacvq` (eu-west-1)
- Stack: React 18 + TypeScript + Vite 5 + Tailwind + shadcn/ui + Supabase

## Build & Dev
```bash
npm run dev          # Vite dev server (Port 8080)
npm run build        # Production build via Vite → dist/
```

## Key Architecture Patterns
- **Wizard**: 8-step sales wizard at `/verkaufen/wizard` (VerkaufenWizard.tsx)
  - Steps: VehicleType → VehicleInfo → Details → Equipment → QuickContact → Photos → SaleChannel → AccountLocation
  - Session persistence via `useWizardSession.ts` (anonymous_id-based for non-auth users)
  - Form state in `useWizardForm.ts` with Zod validation per step
  - Vehicle data (manufacturers/models) in `src/lib/vehicle-data.ts`
- **Step numbering mismatch**: Schema names (step1Schema–step8Schema) don't match step numbers in validateStep. E.g., step3Schema validates Step 5 (QuickContact), step4Schema validates Step 3 (now fully optional).
- **Step 3 is fully optional** (no validation): Smart defaults pre-fill Diesel + Schaltung + Keine Mängel. User can pass with 0 clicks.

## Wizard Funnel Data (Apr 2026, 224 all-time sessions)
- Step 1 drop: 14 (6.3%), Step 2 drop: 15 (6.7%), Step 3 drop: 16 (7.1%)
- Step 4 drop: 7 (3.1%), Step 5 drop: 6 (2.7%)
- **Step 6 (Photos) drop: 24 (10.7%)** ← BIGGEST bottleneck
- Step 7 drop: 11 (4.9%), Completed: 129 (57.6%)
- Step 2 droppers: ~50% have ZERO fields filled → form overwhelm

## Conversion Optimizations (08.04.2026)
### Phase 1 – Step 2 Redesign (committed)
- Redesigned VehicleInfoStep with progressive disclosure
- Top manufacturers as chips, searchable list for rest
- Model suggestions from vehicle-data.ts
- Micro-progress indicators within steps (X von 5)
- Condition as clickable tiles with emojis instead of dropdown

### Phase 2 – Navigation & Orientation (committed)
- Auto-advance on Step 1: clicking body type tile → 450ms delay → auto-proceeds
- Step dots under progress bar for visual orientation
- "Schritt X von 8: Name" label above progress bar
- Contextual Weiter labels: "Weiter zu Fahrzeugdaten", "Weiter zu Details", etc.
- Progress starts at 12% instead of 8% (less discouraging)
- Erstzulassung changed from type="date" (mm/dd/yyyy) to type="month" (German-friendly)

### Phase 3 – Photos & SaleChannel Drop-off Fix (committed)
- **PhotosStep redesign**: Removed confusing "Fotos später nachreichen" toggle button (was alongside "Weiter")
- Changed from blue FOMO warning to green reassurance banner ("Kein Problem ohne Fotos")
- Made "optional" prominent in subtitle text
- Removed intimidating "max. 30 Fotos, je max. 100 MB" from upload hint
- Photo tips collapsed into `<details>` to reduce visual overwhelm
- "Weiter ohne Fotos" → "Weiter – Fotos nachreichen" (positive framing)
- Dynamic green banner: shows upload count when photos exist
- **SaleChannelStep**: Pre-selects "auction" (recommended) on mount to reduce required clicks

### Phase 4 – Basisfahrzeug/Chassis-basierte PS-Auswahl & Modelldaten (committed)
- **Basisfahrzeug dropdown** in DetailsStep (Step 3) with 18 chassis options
  - Fiat Ducato, Mercedes Sprinter, Ford Transit, VW Crafter/T5/T6, MAN TGE, etc.
  - Selecting chassis shows PS options as clickable chips (no manual typing needed)
  - Falls back to manual number input if "Sonstige" or no chassis selected
- **Vehicle data expanded** for top manufacturers based on real user input analysis:
  - Hobby, Hymer, Bürstner, Dethleffs, Knaus, Ahorn all expanded
  - Wohnwagen: Fendt (+Platin, Brillant), Hobby (+Freistaat Edition), LMC (+Dominant), TEC (+Freetec)
- **Key insight**: PS depends on chassis (Ducato=120/140/160/180), NOT on Wohnmobil brand
- **User data patterns** (from wizard_sessions): Users type free-form models with floor plan numbers (e.g., "Excellent 560 UL"), some confuse manufacturer/model (e.g., "Carado T447" as manufacturer)

## Competitor Analysis (Apr 2026)
- **Caravanmarkt24**: 4-step flow, 10-15min, immediate offer within 24h
- **TruckScout24**: Vehicle-type-first, mandatory: type/make/model/registration/mileage/price, up to 15 photos
- **mobile.de**: Extensive API fields (make, model, power kW, registration), 15 photos, paid visibility packages
- **Key takeaways**: Minimal required fields + rich optional data; photo quality is critical; time estimates reduce friction

### Phase 5 – Data Integrity & Backend Fixes (08.04.2026)
- **DB migration**: Added `base_vehicle` column to `motorhomes` table
- **Edge Function**: `auto-convert-wizard` v14 deployed – maps `formData.baseVehicle` → `base_vehicle`
- **PS→kW conversion**: PS chips and manual input both auto-calculate `power_kw` (PS × 0.7355)
- **Chips show both units**: e.g. "140 PS (103 kW)" for professional feel

## Vehicle Data Stats (08.04.2026)
- **Wohnmobil**: 96 Hersteller, 1165 Modelle
- **Wohnwagen**: 36 Hersteller, ~175 Modelle
- **Basisfahrzeuge**: 29 Chassis-Optionen mit 157 PS-Werten (inkl. E-Ducato + eSprinter)
- **PS-Format**: Chips zeigen `XXkW/YYYPS` (z.B. "103kW/140PS")
- **Letzte Erweiterung**: Knaus (Van Wave, Sky Wave, Sky I, CUVision), Pössl (Summit Shine, Roadstar X/XT, Campstar, Vanstar), Weinsberg (Edition PEPPER/FIRE, CUVolution), Etrusco (Base-Serie), Renault Master 130PS (2025), Fiat E-Ducato, Mercedes eSprinter
- User data analysis: Most common free-form entries verified against model lists
- Forster VB-Serie, Rimor Bliss/Europe, Sprite, Bailey, T@B added based on real user patterns

## Dealer Activation (08.04.2026 Session 2)

### Problem Analysis
- 44 approved dealers, but only **7 have EVER bid** (16% activation rate)
- **37 dealers (84%) have ZERO bids** → "sleeping dealers"
- Root cause: **No "new auction" notifications were being sent** (0 emails of type auction_new_auction ever)
- /haendler page described SELLING process instead of BUYING/bidding
- Inactivity email only triggered after 30 days (too late)
- Approval email was generic without showing available auctions

### Fixes Implemented
1. **send-dealer-auction-digest** Edge Function (NEW): Daily digest at 08:00 with new/ending auctions
2. **send-dealer-notification** (type: approved): Now includes Top-5 live auctions with prices/bids
3. **/haendler page**: Completely rewritten for auction-buying perspective
4. **send-inactivity-email**: Added 3-day "first nudge" tier for dealers who never bid
5. **DealerDashboard**: Onboarding card with 3-step guide for dealers with 0 bids
6. **DB**: Added `status_changed_at` column to `dealer_applications` + trigger
7. **Cron**: Daily digest at 08:00, inactivity check changed from weekly to daily

### Anti-Spam Design
- Digest: max 1/day, skips if nothing new, opt-out via broadcast_emails_enabled
- First nudge: exactly once per dealer, only 3-30 days after approval
- Inactivity: max once per 30 days (unchanged)
- New dealer: 24h grace period after approval (no digest, just approval email)

### Edge Functions Requiring Deployment
After code changes, these functions need redeploying:
- `send-dealer-auction-digest` (NEW)
- `send-dealer-notification` (updated approval email)
- `send-inactivity-email` (added first-nudge tier)

### Dealer Email Journey (After Fix)
1. Day 0: Registration → application_received + confirm email
2. Day 0-2: Admin approves → **approval email WITH live auctions**
3. Day 1+: **Daily auction digest** (new/ending auctions, personalized)
4. Day 3: **First nudge** if no bid yet (one-time, with step-by-step guide)
5. Ongoing: outbid/ending_soon/won/lost (transactional, unchanged)
6. Day 30+: Inactivity reminder (unchanged, monthly max)

## Dealer Flow Fixes (08.04.2026 – Phase 6)
### DB Migrations Applied
- `approve_dealer_application()`: Now syncs company_name, street, zip, city, country, vat_id → profiles
- `create_auction_invoice()`: Fixed parameter name (dealer_id_param), added reverse charge
- `create_instant_buy_invoice()`: Fixed referencing non-existent columns + reverse charge
- `get_dealer_tax_info(dealer_id)`: New helper → 19% DE / 0% EU reverse charge
- `reapply_dealer_application()`: New function for rejected dealers to re-apply
- New columns: `invoices.reverse_charge`, `invoices.dealer_country`, `profiles.vat_id`, `dealer_applications.vat_id`
- Backfill: All 44 approved dealers' profiles synced from dealer_applications

### Edge Functions Deployed
- `register-dealer` v2: Stores vatId
- `generate-invoice-pdf` v13: Reverse charge box, full dealer address + USt-IdNr

### Frontend Changes
- SmartDashboard: EmailVerificationBanner also in DealerLayoutContent
- PendingDealerBanner: Re-apply button for rejected dealers (calls `reapply_dealer_application` RPC)
- useDealerPending: Country from DB → user_metadata → 'DE' fallback chain
- RegisterHaendler: USt-ID field for non-DE countries, FileText icon
- AdminDealerDetail: Email unconfirmed warning + resend button
- dealerRegistrationTranslations: All 8 languages' benefits corrected

### CRITICAL BUG FOUND & FIXED
- `create_auction_invoice()` had param name `winner_id_param` but `close-auction` called with `dealer_id_param` → would have caused invoice creation to fail on next auction close

## Dealer Acquisition & Activation (08.04.2026 Session 3)

### Problem Analysis (Daten-basiert)
- **44 approved dealers, nur 7 haben jemals geboten (16% Aktivierung)**
- **37 Händler (84%) = 0 Gebote** → komplett schlafend
- Nur 1 wirklich aktiver Händler (Autohaus Schiller: 42 Gebote, Gold)
- **31 aktive Auktionen, meisten mit 0 Geboten** → Supply/Demand Mismatch
- 2 verkauft von 63 Auktionen = 3.2% Erfolgsrate
- Registrierungs-Funnel: 169 /haendler Views → 152 /register → 43 Applications (90d) = 28% OK
- **Root Cause: Kein Digest-Email wurde jemals gesendet** (Function war nie deployed!)

### Fixes Implemented
1. **KRITISCH: `send-dealer-auction-digest` Edge Function deployed** (v1)
   - War nur als Code vorhanden, nie deployed → Cron lief ins Leere
   - DB-Migration: `dealer_auction_digest` + `dealer_first_nudge` Email-Types zur Constraint hinzugefügt
   - Ab morgen 08:00: Alle 44 Händler erhalten täglichen Auction Digest
   
2. **/haendler Seite: Live-Auktionen Preview**
   - Echte Fahrzeug-Karten mit Fotos, Countdown-Timer, "Noch ohne Gebot" Badge
   - Echtzeit-Statistiken statt hardcoded values
   - LIVE-Badge mit Pulse-Animation für Urgency
   
3. **/kaufen Seite: Dealer Registration CTA**
   - Banner für nicht-eingeloggte Besucher: "Sie sind Händler?"
   - Link zu /register/haendler
   
4. **Neue SEO Landing Page: /wohnmobil-haendler-werden**
   - B2B-Akquise-Seite für Google Ads Targeting
   - FAQ, Live-Stats, Schema.org Structured Data
   - Keywords: 'wohnmobil händler werden', 'wohnmobil auktion händler'

### Dealer Activation Metrics to Monitor
- Daily digest email send count (admin_emails WHERE email_type = 'dealer_auction_digest')
- First-bid rate after digest (compare pre/post deployment)
- /haendler → /register/haendler conversion (analytics_page_views)
- Bids per auction trend (currently avg ~0.3, target: 2+)
### Phase 5b – Step 3 (DetailsStep) Redesign (08.04.2026)
- **Root cause**: 83% of Step 3 droppers filled ZERO fields → visual overwhelm (6 sections visible at once)
- **Progressive Disclosure**: Phase 1 (fuel+transmission) → Phase 2 (sleeping chips) → Phase 3 (defects pre-selected) → Optional collapsed
- **seats_with_seatbelts**: Moved from required → optional (collapsed section)
- **Pflichtfelder reduced**: Wohnmobil 5→4, Wohnwagen 2→2 (unchanged)
- **Mängel pre-selected**: "Keine Mängel" auto-selected on mount → 0 decisions needed
- **Schlafplätze**: Dropdown → Chip-Row [1-9] (one tap)
- **Optional collapsed section**: Sitzplätze, Erstzulassung, Basisfahrzeug, Fahrzeugzustand-Checkboxen
- **Validation schema updated**: step4SchemaWohnmobil no longer requires seats_with_seatbelts

### Competitor Analysis: caravanmarkt24.de
- Ultra-minimal entry: 2 fields only (Fahrzeugtyp dropdown + Marke dropdown)
- FOMO: "138 Anfragen in den letzten 24 Stunden" with fire emoji
- Time promise: "Jetzt Daten eintragen (3 Min)"
- Google 4.9 rating badge directly in form
- Progressive disclosure: start simple → expand after initial commitment
- No visible multi-step wizard at entry point

### Phase 5c – Step 4 Redesign: Fahrzeug-Details & Ausstattung (08.04.2026)
- **Problem**: Sitzplätze, EZ, Basisfahrzeug, Zustand-Checkboxen waren in Step 3 als collapsed "optional" versteckt – aber Händler brauchen diese Infos
- **Daten-Beweis**: 69% der Nutzer füllen Sitzplätze freiwillig aus, 96% Nichtraucher, 88% Unfallfrei → Nutzer WOLLEN das
- **TÜV/HU Katastrophe**: Nur 21% der Motorhomes hatten TÜV-Daten (16/77) – jetzt im Wizard sichtbar
- **Step 3 → Step 4 Migration**: Optional-Section aus Step 3 entfernt, Felder nach Step 4 verschoben
- **Step 4 Aufbau**: Oben sichtbar (Fahrzeug-Details) + unten collapsed (25 Equipment-Checkboxen)
  - Sichtbar: Sitzplätze (Chips), EZ + TÜV/HU (MonthYearPicker), Basisfahrzeug/PS, Unfallfrei/Nichtraucher/Scheckheft
  - Collapsed: Wohnbereich, Fahrzeug-Extras, Energie & Außen, Freitext
- **Wohnwagen**: Nur TÜV/HU + Zustand-Checkboxen (kein EZ, Sitzplätze, Basisfahrzeug)
- **Step-Name**: "Ausstattung" → "Details & Ausstattung", Label "Weiter zu Kontakt"
- **MonthYearPicker**: Wiederverwendbare Komponente für EZ + TÜV (mit futureYears-Param für TÜV)

### Phase 6 – Step 3 Zero-Friction Redesign + Konkurrenzanalyse (08.04.2026 Session 3)
- **Caravanmarkt24 Analyse**: Single-page progressive disclosure, nur 4 Felder (Typ/Marke/Kategorie/Baureihe), KEINE Tech-Details
  - "3 Min" Zeitschätzung, "138 Anfragen in 24h" Social Proof, Google 4.9★ Badge
  - Kein Multi-Step Wizard, sondern Felder erscheinen nach und nach auf einer Seite
- **Step 3 Redesign**: "Technische Details" → "Bessere Angebote erhalten"
  - 0 Pflichtfelder (vorher 4), Smart Defaults: Diesel + Schaltung + Keine Mängel
  - Kein Progressive Disclosure mehr innerhalb des Steps
  - Grüne CheckCircle2-Haken bei gefüllten Feldern
  - Positives Framing: "Händler bieten bis zu 15% mehr"
  - step4SchemaWohnmobil/Wohnwagen → step4Schema (leeres z.object)
- **Critical Data Fixes** (same session):
  - 2 sold auctions (Eriba €10.950, Forster €23.000) hatten keine Rechnungen → CA2026-001014 + CA2026-001015 erstellt, PDFs generiert, Emails + Winner-Notifications gesendet
  - 3 Wizard-Sessions (Chausson C656, Bürstner A574/3, XGO Dynamic 25) als "converted" markiert ohne Motorhome → re-converted erfolgreich
  - 2 Kaufverträge (KV-2026-00001, KV-2026-00002) reaktiviert
- **auto-convert-wizard v15**: Partial-failure recovery – prüft ob Motorhome existiert bevor "already converted" zurückgegeben wird
- **Security Migration**: 11× search_path gefixt, public_site_settings → SECURITY INVOKER, 2 RLS-Policies hinzugefügt

## Wertrechner Kalibrierung (09.04.2026)
- **Problem**: Algorithmus überschätzte Ø 62,7% vs. Experten-Bewertungen (80% der Fälle zu hoch)
- **Root Cause**: Zu hohe Basispreise (integriert 120k), Luxus-Tier ×2.8, Abschreibung flacht ab Jahr 5 bei nur 3%
- **Datengrundlage**: 284 Leads mit Algo + Experten-Wert, 299 KI-Trainingsdaten
- **Fixes**: Basispreise -20-30%, Tiers gesenkt (luxus 2.0, premium 1.2), Abschreibungskurven 13 Stufen
- **Ergebnis**: Concorde 1994 Alkoven von +486% auf +15%, Dethleffs 2003 von +83% auf -26%
- **Fallback-Label**: KI-Fehler zeigt jetzt "Algorithmische Schätzung" (grau) statt irreführend "KI-Wertschätzung" (teal)
- **Konfidenz-Spanne**: ±5% bei ≥85%, ±10% bei ≥70%, ±15% bei ≥50%, ±20% bei <50%
- **Hinweis**: User sieht in ~95% der Fälle den KI-Wert (299 Trainingsdaten, API Key aktiv). Algo ist nur Fallback.

## Google Tracking Fixes (08.04.2026 Session 5)

### 7 Critical Bugs Fixed
1. **trackUserRegistered**: Removed BEWERTUNG_ABGESCHLOSSEN conversion (was firing on EVERY registration, not just wizard completion)
2. **LANDING_PAGE_LEAD**: Downgraded from primary (5€) to secondary conversion (1€) – landing pages capture NO contact data
3. **trackBeratungRequested**: Removed TERMINBUCHUNG label – Ankaufstation inquiries are NOT appointments. New custom event: `purchase_inquiry`
4. **GCLID/GBRAID/WBRAID overwrite bug**: Each click-ID was overwriting the previous one in track-conversion. Fixed to merge all into one object.
5. **Missing transaction_id**: Added to trackWizardStarted, trackWizardStep, trackUserRegistered, trackBeratungRequested
6. **Dead code removed**: trackContactFormSubmitted, trackLeadContactData, trackPageView, trackAuctionCreated (all unused)
7. **WohnmobilHaendlerWerden**: Replaced trackLandingPageLead → trackCTAClick for dealer CTAs (no lead data captured)

### Edge Function Deployed
- `track-conversion` v11 – GCLID merge fix

### Still Pending (Requires User Action)
- **GA4_API_SECRET**: Must be created in Google Analytics → Admin → Data Streams → Measurement Protocol API secrets, then stored as Supabase secret. Without it, server-side tracking is inactive.
- In Google Ads: Reclassify `LANDING_PAGE_LEAD` conversion from "Primary" to "Secondary/Observation" in campaign settings

## Email Anti-Spam Fixes (08.04.2026 Session 5)

### Problem: Massive Email-Überflutung der Händler
- **209 Bid-Emails** total: 122 bid_confirmed + 87 bid_outbid
- **Autohaus Schiller**: 151 Emails total (96 Bid + 49 ending_soon + 4 winner + 2 invoice)
- **101 auction_ending_soon Emails** mit 4-5x Duplikaten pro Auktion pro Händler
- **22 favorite_notification Emails** (15 an einen einzigen User)

### Fixes
1. **bid_confirmed Email ENTFERNT** (place-bid v24)
   - In-App Notification bleibt (dealer_notifications)
   - UI-Feedback reicht (Toast + aktualisierter Betrag)
   - bid_outbid Email bleibt (hat Handlungsbedarf)

2. **auction_ending_soon Dedup gefixt** (send-auction-ending-notification v20)
   - ALTER: Subject-Match in admin_emails → funktionierte NICHT (Unicode/Race Condition)
   - NEU: Dedup via dealer_notifications (user_id + type + auction_id)
   - Dedup-Marker wird VOR dem Email-Versand inserted (Race-Condition-sicher)
   - Max 1 ending-soon Email pro Bieter pro Auktion, jemals

3. **favorite_notification Anti-Spam** (send-favorite-notification v9)
   - Max 1 price_change Email pro User pro 24h
   - Per-User Logging (email_type: `favorite_price_change`) für Dedup
   - DB: `favorite_price_change` zur admin_emails constraint hinzugefügt

### Noch nicht gefixt (niedrigere Priorität)
- `wizard_recovery_first`: Bis zu 6x pro User (Problem: neue Sessions desselben Users)
- Seller bekommt Email bei JEDEM neuen Gebot (send-auction-notification, nicht geloggt)
- Admin bekommt 113 Lead-Admin-Emails (sollte Digest sein)

## Known Remaining Items
- 1 approved dealer has unconfirmed email (admin can resend via new button)
- 37 of 44 approved dealers have never placed a bid (digest email should help starting tomorrow)
- Baujahr ranges per model NOT implemented (user requested "von wann bis wann")
- Search is starts-with; could benefit from fuzzy matching for typos (users type "Exzellent" for "Excellent")
- Edge Functions still needing redeployment: send-dealer-notification (updated approval email), send-inactivity-email (first-nudge tier)
- Consider: Dealer referral program, phone onboarding for top-value dealers

## Dealer Flow Audit (08.04.2026 Session 4)

### Bugs Found & Fixed
1. **RLS Stats Bug**: `/haendler` and `/wohnmobil-haendler-werden` showed "0+" dealers and "0 brands"
   - Root cause: `dealer_applications` RLS blocks anonymous SELECT → count always 0
   - Fix: Created `get_public_platform_stats()` SECURITY DEFINER function
   - Both pages now use `supabase.rpc("get_public_platform_stats")` instead of direct table queries
2. **Wrong Column Name**: `/wohnmobil-haendler-werden` queried `start_price` (doesn't exist) → `starting_bid`
3. **Wrong Column Name**: `/wohnmobil-haendler-werden` queried `storage_path` (doesn't exist) → `url`
   - Photos NEVER loaded on the dealer SEO landing page before this fix
4. **Confusing Stat**: "0 €" for Registrierung was misleading → changed to "Kostenlos"

### Dealer Flow Verification (Complete)
- ✅ `/haendler` – Landing page with live stats, auction previews, CTA
- ✅ `/wohnmobil-haendler-werden` – SEO landing page with live data, photos, FAQs
- ✅ `/register/haendler` – Registration form with all fields, document upload
- ✅ `/login` / `/login/haendler` – Login with Händler-Registrierung link
- ✅ `/kaufen` – Marketplace with Händler CTA banner, auction cards
- ✅ Dealer Dashboard – Onboarding card for 0-bid dealers
- ✅ `place-bid` – Restriction checks, atomic bidding, soft-close
- ✅ `instant-buy` – Restriction checks, full sale flow
- ✅ `accept-kaufchance-offer` – Race condition protection, counter-offers
- ✅ `close-auction` – Correct param names, invoice creation
- ✅ `send-dealer-auction-digest` – Deployed and active
- ✅ `send-dealer-notification` – Updated approval email deployed
- ✅ All 56 Edge Functions deployed and ACTIVE

### Public Platform Stats RPC
- Function: `get_public_platform_stats()` (SECURITY DEFINER)
- Returns: active_auctions, sold_auctions, approved_dealers, total_motorhomes, ending_soon, unique_brands
- Accessible by anon and authenticated roles

## Dev Environment Notes
- No .env file in repo; needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- Vite dev server has connectivity issues in container environments (hangs on curl)
- Build dist/ and serve with `npx vite preview --port 8011` for SPA routing support
