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
- **Step numbering mismatch**: Schema names (step1Schema–step8Schema) don't match step numbers in validateStep. E.g., step3Schema validates Step 5 (QuickContact), step4SchemaWohnmobil validates Step 3 (DetailsStep).

## Wizard Funnel Data (Apr 2026, 241 sessions since March)
- Step 1 drop: 21 (8.7%), Step 2 drop: 19 (7.9%), Step 3 drop: 21 (8.7%)
- Step 4 drop: 9 (3.7%), Step 5 drop: 5 (2.1%)
- **Step 6 (Photos) drop: 24 (10.0%)** ← BIGGEST bottleneck (22 of 24 have 0 photos!)
- Step 7 drop: 8 (3.3%), Completed: 132 (54.8%)
- **Completion by body type**: Alkoven 80%, Wohnwagen 65.6%, Vollintegriert 56.3%, Teilintegriert 55.9%, Kastenwagen 54.5%, Campingbus 37.5%
- **Step 2 droppers**: 6 instant-bouncer (<1min, 0 fields), 6 model-search-frustration, 3 typo-related, 4 returning users
- **Step 6 droppers**: Real users with email+data who saw photo upload and bailed

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
- Erstzulassung: originally type="date" → type="month" → Phase 7: custom Monat/Jahr Selects

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
- **Wohnmobil**: 96 Hersteller, 1035 Modelle
- **Wohnwagen**: 36 Hersteller, 156 Modelle
- **Basisfahrzeuge**: 21 Chassis-Optionen mit 82 PS-Werten
- User data analysis: Most common free-form entries verified against model lists
- Forster VB-Serie, Rimor Bliss/Europe, Sprite, Bailey, T@B added based on real user patterns

### Phase 7 – Step 3 UX-Optimierung (08.04.2026, committed)
- **Erstzulassung**: Native `type="month"` Picker ersetzt durch Monat/Jahr-Dropdowns (browser-unabhängig, keine "---------- ----" Anzeige mehr)
- **Kraftstoffart**: Dropdown durch 4 klickbare Tiles ersetzt (⛽ Diesel/⛽ Benzin/🔋 Hybrid/⚡ Elektro)
- **Getriebe**: Dropdown durch 2 klickbare Tiles ersetzt (⚙️ Schaltung/🅰️ Automatik) – reduziert Klicks von 4 auf 2 pro Feld
- **Basisfahrzeug & Leistung**: Collapsible-Sektion mit Toggle-Button (default: zugeklappt für neue User, offen wenn Daten vorhanden)
- **Wohnwagen-Erstzulassung**: Gleicher Monat/Jahr-Dropdown Fix
- **Analyse-Ergebnis**: Step 3 NICHT in 2 Steps aufteilen – nur 9.1% Absprung, Splitting würde Wizard psychologisch verlängern. Stattdessen: visuell entlasten durch Tiles + Collapsible.

### Phase 8 – Modell-Datenbank Expansion (08.04.2026, committed)
- **Live-Analyse bestätigt**: Wizard Steps 1–8 funktionieren einwandfrei (Desktop)
- **DB-Analyse**: Pössl-Nutzer (6.-häufigster Hersteller, 12 Sessions) brach bei Step 2 ab wegen fehlender Modellvorschläge
- **Pilote**: 5 → 27 Modelle (Pacific, Galaxy, Atlas, Van, Explorateur, Aventura, Reference, Sensation, Vega, Foxy Van)
- **Rapido**: Duplikate entfernt, 24 echte Modellnummern (C50-C86, V-Serie, 6F/8F/80dF, Distinction i-Serie)
- **GiottiLine**: 4 → 18 Modelle (Siena, Toscan, GiottiCompact, GiottiVan, Therry-Serie)
- **Roller Team**: 7 → 19 Modelle (Kronos, Zefiro, Livingstone, Pegaso, T-Line mit Nummern)
- **Sun Living**: 5 → 16 Modelle (Lido + S/A/V/C-Serie mit spezifischen Nummern)
- **Sunlight**: +6 Modelle inkl. T 65 (von echtem Nutzer gesucht aber fehlend!)
- **Le Voyageur**: 5 → 11 (LV + Liner mit Längenangaben)
- **Concorde**: 7 → 11 (Credo Action, Charisma III, Cruiser Daily, Liner Plus, Compact)
- **Total**: 96 Hersteller, 1117 Modelle (vorher 1035, +82 Modelle, +7.9%)

## Vehicle Data Stats
- Wohnmobil: 96 Hersteller, 1117 Modelle
- Wohnwagen: 36 Hersteller, 156 Modelle
- Basisfahrzeuge: 19 (mit PS-Optionen)
- Popular WM: Hymer(56), Bürstner(37), Dethleffs(33), Knaus(29), Pilote(27), Weinsberg(27), Adria(27)
- Popular WW: Hobby(10), Fendt(10), Wilk(10), Kabe(9), Tabbert(9), Bürstner(9)

## Real User Data Insights (08.04.2026)
- Top WM-Hersteller nach Sessions: Hobby(24), Dethleffs(19), Weinsberg(15), Bürstner(14), Hymer(12), Pössl(12)
- Nutzer geben oft sehr spezifische Modellnummern ein (z.B. "560 CFe", "T6613 EB") → Freitext-Feld essential
- Häufige Tippfehler: "Sunligth", "Bürstner " (Leerzeichen), "Exzellent"
- "Carado T447" als Hersteller eingetragen (4 Sessions) → Nutzer verwechseln Hersteller/Modell-Feld
- "Fiat Ducato" als Pössl-Modell eingetragen → Nutzer verwechseln Basisfahrzeug/Modell

### Phase 9 – Deep Funnel Analysis & Fixes (08.04.2026, committed)
- **Datenbasierte Tiefenanalyse**: Alle 241 Sessions einzeln analysiert (form_data JSON-Felder: customerName/customerEmail/saleChannel)
- **Fuzzy-Suche implementiert**: Bigram-Overlap + Single-Char-Off Algorithmus im SearchableSelect
  - Getestet: smara→Amara(0.7), Exzellent→Excellent(0.38), Pösl→Pössl(0.7), Dethlefs→Dethleffs(0.7), random→Hymer(0.0)
  - Behebt 3-6 Step-2-Abbrüche pro Monat (Tippfehler-bedingt)
- **Whitespace-Trimming**: onBlur in SearchableSelect trimmt trailing/leading spaces
  - Behebt "Bürstner " (trailing space) aus echten Sessions
- **Micro-Progress Fix**: Freetext-Hersteller zählen jetzt als "ausgefüllt" (manufacturer?.trim() statt manufacturers.includes())
- **Photo-Step prominenter Skip**: Neuer "Ohne Fotos fortfahren" Button OBERHALB des Upload-Bereichs
  - Ziel: 24 Step-6-Abbrecher reduzieren (22 davon hatten 0 Fotos)
- **Button-Label**: "Weiter – Fotos nachreichen" → "Weiter ohne Fotos" (klarere Absicht)
- **Sale Channel Stats**: Auction 59%, Instant Price 36%, Station 4.5%
- **Photo Upload Rate**: Nur 33% aller abgeschlossenen Sessions haben Fotos

## Known Remaining Items
- Baujahr ranges per model NOT implemented (user requested "von wann bis wann")
- Campingbus completion rate lowest at 37.5% – small sample, monitor
- 67% of completed sessions have 0 photos – consider post-wizard photo email workflow
- 4 users navigated back from later steps to Step 2 and got stuck

## Dev Environment Notes
- No .env file in repo; needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- Vite dev server has connectivity issues in container environments (hangs on curl)
- Build dist/ and serve with Python http.server works but lacks SPA routing
