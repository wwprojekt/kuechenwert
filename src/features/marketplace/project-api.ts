import { callFunction } from "./api-client";

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
  appliance_level?: string;
  appliances?: string[];
  extras?: string[];
  services?: string[];
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
      room?: { description?: string; walls?: Record<string, number>; form?: string };
      labels?: ProjectSummaryLabels;
      wishes?: string | null;
      estimate?: { min: number; max: number; mid: number };
    };
  };
  offers: ProjectOffer[];
  renders: ProjectMedia[];
  photos: Array<{ path: string; url: string | null }>;
}

const FN = "kw-project";

export const getProject = (token: string) => callFunction<ProjectView>(FN, { action: "get", token });
export const acceptOffer = (token: string, bidId: string) => callFunction<ProjectView>(FN, { action: "accept", token, bid_id: bidId });
export const cancelProject = (token: string, reason: string) => callFunction<ProjectView>(FN, { action: "cancel", token, reason });
/** `already`: Für das Projekt war schon eine Nummer hinterlegt, sie bleibt unverändert. */
export const addProjectPhone = (token: string, phone: string, consentCall: boolean) =>
  callFunction<{ ok: true; already?: true }>(FN, { action: "add-phone", token, phone, consent_call: consentCall });
export const requestProjectLink = (email: string) => callFunction<{ ok: true }>(FN, { action: "resend", email });
