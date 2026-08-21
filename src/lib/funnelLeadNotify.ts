import { supabase } from "@/integrations/supabase/client";
import { getTrackingData } from "@/lib/clickIdService";

/**
 * Bestätigungsmail + serverseitiges Conversion-Tracking (GA4/Ads Click-IDs).
 * Fire-and-forget: ein Fehlschlag darf den Funnel-Dankeschön-Schritt nicht blockieren.
 */
export function notifyKitchenFunnelLead(opts: {
  funnel: "a" | "b" | "c";
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  postalCode?: string | null;
  kitchenForm?: string | null;
  transactionId: string;
}): void {
  const email = (opts.email || "").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

  const tracking = getTrackingData();
  const name = [opts.firstName, opts.lastName].filter(Boolean).join(" ").trim() || email;

  void supabase.functions
    .invoke("send-lead-notification", {
      body: {
        type: "funnel",
        name,
        email,
        phone: opts.phone?.trim() || undefined,
        kitchenForm: opts.kitchenForm || undefined,
        postalCode: opts.postalCode || undefined,
        funnelVariant: opts.funnel,
        gclid: tracking.gclid || undefined,
        gbraid: tracking.gbraid || undefined,
        wbraid: tracking.wbraid || undefined,
        ga4ClientId: tracking.ga4ClientId || undefined,
        transactionId: opts.transactionId,
      },
    })
    .catch((err) => {
      console.error("[funnel] send-lead-notification failed (non-blocking):", err);
    });
}
