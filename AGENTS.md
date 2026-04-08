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

## Wizard Funnel Data (Apr 2026)
- Step 1→2: 15.2% drop (43/283)
- Step 2→3: 15.2% drop (43/283) ← BIGGEST bottleneck
- Completion rate: 39.6% (112/283)
- Most Step 2 droppers have ZERO fields filled → form overwhelm

## Conversion Optimization (08.04.2026)
- Redesigned VehicleInfoStep with progressive disclosure
- Top manufacturers as chips, searchable list for rest
- Model suggestions from vehicle-data.ts
- Micro-progress indicators within steps
- Condition as clickable tiles instead of dropdown
