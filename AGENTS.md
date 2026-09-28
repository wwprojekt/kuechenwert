# AGENTS.md – KüchenWert Repository Knowledge

## Project Overview
- German-language kitchen (Küche) lead-gen and comparison platform, forked from a caravan auction stack
- Live domain: `kuechenwert24.de` (brand: KüchenWert)
- Supabase project ID: `gzqayoalwtmypndrmqes`
- Stack: React 18 + TypeScript + Vite 5 + Tailwind + shadcn/ui + Supabase
- **Primary product:** Funnels A/B/C + Küchenrechner + dealer marketplace. Do NOT implement new Wohnmobil/Caravan features. User-facing copy must say Küche, never Fahrzeug/Wohnmobil.
- Caravan frontend code and Edge Functions were removed or tombstoned on 2026-09-28. The caravan tables (`auctions`, `bids`, `kitchens`, `kaufchance_invitations`, `post_auction_offers`, `appointments`, `wizard_sessions`, …) still exist in the DB as unused legacy — do not build on them.

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
npm run typecheck    # Strict ratchet check (tsconfig.strict.json), CI gate

# Prerender public routes into dist/<route>/index.html (after build, needs Chrome/Chromium via PRERENDER_CHROME)
PRERENDER=1 node scripts/prerender.mjs
# App under the production CSP in headless Chrome
node scripts/check-csp.mjs [--tracking]
```

The deploy workflow runs `npm run typecheck`, `npx eslint src` (errors only), `npx vitest run` (all tests) and the build before every Dokploy deploy.

Note: Always lint, test, and typecheck updated files. Use project-wide build only before commit or when explicitly requested.

## When Stuck
- Ask a clarifying question or propose a short plan
- Do NOT push large speculative changes without confirmation
- If a fix attempt fails twice, stop and explain the problem instead of trying a third approach
- Check the TODO list in `project.md` before starting any task

## Commit Checklist
Before every commit:
1. `npm run typecheck` and `npx tsc --noEmit -p tsconfig.app.json` – all green (the root `tsconfig.json` only holds references, plain `npx tsc --noEmit` checks nothing)
2. `npx eslint --fix` on changed files – no errors
3. `npm run build` – successful production build
4. Diff is small and focused on one feature/fix
5. Update the TODO list in `project.md` (mark completed tasks)
6. Commit message format: `feat(scope): short description` or `fix(scope): short description`
7. **Verify you are on `main`**: `git branch --show-current` MUST print `main`. If not, switch first (`git checkout main`) — never commit on `cursor/*` or other feature branches because Dokploy will not deploy them.
8. **`git fetch origin main` BEFORE pushing**: detects concurrent commits from parallel agents/devs. If diverged: `git pull --rebase origin main` first.
9. **IMMEDIATELY push to GitHub**: `git push origin main` (MANDATORY – local-only commits are NOT acceptable)
10. If push fails: `git pull --rebase origin main && git push origin main`
11. Verify push: `git status` must show `Your branch is up to date with 'origin/main'`. The push starts `.github/workflows/deploy.yml` (typecheck, lint, tests, build, then Dokploy deploy via API); production is updated a few minutes later. Check the run with `gh run list --workflow deploy.yml` and the live build via `last-modified` of `/`.
12. If the change applied a DB migration via MCP: confirm the corresponding `supabase/migrations/<timestamp>_<name>.sql` file exists AND is part of the commit. Migration without file = invisible to git = unreproducible.

## Good Examples (copy these patterns)
- **Functional component with hooks**: `src/features/account/EmailPreferencesCard.tsx`
- **Form with Zod validation**: `src/features/marketplace/components/ContactComplaintCard.tsx`
- **Edge Function with error handling**: `supabase/functions/kw-contact/index.ts` (Zod, Turnstile, rate limit, specific HTTP codes)
- **Authenticated API call**: `src/lib/sessionGuard.ts` (`invokeWithAuth`)
- **Realtime subscription**: `src/components/NotificationCenter.tsx` (filtered by `user_id`)

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

### Funnels & Leads
- Funnel A `/formular` (question flow, submit via `kw-lead`), Funnel B `/funnel/b` (`kw-lead-b`), Funnel C `/funnel/c` (planner with room photo, AI render and price engine via `kw-planner`).
- Funnel B starts with the existing offer: price plus documents (categories `angebot`, `grundriss` = planning, `kueche_bild` = photos; up to 10 files à 20 MB, PDF or image) or "später nachreichen". The detail steps after it are optional and can be skipped. Upload logic for both functions lives in `_shared/lead-files.ts` (announce → signed upload URLs → attach with content check and EXIF stripping); browser side in `src/features/funnel-b/`. Customers add documents later on `/projekt/:token` (`kw-project` `upload-files` / `attach-files`, max. 20 per project), which enqueues `lead_files_added` → admin mail.
- **Studios see customer documents only when released:** an admin checks each file in the tender panel and sets `lead_files.shared_with_studios` (only if no names or contact data are visible, otherwise upload a redacted version and release that one), or after the studio bought the contact / won the project (then all files). Enforced by the storage policy `LeadFiles: dealer read released` → `kw_can_view_lead_file()` and by `kw_dealer_project` (`media` items with `kind: "document"`, file names hidden before purchase). This mirrors the Funnel B consent (`kw-unterbieten-2026-09-28b`). All submits: Honeypot, Turnstile, rate limit, `submission_id` against duplicates, lead + `lead_consents` in one transaction. Without a valid Turnstile token a lead is stored as `bot_check = unverified` and not published automatically.
- Consumers reach their project via `/projekt/:token` (`kw-project`): token never in tracking, error or mail logs; the route is served with `no-referrer`, `noindex`, `no-store`.
- Direct INSERTs on `leads`, `lead_files`, `lead_consents` and `contact_messages` are revoked for `anon`; writes only go through the Edge Functions (service role). The contact form uses `kw-contact`.
- Room photos are stripped of EXIF/GPS on the client and on the server. Planner renders are private and only delivered as signed URLs.

### Funnel C: AI visualization & learning price engine
- **Models are data, not code:** `kw_ai_settings` (single row, admin page `/admin/ki`) picks main, variant, fallback and challenger models plus the daily render cap (0 = paused). Only models listed in `_shared/fal-models.ts` (registry with vendor, estimated cost and the fal input per model family) are accepted; unknown IDs fall back to the defaults. The old secrets `FAL_EDIT_MODEL`, `FAL_TEXT_MODEL`, `KW_DAILY_RENDER_CAP` are no longer read. Adding a model = registry entry (verify its input schema at `https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=<id>`) + test.
- **Fallback chain:** `kw-planner` moves to the next model when submit/status/result fails, the fal queue waits > 45 s (the queued job is cancelled) or processing takes > 150 s (`fallbackReason`), at most 3 attempts (`nextFallback`, `planner_renders.attempt`). Default with photo: Nano Banana Pro → Nano Banana 2 (sister model, keeps the room; covers capacity problems of one model) → FLUX.2 Pro Edit (other vendor, but redesigns the room more freely; covers Google outages and refused photos). Text: FLUX.2 Pro → Nano Banana 2. `fallback_from` holds the first model, `fallback_reason` the last error; the switch is a conditional update on (`model_slug`, `attempt`), so parallel polls never submit twice.
- **Variants** (`generate` with `base_render_id` + `variant_hint`) edit the selected finished render with `buildVariantPrompt` instead of re-planning from the photo, so only the requested change happens. The frontend only sends a base render while its planning key (`plannerRenderKey`: config and room without studio notes, plus photo) matches the current planning; otherwise it shows "Neu visualisieren".
- **Measure everything:** each render stores model, estimated `cost_cents`, `generation_ms` of its own attempt and the customer rating (`feedback`, action `feedback`). A/B groups (`planner_sessions.ai_group`, fixed per session from the UUID) compare a challenger model on photo sessions. `kw_admin_ai_stats` (admin RPC, max. 30 days because sessions without lead are deleted after 30 days) feeds `/admin/ki`. Frontend events `planner_render` and `planner_feedback`. Health alerts: `render_cap_near` (≥ 80 % of the cap), `renders_failing`.
- **Own model roadmap:** training data are only customer room photos with the optional consent `ai_training` (checkbox in the contact step when a photo exists, toggle on `/projekt/:token`). `_shared/ai-training.ts` copies them without contact data or free text into the private bucket `ai-training` (`kw_ai_training_samples`, 36 months, deleted on revocation, customer erasure and expiry). **Never train on renders of third-party models** (Google and OpenAI forbid using outputs for competing models; check any other vendor's terms first) — renders are not stored as training data. Next steps: collect photos of finished kitchens, train a LoRA on an open model (Qwen Image Edit Plus is in the registry and LoRA-ready via `kw_ai_settings.lora_url`), run it as challenger, promote it when it wins.
- **Learning price engine:** `kw-maintenance` task `price-calibration` (cron `kw-price-calibration`, 03:40 UTC, also a button on `/admin/ki`) re-estimates every tender with offers using the current engine and rate card (no feedback loop), compares with the median offer (`kw_price_observations`) and writes shrunk multipliers per segment (global → funnel a/c → quality (planner only) → PLZ region) to `kitchen_price_calibration` (`_shared/price-calibration.ts`, prior 8, total factor clamped to 0.7–1.45). `loadRateCard` returns card + calibration for `kw-planner`/`kw-lead`; the browser uses the same via `usePriceModel()`, so shown and stored estimates match.

### Marketplace, Orders & Billing
- Leads become tenders (Ausschreibungen); studios submit offers, buy contacts and win projects through `kw_*` RPCs. Coverage is checked per PLZ radius (`kw_dealer_market_profiles`).
- Side effects run through the outbox `kw_outbox`: channel `market` → `kw-market-worker`, channel `order` → `kw-order-worker` (both every minute via cron). Timers: `kw-marketplace-tick` (5 min), `kw-order-tick` (hourly).
- Studio prices are data: `lead_pricing_rules` (contact unlock) and `lead_commission_tiers` (commission on the final order value); active rows are publicly readable and shown live on `/preise` and `/konditionen`.
- Invoices are issued automatically via the outbox event `invoice_issue`. Issuer data comes from `site_settings` + `BRAND_LEGAL` (`_shared/issuer-profile.ts`, § 14 UStG). If the IBAN (mod-97 check) or VAT ID/tax number is missing, the invoice stays a draft and the admin gets an `invoice_issue_blocked` mail; payments and reminders only apply to issued invoices. Issued invoices are protected by GoBD immutability triggers; PDFs are write-once in storage (`<dealer_id>/<invoice_number>.pdf`).
- Complaints about bought contacts: studios file them in the project detail, admins decide in the admin tender panel (events `complaint_filed` / `complaint_decided`).

### Operations
- `kw-maintenance`: retention cleanup daily (02:15 UTC, includes expired AI training copies), health check hourly and price calibration daily (03:40 UTC); alerts to the admin are deduplicated for 12 h.
- Cron jobs call Edge Functions with the header `x-kw-cron-secret` (vault secret `kw_cron_secret`, env `KW_CRON_SECRET`); functions check it with `checkCronOrServiceRoleOrAdmin` from `_shared/auth.ts` (constant-time compare).
- Broadcast mails carry per-recipient `List-Unsubscribe` + `List-Unsubscribe-Post` headers (RFC 8058); `kw-unsubscribe` verifies the signed token (`_shared/unsubscribe-token.ts`), `/abmelden` works without login, every change is written to the consent log.

### Session & Auth
- `ensureValidRLSSession()` in `sessionGuard.ts`: Checks JWT `exp` field, proactive refresh
- `invokeWithAuth()`: Central helper for all authenticated Edge Function calls (getFreshAccessToken + 401-Retry + SessionExpiredError)
- AuthContext: Periodic token refresh every 4 minutes for active tabs
- **CRITICAL**: `getSession()` reads from LOCAL CACHE and returns session objects even with EXPIRED access tokens. ALWAYS use `ensureValidRLSSession()` before RLS queries.

### RLS Session-Sensitive Tables
| Table | SELECT RLS | Impact when expired |
|-------|-----------|---------------------|
| `user_roles` | `auth.uid() = user_id` | **CRITICAL: isDealer=false** |
| `profiles` | `auth.uid() = id` | Own profile missing |

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
- All emails via Resend API (`info@kuechenwert24.de`; marketplace/order workers send from `noreply@kuechenwert24.de` with `reply_to` = info@)
- Shared template: `_shared/email-builder.ts` (KüchenWert branding, Forest Sage); invoice wording per invoice type in `_shared/invoice-labels.ts`
- Anti-spam: Per-type dedup via `dealer_notifications` and `admin_emails` tables
- Rate limits: Resend Free Plan ~100/day, 3000/month
- **Consent (`user_notification_preferences`)**: Newsletter (`newsletter_enabled`) and advertising (`promotional_emails`) are opt-in, only `true` counts; NULL or a missing row means no consent (§ 7 Abs. 2 UWG, B2B included). Platform notices (`broadcast_emails_enabled`) are opt-out, only `false` excludes. Recipient selection for admin broadcasts lives only in `_shared/broadcast-recipients.ts` (used by `send-broadcast-email` and `get-recipient-count`). Frontend resolution mirrors it in `src/features/account/email-preferences.ts`; writes always send all three columns explicitly.
- Users manage voluntary emails at `/dashboard/settings` (studios and consumers). The studio "new projects" mail is controlled only by `kw_dealer_market_profiles.notify_new_projects` on the Einzugsgebiet page.

### Invoices & Tax
- Studio fees: contact unlock (`lead_pricing_rules`) and commission tiers (`lead_commission_tiers`), see "Marketplace, Orders & Billing"
- 19% MwSt for DE, 0% reverse charge for EU
- The caravan RPC `calculate_commission(sale_amount, dealer_id)` is legacy and only referenced by the unused `_shared/*-sale-conversion.ts` helpers

## Critical Rules (Learned from Production Bugs)

### React Hooks
- **NEVER** call React Hooks after an early return – all hooks MUST be unconditionally before any `return`
- Hooks that need loaded data → move to Child-Component, NOT parent with fallback value

### Column-Level Grants
- Tables with column-level grants reject `select('*')` (directly or as relationship embed) with **`42501 permission denied`**, including `select('*', { count: 'exact', head: true })`. Select explicit columns; for counts select a single granted column (`select("id", { count: "exact", head: true })`).
- Legacy example: `public.auctions` grants each public column individually (Migrations `20260420260000` + `20260420290100`). The frontend no longer queries it; the former helper `AUCTION_PUBLIC_COLUMNS` was removed with the caravan code.

### Edge Functions
- `verify_jwt` matrix:
  - **`true`** for ADMIN-only functions that don't do their own auth (lets the Supabase gateway reject before code runs). Beware: gateway 401 has empty body — frontend errors will be opaque. Use only when frontend doesn't need to distinguish reasons.
  - **`false`** + own service-role check for functions with custom auth, public flows, or webhook signature verification. All KüchenWert functions currently fall here (`supabase/config.toml` is the source of truth).
- **Never authorize on decoded JWT claims alone.** With `verify_jwt = false` the gateway does not check signatures, so a hand-made token with `role: service_role` decodes fine. `_shared/auth.ts` verifies such tokens against the Auth server (`isGenuineServiceRoleJwt`); a function only gets that fix when it is redeployed. Probe after deploy: forged token must return 401.
- Catch-all `throw` → 500 is bad for UX. Use specific HTTP codes + readable error messages
- `supabase_deploy_edge_function` ALWAYS requires the `files` parameter with file contents
- **Deploying large functions via MCP without CLI login**: the repo is public, so pass a one-line `index.ts` that imports the function from `https://raw.githubusercontent.com/wwprojekt/kuechenwert/<full-commit-sha>/supabase/functions/<name>/index.ts`. Relative imports (`../_shared/*`) resolve against the same commit and are bundled at deploy time, no runtime dependency on GitHub. Pin a pushed commit SHA (never `main`), keep `verify_jwt` as in `config.toml`, and probe afterwards. Does not work for code that reads files via `import.meta.url`. A later CLI deploy replaces the shim with the local files.
- For periodically-running functions (cleanup, digests, reminders, outbox workers): the cron job in `cron.schedule` sends `x-kw-cron-secret` (from vault `kw_cron_secret`) and the function checks it with `checkCronOrServiceRoleOrAdmin` (`_shared/auth.ts`). Admins and the genuine service role may still call these functions manually.
- Retired functions are not deleted right away: their `index.ts` calls `serveGone("<name>")` from `_shared/gone.ts` (410 Gone) and `config.toml` lists them under "Stillgelegt". Delete them in the Supabase dashboard only after an observation period.
- Images: the caravan photo pipeline (`process-photo`, Cloudflare Worker `/img/`) is retired and `worker/` is not deployed. `proxiedImageUrl(url, { width, quality })` from `@/lib/imageTransform` falls back to Supabase image transformation when no proxy host is configured. Upload buckets need a server-side `file_size_limit`; browser compression (`src/lib/imageCompress.ts`) is not a safety net.

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
- **Renames do not update function bodies.** Postgres stores PL/pgSQL/SQL bodies as text; after renaming a table or column, search `pg_proc.prosrc` for the old name and fix the functions in the same migration (see `20260926133055_kw_fix_kitchen_rename_in_functions`: 28 functions still used `motorhomes` and blocked dealer approval).
- **Outbox channels:** `kw_outbox.channel = 'market'` is processed by `kw-market-worker` (`kw_enqueue`), `'order'` by `kw-order-worker` (`kw_enqueue_order`). A new event type must be handled by the worker of its channel, otherwise it retries and then stays unprocessed.
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
- Periodic Refetch via `setInterval` + `window.addEventListener("focus")` is preferable to Realtime for browse pages (e.g. `/dashboard/projekte`). Realtime is for detail pages where users expect live updates.

## Project Structure
- `src/App.tsx` – Main router with all public and admin routes; studio/consumer dashboard routes live in `src/components/SmartDashboard.tsx`
- `src/features/` – Feature modules: `funnel-a`, `funnel-b`, `planner`, `marketplace`, `account`
- `src/pages/` – ~70 page components (public pages, `admin/`, `dashboard/`, `dealer/`, `funnel/`)
- `src/components/` – shadcn/ui (`ui/`), admin, dashboard, pricing and layout components
- `src/lib/`, `src/hooks/` – utilities (sessionGuard, brand config, SEO, invoices, tracking) and hooks
- `src/integrations/supabase/` – Client + generated TypeScript types
- `supabase/functions/` – 36 active Edge Functions (+ tombstones, see below); shared code in `_shared/`
- `supabase/migrations/` – versioned migrations (file name = version in `supabase_migrations.schema_migrations`)
- `docker/`, `Dockerfile` – nginx image for Dokploy, including prerendering at build time

## Edge Functions Status
- **36 active**: funnels and projects (`kw-lead`, `kw-lead-b`, `kw-planner`, `kw-project`, `kw-contact`), marketplace and orders (`kw-market-worker`, `kw-order-worker`), operations (`kw-maintenance`, `process-dunning`, `send-payment-reminder`, `process-scheduled-emails`), consent (`kw-unsubscribe`), invoices (`generate-invoice-pdf`, `send-invoice-email`, `record-invoice-payment`, `cancel-invoice`), admin/account functions, `inbound-webhook` (Svix/Resend signature), `track-conversion`, `sitemap`.
- **59 tombstoned** (410 Gone via `_shared/gone.ts`, listed under "Stillgelegt" in `config.toml`): caravan auctions, wizard, appointments, contracts, photo pipeline, one-time migration tools, `log-error`, `send-lead-notification`, old planner functions.
- Auth patterns: admin functions `checkServiceRoleOrAdmin`, cron functions `checkCronOrServiceRoleOrAdmin`, public submits Turnstile + honeypot + rate limit, consumer links signed tokens (`kw-project`, `kw-unsubscribe`).
- Shared utilities: `_shared/cors.ts`, `_shared/auth.ts`, `_shared/email-builder.ts`, `_shared/rate-limiter.ts`, `_shared/edgeLogger.ts`, `_shared/turnstile.ts`, `_shared/kw-http.ts`, `_shared/brand-config.ts` (`BRAND_LEGAL` for § 35a GmbHG / § 14 UStG), `_shared/issuer-profile.ts`, `_shared/unsubscribe-token.ts`, `_shared/broadcast-recipients.ts`, `_shared/gone.ts`.

## Hosting, Routing & SEO
- nginx serves a **route allowlist** (`docker/default.conf`): unknown paths get a real 404, legacy caravan URLs a 301 (query strings such as UTM/gclid are kept). **A new public route must be added to the allowlist**, otherwise it returns 404 in production. Indexable routes also belong in `scripts/prerender.mjs` (`ROUTES`) and in the `sitemap` function.
- Public routes are prerendered during the Docker build (`dist/<route>/index.html`, SPA shell in `dist/spa.html`). If Chromium or a route fails, the build falls back to the plain SPA.
- Security headers live in `docker/security-headers.conf` and must be included in every nginx block with its own `add_header`. The CSP allows no inline scripts: bootstrap code lives in `public/js/consent-bootstrap.js` and `public/js/tracking-loader.js`. Check changes with `node scripts/check-csp.mjs`.
- `/projekt` and `/abmelden` are served with `no-referrer`, `noindex` and `no-store`; `/admin` and `/dashboard` with `noindex`. The service worker (`public/sw.js`, bump `CACHE_VERSION` on SW changes) does not cache private pages.
- nginx takes the client IP from `CF-Connecting-IP` for Cloudflare ranges (`docker/nginx.conf`); keep the ranges current.

## Dev Environment Notes
- Without `.env`, `src/integrations/supabase/client.ts` falls back to the **production** project (URL and publishable key are public). `npm run dev`, local builds and `npm run test:e2e` then talk to production: never submit forms or run write tests there. For write tests set `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local` to another project.
- Build `dist/` and serve with `npx serve dist -l 8012 --single` for SPA routing; this does not reproduce the nginx allowlist, redirects or headers.
- Agent-proxy paths break SPA asset loading.

## Known Remaining Items
- Blog and Ratgeber: pages exist, 0 articles; both overview pages are `noindex` until content exists.
- Caravan tables, functions, triggers and buckets still exist in the DB; drop them by migration once nothing accesses them anymore.
- 59 tombstoned Edge Functions: delete in the Supabase dashboard after an observation period, then remove the directories and `config.toml` entries.

## Removed Code (2026-09-28)
- Caravan frontend: auctions, bidding, Kaufchance, sell wizard, stations/appointments, contracts, listings, Wertrechner reviews, dealer inventory and the matching admin pages, hooks and libs; unused shadcn components. Legacy routes redirect to `/formular`, `/kuechenrechner` or `/kuechenstudios`.
- Edge Functions for these features were replaced by 410 tombstones.

## Google Tracking
- Custom analytics: `analytics_sessions`, `analytics_page_views`, `analytics_events`
- Google tag and Meta Pixel load only after consent (`public/js/tracking-loader.js`); click IDs (gclid, gbraid, wbraid, msclkid, fbclid) are stored only with marketing consent.
- The former CaravanWert GA4/Ads IDs were removed; KüchenWert IDs are entered under Admin → Tracking. Leads from all funnels report `KUECHEN_LEAD`.
- **GA4_API_SECRET**: Must be created in GA4 Admin → Data Streams → Measurement Protocol API secrets
