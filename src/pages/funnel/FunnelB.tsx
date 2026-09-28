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
        description="Laden Sie Angebot und Planung Ihres Küchenstudios hoch – geprüfte Studios aus Ihrer Region können den Preis 72 Stunden lang unterbieten. Kostenlos und unverbindlich."
        canonicalPath="/funnel/b"
      />
      <FunnelBClient />
    </>
  );
}
