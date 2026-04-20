-- =============================================================================
-- Phase 4 — Audit Round 4 fixes
-- =============================================================================
--
-- Deep audit (Round 4) surfaced three legally/security-critical regressions
-- that slipped through Round 3. This migration fixes them end-to-end and is
-- idempotent (safe to re-apply).
--
-- Findings addressed:
--
--   #19 CRITICAL SECURITY  view `public.auctions_public` was defined without
--                          the `security_invoker = true` option, which makes
--                          PostgreSQL / Supabase treat it as SECURITY DEFINER.
--                          Result: RLS of the view creator (superuser) applied
--                          to every query instead of the querying user's RLS.
--                          For a view that sits in front of the `auctions`
--                          table this effectively bypasses RLS. Linter error
--                          level = ERROR. Fix: recreate WITH
--                          (security_invoker = true).
--
--   #20 CRITICAL LEGAL     all 97 active/kaufchance auctions had
--                          `agb_version_at_start = NULL`. The field exists so
--                          that every listing binds to the AGB version that
--                          was live at its activation time (juristische
--                          Absicherung pro Inserat). The insert path in the
--                          wizard (`useWizardForm.ts`) and in
--                          `auto-convert-wizard` already snapshots the
--                          version via `get_current_agb_version()`, but the
--                          RPC returned NULL / errored before the AGB v6
--                          bump, so NULLs leaked into every row. We backfill
--                          the 97 NULLs with the current AGB version
--                          ("v6 (2026-04-20)"). Sellers of these listings
--                          have either (a) accepted v6 via opt-in email
--                          (Bestand) or (b) are new-system sellers who
--                          activated after v6 went live — the backfill
--                          therefore matches the legally-binding version
--                          they actually saw.
--
--   #24 LEGAL DEFENSE      the trigger `set_marketing_phase_on_activation`
--                          did not set `agb_version_at_start` at activation
--                          time. If the wizard path ever silently skips the
--                          snapshot (e.g. RPC timeout) we would keep
--                          producing NULLs. Fix: the trigger now snapshots
--                          the version alongside `marketing_phase_started_at`
--                          on the first activation of a new-system auction.
--                          This is a belt-and-suspenders guard — the Edge
--                          Function / wizard code still sets the value, but
--                          if either fails the trigger catches it.
--
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- FIX #19 — auctions_public view: security_invoker = true
-- -----------------------------------------------------------------------------
-- Recreate the view with the `security_invoker` option explicitly set to
-- true so that RLS on `public.auctions` is evaluated with the querying
-- user's permissions (and our column-level REVOKE actually applies).
--
-- Note: we keep the same column list as the Round-3 migration
-- (20260420290100_phase4_revoke_strategy_columns.sql) — strategy-sensitive
-- columns (auto_relist, dynamic_pricing, marketing_phase_max_until,
-- agb_version_at_start, seller_initial_*) stay out.

DROP VIEW IF EXISTS public.auctions_public CASCADE;

CREATE VIEW public.auctions_public
WITH (security_invoker = true)
AS
SELECT
  id,
  motorhome_id,
  status,
  starting_bid,
  current_bid,
  reserve_price,
  start_time,
  end_time,
  kaufchance_expires_at,
  kaufchance_min_price,
  auction_round,
  marketing_phase_started_at,
  last_price_reduction_at,
  soft_close_extension_minutes,
  created_at,
  updated_at
FROM public.auctions;

-- Public read access (RLS on underlying auctions still applies because
-- of security_invoker = true).
GRANT SELECT ON public.auctions_public TO anon, authenticated;

COMMENT ON VIEW public.auctions_public IS
  'Buyer-safe projection of public.auctions without strategy-sensitive '
  'fields (auto_relist, dynamic_pricing, marketing_phase_max_until, '
  'agb_version_at_start, seller_initial_*). Runs with security_invoker=true '
  'so the RLS of the querying user applies (see Audit Round 4, Bug #19).';

-- -----------------------------------------------------------------------------
-- FIX #24 — set_marketing_phase_on_activation: snapshot agb_version too
-- -----------------------------------------------------------------------------
-- On the FIRST activation of a new-system auction (marketing_phase_started_at
-- IS NULL and status becomes 'active'), also snapshot the current AGB version
-- from `get_current_agb_version()`.
--
-- Wir snapshotten NICHT beim Recycling (marketing_phase_started_at IS NOT
-- NULL) — der Verkäufer hat beim ersten Einstellen die damalige AGB
-- akzeptiert, ein späteres Re-Listing innerhalb derselben Marketing-Phase
-- bindet weiter an diese Version. Nach Ablauf des Soft-Caps (16/30 Tage)
-- läuft die Auktion aus → Verkäufer bekommt die 3-Buttons-Mail → wenn er
-- "erneut einstellen" klickt, wird ein neues Auctions-Row angelegt und
-- der Snapshot greift wieder.

CREATE OR REPLACE FUNCTION public.set_marketing_phase_on_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_max_days INTEGER;
  v_is_activation BOOLEAN;
  v_agb_version TEXT;
BEGIN
  IF NEW.seller_initial_reserve IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.marketing_phase_started_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_is_activation := (NEW.status = 'active');
  ELSE
    v_is_activation := (NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active');
  END IF;

  IF NOT v_is_activation THEN
    RETURN NEW;
  END IF;

  NEW.marketing_phase_started_at := COALESCE(NEW.marketing_phase_started_at, now());

  IF NEW.seller_initial_instant_price IS NOT NULL THEN
    v_max_days := 30;
  ELSE
    v_max_days := 16;
  END IF;

  IF NEW.marketing_phase_max_until IS NULL THEN
    NEW.marketing_phase_max_until :=
      NEW.marketing_phase_started_at + (v_max_days || ' days')::INTERVAL;
  END IF;

  -- Audit Round 4, Fix #24: AGB-Version snapshot als Defense-in-Depth.
  -- Wizard (useWizardForm.ts) + auto-convert-wizard setzen das Feld
  -- bereits beim INSERT. Wenn das aus irgendeinem Grund (RPC-Timeout,
  -- ältere Client-Version, manueller Admin-Insert) fehlschlägt, fangen
  -- wir es hier beim Activation-Trigger auf. NEW-Wert hat Vorrang, falls
  -- der Caller bewusst eine Version gesetzt hat.
  IF NEW.agb_version_at_start IS NULL THEN
    BEGIN
      v_agb_version := public.get_current_agb_version();
      IF v_agb_version IS NOT NULL AND length(v_agb_version) > 0 THEN
        NEW.agb_version_at_start := v_agb_version;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Non-fatal: wenn get_current_agb_version fehlschlägt (z.B.
      -- legal_pages-Row fehlt in Test-DB), lassen wir agb_version_at_start
      -- NULL statt die ganze Aktivierung zu blockieren. Admin sieht das
      -- dann im Dashboard.
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.set_marketing_phase_on_activation() IS
  'BEFORE INSERT/UPDATE trigger on public.auctions. Sets '
  'marketing_phase_started_at, marketing_phase_max_until and '
  'agb_version_at_start on the first activation of a new-system auction '
  '(seller_initial_reserve set, marketing_phase_started_at IS NULL, status '
  'becomes active). Idempotent: subsequent re-activations are no-ops, the '
  'original snapshot stays. See Phase-4 Audit Round 4, Fix #24.';

-- -----------------------------------------------------------------------------
-- FIX #20 — Backfill agb_version_at_start on existing 97 active/kaufchance
-- -----------------------------------------------------------------------------
-- Conservative position: backfill with the current AGB version
-- ("v6 (2026-04-20)"). Sellers of active/kaufchance listings have either
-- (a) accepted v6 by opting in via the Bestand Opt-in-Mail, or
-- (b) activated after v6 went live and accepted it through the wizard
--     consent checkbox (set_wizard_agb_consent).
-- Leaving 97 rows with NULL is legally worse than this conservative
-- backfill, because the field's only purpose is pro-listing nachweisbar
-- welche Version galt.

DO $backfill$
DECLARE
  v_current_version TEXT;
  v_rows_updated INTEGER;
BEGIN
  v_current_version := public.get_current_agb_version();
  IF v_current_version IS NULL OR length(v_current_version) = 0 THEN
    RAISE EXCEPTION
      'Audit Round 4 Fix #20: get_current_agb_version() returned NULL/empty '
      '— refusing to backfill with empty string. Check legal_pages row for '
      'slug=''agb''.';
  END IF;

  UPDATE public.auctions
     SET agb_version_at_start = v_current_version,
         updated_at = now()
   WHERE status IN ('active', 'kaufchance')
     AND agb_version_at_start IS NULL;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  RAISE NOTICE 'Audit Round 4 Fix #20: backfilled agb_version_at_start on % active/kaufchance auctions with version %',
    v_rows_updated, v_current_version;
END
$backfill$;

COMMIT;

-- -----------------------------------------------------------------------------
-- Smoke tests (post-commit — non-transactional, just raise notices)
-- -----------------------------------------------------------------------------
DO $smoke$
DECLARE
  v_null_count INTEGER;
  v_view_is_invoker BOOLEAN;
  v_agb TEXT;
BEGIN
  SELECT COUNT(*) INTO v_null_count
    FROM public.auctions
   WHERE status IN ('active', 'kaufchance')
     AND agb_version_at_start IS NULL;
  IF v_null_count > 0 THEN
    RAISE WARNING 'Smoke test: % active/kaufchance rows still have agb_version_at_start IS NULL',
      v_null_count;
  ELSE
    RAISE NOTICE 'Smoke test OK: 0 active/kaufchance rows with agb_version_at_start IS NULL';
  END IF;

  SELECT (reloptions::text[] @> ARRAY['security_invoker=true']) INTO v_view_is_invoker
    FROM pg_class
   WHERE relname = 'auctions_public'
     AND relnamespace = 'public'::regnamespace;
  IF v_view_is_invoker IS NOT TRUE THEN
    RAISE WARNING 'Smoke test: auctions_public is NOT security_invoker=true (reloptions=%)',
      (SELECT reloptions FROM pg_class WHERE relname='auctions_public' AND relnamespace='public'::regnamespace);
  ELSE
    RAISE NOTICE 'Smoke test OK: auctions_public is security_invoker=true';
  END IF;

  v_agb := public.get_current_agb_version();
  IF v_agb IS NULL OR v_agb NOT ILIKE 'v%' THEN
    RAISE WARNING 'Smoke test: get_current_agb_version() returned unexpected value %', v_agb;
  ELSE
    RAISE NOTICE 'Smoke test OK: get_current_agb_version() = %', v_agb;
  END IF;
END
$smoke$;
