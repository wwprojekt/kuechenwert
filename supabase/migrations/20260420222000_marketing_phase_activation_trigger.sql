-- Migration: Marketing-Phase wird beim Aktivieren automatisch gestartet
--
-- Phase 3.2 des Marketing-Phase-Rollouts.
--
-- Hintergrund:
--   In Phase 1/2 haben wir die Spalten `marketing_phase_started_at` und
--   `marketing_phase_max_until` in `auctions` ergänzt – aber bewusst NICHT
--   beim Wizard/auto-convert-wizard befüllt. Die Marketingphase soll erst
--   starten, wenn der Admin die Auktion aktiviert (status: draft → active),
--   nicht bereits beim Erstellen des Drafts.
--
--   Damit das robust funktioniert (egal ob Aktivierung über das Admin-
--   Dashboard, einen Edge-Job, oder ein Backfill-SQL passiert), setzen
--   wir die Phase per BEFORE-UPDATE-Trigger.
--
-- Verhalten:
--   * Nur bei Übergang status != 'active' → 'active'
--   * Nur wenn `seller_initial_reserve IS NOT NULL`
--     (Marker für „neue Marketingphase-Logik gilt"; alte Bestand-Inserate
--      ohne `seller_initial_reserve` laufen weiterhin nach Alt-Logik)
--   * Nur wenn `marketing_phase_started_at IS NULL`
--     (Re-Aktivierung nach Pause oder Auto-Relist setzt die Phase NICHT
--      zurück – die Bindung läuft kontinuierlich, sonst Endlos-Bindung)
--   * `max_until` = `started_at` + 30 Tage bei Festpreis (instant_price)
--                 = `started_at` + 16 Tage bei Auktion
--
-- Konstanten (16 / 30) sind dupliziert in:
--   * supabase/functions/_shared/marketing-config.ts
--   * src/lib/marketing-config.ts
--   Wenn sich die Werte ändern, muss diese Migration ergänzt werden
--   (neue Migration mit DROP TRIGGER + neue CREATE TRIGGER, oder
--   CREATE OR REPLACE FUNCTION mit angepassten Intervallen).

CREATE OR REPLACE FUNCTION public.set_marketing_phase_on_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_days INTEGER;
BEGIN
  -- Nur greifen, wenn wirklich auf 'active' geschaltet wird
  IF NEW.status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM 'active' THEN
    -- Bereits aktiv → keine erneute Initialisierung
    RETURN NEW;
  END IF;

  -- Nur für Inserate der neuen Marketingphase-Logik (Phase 1+ Wizard)
  IF NEW.seller_initial_reserve IS NULL THEN
    RETURN NEW;
  END IF;

  -- Nicht überschreiben, wenn bereits gesetzt
  IF NEW.marketing_phase_started_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  NEW.marketing_phase_started_at := now();

  -- Festpreis: 30-Tage-Cap, sonst Auktion: 16-Tage-Cap.
  -- (Auktion = AUCTION_DURATION_DAYS × AUCTION_MAX_ROUNDS + 1 Kaufchance-Tag/Runde
  --  = 3 × 4 + 1 × 4 = 16 Tage; siehe MARKETING_CONFIG.)
  IF NEW.seller_initial_instant_price IS NOT NULL THEN
    v_max_days := 30;
  ELSE
    v_max_days := 16;
  END IF;

  IF NEW.marketing_phase_max_until IS NULL THEN
    NEW.marketing_phase_max_until := now() + (v_max_days || ' days')::INTERVAL;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_marketing_phase_on_activation() IS
  'BEFORE UPDATE Trigger: setzt marketing_phase_started_at + max_until beim Übergang status → active (nur für neue Inserate mit seller_initial_reserve gesetzt). Idempotent: läuft nicht erneut bei späteren Status-Wechseln.';

DROP TRIGGER IF EXISTS trg_set_marketing_phase_on_activation ON public.auctions;

CREATE TRIGGER trg_set_marketing_phase_on_activation
  BEFORE UPDATE ON public.auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_marketing_phase_on_activation();
