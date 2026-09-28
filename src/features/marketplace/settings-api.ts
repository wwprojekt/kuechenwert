import { supabase } from "@/integrations/supabase/client";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import { ApiError } from "./api-client";

/** Einzeilige Tabelle kw_marketplace_settings (id = true); Wertebereiche sichern CHECK-Constraints. */
export interface MarketplaceSettings {
  tender_duration_hours: number;
  tender_duration_hours_unterbieten: number;
  decision_window_days: number;
  max_contact_purchases: number;
  bid_visibility: "lowest_price" | "sealed";
  default_service_radius_km: number;
  min_offer_ratio: number;
  auto_publish_funnel_a: boolean;
  auto_publish_funnel_c: boolean;
  contact_price_fallback_cents: number;
  auto_issue_invoices: boolean;
  updated_at: string | null;
}

const COLUMNS =
  "tender_duration_hours, tender_duration_hours_unterbieten, decision_window_days, max_contact_purchases, bid_visibility, default_service_radius_km, min_offer_ratio, auto_publish_funnel_a, auto_publish_funnel_c, contact_price_fallback_cents, auto_issue_invoices, updated_at";

async function requireSession() {
  if (!(await ensureValidRLSSession())) throw new ApiError("Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.", 401);
}

export async function fetchMarketplaceSettings(): Promise<MarketplaceSettings> {
  await requireSession();
  const { data, error } = await supabase.from("kw_marketplace_settings").select(COLUMNS).eq("id", true).single();
  if (error) throw new ApiError(error.message, 409, error.code);
  return { ...data, min_offer_ratio: Number(data.min_offer_ratio) } as MarketplaceSettings;
}

export async function saveMarketplaceSettings(settings: Omit<MarketplaceSettings, "updated_at">): Promise<void> {
  await requireSession();
  const { error } = await supabase
    .from("kw_marketplace_settings")
    .update({ ...settings, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) {
    throw new ApiError(
      error.code === "23514" ? "Ein Wert liegt außerhalb des erlaubten Bereichs." : error.code === "42501" ? "Nur Admins dürfen die Einstellungen ändern." : error.message,
      409,
      error.code,
    );
  }
}
