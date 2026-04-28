import { useEffect } from "react";
import FunnelBClient from "./FunnelBClient";
import { captureUtmParams } from "@/lib/utm";

export default function FunnelB() {
  useEffect(() => {
    captureUtmParams();
  }, []);

  return <FunnelBClient />;
}
