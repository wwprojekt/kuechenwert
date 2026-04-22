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
- Use `SECURITY INVOKER` for all new database functions (see exceptions below)
- Keep components small and focused (< 200 lines)
- Keep diffs small and focused on one feature
- **Session-Start Check**: First action in every new session = `git fetch origin main && git status`. If `Your branch is ahead of 'origin/main'`: stranded commits → push immediately before doing anything else (Dokploy is blocked).
- **Migration File First**: When changing the DB via `apply_migration` MCP tool, write the SQL file under `supabase/migrations/<timestamp>_<name>.sql` FIRST, then apply. The file is the source of truth — without it the change is invisible to git, fresh checkouts, and CI.
- **Edge Function periodisch → Cron in selber Migration**: If a new Edge Function is meant to run on a schedule (image processing, cleanup, digests, reminders), create the `cron.schedule(...)` call in the SAME migration that documents the function. Multiple production bugs (e.g. `process-photo` 2081 unprocessed photos) came from "function exists but cron was forgotten".
- **ALWAYS work directly on `main` and push after every commit** (`git push origin main`)
  - Dokploy auto-deploys ONLY from `main` — feature/fix branches do NOT trigger deploys
  - If a tool/CI auto-creates a feature branch (e.g. `cursor/*`), immediately fast-forward merge to `main` and push: `git checkout main && git merge --ff-only <branch> && git push origin main`
  - Before every push: `git fetch origin main` to detect concurrent agents/devs. If diverged: `git pull --rebase origin main` then push.

## Don't
- Do NOT call React Hooks after an early return
- Do NOT use `getSession()` directly for RLS queries (returns expired tokens)
- Do NOT access `profiles.role` (does not exist – use `user_roles` table)
- Do NOT use `verify_jwt: true` for Edge Functions with **custom auth logic** (gateway 401 has no body — see Edge Functions section for nuances)
- Do NOT hard-code colors – use Tailwind classes
- Do NOT add new heavy dependencies without checking existing alternatives
- Do NOT use `rm -rf` on project directories
- Do NOT use `git push --force`
- Do NOT leave commits stranded on a feature/fix branch — Dokploy only deploys from `main`. Always fast-forward into `main` and push there.
- Do NOT push without first running `git fetch origin main` — concurrent agents may have pushed; surprise divergence wastes a deploy slot
- Do NOT add new tables to the `supabase_realtime` publication unless a frontend component actually subscribes to them. Each table in the publication writes to WAL for every change → measurable load.
- Do NOT call `supabase.storage.from(...).upload(file)` without `cacheControl` — see "Storage Uploads" section
- Do NOT apply a migration via MCP without also writing the file to `supabase/migrations/` first

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
7. **Verify you are on `main`**: `git branch --show-current` MUST print `main`. If not, switch first (`git checkout main`) — never commit on `cursor/*` or other feature branches because Dokploy will not deploy them.
8. **`git fetch origin main` BEFORE pushing**: detects concurrent commits from parallel agents/devs. If diverged: `git pull --rebase origin main` first.
9. **IMMEDIATELY push to GitHub**: `git push origin main` (MANDATORY – local-only commits are NOT acceptable)
10. If push fails: `git pull --rebase origin main && git push origin main`
11. Verify push: `git status` must show `Your branch is up to date with 'origin/main'`. Dokploy webhook triggers auto-build/deploy within ~1 minute of the push appearing on `origin/main`.
12. If the change applied a DB migration via MCP: confirm the corresponding `supabase/migrations/<timestamp>_<name>.sql` file exists AND is part of the commit. Migration without file = invisible to git = unreproducible.

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
- **Storage upload without `cacheControl`**: Any `.upload(path, file)` call missing the `cacheControl: "31536000, immutable"` option — defaults to 1h cache and breaks edge caching
- **Edge Function without Cron when periodic**: Deploying a function intended to run on a schedule without also adding the `cron.schedule(...)` migration in the same commit
- **MCP migration without file**: Calling `apply_migration` without writing `supabase/migrations/<timestamp>_<name>.sql` first
- **Migration committed but never applied**: A `.sql` file in `supabase/migrations/` that is NOT listed in `supabase_migrations.schema_migrations` is dead code that silently does nothing. Real example: 2026-04-21 the cron-throttle file was committed (commit `210d723`) but never applied → photo crons ran 5× too fast for 16 h and overloaded the connection pool. **After every `apply_migration` call, verify with `select 1 from supabase_migrations.schema_migrations where version = '<ts>';`**. The Schedule-Drift card on `/admin/cron-health` will surface this class of bug for cron jobs going forward.
- **Global Realtime listener**: `supabase.channel("foo").on("postgres_changes", { event: "*", table: "bids" }, ...)` without a `filter` — broadcasts every change in the table to every client

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

### `public.auctions` Column-Level Grants (P4-Hardening)
- Table-level `SELECT ON public.auctions` is **REVOKED** for `authenticated` and `anon`. Each public column is granted INDIVIDUALLY (Migrations `20260420260000` + `20260420290100`).
- **6 columns are intentionally NOT granted** (owner/admin only — readable via `get_auction_owner_meta` / `get_auctions_owner_meta_bulk` RPCs):
  - `seller_initial_reserve`, `seller_initial_instant_price`
  - `dynamic_pricing`, `auto_relist`
  - `marketing_phase_max_until`, `agb_version_at_start`
- Consequence: ANY query that does `select('*')` on `public.auctions` (directly OR as Supabase relationship embed `auction:auctions(*)`) is rejected with **`42501 permission denied for table auctions`** by PostgREST. This includes `select('*', { count: 'exact', head: true })` for badge counts.
- **Fix pattern — always use `AUCTION_PUBLIC_COLUMNS`** from `src/lib/auction-columns.ts`:

  ```typescript
  import { AUCTION_PUBLIC_COLUMNS } from "@/lib/auction-columns";

  // Direct query
  supabase.from("auctions").select(AUCTION_PUBLIC_COLUMNS)

  // Relationship embed
  supabase.from("motorhomes").select(`*, auction:auctions(${AUCTION_PUBLIC_COLUMNS})`)

  // Count badge (any granted column works)
  supabase.from("auctions").select("id", { count: "exact", head: true })
  ```

- If the page also needs owner-only fields, fetch them via the bulk RPC after the main query and merge (see `src/pages/dashboard/DashboardOverview.tsx`, `src/pages/admin/AdminAuctions.tsx` for canonical examples).
- **Adding a new column to `public.auctions`?** Decide public-vs-owner and update BOTH the migration AND `AUCTION_PUBLIC_COLUMNS` in the same commit, otherwise pages will silently break the next time anyone touches them.

### Edge Functions
- `verify_jwt` matrix:
  - **`true`** for ADMIN-only functions that don't do their own auth (lets the Supabase gateway reject before code runs). Beware: gateway 401 has empty body — frontend errors will be opaque. Use only when frontend doesn't need to distinguish reasons.
  - **`false`** + own service-role check for functions with custom auth, public flows, or webhook signature verification. Most CaravanWert functions fall here.
- Catch-all `throw` → 500 is bad for UX. Use specific HTTP codes + readable error messages
- `supabase_deploy_edge_function` ALWAYS requires the `files` parameter with file contents
- For periodically-running functions (image processing, cleanup, digests, reminders): the function has NO own auth — instead the cron job in `cron.schedule` passes the service-role key from `vault.decrypted_secrets` in the `Authorization` header. Function reads `req.headers.get("Authorization")` and verifies it matches `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`.
- `process-photo` skips originals > 2 MB (`processing_error = 'original_too_large'`). Reason: jsquash WASM crashes on large buffers. For these: run `scripts/backfill-photo-variants.mjs` locally (uses native `sharp`).

### Storage Uploads
**Every** `.from("<bucket>").upload(path, file, options)` call must set `cacheControl`. The Supabase Storage SDK auto-prepends `max-age=` to whatever string you pass:

```typescript
// CORRECT — produces wire header `Cache-Control: max-age=31536000, immutable`
.upload(path, file, {
  contentType: detected.mime,
  cacheControl: "31536000, immutable",
  upsert: false,
})

// WRONG — produces `Cache-Control: max-age=public, max-age=31536000, immutable`
//         which browsers + CDNs partially ignore
.upload(path, file, { cacheControl: "public, max-age=31536000, immutable" })

// WRONG — defaults to max-age=3600 (1 hour) → no edge caching
.upload(path, file, { contentType: detected.mime })
```

Note: Supabase serves storage via its own Cloudflare with Bot Management (`Set-Cookie: __cf_bm`), which forces `Cache-Control: no-cache` on the wire even when metadata is correct. Browsers still benefit (304 revalidation), but for true 1-year edge cache an own Worker proxy is required.

### Database
- `profiles.role` does NOT exist – roles ALWAYS via `user_roles` table
- `search_path` must be set correctly in all functions (security)
- `SECURITY INVOKER` is the default for new functions. Use `SECURITY DEFINER` ONLY when:
  - The function must bypass RLS by design (cron-triggered batch jobs, mass aggregations, admin RPCs)
  - It's called from an Edge Function that already verified caller identity
  - When using DEFINER: explicitly set `SET search_path = public, pg_catalog` AND add a comment explaining why DEFINER is needed
- New tables: do NOT add to `supabase_realtime` publication by default. Only add if a frontend component will subscribe. Removing later requires a migration; not adding costs nothing.

### Realtime
- Pattern for live updates: Edge Function returns ID + data → Frontend optimistic update → Realtime dedup via ID-Set (ref) → Auto-cleanup after timeout
- Listener-Hygiene: every `supabase.channel(...)` MUST be filtered server-side (`filter: "column=eq.value"` or `=in.(...)`). Global listeners (no filter) cause every WAL change in that table to push to every connected client → exponential cost.
- Periodic Refetch via `setInterval` + `window.addEventListener("focus")` is preferable to Realtime for browse pages (e.g. /kaufen). Realtime is for detail pages where users expect live updates.

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
- **61 Edge Functions** all ACTIVE
- Shared utilities: `_shared/cors.ts`, `_shared/auth.ts`, `_shared/email-builder.ts`, `_shared/rate-limiter.ts`, `_shared/edgeLogger.ts`, `_shared/turnstile.ts`

### Security Classification (Auth Audit 2026-04-11)
- **ADMIN** (24): `admin-create-user`, `admin-delete-user`, `backfill-email-content`, `check-expired-auctions`, `close-auction`, `complete-handover`, `fetch-attachment-url`, `generate-invoice-pdf`, `generate-purchase-contract`, `get-dealer-auth-status`, `get-recipient-count`, `process-abandoned-wizards`, `process-dunning`, `process-scheduled-emails`, `request-dealer-documents`, `resend-confirmation-email`, `send-admin-email`, `send-appointment-confirmation`, `send-auction-ending-notification`, `send-broadcast-email`, `send-dealer-auction-digest`, `send-dealer-notification`, `send-inactivity-email`, `send-invoice-email`
- **USER_AUTH** (6): `accept-kaufchance-offer`, `dealer-document-upload`, `generate-ai-description`, `generate-appointment-pin`, `instant-buy`, `place-bid`
- **RATE_LIMITED** (4): `ai-valuation`, `log-error`, `send-purchase-inquiry-notification`, `track-conversion`
- **TURNSTILE** (1): `send-lead-notification`
- **WEBHOOK** (1): `inbound-webhook` (Svix/Resend signature)
- **INTERNAL_ONLY** (1): `handle-autobid` (called from `place-bid`, no own auth)
- **PUBLIC_UNPROTECTED** (24): See risk list below

### Public Unprotected Functions — Risk Assessment
| Function | Risk | Mitigations |
|----------|------|-------------|
| `auto-convert-wizard` | HIGH — creates users, motorhomes, auctions | Requires valid `wizard_sessions` row |
| `generate-handover-pdf` | MEDIUM — reads appointments, writes to storage | Requires valid appointment ID |
| `notify-auction-winner` | MEDIUM — sends emails to users | Requires valid auction ID |
| `notify-offer-action` | MEDIUM — sends Kaufchance emails | Requires valid auction ID |
| `send-auction-notification` | MEDIUM — broad email primitive | Anti-spam via `admin_emails` dedup |
| `send-push-notification` | MEDIUM — sends Web Push to users | Requires valid subscription data |
| `upload-wizard-photos` | MEDIUM — uploads to storage | Requires valid `wizard_sessions` row |
| `send-bid-notification` | LOW — outbid/new bid emails | Requires valid bid/auction IDs |
| `send-disposition-email` | LOW — lead follow-up emails | Anti-spam via `admin_emails` dedup |
| `send-expert-valuation` | LOW — valuation email to leads | Requires valid lead ID |
| `send-favorite-notification` | LOW — price change alerts | Requires valid motorhome ID |
| `send-payment-confirmation` | LOW — confirmation email | Requires valid data in body |
| `send-welcome-email` | LOW — welcome email | Dedup via `admin_emails` |
| `register-dealer` | LOW — intentionally public | Creates user + pending application |
| `send-appointment-reminder` | LOW — cron: reminder emails | Reads only upcoming appointments |
| `send-auction-summary` | LOW — cron: seller summaries | Reads active auctions only |
| `send-auto-response` | LOW — auto-reply from inbound | Called from `inbound-webhook` |
| `send-payment-reminder` | LOW — cron: payment reminders | Reads overdue invoices only |
| `send-registration-invite` | LOW — magic link invite | Requires valid wizard session |
| `send-wizard-resume-email` | LOW — resume link email | Requires valid session ID |
| `send-wrong-number-email` | LOW — wrong number follow-up | Requires valid lead ID |
| `notify-vehicle-question` | LOW — admin notification | Sends only to admin email |
| `verify-appointment-pin` | LOW — PIN verification | `pin_attempts` lockout table |
| `sitemap` | NONE — public XML sitemap | Read-only, public data |

## Dev Environment Notes
- .env file exists with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- Build dist/ and serve with `npx serve dist -l 8012 --single` for reliable SPA routing
- Agent-proxy paths break SPA asset loading; production Netlify works fine

## Known Remaining Items
- Blog: Table + pages exist, 0 articles (content feature never populated)
- Migration Edge Functions (import-table-data, import-photos, migrate-storage, backfill-email-content): One-time tools, harmless
- Baujahr ranges per model NOT implemented
- Search is starts-with; could benefit from fuzzy matching
- 24 Edge Functions are PUBLIC_UNPROTECTED (see Security Classification above) — cron-style functions should ideally require a shared secret header

## Removed Dead Code (2026-04-11)
- `src/lib/analytics.ts` — Duplicate of `analyticsService.ts`, never imported, `AnalyticsInitializer` was disabled
- `src/components/wizard/ContactStep.tsx` — Legacy wizard step, replaced by `QuickContactStep` + `SaleChannelStep` + `AccountLocationStep`
- `src/components/ProtectedRoute.tsx` + test — Only referenced in tests, never used in `App.tsx`
- `src/pages/dealer/DealerLayout.tsx` — Replaced by `SmartDashboard`'s `DealerLayoutContent`
- `src/components/DealerRoute.tsx` — Only imported by deleted `DealerLayout.tsx`

## Wertrechner Calibration
- Algorithm + KI dual system: KI (OpenAI) is primary (~95% of cases), algorithm is fallback
- Fallback label: "Algorithmische Schätzung" (gray) instead of misleading "KI-Wertschätzung" (teal)
- Confidence ranges: ±5% at ≥85%, ±10% at ≥70%, ±15% at ≥50%, ±20% at <50%

## Google Tracking
- Custom analytics: `analytics_sessions`, `analytics_page_views`, `analytics_events`
- Google Ads: GCLID/GBRAID/WBRAID click-ID capture via `track-conversion` Edge Function
- Meta Pixel: Consent-managed
- **GA4_API_SECRET**: Must be created in GA4 Admin → Data Streams → Measurement Protocol API secrets
