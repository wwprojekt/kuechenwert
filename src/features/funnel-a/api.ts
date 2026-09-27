import { callFunction } from "@/features/marketplace/api-client";
import { generateTransactionId, setEnhancedConversionFromForm, trackKitchenFunnelLead } from "@/lib/gadsConversionService";
import { trackMetaLead } from "@/lib/metaPixelService";
import { getEntryPath, getStoredUtm } from "@/lib/utm";
import type { FunnelAAnswers } from "./catalog";
import type { ValidContact } from "./validation";

export interface FunnelASubmitPayload {
  answers: FunnelAAnswers;
  contact: ValidContact;
  turnstileToken: string | null;
  /** Honeypot: bleibt bei Menschen leer. */
  website: string;
  /** Gleich bei Wiederholungen, damit der Server Doppel-Anfragen erkennt. */
  submissionId: string;
  /** Nur mit Marketing-Einwilligung gesetzt. */
  clickIds: Record<string, string> | null;
}

export interface FunnelASubmitResult {
  ok: boolean;
  lead_id?: string;
  project_token?: string;
  project_url: string;
  estimate?: { min: number; max: number; mid: number };
}

export function buildSubmitBody({ answers, contact, turnstileToken, website, submissionId, clickIds }: FunnelASubmitPayload) {
  return {
    action: "submit",
    answers,
    contact: {
      salutation: contact.salutation,
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email,
      phone: contact.phone,
    },
    consents: {
      share_with_studios: true,
      contact_by_phone: contact.contact_by_phone,
      marketing: contact.marketing,
    },
    turnstile_token: turnstileToken,
    website,
    submission_id: submissionId,
    click_ids: clickIds,
    utm: getStoredUtm(),
    landing_page: getEntryPath() ?? window.location.pathname,
  };
}

export function submitFunnelA(payload: FunnelASubmitPayload): Promise<FunnelASubmitResult> {
  return callFunction<FunnelASubmitResult>("kw-lead", buildSubmitBody(payload));
}

/** Conversion-Tracking (Ads, GA4, Meta) – darf die Weiterleitung nie blockieren. */
export async function trackFunnelALead(contact: ValidContact, answers: FunnelAAnswers): Promise<void> {
  try {
    const transactionId = generateTransactionId("funnel_a");
    await setEnhancedConversionFromForm({
      email: contact.email,
      firstName: contact.first_name,
      lastName: contact.last_name,
      postalCode: answers.postal_code,
      ...(contact.phone ? { phone: contact.phone } : {}),
    });
    await trackKitchenFunnelLead("a", transactionId);
    trackMetaLead({ content_name: "Funnel A", content_category: "Küchenanfrage" });
  } catch (err) {
    console.error("[funnel-a] Tracking fehlgeschlagen (nicht blockierend):", err);
  }
}
