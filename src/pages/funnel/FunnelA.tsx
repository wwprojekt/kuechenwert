import { useEffect } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { FunnelSeo } from "@/components/funnel/funnel-seo";
import { FUNNEL_A_FIRST_SLUG, isFunnelAStepSlug, stepPath } from "@/features/funnel-a/steps";
import { captureUtmParams } from "@/lib/utm";
import { FunnelAClient } from "./FunnelAClient";

/**
 * Funnel A („Küchenangebote einholen“), Route /funnel/a/:step.
 * Unbekannte oder alte Slugs (z. B. telefon, fronten aus v1) führen zum
 * ersten Schritt; Query-Parameter (utm_*, form, plz …) bleiben dabei erhalten.
 */
export default function FunnelA() {
  const { step } = useParams<{ step?: string }>();
  const { search } = useLocation();

  useEffect(() => {
    captureUtmParams();
  }, []);

  if (!isFunnelAStepSlug(step)) {
    return <Navigate to={{ pathname: stepPath(FUNNEL_A_FIRST_SLUG), search }} replace />;
  }

  return (
    <>
      <FunnelSeo
        title="Küchenangebote einholen"
        description="Beschreiben Sie Ihre Wunschküche in wenigen Klicks und erhalten Sie kostenlos Angebote geprüfter Küchenstudios aus Ihrer Region."
        canonicalPath="/formular"
        noIndex
      />
      <FunnelAClient slug={step} />
    </>
  );
}
