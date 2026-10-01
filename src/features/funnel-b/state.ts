import type { PlanChangesSlug } from "@/config/funnel-b-stammdaten";
import { isStudioPlanningFile, type PendingLeadFile } from "./files";

export type OfferDeliveryMethod = "" | "now" | "later";

export interface FunnelBAppliance {
  id: string;
  categorySlug: string;
  brandSlug: string;
  model: string;
}

/** Formularstand von Funnel B; Feldnamen sind der Vertrag mit kw-lead-b. */
export interface FunnelBData {
  /** Leistungsumfang des vorhandenen Angebots (OFFER_INCLUDES) oder ["unknown"]. */
  offerIncludes: string[];
  /** YYYY-MM-DD aus dem Angebot, optional. */
  offerValidUntil: string;
  kitchenForm: string;
  timeframe: string;

  brand: string;
  brandCustom: string;
  frontName: string;
  frontMaterialName: string;
  handleType: string;

  worktopMaterial: string;
  worktopDesign: string;
  worktopDesignCustom: string;

  appliances: FunnelBAppliance[];

  sinkBrand: string;
  sinkMaterial: string;
  sinkDesignation: string;

  extras: string[];
  extrasNotes: string;

  paymentDownPaymentPercent: string;
  paymentFinancing: string;
  paymentFinancingApr: string;
  paymentFinancingMonths: string;

  existingOfferStudio: string;
  existingOfferPriceEur: string;
  /** Unterlagen: "now" = jetzt hochladen, "later" = später über den Projektlink nachreichen */
  offerDeliveryMethod: OfferDeliveryMethod;
  uploads: PendingLeadFile[];
  /** Planung genau so anbieten („none“) oder mit Änderungen („changes“, beschrieben in planChangesText). */
  planChanges: "" | PlanChangesSlug;
  planChangesText: string;
  /** Nur im Browser: Detailfragen beantworten („ja“) oder direkt zu den Kontaktdaten („nein“). */
  wantsDetails: "" | "ja" | "nein";

  postalCode: string;
  city: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  salutation: "frau" | "herr" | "divers" | "";
  /** AGB akzeptiert, Datenschutzerklärung gelesen (FUNNEL_TERMS.b); übersteht kein Neuladen. */
  acceptTerms: boolean;
}

export const initialFunnelBData: FunnelBData = {
  offerIncludes: [],
  offerValidUntil: "",
  kitchenForm: "",
  timeframe: "",
  brand: "",
  brandCustom: "",
  frontName: "",
  frontMaterialName: "",
  handleType: "",
  worktopMaterial: "",
  worktopDesign: "",
  worktopDesignCustom: "",
  appliances: [],
  sinkBrand: "",
  sinkMaterial: "",
  sinkDesignation: "",
  extras: [],
  extrasNotes: "",
  paymentDownPaymentPercent: "",
  paymentFinancing: "",
  paymentFinancingApr: "",
  paymentFinancingMonths: "",
  existingOfferStudio: "",
  existingOfferPriceEur: "",
  offerDeliveryMethod: "",
  uploads: [],
  planChanges: "",
  planChangesText: "",
  wantsDetails: "",
  postalCode: "",
  city: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  salutation: "",
  acceptTerms: false,
};

/** Haken der Fassung bis 30.09.2026, die noch im sessionStorage stehen können. */
const LEGACY_KEYS = ["consentShare", "consentCall", "consentStudioCall", "consentMarketing"];

export const FUNNEL_B_STORAGE_KEY = "kw_funnel_b";

/** Persist nur JSON-serialisierbare Felder, keine File-Objekte und keine AGB-Bestätigung. */
export function serializeFunnelB(data: FunnelBData): string {
  const { uploads: _uploads, acceptTerms: _terms, ...rest } = data;
  return JSON.stringify(rest);
}

export function loadFunnelB(): FunnelBData {
  if (typeof window === "undefined") return initialFunnelBData;
  try {
    const raw = sessionStorage.getItem(FUNNEL_B_STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    for (const key of LEGACY_KEYS) delete saved[key];
    return { ...initialFunnelBData, ...(saved as Partial<FunnelBData>), uploads: [], acceptTerms: false };
  } catch {
    return initialFunnelBData;
  }
}

/** Preis und Planung vollständig: genannter Preis und entweder Unterlagen oder „später nachreichen“. */
export function isOfferReady(data: FunnelBData): boolean {
  if (!(Number(data.existingOfferPriceEur) > 0)) return false;
  if (data.offerDeliveryMethod === "later") return true;
  return data.offerDeliveryMethod === "now" && data.uploads.length > 0;
}

/** Planung oder Angebot liegt bei: Was darin steht, fragt der Funnel nicht noch einmal ab. */
export function planningOnFile(data: Pick<FunnelBData, "offerDeliveryMethod" | "uploads">): boolean {
  return data.offerDeliveryMethod === "now" && data.uploads.some((u) => isStudioPlanningFile(u.category));
}

/** Dateien gehen nur mit „Jetzt hochladen“ mit; bei „Später nachreichen“ ist der Upload nicht im Pfad. */
export function submissionUploads(data: FunnelBData): PendingLeadFile[] {
  return data.offerDeliveryMethod === "now" ? data.uploads : [];
}
