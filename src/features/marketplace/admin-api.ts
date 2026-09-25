import { supabase } from "@/integrations/supabase/client";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import { ApiError } from "./api-client";

export type AdminTenderStatus = "draft" | "active" | "completed" | "awarded" | "expired" | "cancelled";

export const TENDER_STATUS_LABELS: Record<string, { label: string; tone: "warning" | "active" | "success" | "muted" }> = {
  draft: { label: "Entwurf – Freigabe nötig", tone: "warning" },
  active: { label: "Angebotsphase läuft", tone: "active" },
  completed: { label: "Beendet – Kunde entscheidet", tone: "active" },
  awarded: { label: "Vergeben", tone: "success" },
  expired: { label: "Abgelaufen", tone: "muted" },
  cancelled: { label: "Storniert", tone: "muted" },
};

export interface AdminTender {
  id: string;
  status: string;
  duration_hours: number | null;
  published_at: string | null;
  ends_at: string | null;
  decision_deadline_at: string | null;
  contact_price_cents: number | null;
  max_contact_purchases: number | null;
  offer_count: number;
  lowest_offer_eur: number | null;
  contact_purchases: number;
}

export interface AdminLeadFile {
  id: string;
  file_name: string;
  category: string | null;
  file_type: string | null;
  url: string | null;
}

async function requireSession() {
  if (!(await ensureValidRLSSession())) throw new ApiError("Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.", 401);
}

function fail(error: { message: string; code?: string }): never {
  const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 409;
  throw new ApiError(error.message, status, error.code);
}

/** Letzter Tender-Status je Lead für die Übersichtstabelle. */
export async function fetchTenderStatuses(leadIds: string[]): Promise<Record<string, string>> {
  if (leadIds.length === 0) return {};
  await requireSession();
  const { data, error } = await supabase
    .from("lead_auctions")
    .select("lead_id, status, created_at")
    .in("lead_id", leadIds)
    .order("created_at", { ascending: true });
  if (error) fail(error);
  const map: Record<string, string> = {};
  for (const row of data ?? []) map[row.lead_id] = row.status;
  return map;
}

export async function fetchAdminTender(leadId: string): Promise<AdminTender | null> {
  await requireSession();
  const { data: tender, error } = await supabase
    .from("lead_auctions")
    .select("id, status, duration_hours, published_at, ends_at, decision_deadline_at, contact_price_cents, max_contact_purchases")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail(error);
  if (!tender) return null;

  const [bids, contacts] = await Promise.all([
    supabase.from("lead_bids").select("price_eur, status").eq("auction_id", tender.id),
    supabase.from("lead_match_candidates").select("id", { count: "exact", head: true }).eq("auction_id", tender.id),
  ]);
  if (bids.error) fail(bids.error);
  if (contacts.error) fail(contacts.error);
  const active = (bids.data ?? []).filter((b) => b.status !== "withdrawn");
  return {
    ...tender,
    offer_count: active.length,
    lowest_offer_eur: active.length ? Math.min(...active.map((b) => Number(b.price_eur))) : null,
    contact_purchases: contacts.count ?? 0,
  };
}

export async function fetchLeadFiles(leadId: string): Promise<AdminLeadFile[]> {
  await requireSession();
  const { data, error } = await supabase
    .from("lead_files")
    .select("id, file_url, file_name, file_type, category")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true });
  if (error) fail(error);
  const files = data ?? [];
  if (files.length === 0) return [];
  const { data: signed } = await supabase.storage.from("lead-files").createSignedUrls(
    files.map((f) => f.file_url),
    60 * 60,
  );
  const urls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return files.map((f) => ({
    id: f.id,
    file_name: f.file_name,
    category: f.category,
    file_type: f.file_type,
    url: urls.get(f.file_url) ?? null,
  }));
}

export async function openTenderAsAdmin(leadId: string, notifyCustomer: boolean): Promise<string> {
  await requireSession();
  const { data, error } = await supabase.rpc("kw_admin_open_tender", { p_lead_id: leadId, p_notify_customer: notifyCustomer });
  if (error) fail(error);
  return data as string;
}

export async function publishTenderAsAdmin(auctionId: string): Promise<void> {
  await requireSession();
  const { error } = await supabase.rpc("kw_admin_publish_tender", { p_auction_id: auctionId });
  if (error) fail(error);
}
