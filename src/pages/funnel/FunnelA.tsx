import { useEffect } from "react";
import { useParams, Navigate, useSearchParams } from "react-router-dom";
import { FunnelAClient } from "./FunnelAClient";
import { useFunnelAStammdaten } from "./useFunnelAStammdaten";
import { FUNNEL_A_STEPS } from "@/config/funnel-a";
import { captureUtmParams } from "@/lib/utm";
import { Loader2 } from "lucide-react";

/**
 * Wrapper-Page fuer Funnel A.
 *
 * Route: /funnel/a/:step
 *
 * Haendelt:
 *   - URL-Param :step -> StepSlug
 *   - UTM-Capture beim ersten Besuch (persistiert in sessionStorage)
 *   - Query-Param ?plz=... als Hero-Handoff (wenn der User auf der Homepage
 *     die PLZ schon eingegeben hat, starten wir Funnel A damit vorausgefuellt)
 *   - Stammdaten-Loading (catalog_front_materials + catalog_appliance_brands +
 *     catalog_worktop_materials) via react-query
 *   - Redirect bei unbekanntem Step-Slug
 */
export default function FunnelA() {
  const { step: stepSlug } = useParams<{ step: string }>();
  const [searchParams] = useSearchParams();
  const initialPlz = searchParams.get("plz") ?? "";
  const { data: stammdaten, isLoading } = useFunnelAStammdaten();

  useEffect(() => {
    captureUtmParams();
  }, []);

  if (!stepSlug) {
    return <Navigate to={`/funnel/a/${FUNNEL_A_STEPS[0]?.slug}`} replace />;
  }

  const isValidStep = FUNNEL_A_STEPS.some((s) => s.slug === stepSlug);
  if (!isValidStep) {
    return <Navigate to={`/funnel/a/${FUNNEL_A_STEPS[0]?.slug}`} replace />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <FunnelAClient
      stepSlug={stepSlug}
      initialPlz={initialPlz}
      stammdaten={stammdaten}
    />
  );
}
