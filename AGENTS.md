# AGENTS.md – CaravanWert Repository Knowledge

## Project Overview
- German-language Wohnmobil/Wohnwagen sales platform with auction system
- Supabase project ID: `zcrwqxsyptjwkuxfacvq` (eu-west-1)
- Stack: React 18 + TypeScript + Vite 5 + Tailwind + shadcn/ui + Supabase

## Do
- Use React functional components with hooks
- Use TanStack React Query v5 for server state
- Use Zod for all form validation
- Use `ensureValidRLSSession()` before every RLS query
- Use `invokeWithAuth()` for all authenticated Edge Function calls
- Use shadcn/ui components from `src/components/ui/`
- Use the shared email template `_shared/email-builder.ts` for all emails
- Use `SECURITY INVOKER` for all new database functions
- Keep components small and focused (< 200 lines)
- Keep diffs small and focused on one feature
- **ALWAYS push to GitHub after every commit** (`git push origin main`)

## Don't
- Do NOT call React Hooks after an early return
- Do NOT use `getSession()` directly for RLS queries (returns expired tokens)
- Do NOT access `profiles.role` (does not exist – use `user_roles` table)
- Do NOT use `verify_jwt: true` for Edge Functions with custom auth
- Do NOT hard-code colors – use Tailwind classes
- Do NOT add new heavy dependencies without checking existing alternatives
- Do NOT use `rm -rf` on project directories
- Do NOT use `git push --force`

## Commands

### File-scoped (PREFERRED – faster and cheaper)
```bash
# TypeScript-Check einzelne Datei
npx tsc --noEmit src/path/to/file.tsx

# Lint einzelne Datei
npx eslint --fix src/path/to/file.tsx

# Test einzelne Datei
npx vitest run src/path/to/file.test.tsx

# Format einzelne Datei
npx prettier --write src/path/to/file.tsx
```

### Project-wide (use sparingly)
```bash
npm run dev          # Vite dev server (Port 8080)
npm run build        # Production build via Vite → dist/
npm run test:run     # Vitest single run
npm run test:e2e     # Playwright E2E tests
npm run lint         # ESLint full project
```

Note: Always lint, test, and typecheck updated files. Use project-wide build only before commit or when explicitly requested.

## When Stuck
- Ask a clarifying question or propose a short plan
- Do NOT push large speculative changes without confirmation
- If a fix attempt fails twice, stop and explain the problem instead of trying a third approach
- Check the TODO list in `project.md` before starting any task

## Commit Checklist
Before every commit:
1. `npx tsc --noEmit` – all green (no TypeScript errors)
2. `npx eslint --fix` on changed files – all green
3. `npm run build` – successful production build
4. Diff is small and focused on one feature/fix
5. Update the TODO list in `project.md` (mark completed tasks)
6. Commit message format: `feat(scope): short description` or `fix(scope): short description`
7. **IMMEDIATELY push to GitHub**: `git push origin main` (MANDATORY – local-only commits are NOT acceptable)
8. If push fails: `git pull --rebase origin main && git push origin main`

## Good Examples (copy these patterns)
- **Functional component with hooks**: `src/pages/AuctionDetail.tsx`
- **Form with Zod validation**: `src/components/wizard/steps/VehicleInfoStep.tsx`
- **Edge Function with error handling**: `supabase/functions/place-bid/index.ts`
- **Authenticated API call**: `src/lib/sessionGuard.ts` (`invokeWithAuth`)
- **Realtime subscription**: `src/hooks/useAuctionRealtime.ts`

## Bad Examples (avoid these patterns)
- **Class-based components**: None currently, but do not introduce them
- **Direct getSession() for RLS**: Any code using `supabase.auth.getSession()` before RLS queries without `ensureValidRLSSession()`
- **God components**: Components over 300 lines – split into smaller sub-components

## Key Architecture Patterns

### Wizard (Verkaufs-Wizard)
- 8-step sales wizard at `/verkaufen/wizard` (VerkaufenWizard.tsx)
- Steps: VehicleType → VehicleInfo → Details → Equipment → QuickContact → Photos → SaleChannel → AccountLocation
- Session persistence via `useWizardSession.ts` (anonymous_id-based for non-auth users)
- Form state in `useWizardForm.ts` with Zod validation per step
- Vehicle data (manufacturers/models) in `src/lib/vehicle-data.ts`
- **Step numbering mismatch**: Schema names (step1Schema–step8Schema) don't match step numbers in validateStep
- **Step 3 is fully optional** (no validation): Smart defaults pre-fill Diesel + Schaltung + Keine Mängel

### Auction System
- Atomic bidding via `place_bid_atomic` RPC (pg_advisory_xact_lock)
- Auto-Bid: `handle_autobid_atomic` with advisory lock
- Soft-Close: Last 1 minute → +1 minute extension
- 3 outcomes: SOLD / KAUFCHANCE / ENDED
- Optimistic Update + Realtime Dedup pattern for live bid display

### Session & Auth
- `ensureValidRLSSession()` in `sessionGuard.ts`: Checks JWT `exp` field, proactive refresh
- `invokeWithAuth()`: Central helper for all authenticated Edge Function calls (getFreshAccessToken + 401-Retry + SessionExpiredError)
- AuthContext: Periodic token refresh every 4 minutes for active tabs
- **CRITICAL**: `getSession()` reads from LOCAL CACHE and returns session objects even with EXPIRED access tokens. ALWAYS use `ensureValidRLSSession()` before RLS queries.

### RLS Session-Sensitive Tables
| Table | SELECT RLS | Impact when expired |
|-------|-----------|---------------------|
| `user_roles` | `auth.uid() = user_id` | **CRITICAL: isDealer=false** |
| `kaufchance_invitations` | `bidder_id = auth.uid()` | Kaufchancen invisible |
| `post_auction_offers` | `buyer_id = auth.uid()` | Offers invisible |
| `profiles` | `auth.uid() = id` | Own profile missing |
| `bids` | `USING(true)` | OK (public) |
| `auctions` | `USING(true)` | OK (public) |
| `motorhomes` | `USING(true)` | OK (public) |

### Defense-in-Depth Session Protection
1. Supabase auto-refresh (client built-in)
2. AuthContext periodic refresh (every 4 min)
3. AuthContext visibilitychange (tab switch, token < 5 min)
4. `ensureValidRLSSession()` (before every RLS query, checks JWT exp)
5. `useUserRole` retry (role missing? → refresh + re-query)
6. SessionExpiredDialog (last fallback: prompt user to login)

### Dealer System
- Roles: admin, dealer, seller (enum `app_role`)
- Dealer levels: Bronze → Silber → Gold → Platin (points-based)
- `profiles.role` does NOT exist – ALWAYS check roles via `user_roles` table
- Dealer approval syncs company data to profiles via `approve_dealer_application()` RPC

### Email System
- All emails via Resend API (info@caravanwert.de)
- Shared template: `_shared/email-builder.ts` (professional HTML with CaravanWert branding)
- Anti-spam: Per-type dedup via `dealer_notifications` and `admin_emails` tables
- Rate limits: Resend Free Plan ~100/day, 3000/month

### Commission System
- `calculate_commission(sale_amount, dealer_id)` RPC
- Tier-based with volume discounts
- 19% MwSt for DE, 0% reverse charge for EU

## Critical Rules (Learned from Production Bugs)

### React Hooks
- **NEVER** call React Hooks after an early return – all hooks MUST be unconditionally before any `return`
- Hooks that need loaded data → move to Child-Component, NOT parent with fallback value

### Edge Functions
- `verify_jwt: true` is problematic for functions with own auth – Gateway 401 has no body
- Catch-all `throw` → 500 is bad for UX. Use specific HTTP codes + readable error messages
- `supabase_deploy_edge_function` ALWAYS requires the `files` parameter with file contents

### Database
- `profiles.role` does NOT exist – roles ALWAYS via `user_roles` table
- `search_path` must be set correctly in all functions (security)
- All DB functions should use `SECURITY INVOKER` unless specifically needed otherwise

### Realtime
- Pattern for live updates: Edge Function returns ID + data → Frontend optimistic update → Realtime dedup via ID-Set (ref) → Auto-cleanup after timeout

## Project Structure
- `src/App.tsx` – Main router with all routes
- `src/pages/` – 40+ page components
- `src/components/` – UI, Admin, Dashboard, Wizard, Skeletons
- `src/hooks/` – 15+ custom hooks
- `src/lib/` – 25+ utility modules (sessionGuard, vehicle-data, etc.)
- `src/contexts/` – AuthContext, SettingsContext
- `src/integrations/supabase/` – Client + TypeScript types
- `supabase/functions/` – 57 Edge Functions
- `supabase/migrations/` – 65+ migrations

## Vehicle Data Stats
- **Wohnmobil**: 100 manufacturers, 1221 models
- **Wohnwagen**: 36 manufacturers, 201 models
- **Basisfahrzeuge**: 33 chassis options with 171 PS values
- PS format: Chips show `XXkW/YYYPS`

## Edge Functions Status
- **57 Edge Functions** all ACTIVE
- Shared utilities: `_shared/cors.ts`, `_shared/auth.ts`, `_shared/email-builder.ts`, `_shared/rate-limiter.ts`, `_shared/edgeLogger.ts`, `_shared/turnstile.ts`

## Dev Environment Notes
- .env file exists with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- Build dist/ and serve with `npx serve dist -l 8012 --single` for reliable SPA routing
- Agent-proxy paths break SPA asset loading; production Netlify works fine

## Known Remaining Items
- Blog: Table + pages exist, 0 articles (content feature never populated)
- Migration Edge Functions (import-table-data, import-photos, migrate-storage, backfill-email-content): One-time tools, harmless
- 32 analysis Markdown files in root should be moved to docs/archive/
- Baujahr ranges per model NOT implemented
- Search is starts-with; could benefit from fuzzy matching

## Wertrechner Calibration
- Algorithm + KI dual system: KI (OpenAI) is primary (~95% of cases), algorithm is fallback
- Fallback label: "Algorithmische Schätzung" (gray) instead of misleading "KI-Wertschätzung" (teal)
- Confidence ranges: ±5% at ≥85%, ±10% at ≥70%, ±15% at ≥50%, ±20% at <50%

## Google Tracking
- Custom analytics: `analytics_sessions`, `analytics_page_views`, `analytics_events`
- Google Ads: GCLID/GBRAID/WBRAID click-ID capture via `track-conversion` Edge Function
- Meta Pixel: Consent-managed
- **GA4_API_SECRET**: Must be created in GA4 Admin → Data Streams → Measurement Protocol API secrets
