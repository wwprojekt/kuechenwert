import type { PendingLeadFile } from "@/features/funnel-b/files";
import { announceFiles, uploadToTargets, type UploadTarget } from "@/features/funnel-b/upload";
import type { CustomerDetails } from "./lead-details";
import { callFunction } from "./api-client";
import type { Order } from "./order";

export type TenderStatus = "draft" | "active" | "completed" | "awarded" | "expired" | "cancelled";
export type OfferStatus = "active" | "withdrawn" | "accepted" | "declined";

export interface OfferIncludes {
  delivery?: boolean;
  assembly?: boolean;
  appliances?: boolean;
  removal?: boolean;
  connection?: boolean;
  measurement?: boolean;
}

export const OFFER_INCLUDE_LABELS: Record<keyof OfferIncludes, string> = {
  delivery: "Lieferung",
  assembly: "Montage",
  appliances: "Elektrogeräte",
  removal: "Altküche-Entsorgung",
  connection: "Elektro- & Wasseranschluss",
  measurement: "Aufmaß vor Ort",
};

export interface ProjectOffer {
  bid_id: string;
  price_eur: number;
  delivery_weeks: number | null;
  includes: OfferIncludes;
  valid_until: string | null;
  message: string | null;
  revision: number;
  status: OfferStatus;
  submitted_at: string;
  updated_at: string;
  dealer: {
    company_name: string;
    city?: string;
    website?: string;
    verified: boolean;
    member_since?: string;
    distance_km?: number;
    rating?: number;
    reviews: number;
    intro?: string;
    phone?: string;
    email?: string;
    street?: string;
    postal_code?: string;
  };
}

export interface ProjectMedia {
  id?: string;
  bucket: string;
  path: string | null;
  url: string | null;
  mode?: "edit" | "text";
  version?: number;
  variant?: string | null;
}

export interface ProjectSummaryLabels {
  quality?: string;
  style?: string;
  front?: string;
  handle?: string;
  wall_cabinets?: string;
  tall_units?: number;
  worktop?: string;
  sink?: string;
  tap?: string;
  appliance_level?: string;
  appliances?: string[];
  extras?: string[];
  services?: string[];
  timeframe?: string | null;
}

export interface ProjectView {
  lead: {
    id: string;
    funnel_type: "a" | "b" | "traumkueche";
    status: string;
    first_name: string | null;
    postal_code: string;
    created_at: string;
    kitchen_form: string | null;
    kitchen_style: string | null;
    budget_eur: number | null;
    timeframe_months: number | null;
    has_phone: boolean;
    /** Aktive Studios, deren Einzugsgebiet die PLZ abdeckt; fehlt bei älteren Function-Versionen. */
    studios_in_area?: number;
  };
  tender: null | {
    id: string;
    status: TenderStatus;
    published_at: string | null;
    ends_at: string | null;
    decision_deadline_at: string | null;
    estimate_min_eur: number | null;
    estimate_max_eur: number | null;
    reference_price_eur: number | null;
    won_bid_id: string | null;
    decided_at: string | null;
    contact_unlocks: number;
    summary: {
      room?: { description?: string; walls?: Record<string, number>; form?: string; ceiling_height_cm?: number | null; ventilation?: string | null };
      labels?: ProjectSummaryLabels;
      wishes?: string | null;
      estimate?: { min: number; max: number; mid: number };
    };
  };
  /** Eigene Ergänzungen des Kunden (Angaben vervollständigen); fehlt bei älteren Function-Versionen. */
  details?: { customer: CustomerDetails; updated_at: string | null } | null;
  offers: ProjectOffer[];
  renders: ProjectMedia[];
  photos: Array<{ path: string; url: string | null }>;
  /** Auftragsverlauf nach dem Zuschlag; fehlt bei älteren Function-Versionen. */
  order?: Order | null;
  /** Hochgeladene Unterlagen (nur Name und Kategorie). */
  files?: ProjectFile[];
  /** Unterlagen dürfen nachgereicht werden (Projekt offen, noch Platz). */
  can_upload_files?: boolean;
  /** Einwilligung zur KI-Verbesserung; nur bei Planungen mit Raumfoto. */
  ai_training?: { granted: boolean } | null;
  /** Planung aus dem Konfigurator (Funnel C), auch ohne Ausschreibung. */
  planner?: {
    estimate: { min: number; max: number; mid: number } | null;
    photo_count: number | null;
    room?: { ceilingHeightCm?: number | null; ventilation?: string | null } | null;
  } | null;
}

export interface ProjectFile {
  name: string;
  category: string;
  created_at: string;
}

const FN = "kw-project";

export const getProject = (token: string) => callFunction<ProjectView>(FN, { action: "get", token });
export const acceptOffer = (token: string, bidId: string) => callFunction<ProjectView>(FN, { action: "accept", token, bid_id: bidId });
export const cancelProject = (token: string, reason: string) => callFunction<ProjectView>(FN, { action: "cancel", token, reason });
/** `already`: Für das Projekt war schon eine Nummer hinterlegt, sie bleibt unverändert. */
export const addProjectPhone = (token: string, phone: string, consentCall: boolean) =>
  callFunction<{ ok: true; already?: true }>(FN, { action: "add-phone", token, phone, consent_call: consentCall });
export const requestProjectLink = (email: string) => callFunction<{ ok: true }>(FN, { action: "resend", email });
export const confirmOrder = (token: string) => callFunction<ProjectView>(FN, { action: "order-confirm", token });
export const reportOrderProblem = (token: string, message: string) =>
  callFunction<ProjectView>(FN, { action: "order-problem", token, message });
/** Alle zum Projekt gespeicherten Daten als JSON (Art. 15/20 DSGVO). */
export const exportProjectData = (token: string) => callFunction<Record<string, unknown>>(FN, { action: "export-data", token });
/** Projekt beenden und personenbezogene Daten löschen; `email` bestätigt die Anfrage. */
export const deleteProjectData = (token: string, email: string) =>
  callFunction<{ ok: true }>(FN, { action: "delete-data", token, email });
/** KI-Verbesserung erlauben oder widerrufen; ein Widerruf löscht die Trainingskopien sofort. */
/** Funnel C „nur Visualisierung“: Angebote nachträglich anfordern (gleiche Einwilligung wie im Funnel). */
export const requestProjectOffers = (token: string, input: { timeframeMonths: number | null; contactByPhone: boolean }) =>
  callFunction<ProjectView>(FN, {
    action: "request-offers",
    token,
    consent_share: true,
    timeframe_months: input.timeframeMonths,
    contact_by_phone: input.contactByPhone,
  });

export const setProjectAiConsent = (token: string, granted: boolean) =>
  callFunction<ProjectView>(FN, { action: "ai-consent", token, granted });

/** Angaben vervollständigen: ersetzt die bisherigen Ergänzungen des Kunden. */
export const saveProjectDetails = (token: string, details: CustomerDetails) =>
  callFunction<ProjectView>(FN, { action: "save-details", token, details });

/**
 * Unterlagen über den Projektlink nachreichen: ankündigen, direkt in den
 * Bucket hochladen, danach eintragen lassen. Liefert die Zahl der
 * eingetragenen Dateien.
 */
export async function uploadProjectFiles(
  token: string,
  files: PendingLeadFile[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ attached: number; failed: number }> {
  const issued = await callFunction<{ upload_token?: string; uploads?: UploadTarget[] }>(FN, {
    action: "upload-files",
    token,
    files: announceFiles(files),
  });
  const targets = issued.uploads ?? [];
  if (!targets.length || !issued.upload_token) return { attached: 0, failed: files.length };
  const uploaded = await uploadToTargets(files, targets, onProgress);
  if (uploaded.length === 0) return { attached: 0, failed: files.length };
  const result = await callFunction<{ attached: number }>(FN, {
    action: "attach-files",
    token,
    upload_token: issued.upload_token,
    files: uploaded,
  });
  const attached = result.attached ?? 0;
  return { attached, failed: Math.max(0, files.length - attached) };
}
