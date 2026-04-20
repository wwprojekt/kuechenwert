-- Migration: Random Starting-Bid RPC
--
-- Phase 1.3 des Marketing-Phase-Rollouts.
--
-- Hintergrund:
--   Bisher wurde starting_bid hartcodiert auf €50 gesetzt (8+ Stellen im
--   Code). Damit konnten Händler über mehrere Auktionen hinweg sehen,
--   dass das Startgebot konstant niedrig bleibt → keinerlei Information
--   über den Reserve-Preis. Aber: das ist unnötig vorsichtig und
--   verschenkt UX-Wert. Mit einem zufälligen Startgebot zwischen 40 % und
--   60 % der Reserve können wir:
--     1. Die Auktion psychologisch näher am realistischen Verkaufspreis
--        starten (mehr "Anchoring" → höhere Endpreise).
--     2. Den genauen Reserve-Preis trotzdem geheim halten, weil die
--        Range 40-60 % eine ±25 % Unsicherheit erzeugt.
--     3. Pro Runde re-randomisieren, sodass Händler über mehrere Runden
--        hinweg keine deterministische Berechnung anstellen können.
--
-- Constraints (siehe migration 20260412120000_bid_must_be_multiple_of_50):
--   * Jedes Gebot muss ein Vielfaches von €50 sein
--   * starting_bid selbst ist davon NICHT betroffen (DB-seitig), aber wir
--     runden trotzdem auf 50er ab, damit der erste Bieter eine saubere
--     Mindestgebot-Zahl sieht (sonst Sprung wie 12.463 → erstes Gebot
--     12.550, wirkt komisch).
--
-- Edge Cases:
--   * Reserve NULL/<=0 → Fallback €50 (= bisheriges Verhalten)
--   * Reserve sehr klein (< 100€) → mindestens €50, höchstens reserve-50
--   * Festpreis (sale_channel = 'instant_price') → starting_bid = 0
--     bleibt unverändert (kein Auktionsmodus → wird vom Aufrufer
--     entschieden, RPC wird dort einfach nicht gerufen).

CREATE OR REPLACE FUNCTION public.compute_random_starting_bid(
  p_reserve_price NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_factor      NUMERIC;
  v_raw         NUMERIC;
  v_rounded     NUMERIC;
  v_max_allowed NUMERIC;
BEGIN
  -- Edge Case 1: keine valide Reserve
  IF p_reserve_price IS NULL OR p_reserve_price <= 0 THEN
    RETURN 50;
  END IF;

  -- Edge Case 2: Reserve so klein dass kein sinnvolles Random-Window passt
  -- (z.B. Reserve 100€ → Range wäre 40-60€ → kaum Spread, kein Schutz)
  IF p_reserve_price < 200 THEN
    RETURN 50;
  END IF;

  -- Random-Faktor zwischen 0.40 und 0.60 (Equal-Distribution via random())
  v_factor := 0.40 + random() * 0.20;
  v_raw := p_reserve_price * v_factor;

  -- Auf 50er-Vielfaches abrunden
  v_rounded := FLOOR(v_raw / 50) * 50;

  -- Sicherheitsnetz: nicht über (Reserve - 50€), sonst kein Bid möglich
  -- (Mindestgebot = starting_bid + 50, das müsste <= Reserve bleiben)
  v_max_allowed := FLOOR((p_reserve_price - 50) / 50) * 50;

  RETURN GREATEST(50, LEAST(v_rounded, v_max_allowed));
END;
$$;
