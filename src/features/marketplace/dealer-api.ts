import { supabase } from "@/integrations/supabase/client";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import { ApiError } from "./api-client";
import type { OfferIncludes, ProjectSummaryLabels, TenderStatus } from "./project-api";

export type DealerScope = "open" | "all" | "mine";

export interface ProjectSummary {
  source?: "a" | "b" | "c";
  room?: { form?: string; walls?: Record<string, number>; ceiling_height_cm?: number | null; description?: string; notes?: string | null };
  labels?: ProjectSummaryLabels;
  config?: Record<string, unknown>;
  wishes?: string | null;
  estimate?: { min: number; max: number; mid: number };
  layout?: { runCm: number; baseRunCm: number; islandCm: number; worktopCm: number; tallUnits: number };
  timeframe_months?: number | null;
  housing_type?: string | null;
  photo_count?: number;
  cover?: { bucket: string; path: string } | null;
  kitchen_form?: string | null;
  kitchen_style?: string | null;
  budget_eur?: number | null;
  existing_offer_eur?: number | null;
  answers?: Record<string, unknown>;
}

export interface MyOffer {
  id: string;
  price_eur: number;
  status: "active" | "withdrawn" | "accepted" | "declined";
  revision: number;
  updated_at: string;
  delivery_weeks: number | null;
  includes?: OfferIncludes;
  valid_until?: string | null;
  notes?: string | null;
}

export interface DealerProjectRow {
  auction_id: string;
  status: TenderStatus;
  funnel_type: "a" | "b" | "traumkueche";
  published_at: string | null;
  ends_at: string | null;
  decision_deadline_at: string | null;
  postal_prefix: string;
  region: string | null;
  distance_km: number | null;
  summary: ProjectSummary;
  estimate_min_eur: number | null;
  estimate_max_eur: number | null;
  reference_price_eur: number | null;
  offer_count: number;
  lowest_offer_eur: number | null;
  my_offer: MyOffer | null;
  contact_unlocked: boolean;
  contact_purchases: number;
  max_contact_purchases: number;
  contact_price_cents: number | null;
  awarded_to_me: boolean;
  in_service_area: boolean;
}

export interface DealerProjectDetail extends Omit<DealerProjectRow, "my_offer" | "in_service_area"> {
  service_radius_km: number | null;
  bid_visibility: "lowest_price" | "sealed";
  my_offer: MyOffer | null;
  media: Array<{ bucket: string; path: string; kind: "render" | "photo"; mode?: string }>;
  contact: null | {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    postal_code: string;
    city: string | null;
    address_line: string | null;
    consent_call: boolean;
  };
}

export interface MarketProfile {
  dealer_id: string;
  service_postal_code: string | null;
  service_radius_km: number;
  notify_new_projects: boolean;
  min_project_value_eur: number | null;
  offer_intro: string | null;
}

function toApiError(error: { message: string; code?: string }): ApiError {
  const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 409;
  return new ApiError(error.message, status, error.code);
}

async function guard() {
  const ok = await ensureValidRLSSession();
  if (!ok) throw new ApiError("Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.", 401);
}

export async function fetchDealerProjects(scope: DealerScope): Promise<DealerProjectRow[]> {
  await guard();
  const { data, error } = await supabase.rpc("kw_dealer_projects", { p_scope: scope, p_limit: 100, p_offset: 0 });
  if (error) throw toApiError(error);
  return (data ?? []) as unknown as DealerProjectRow[];
}

export async function fetchDealerProject(auctionId: string): Promise<DealerProjectDetail> {
  await guard();
  const { data, error } = await supabase.rpc("kw_dealer_project", { p_auction_id: auctionId });
  if (error) throw toApiError(error);
  return data as unknown as DealerProjectDetail;
}

export async function placeOffer(input: {
  auctionId: string;
  priceEur: number;
  deliveryWeeks: number | null;
  includes: OfferIncludes;
  validUntil: string | null;
  message: string | null;
}) {
  await guard();
  const { data, error } = await supabase.rpc("kw_dealer_place_offer", {
    p_auction_id: input.auctionId,
    p_price_eur: input.priceEur,
    p_delivery_weeks: input.deliveryWeeks ?? undefined,
    p_includes: input.includes as never,
    p_valid_until: input.validUntil ?? undefined,
    p_message: input.message ?? undefined,
  });
  if (error) throw toApiError(error);
  return data as unknown as { ok: true; bid_id: string; rank: number; is_update: boolean };
}

export async function withdrawOffer(auctionId: string) {
  await guard();
  const { error } = await supabase.rpc("kw_dealer_withdraw_offer", { p_auction_id: auctionId });
  if (error) throw toApiError(error);
}

export async function unlockContact(auctionId: string): Promise<DealerProjectDetail> {
  await guard();
  const { data, error } = await supabase.rpc("kw_dealer_unlock_contact", { p_auction_id: auctionId });
  if (error) throw toApiError(error);
  return data as unknown as DealerProjectDetail;
}

/** Signierte URLs für Renders/Fotos (Storage-Policy prüft die Berechtigung). */
export async function signPlannerMedia(paths: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return {};
  const { data, error } = await supabase.storage.from("planner-media").createSignedUrls(unique, 3600);
  if (error) return {};
  const out: Record<string, string> = {};
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) out[entry.path] = entry.signedUrl;
  }
  return out;
}

export async function fetchMarketProfile(dealerId: string): Promise<MarketProfile | null> {
  await guard();
  const { data, error } = await supabase.from("kw_dealer_market_profiles").select("*").eq("dealer_id", dealerId).maybeSingle();
  if (error) throw toApiError(error);
  return data as MarketProfile | null;
}

export async function saveMarketProfile(profile: MarketProfile) {
  await guard();
  const { error } = await supabase.from("kw_dealer_market_profiles").upsert(profile, { onConflict: "dealer_id" });
  if (error) throw toApiError(error);
}
