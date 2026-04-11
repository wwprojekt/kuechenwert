# AGENTS.md – CaravanWert Repository Knowledge

## Project Overview
- German-language Wohnmobil/Wohnwagen sales platform with auction system
- Supabase project ID: `zcrwqxsyptjwkuxfacvq` (eu-west-1)
- Stack: React 18 + TypeScript + Vite 5 + Tailwind + shadcn/ui + Supabase

## Build & Dev
```bash
npm run dev          # Vite dev server (Port 8080)
npm run build        # Production build via Vite → dist/
npm run test:run     # Vitest single run
npm run test:e2e     # Playwright E2E tests
npm run lint         # ESLint
```

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
