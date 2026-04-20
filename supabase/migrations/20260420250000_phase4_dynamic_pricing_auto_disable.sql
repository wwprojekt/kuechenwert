-- =====================================================================
-- Phase 4 / A2: Auto-Disable dynamic_pricing bei manueller Preis-Editierung
-- =====================================================================
-- Wenn ein Verkäufer (oder ein Admin im Namen des Verkäufers) den Mindest-
-- preis (motorhomes.reserve_price) ODER Festpreis (motorhomes.instant_price)
-- MANUELL ändert, soll für die zugehörige aktive Auktion (status = 'active'
-- oder 'kaufchance') die automatische Preissenkung (auctions.dynamic_pricing)
-- ausgeschaltet werden.
--
-- Begründung (laut User-Spec): Der Verkäufer hat soeben bewusst eine eigene
-- Preisentscheidung getroffen. Wenn unser Marketing-Cron-Job diesen Preis
-- direkt danach automatisch weiter senken würde, wäre das ein Verstoß gegen
-- den Verkäuferwillen UND ein potenzielles Haftungs-/Vertrauensproblem.
-- Der Verkäufer muss bewusst neu zustimmen (Re-Aktivierung im Dashboard).
--
-- Sicherheits-Diskriminator: Der Trigger feuert NUR wenn auth.uid() IS NOT
-- NULL — also NUR aus echten User-Sessions (Frontend / Admin-UI). Edge
-- Functions mit Service-Role haben auth.uid() = NULL → der Trigger feuert
-- dort NICHT (close-auction, check-expired-auctions führen ihre eigenen
-- Reserve-Senkungen über auctions.reserve_price bzw. motorhomes.instant_price
-- mit Service-Role aus).
--
-- Idempotenz: Trigger kann gefahrlos mehrfach migriert werden (CREATE OR
-- REPLACE FUNCTION + DROP TRIGGER IF EXISTS).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.disable_dynamic_pricing_on_manual_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_changed boolean := false;
BEGIN
  -- Nur auf echte User-Sessions reagieren. Service-Role (Edge Functions,
  -- Cron-Jobs wie check-expired-auctions / close-auction) hat auth.uid() = NULL
  -- und darf den eigenen Auto-Senkungs-Lauf nicht selbst sabotieren.
  IF v_caller IS NULL THEN
    RETURN NEW;
  END IF;

  -- Hat sich tatsächlich einer der Anker-Preise geändert?
  IF NEW.reserve_price IS DISTINCT FROM OLD.reserve_price THEN
    v_changed := true;
  END IF;

  IF NEW.instant_price IS DISTINCT FROM OLD.instant_price THEN
    v_changed := true;
  END IF;

  IF NOT v_changed THEN
    RETURN NEW;
  END IF;

  -- dynamic_pricing für aktive/kaufchance-Auktion dieses Motorhomes
  -- ausschalten (sofern überhaupt aktiv). Wir touchen updated_at NICHT,
  -- um keine Cache-Invalidierungen zu triggern, die nichts mit der
  -- Verkäufer-Edit zu tun hatten — auctions.updated_at wird hier aber
  -- mitgezogen, damit React Query einen sauberen Refresh hat.
  UPDATE public.auctions
     SET dynamic_pricing = false,
         updated_at = now()
   WHERE motorhome_id = NEW.id
     AND status IN ('active', 'kaufchance')
     AND dynamic_pricing = true;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.disable_dynamic_pricing_on_manual_edit() IS
'Phase 4 / A2: Schaltet auctions.dynamic_pricing automatisch auf false, sobald der Verkäufer (oder Admin) den Mindest-/Festpreis am motorhomes-Datensatz manuell ändert. Feuert nur bei auth.uid() IS NOT NULL — Service-Role / Edge Functions sind ausgenommen.';

DROP TRIGGER IF EXISTS trg_disable_dynamic_pricing_on_manual_edit ON public.motorhomes;

CREATE TRIGGER trg_disable_dynamic_pricing_on_manual_edit
  AFTER UPDATE OF reserve_price, instant_price ON public.motorhomes
  FOR EACH ROW
  EXECUTE FUNCTION public.disable_dynamic_pricing_on_manual_edit();

-- =====================================================================
-- Smoke-Test (ohne Side-Effects, prüft nur Existenz)
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'trg_disable_dynamic_pricing_on_manual_edit'
       AND tgrelid = 'public.motorhomes'::regclass
  ) THEN
    RAISE EXCEPTION 'Trigger trg_disable_dynamic_pricing_on_manual_edit wurde NICHT angelegt';
  END IF;

  RAISE NOTICE 'OK: trg_disable_dynamic_pricing_on_manual_edit ist installiert';
END $$;
