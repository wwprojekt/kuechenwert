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
        title="Studio-Preis unterbieten"
        description="Nennen Sie den Preis Ihres Küchenstudios und laden Sie die Planung hoch – geprüfte Studios aus Ihrer Region können ihn 72 Stunden lang unterbieten. Kostenlos und unverbindlich."
        canonicalPath="/funnel/b"
      />
      <FunnelBClient />
    </>
  );
}
