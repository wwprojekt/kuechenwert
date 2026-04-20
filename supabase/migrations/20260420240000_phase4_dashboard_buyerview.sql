-- Migration: Phase 4 — Schema-Erweiterungen für Verkäufer-Dashboard + Käufer-View
--
-- Diese Migration liefert die Datenbasis für:
--   * "Stabil seit X Tagen"-Badge im Käufer-View
--     → braucht `auctions.last_price_reduction_at`
--   * Verkäufer-Toggle für `dynamic_pricing` analog zu `auto_relist`
--     → braucht `toggle_dynamic_pricing(p_auction_id, p_value)` RPC
--   * Käufer-View über `auctions_public` MUSS auch dieses Feld + auction_round
--     liefern, ohne `seller_initial_*` zu leaken.
--
-- Designentscheidungen:
--   * `last_price_reduction_at` wird vom Cron / close-auction gesetzt, wenn
--     reserve_price reduziert wird. NULL = noch nie reduziert (alle frischen
--     Inserate). Wir machen KEINEN Backfill, damit der Badge-Algorithmus
--     korrekt fällt zurück auf "start_time" als impliziter "stabil seit"-Punkt.
--   * `toggle_dynamic_pricing` mirror't toggle_auto_relist 1:1, aber mit
--     erweitertem Status-Filter: dynamic_pricing wirkt für 'active' und
--     'kaufchance' (Auktion + Festpreis). Verkäufer kann jederzeit aus-
--     steigen, solange noch eine Reduktions-Runde theoretisch käme.

-- ───────────────────────────────────────────────────────────────────────
-- 1. last_price_reduction_at Spalte
-- ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.auctions
  ADD COLUMN IF NOT EXISTS last_price_reduction_at TIMESTAMPTZ;

COMMENT ON COLUMN public.auctions.last_price_reduction_at IS
  'Zeitpunkt der letzten automatischen Preis-Reduktion (close-auction / check-expired-auctions). NULL = noch nie reduziert. Basis für "Stabil seit X Tagen"-Badge im Käufer-View.';

-- Index für mögliche Abfragen "alle die seit X Tagen stabil sind"
CREATE INDEX IF NOT EXISTS idx_auctions_last_price_reduction_at
  ON public.auctions (last_price_reduction_at)
  WHERE status IN ('active', 'kaufchance');

-- ───────────────────────────────────────────────────────────────────────
-- 2. toggle_dynamic_pricing RPC
-- ───────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.toggle_dynamic_pricing(
  p_auction_id uuid,
  p_value boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_seller uuid;
  v_status text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Anmeldung erforderlich' USING ERRCODE = '42501';
  END IF;

  IF p_value IS NULL THEN
    RAISE EXCEPTION 'dynamic_pricing darf nicht NULL sein' USING ERRCODE = '22004';
  END IF;

  SELECT m.seller_id, a.status::text
    INTO v_seller, v_status
    FROM public.auctions a
    JOIN public.motorhomes m ON m.id = a.motorhome_id
   WHERE a.id = p_auction_id;

  IF v_seller IS NULL THEN
    RAISE EXCEPTION 'Auktion nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  IF v_seller <> v_caller THEN
    RAISE EXCEPTION 'Sie sind nicht der Verkäufer dieses Inserats' USING ERRCODE = '42501';
  END IF;

  -- dynamic_pricing wirkt für active + kaufchance (sowohl Auktion als auch
  -- Festpreis können in beiden Status vom Cron reduziert werden).
  IF v_status NOT IN ('active', 'kaufchance') THEN
    RAISE EXCEPTION
      'Automatische Preissenkung kann nur bei laufenden oder Kaufchance-Inseraten umgeschaltet werden'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.auctions
     SET dynamic_pricing = p_value,
         updated_at      = now()
   WHERE id = p_auction_id;

  RETURN p_value;
END;
$$;

COMMENT ON FUNCTION public.toggle_dynamic_pricing(uuid, boolean) IS
  'Sicheres Toggle für dynamic_pricing auf eigenen Auktionen. Verkäufer kann automatische -2 % pro Runde ein-/ausschalten ohne andere Spalten zu beeinflussen.';

REVOKE ALL ON FUNCTION public.toggle_dynamic_pricing(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.toggle_dynamic_pricing(uuid, boolean) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────
-- 3. auctions_public View Update — last_price_reduction_at hinzufügen
--    (auction_round war schon drin, ebenso die Marketing-Phase-Felder)
-- ───────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.auctions_public CASCADE;
CREATE VIEW public.auctions_public
WITH (security_invoker = true) AS
SELECT
  id,
  motorhome_id,
  status,
  starting_bid,
  current_bid,
  reserve_price,                       -- aktueller (evtl. reduzierter) Wert ist OK
  start_time,
  end_time,
  kaufchance_expires_at,
  kaufchance_min_price,
  auto_relist,
  auction_round,
  dynamic_pricing,
  marketing_phase_started_at,
  marketing_phase_max_until,
  last_price_reduction_at,             -- NEU: für Stable-Price-Badge
  soft_close_extension_minutes,
  created_at,
  updated_at
FROM public.auctions;

COMMENT ON VIEW public.auctions_public IS
  'Öffentliche Auktions-View OHNE seller_initial_*. Käufer-Frontends nutzen diese View, um versehentliches Leaken des Verkäufer-Anker-Preises zu verhindern. Enthält jetzt auch last_price_reduction_at + auction_round für den "Stabil seit X Tagen"-Badge.';

GRANT SELECT ON public.auctions_public TO anon, authenticated;
