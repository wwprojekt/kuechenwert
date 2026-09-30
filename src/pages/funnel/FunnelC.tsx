import { useEffect } from "react";
import { FunnelSeo } from "@/components/funnel/funnel-seo";
import { PlannerFunnel } from "@/features/planner/PlannerFunnel";
import { usePlannerFunnel } from "@/features/planner/usePlannerFunnel";
import { captureUtmParams } from "@/lib/utm";

/**
 * Funnel C — Traumküche planen & visualisieren (Konfigurator v3).
 *
 * Form, Maße, Foto und Ausstattung je auf einem Bildschirm → „Küche
 * visualisieren“ startet die KI im Hintergrund → Angebote gewünscht?, Name,
 * E-Mail und Telefon → erst dann Küche und Preisschätzung (jede
 * Visualisierung ist ein Lead; der Server gibt Bild und Preis vorher nicht heraus).
 */
export default function FunnelC() {
  const controller = usePlannerFunnel();

  useEffect(() => {
    captureUtmParams();
  }, []);

  return (
    <>
      <FunnelSeo
        title="Traumküche planen & visualisieren"
        description="Laden Sie ein Foto Ihres Raums hoch, konfigurieren Sie Ihre Wunschküche und sehen Sie per KI, wie sie aussehen wird – mit realistischer Preisschätzung und Angeboten geprüfter Küchenstudios."
        canonicalPath="/funnel/c"
      />
      <PlannerFunnel c={controller} />
    </>
  );
}
