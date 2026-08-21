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
        title="Studio-Angebot unterbieten"
        description="Laden Sie Ihr bestehendes Küchenstudio-Angebot hoch — wir holen vergleichbare Alternativen ein und helfen Ihnen, den Preis zu unterbieten."
        canonicalPath="/funnel/b"
      />
      <FunnelBClient />
    </>
  );
}
