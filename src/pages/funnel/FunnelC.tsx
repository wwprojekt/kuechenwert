import { useEffect } from "react";
import { FunnelSeo } from "@/components/funnel/funnel-seo";
import { PlannerFunnel } from "@/features/planner/PlannerFunnel";
import { usePlannerFunnel } from "@/features/planner/usePlannerFunnel";
import { captureUtmParams } from "@/lib/utm";

/**
 * Funnel C — Traumküche planen & visualisieren (Konfigurator v3).
 *
 * Form, Maße, Foto und Ausstattung je auf einem Bildschirm → „Küche
 * visualisieren“ startet die KI im Hintergrund → Fragen für die Studios,
 * Name, E-Mail, Telefon und AGB-Haken → erst dann Küche und Preisschätzung.
 * Jede Visualisierung ist ein Lead mit Ausschreibung; der Server gibt Bild und
 * Preis vorher nicht heraus.
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
        description="Laden Sie ein Foto Ihres Raums hoch, planen Sie Ihre Wunschküche und sehen Sie per KI, wie sie aussehen wird – mit Preisschätzung und kostenlosen, unverbindlichen Angeboten geprüfter Küchenstudios aus Ihrer Region."
        canonicalPath="/funnel/c"
      />
      <PlannerFunnel c={controller} />
    </>
  );
}
