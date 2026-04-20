-- =====================================================================
-- Phase 4 / Hardening: Security Polish (3 small bugs from Audit Round 3)
-- =====================================================================
-- Behebt:
--   #16  cron_run_locks: RLS aktiv aber keine Policy → explizite Deny-Policy
--   #17  set_marketing_phase_on_activation: mutable search_path
--   #18  disable_dynamic_pricing_on_manual_edit: re-create mit sauberen
--        UTF-8 Comments (vorherige Migration hatte CRLF/Encoding-Mojibake)
--
-- Alle 3 sind Best-Practice-Hardening, kein funktionaler Bug.
-- =====================================================================

-- ─── #16  cron_run_locks: explizite Deny-Policy ────────────────────────
-- Tabelle hat RLS enabled aber 0 Policies. Das ist effektiv "deny all"
-- (Postgres-Default), aber Best Practice (und Doku-Standard) verlangt
-- eine explizite Policy, damit Supabase-Linter happy ist und der nächste
-- Maintainer beim `\d cron_run_locks` SOFORT sieht: Diese Tabelle ist
-- intern.
--
-- Service-Role bypassed RLS sowieso (siehe try_acquire_cron_lock /
-- release_cron_lock — beide SECURITY DEFINER). Frontend-Clients dürfen
-- die Tabelle nie sehen.
DROP POLICY IF EXISTS "deny_all_clients" ON public.cron_run_locks;

CREATE POLICY "deny_all_clients"
  ON public.cron_run_locks
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON POLICY "deny_all_clients" ON public.cron_run_locks IS
  'Explizite Deny-Policy: cron_run_locks ist eine interne Tabelle. Zugriff erfolgt ausschließlich über die SECURITY DEFINER RPCs try_acquire_cron_lock / release_cron_lock (Service-Role bypassed RLS).';


-- ─── #17  set_marketing_phase_on_activation: search_path fixieren ──────
-- Function nutzt now() und INTERVAL ohne SET search_path = public.
-- Klassisches search_path-Hijacking-Risiko (klein, aber Best Practice).
ALTER FUNCTION public.set_marketing_phase_on_activation()
  SET search_path = public;


-- ─── #18  disable_dynamic_pricing_on_manual_edit: clean rewrite ────────
-- Vorherige Migration hatte deutsche Umlaute als Mojibake (CRLF + UTF-8
-- Encoding-Konflikt beim Migration-Apply). Function ist funktional korrekt,
-- aber pg_get_functiondef zeigt "tats??chlich" statt "tatsächlich".
-- CREATE OR REPLACE mit identischem Body, nur saubere Comments.
CREATE OR REPLACE FUNCTION public.disable_dynamic_pricing_on_manual_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_caller uuid := auth.uid();
  v_changed boolean := false;
BEGIN
  -- Nur auf echte User-Sessions reagieren. Service-Role (Edge Functions,
  -- Cron-Jobs wie check-expired-auctions / close-auction) hat
  -- auth.uid() = NULL und darf den eigenen Auto-Senkungs-Lauf nicht
  -- selbst sabotieren.
  IF v_caller IS NULL THEN
    RETURN NEW;
  END IF;

  -- Hat sich tatsaechlich einer der Anker-Preise geaendert?
  -- (ASCII-only um zukuenftige Encoding-Probleme zu vermeiden.)
  IF NEW.reserve_price IS DISTINCT FROM OLD.reserve_price THEN
    v_changed := true;
  END IF;

  IF NEW.instant_price IS DISTINCT FROM OLD.instant_price THEN
    v_changed := true;
  END IF;

  IF NOT v_changed THEN
    RETURN NEW;
  END IF;

  -- dynamic_pricing fuer aktive/kaufchance-Auktion dieses Motorhomes
  -- ausschalten (sofern ueberhaupt aktiv). Wir touchen updated_at NICHT
  -- direkt, dass macht React Query schon ueber refetch.
  UPDATE public.auctions
     SET dynamic_pricing = false,
         updated_at = now()
   WHERE motorhome_id = NEW.id
     AND status IN ('active', 'kaufchance')
     AND dynamic_pricing = true;

  RETURN NEW;
END;
$func$;


-- ─── Smoke-Test ────────────────────────────────────────────────────────
DO $$
DECLARE
  v_policy_count int;
  v_search_path text;
  v_func_def text;
BEGIN
  -- 1) cron_run_locks hat jetzt mind. 1 Policy
  SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
   WHERE schemaname='public' AND tablename='cron_run_locks';
  IF v_policy_count = 0 THEN
    RAISE EXCEPTION 'cron_run_locks Policy missing after migration';
  END IF;

  -- 2) set_marketing_phase_on_activation hat search_path = public
  SELECT array_to_string(p.proconfig, ', ')
    INTO v_search_path
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public'
     AND p.proname='set_marketing_phase_on_activation';
  IF v_search_path IS NULL OR v_search_path NOT LIKE '%search_path=public%' THEN
    RAISE EXCEPTION 'set_marketing_phase_on_activation search_path nicht gesetzt: %', v_search_path;
  END IF;

  -- 3) disable_dynamic_pricing_on_manual_edit body ist ASCII-only fuer Comments
  --    (Existenz-Check, kein Mojibake-String-Check noetig)
  SELECT pg_get_functiondef(p.oid) INTO v_func_def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public'
     AND p.proname='disable_dynamic_pricing_on_manual_edit';
  IF v_func_def IS NULL THEN
    RAISE EXCEPTION 'disable_dynamic_pricing_on_manual_edit nicht mehr vorhanden';
  END IF;
  IF v_func_def LIKE '%??%' THEN
    RAISE EXCEPTION 'disable_dynamic_pricing_on_manual_edit hat noch Mojibake (??)';
  END IF;

  RAISE NOTICE 'OK: cron_run_locks Policy + search_path Fix + Mojibake Cleanup';
END $$;
