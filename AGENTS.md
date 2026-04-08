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

## Dev Environment Notes
- No .env file in repo; needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- Vite dev server has connectivity issues in container environments (hangs on curl)
- Build dist/ and serve with Python http.server works but lacks SPA routing
