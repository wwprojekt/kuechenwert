-- Migration: Phase-3-Hotfix
--
-- Findings during Phase-3-Audit:
--   1. Der BEFORE UPDATE-Trigger trg_set_marketing_phase_on_activation
--      greift nicht, wenn das Frontend die Auktion direkt mit
--      `INSERT ... status = 'active'` anlegt (5 Admin-Codepfade tun genau das).
--      Folge: marketing_phase_started_at + max_until bleiben NULL,
--      check-expired-auctions kann den Soft-Brake nicht greifen lassen.
--   2. 84 bereits aktive Auktionen haben seller_initial_reserve gesetzt
--      (Phase-1-Backfill), aber 0 davon haben marketing_phase_*. Sie sind
--      damit unsichtbar für den neuen Lifecycle.
--
-- Dieser Hotfix:
--   * Erweitert den Trigger auf BEFORE INSERT OR UPDATE (idempotent: läuft
--     nicht erneut, wenn marketing_phase_started_at bereits gesetzt ist).
--   * Backfill für bestehende new-system Auktionen in active/kaufchance:
--     started_at = COALESCE(start_time, created_at), max_until via
--     gleicher 16d/30d-Logik wie der Trigger.

-- ───────────────────────────────────────────────────────────────────────
-- 1. Trigger-Funktion: zusätzlich für INSERT-Pfad robust machen
-- ───────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_marketing_phase_on_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_days INTEGER;
  v_is_activation BOOLEAN;
BEGIN
  -- Nur für new-system Inserate (seller_initial_reserve gesetzt)
  IF NEW.seller_initial_reserve IS NULL THEN
    RETURN NEW;
  END IF;

  -- Idempotent: bereits gesetzt → nichts tun (auch nicht bei Re-Activation)
  IF NEW.marketing_phase_started_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Activation-Erkennung:
  --   * INSERT: TG_OP = 'INSERT' und NEW.status = 'active'
  --   * UPDATE: status wechselt nach 'active'
  IF TG_OP = 'INSERT' THEN
    v_is_activation := (NEW.status = 'active');
  ELSE  -- UPDATE
    v_is_activation := (NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active');
  END IF;

  IF NOT v_is_activation THEN
    RETURN NEW;
  END IF;

  -- Phase setzen
  NEW.marketing_phase_started_at := COALESCE(NEW.marketing_phase_started_at, now());

  IF NEW.seller_initial_instant_price IS NOT NULL THEN
    v_max_days := 30;  -- Festpreis (oder Festpreis+Auktion)
  ELSE
    v_max_days := 16;  -- Pure Auktion (max 4 Runden à 3 Tage + 4×24h Kaufchance)
  END IF;

  IF NEW.marketing_phase_max_until IS NULL THEN
    NEW.marketing_phase_max_until := NEW.marketing_phase_started_at + (v_max_days || ' days')::INTERVAL;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_marketing_phase_on_activation() IS
  'BEFORE INSERT OR UPDATE Trigger: setzt marketing_phase_started_at + max_until beim ersten Aktivieren (status → active). Idempotent. Greift sowohl beim direkten INSERT (Admin-Pfad) als auch beim UPDATE (Wizard → Aktivierung).';

DROP TRIGGER IF EXISTS trg_set_marketing_phase_on_activation ON public.auctions;
CREATE TRIGGER trg_set_marketing_phase_on_activation
  BEFORE INSERT OR UPDATE ON public.auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_marketing_phase_on_activation();

-- ───────────────────────────────────────────────────────────────────────
-- 2. Backfill: bestehende active/kaufchance Auktionen mit
--    seller_initial_reserve, aber ohne marketing_phase_*, befüllen.
--    Wir setzen started_at = COALESCE(start_time, created_at), damit der
--    Soft-Brake auf der ursprünglichen Aktivierung basiert (nicht auf jetzt).
-- ───────────────────────────────────────────────────────────────────────

UPDATE public.auctions a
   SET marketing_phase_started_at = COALESCE(a.start_time, a.created_at, now()),
       marketing_phase_max_until  =
         COALESCE(a.start_time, a.created_at, now())
         + CASE
             WHEN a.seller_initial_instant_price IS NOT NULL THEN INTERVAL '30 days'
             ELSE INTERVAL '16 days'
           END
 WHERE a.status IN ('active', 'kaufchance')
   AND a.seller_initial_reserve IS NOT NULL
   AND a.marketing_phase_started_at IS NULL;
