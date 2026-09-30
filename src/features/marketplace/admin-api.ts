import { leadFileExtension, leadFileType } from "@/features/funnel-b/files";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { ensureValidRLSSession, invokeWithAuth } from "@/lib/sessionGuard";
import { ApiError } from "./api-client";
import type { ComplaintReason } from "./dealer-api";
import { sanitizeExpertBriefing, type CustomerDetails, type ExpertBriefing } from "./lead-details";

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
  /** Was Studios sehen (ohne Kontaktdaten, Freitext gefiltert); Aufbau wie ProjectSummary in dealer-api. */
  public_summary: Record<string, unknown> | null;
  offer_count: number;
  lowest_offer_eur: number | null;
  contact_purchases: number;
}

export interface LeadConsent {
  id: string;
  purpose: string;
  granted: boolean;
  text_version: string;
  created_at: string;
}

/** Jüngste Entscheidung je Zweck; undefined, wenn nie gefragt. */
export function latestConsent(consents: LeadConsent[] | undefined, purpose: string): boolean | undefined {
  let latest: LeadConsent | undefined;
  for (const c of consents ?? []) {
    if (c.purpose === purpose && (!latest || c.created_at >= latest.created_at)) latest = c;
  }
  return latest?.granted;
}

export interface AdminLeadFile {
  id: string;
  file_name: string;
  category: string | null;
  file_type: string | null;
  url: string | null;
  /** Für Studios freigegeben (vom Team geprüft, keine Namen/Kontaktdaten sichtbar). */
  shared_with_studios: boolean;
}

async function requireSession() {
  if (!(await ensureValidRLSSession())) throw new ApiError("Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.", 401);
}

function fail(error: { message: string; code?: string }): never {
  const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 409;
  throw new ApiError(error.message, status, error.code);
}

export interface AdminLeadDetails {
  customer: CustomerDetails;
  customer_updated_at: string | null;
  expert: ExpertBriefing;
  expert_updated_at: string | null;
}

/** Ergänzungen zu einem Lead: Angaben des Kunden und Briefing aus dem Experten-Check. */
export async function fetchLeadDetails(leadId: string): Promise<AdminLeadDetails | null> {
  await requireSession();
  const { data, error } = await supabase
    .from("kw_lead_details")
    .select("customer, customer_updated_at, expert, expert_updated_at")
    .eq("lead_id", leadId)
    .maybeSingle();
  if (error) fail(error);
  return (data as unknown as AdminLeadDetails | null) ?? null;
}

/**
 * Briefing aus dem Experten-Check speichern (ersetzt das bisherige). Studios
 * sehen es ohne Kontaktdaten; Studios am Projekt werden benachrichtigt.
 */
export async function saveExpertBriefing(leadId: string, briefing: ExpertBriefing): Promise<ExpertBriefing> {
  await requireSession();
  const expert = sanitizeExpertBriefing(briefing);
  const { error } = await supabase
    .from("kw_lead_details")
    .upsert({ lead_id: leadId, expert: expert as unknown as Json }, { onConflict: "lead_id" });
  if (error) fail(error);
  return expert;
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

/** Jüngste Weitergabe-Einwilligung je Lead (fehlt, wenn nie protokolliert). */
export async function fetchShareConsents(leadIds: string[]): Promise<Record<string, boolean>> {
  if (leadIds.length === 0) return {};
  await requireSession();
  const { data, error } = await supabase
    .from("lead_consents")
    .select("lead_id, granted, created_at")
    .eq("purpose", "share_with_studios")
    .in("lead_id", leadIds)
    .order("created_at", { ascending: true });
  if (error) fail(error);
  const map: Record<string, boolean> = {};
  for (const row of data ?? []) if (row.lead_id) map[row.lead_id] = row.granted;
  return map;
}

export async function fetchLeadConsents(leadId: string): Promise<LeadConsent[]> {
  await requireSession();
  const { data, error } = await supabase
    .from("lead_consents")
    .select("id, purpose, granted, text_version, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true });
  if (error) fail(error);
  return data ?? [];
}

export interface AdminLeadPlanner {
  sessionId: string;
  photoCount: number;
  renderCount: number;
  /** Gewählte Visualisierung (sonst die neueste), signiert für 1 h. */
  renderUrl: string | null;
}

/** Planung eines Funnel-C-Leads mit Titelbild für den Admin-Dialog. */
export async function fetchLeadPlanner(leadId: string): Promise<AdminLeadPlanner | null> {
  await requireSession();
  const { data: session, error } = await supabase
    .from("planner_sessions")
    .select("id, current_render_id, photo_paths")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail(error);
  if (!session) return null;
  const { data: renders, error: renderErr } = await supabase
    .from("planner_renders")
    .select("id, image_path, storage_bucket")
    .eq("session_id", session.id)
    .eq("status", "success")
    .order("version", { ascending: false });
  if (renderErr) fail(renderErr);
  const list = (renders ?? []).filter((r) => r.image_path);
  const cover = list.find((r) => r.id === session.current_render_id) ?? list[0];
  let renderUrl: string | null = null;
  if (cover?.image_path) {
    const { data } = await supabase.storage.from(cover.storage_bucket || "planner-media").createSignedUrl(cover.image_path, 60 * 60);
    renderUrl = data?.signedUrl ?? null;
  }
  return { sessionId: session.id, photoCount: (session.photo_paths ?? []).length, renderCount: list.length, renderUrl };
}

export async function fetchAdminTender(leadId: string): Promise<AdminTender | null> {
  await requireSession();
  const { data: tender, error } = await supabase
    .from("lead_auctions")
    .select("id, status, duration_hours, published_at, ends_at, decision_deadline_at, contact_price_cents, max_contact_purchases, public_summary")
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
    public_summary: (tender.public_summary ?? null) as Record<string, unknown> | null,
    offer_count: active.length,
    lowest_offer_eur: active.length ? Math.min(...active.map((b) => Number(b.price_eur))) : null,
    contact_purchases: contacts.count ?? 0,
  };
}

export async function fetchLeadFiles(leadId: string): Promise<AdminLeadFile[]> {
  await requireSession();
  const { data, error } = await supabase
    .from("lead_files")
    .select("id, file_url, file_name, file_type, category, shared_with_studios")
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
    shared_with_studios: f.shared_with_studios,
  }));
}

/** Datei für Studios freigeben oder die Freigabe zurücknehmen. */
export async function setLeadFileShared(fileId: string, shared: boolean): Promise<void> {
  await requireSession();
  const { error } = await supabase.from("lead_files").update({ shared_with_studios: shared }).eq("id", fileId);
  if (error) fail(error);
}

/**
 * Geschwärzte Fassung einer Kundendatei hochladen (gleiche Kategorie). Sie
 * ist zunächst nicht freigegeben; das Team gibt sie nach Kontrolle frei.
 */
export async function uploadRedactedLeadFile(leadId: string, category: string, file: File): Promise<void> {
  await requireSession();
  const type = leadFileType(file);
  const extension = leadFileExtension(type);
  if (!extension) throw new ApiError("Bitte ein PDF oder Bild (JPG, PNG, WebP, HEIC) hochladen.", 422);
  const path = `${leadId}/${category}-${crypto.randomUUID()}.${extension}`;
  const { error: uploadErr } = await supabase.storage.from("lead-files").upload(path, file, {
    contentType: type,
    cacheControl: "31536000, immutable",
    upsert: false,
  });
  if (uploadErr) throw new ApiError(uploadErr.message, 409);
  const base = file.name.replace(/\.[^.]+$/, "");
  const { error } = await supabase.from("lead_files").insert({
    lead_id: leadId,
    file_url: path,
    file_name: `${base} (geschwärzt).${extension}`,
    file_type: type,
    file_size_bytes: file.size,
    category,
  });
  if (error) {
    await supabase.storage.from("lead-files").remove([path]);
    fail(error);
  }
}

/**
 * Ausschreibung als Entwurf anlegen. Planungen aus Funnel C schreibt kw-planner
 * aus der Planung aus (Konfiguration, Maße, Bilder), alle anderen die RPC.
 */
export async function openTenderAsAdmin(leadId: string, funnelType: string, notifyCustomer: boolean): Promise<void> {
  await requireSession();
  if (funnelType === "traumkueche") {
    const { error } = await invokeWithAuth("kw-planner", {
      body: { action: "admin-open-tender", lead_id: leadId, notify_customer: notifyCustomer },
    });
    if (error) throw new ApiError(error.message, (error as { httpStatus?: number }).httpStatus);
    return;
  }
  const { error } = await supabase.rpc("kw_admin_open_tender", { p_lead_id: leadId, p_notify_customer: notifyCustomer });
  if (error) fail(error);
}

export async function publishTenderAsAdmin(auctionId: string): Promise<void> {
  await requireSession();
  const { error } = await supabase.rpc("kw_admin_publish_tender", { p_auction_id: auctionId });
  if (error) fail(error);
}

export type TenderAction = "extend" | "end_now" | "cancel";

export async function runTenderAction(auctionId: string, action: TenderAction, opts: { hours?: number; reason?: string } = {}): Promise<void> {
  await requireSession();
  const { error } = await supabase.rpc("kw_admin_tender_action", {
    p_auction_id: auctionId,
    p_action: action,
    p_hours: opts.hours,
    p_reason: opts.reason,
  });
  if (error) fail(error);
}

export interface AdminComplaint {
  id: string;
  dealer_id: string;
  dealer_name: string;
  reason: ComplaintReason;
  note: string | null;
  status: "offen" | "anerkannt" | "abgelehnt";
  decision_note: string | null;
  created_at: string;
  decided_at: string | null;
  invoice_id: string | null;
  invoice_number: string | null;
  invoice_status: string | null;
  invoice_payment_status: string | null;
}

export async function fetchTenderComplaints(auctionId: string): Promise<AdminComplaint[]> {
  await requireSession();
  const { data, error } = await supabase.rpc("kw_admin_tender_complaints", { p_auction_id: auctionId });
  if (error) fail(error);
  return (data ?? []) as AdminComplaint[];
}

export interface ComplaintDecision {
  invoice_id: string | null;
  invoice_cancellable: boolean;
  invoice_paid: boolean;
}

export async function decideComplaint(complaintId: string, accept: boolean, note: string | null): Promise<ComplaintDecision> {
  await requireSession();
  const { data, error } = await supabase.rpc("kw_admin_decide_complaint", {
    p_complaint_id: complaintId,
    p_accept: accept,
    p_note: note ?? undefined,
  });
  if (error) fail(error);
  return data as unknown as ComplaintDecision;
}

/** Storniert die Rechnung einer anerkannten Reklamation (Storno-Mail nur bei bereits versendeter Rechnung). */
export async function cancelComplaintInvoice(invoiceId: string): Promise<void> {
  const { data, error } = await invokeWithAuth("cancel-invoice", {
    body: { invoiceId, reason: "Reklamation des Kontakts anerkannt", sendEmail: true },
  });
  const message = (data as { error?: string } | null)?.error;
  if (error || message) throw new ApiError(message ?? "Die Rechnung konnte nicht storniert werden.", 409);
}
