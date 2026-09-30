import type { PendingLeadFile } from "./files";

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
  /** Nur im Browser: Detailfragen beantworten („ja“) oder direkt zu den Kontaktdaten („nein“). */
  wantsDetails: "" | "ja" | "nein";

  postalCode: string;
  city: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  salutation: "frau" | "herr" | "divers" | "";
  /** Weitergabe an Studios (Pflicht, Einwilligungszweck share_with_studios). */
  consentShare: boolean;
  /** Rückruf durch KüchenWert zum Experten-Check (Pflicht). */
  consentCall: boolean;
  /** Anrufe durch Studios, die den Kontakt erhalten (optional). */
  consentStudioCall: boolean;
  consentMarketing: boolean;
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
  wantsDetails: "",
  postalCode: "",
  city: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  salutation: "",
  consentShare: false,
  consentCall: false,
  consentStudioCall: false,
  consentMarketing: false,
};

export const FUNNEL_B_STORAGE_KEY = "kw_funnel_b";

/** Persist nur JSON-serialisierbare Felder, keine File-Objekte. */
export function serializeFunnelB(data: FunnelBData): string {
  const { uploads: _uploads, ...rest } = data;
  return JSON.stringify(rest);
}

export function loadFunnelB(): FunnelBData {
  if (typeof window === "undefined") return initialFunnelBData;
  try {
    const raw = sessionStorage.getItem(FUNNEL_B_STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<FunnelBData>) : {};
    return { ...initialFunnelBData, ...saved, uploads: [] };
  } catch {
    return initialFunnelBData;
  }
}

/** Angebot vollständig: Preis und entweder Unterlagen oder „später nachreichen“. */
export function isOfferReady(data: FunnelBData): boolean {
  if (!(Number(data.existingOfferPriceEur) > 0)) return false;
  if (data.offerDeliveryMethod === "later") return true;
  return data.offerDeliveryMethod === "now" && data.uploads.length > 0;
}

/** Die Daten für kw-lead-b: ohne Dateien und ohne reine Browser-Felder. */
export function submissionFields(data: FunnelBData): Record<string, unknown> {
  const { uploads: _uploads, wantsDetails: _details, ...fields } = data;
  return fields;
}
