/**
 * Public-safe column whitelist for `public.auctions`.
 *
 * Background (P4-Hardening, Audit Round 3 — Migrations 20260420260000 +
 * 20260420290100):
 *   The `auctions` table has table-level SELECT REVOKED for `authenticated`
 *   and `anon`. Each currently-public column is granted EXPLICITLY column-by-
 *   column. Six columns are intentionally NOT granted (owner/admin-only,
 *   readable via the SECURITY DEFINER RPCs `get_auction_owner_meta` /
 *   `get_auctions_owner_meta_bulk`):
 *
 *     1. seller_initial_reserve
 *     2. seller_initial_instant_price
 *     3. dynamic_pricing
 *     4. auto_relist
 *     5. marketing_phase_max_until
 *     6. agb_version_at_start
 *
 *   Consequence: ANY query that selects `*` on `public.auctions` (directly
 *   OR as a Supabase relationship embed `auction:auctions(*)`) is rejected
 *   by PostgREST with `42501 permission denied for table auctions`.
 *
 *   Fix pattern (use everywhere instead of `*`):
 *
 *     supabase.from('auctions').select(AUCTION_PUBLIC_COLUMNS)
 *
 *   For embeds:
 *
 *     .select(`*, auction:auctions(${AUCTION_PUBLIC_COLUMNS})`)
 *
 *   If the page also needs the protected fields (only owner/admin pages do),
 *   call the bulk RPC after the main fetch and merge:
 *
 *     const { data: meta } = await supabase.rpc(
 *       'get_auctions_owner_meta_bulk',
 *       { p_auction_ids: ids },
 *     );
 *
 * Adding a new column to `public.auctions`?
 *   1. Decide: public-safe (Käufer dürfen es sehen) ODER owner-only?
 *   2. If public-safe: GRANT SELECT (new_col) ON public.auctions TO
 *      authenticated, anon;  AND add it to AUCTION_PUBLIC_COLUMNS below.
 *   3. If owner-only: do NOT grant — make sure the owner-meta RPCs return
 *      it instead. Document in `supabase/migrations/<timestamp>_<name>.sql`.
 *
 *   Forgetting either step will silently break dealer/admin pages with
 *   "permission denied for table auctions" the next time they hit
 *   `select('*')`. The whitelist below is the source of truth.
 */
// `as const` is REQUIRED — Supabase TypeScript types resolve `.select(...)`
// against the literal column-list. Joining at runtime via .join(", "), or
// even string concatenation with `+`, would widen the type to plain `string`
// and collapse the inferred result type into `unknown`/`SelectQueryError`,
// which forces every downstream `.eq()` call into "not assignable" errors.
// Keep this as a single hand-written string literal.
//
// NOTE: When you add a new public-safe column, append it to this string AND
// to the GRANT-list in the matching `supabase/migrations/*.sql` file.
export const AUCTION_PUBLIC_COLUMNS =
  "id, kitchen_id, starting_bid, current_bid, reserve_price, status, start_time, end_time, soft_close_extension_minutes, created_at, updated_at, kaufchance_expires_at, kaufchance_min_price, auction_round, festpreis_admin_notified_at, marketing_phase_started_at, last_price_reduction_at" as const;
