import { useEffect } from "react";
import FunnelBClient from "./FunnelBClient";
import { captureUtmParams } from "@/lib/utm";
import { FunnelSeo } from "@/components/funnel/funnel-seo";

export default function FunnelB() {
  useEffect(() => {
    captureUtmParams();
  }, []);

  return (
    <>
      <FunnelSeo
        title="Fertige Küchenplanung vergleichen"
        description="Schon eine fertige Planung vom Küchenstudio? Preis nennen, Planung hochladen – geprüfte Studios aus Ihrer Region können 72 Stunden lang günstiger anbieten. Kostenlos und unverbindlich."
        canonicalPath="/funnel/b"
      />
      <FunnelBClient />
    </>
  );
}
