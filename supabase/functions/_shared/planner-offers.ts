/**
 * Funnel C: Ausschreibung zu einer Planung eröffnen. Gemeinsam für kw-planner
 * (Abschluss mit „Ja, Angebote“, späteres Nachfordern im Ergebnis und die
 * Admin-Aktion admin-open-tender) und kw-project (Nachfordern auf der
 * Projektseite).
 *
 * Studios sehen eine Planung nur mit der Einwilligung share_with_studios; wer
 * nur die Visualisierung wollte, hat einen Lead ohne Ausschreibung.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { HttpError } from "./kw-http.ts";
import { sanitizeConfig, sanitizeRoom, type PlannerConfig, type RoomInput } from "./kitchen-catalog.ts";
import { estimateKitchenPrice, type KitchenEstimate } from "./kitchen-pricing.ts";
import { sanitizeProvenance, type PlannerProvenance } from "./planner-provenance.ts";
import { buildPlannerSummary, storedLeadFrame, type PlannerLeadFrame } from "./planner-summary.ts";
import { loadRateCard } from "./rate-card.ts";

/** Einwilligungstext „Ja, Angebote“ (Funnel C, ab 30.09.2026; b nennt Visualisierungen und Raumfotos). */
export const OFFERS_CONSENT_TEXT_VERSION = "kw-projekt-2026-09-30b";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const OPEN_TENDER_STATUSES = ["draft", "active", "completed"];

export interface ConsentMeta {
  userId: string | null;
  ip: string | null;
  userAgent: string | null;
}

/** Titelbild für Studios: die gewählte Visualisierung, sonst die zuletzt fertige. */
export async function plannerCover(
  sb: SupabaseClient,
  session: { id: string; current_render_id: string | null },
  requested: unknown,
): Promise<{ id: string; bucket: string; path: string } | null> {
  const ids = [typeof requested === "string" && UUID_RE.test(requested) ? requested : null, session.current_render_id].filter(
    (id): id is string => !!id,
  );
  for (const id of ids) {
    const { data: r } = await sb
      .from("planner_renders")
      .select("id, image_path, storage_bucket, status")
      .eq("id", id)
      .eq("session_id", session.id)
      .maybeSingle();
    if (r?.status === "success" && r.image_path) return { id: r.id as string, bucket: r.storage_bucket as string, path: r.image_path as string };
  }
  return null;
}

/**
 * Legt die Ausschreibung an (veröffentlicht, wenn Einstellung und Bot-Prüfung
 * es erlauben) und liefert ihren Status. kw_open_tender gibt eine offene
 * Ausschreibung zurück, statt eine zweite anzulegen.
 */
export async function openPlannerTender(
  sb: SupabaseClient,
  input: {
    leadId: string;
    sessionId: string;
    config: PlannerConfig;
    room: RoomInput;
    estimate: KitchenEstimate;
    frame: PlannerLeadFrame;
    photoCount: number;
    cover: { bucket: string; path: string } | null;
    provenance: PlannerProvenance | null;
    botUnverified: boolean;
    /** false legt immer einen Entwurf an (Admin); ohne Angabe entscheiden Einstellung und Bot-Prüfung. */
    publish?: boolean;
  },
): Promise<"active" | "draft"> {
  let publish = input.publish;
  if (publish === undefined) {
    const { data: settings } = await sb.from("kw_marketplace_settings").select("auto_publish_funnel_c").maybeSingle();
    publish = settings?.auto_publish_funnel_c !== false && !input.botUnverified;
  }
  const summary = buildPlannerSummary(input.config, input.room, input.estimate, {
    ...input.frame,
    photoCount: input.photoCount,
    cover: input.cover,
    provenance: input.provenance,
  });
  const { error } = await sb.rpc("kw_open_tender", {
    p_lead_id: input.leadId,
    p_publish: publish,
    p_public_summary: summary,
    p_estimate_min_eur: input.estimate.min,
    p_estimate_max_eur: input.estimate.max,
    p_reference_price_eur: input.estimate.mid,
    p_planner_session_id: input.sessionId,
  });
  if (error) throw error;
  return publish ? "active" : "draft";
}

export async function hasOpenTender(sb: SupabaseClient, leadId: string): Promise<boolean> {
  const { data, error } = await sb
    .from("lead_auctions")
    .select("id")
    .eq("lead_id", leadId)
    .in("status", OPEN_TENDER_STATUSES)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/**
 * Nachträglich Angebote anfordern (Lead ohne Ausschreibung, Funnel C):
 * Einwilligung protokollieren, Ausschreibung eröffnen, Kunde und Team per
 * Outbox (project_created) informieren. Idempotent: Mit offener Ausschreibung
 * passiert nichts.
 */
export async function requestPlannerOffers(
  sb: SupabaseClient,
  input: {
    leadId: string;
    timeframeMonths: number | null;
    contactByPhone: boolean;
    meta: ConsentMeta;
  },
): Promise<{ tenderStatus: string; alreadyOpen: boolean }> {
  const { data: lead, error: leadErr } = await sb
    .from("leads")
    .select("id, funnel_type, postal_code, housing_type, purchase_reason, timeframe_months, bot_check, consent_call, funnel_answers, user_id")
    .eq("id", input.leadId)
    .maybeSingle();
  if (leadErr) throw leadErr;
  if (!lead) throw new HttpError(404, "Projekt nicht gefunden.", "not_found");
  if (lead.funnel_type !== "traumkueche") {
    throw new HttpError(409, "Für dieses Projekt holen wir die Angebote bereits ein.", "not_planner_lead");
  }
  if (await hasOpenTender(sb, lead.id)) {
    const { data: t } = await sb.from("lead_auctions").select("status").eq("lead_id", lead.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    return { tenderStatus: (t?.status as string | undefined) ?? "draft", alreadyOpen: true };
  }

  const { data: session, error: sessionErr } = await sb
    .from("planner_sessions")
    .select("id, spec, room, provenance, photo_paths, current_render_id")
    .eq("lead_id", lead.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sessionErr) throw sessionErr;
  if (!session) throw new HttpError(409, "Zu diesem Projekt gibt es keine Planung.", "no_planning");

  const config = sanitizeConfig(session.spec);
  const room = sanitizeRoom(session.room);
  const { card, version: rateCardVersion, calibration } = await loadRateCard(sb);
  const estimate = estimateKitchenPrice(config, room, { card, postalCode: lead.postal_code, rateCardVersion, calibration });
  const timeframe = input.timeframeMonths ?? (lead.timeframe_months as number | null);

  const consents = [
    { purpose: "share_with_studios", granted: true },
    ...(input.contactByPhone && !lead.consent_call ? [{ purpose: "contact_by_phone", granted: true }] : []),
  ];
  const { error: consentErr } = await sb.from("lead_consents").insert(
    consents.map((c) => ({
      lead_id: lead.id,
      user_id: lead.user_id ?? input.meta.userId,
      purpose: c.purpose,
      granted: c.granted,
      text_version: OFFERS_CONSENT_TEXT_VERSION,
      ip_address: input.meta.ip,
      user_agent: input.meta.userAgent,
    })),
  );
  if (consentErr) throw consentErr;

  const answers = (lead.funnel_answers && typeof lead.funnel_answers === "object" ? lead.funnel_answers : {}) as Record<string, unknown>;
  const { error: updateErr } = await sb
    .from("leads")
    .update({
      funnel_answers: { ...answers, offers_requested: true, offers_requested_at: new Date().toISOString() },
      ...(timeframe !== lead.timeframe_months ? { timeframe_months: timeframe } : {}),
      ...(input.contactByPhone ? { consent_call: true } : {}),
    })
    .eq("id", lead.id);
  if (updateErr) throw updateErr;

  const cover = await plannerCover(sb, session, null);
  const tenderStatus = await openPlannerTender(sb, {
    leadId: lead.id,
    sessionId: session.id,
    config,
    room,
    estimate,
    frame: storedLeadFrame(answers, {
      timeframeMonths: timeframe,
      purchaseReason: (lead.purchase_reason as string | null) ?? null,
      housingType: (lead.housing_type as string | null) ?? "unknown",
    }),
    photoCount: (session.photo_paths ?? []).length,
    cover: cover ? { bucket: cover.bucket, path: cover.path } : null,
    provenance: sanitizeProvenance(session.provenance, room),
    botUnverified: lead.bot_check === "unverified",
  });
  const { error: enqueueErr } = await sb.rpc("kw_enqueue", { p_event_type: "project_created", p_payload: { lead_id: lead.id, funnel: "c" } });
  if (enqueueErr) console.error("[planner-offers] project_created enqueue failed", enqueueErr.message);
  return { tenderStatus, alreadyOpen: false };
}

/**
 * Admin: Ausschreibung zu einer Planung als Entwurf anlegen, etwa wenn das
 * automatische Anlegen beim Abschluss scheiterte. Protokolliert keine
 * Einwilligung; ohne Weitergabe-Einwilligung verweigert kw_open_tender.
 */
export async function openPlannerTenderAsAdmin(
  sb: SupabaseClient,
  input: { leadId: string; notifyCustomer: boolean },
): Promise<{ tenderStatus: string; alreadyOpen: boolean }> {
  const { data: lead, error: leadErr } = await sb
    .from("leads")
    .select("id, funnel_type, postal_code, housing_type, purchase_reason, timeframe_months, bot_check, funnel_answers")
    .eq("id", input.leadId)
    .maybeSingle();
  if (leadErr) throw leadErr;
  if (!lead) throw new HttpError(404, "Lead nicht gefunden.", "not_found");
  if (lead.funnel_type !== "traumkueche") {
    throw new HttpError(409, "Nur für Planungen aus dem Traumküchen-Planer.", "not_planner_lead");
  }
  if (await hasOpenTender(sb, lead.id)) {
    const { data: t } = await sb.from("lead_auctions").select("status").eq("lead_id", lead.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    return { tenderStatus: (t?.status as string | undefined) ?? "draft", alreadyOpen: true };
  }

  const { data: session, error: sessionErr } = await sb
    .from("planner_sessions")
    .select("id, spec, room, provenance, photo_paths, current_render_id")
    .eq("lead_id", lead.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sessionErr) throw sessionErr;
  if (!session) throw new HttpError(409, "Zu diesem Lead gibt es keine Planung.", "no_planning");

  const config = sanitizeConfig(session.spec);
  const room = sanitizeRoom(session.room);
  const { card, version: rateCardVersion, calibration } = await loadRateCard(sb);
  const estimate = estimateKitchenPrice(config, room, { card, postalCode: lead.postal_code, rateCardVersion, calibration });
  const cover = await plannerCover(sb, session, null);
  const answers = (lead.funnel_answers && typeof lead.funnel_answers === "object" ? lead.funnel_answers : {}) as Record<string, unknown>;
  const tenderStatus = await openPlannerTender(sb, {
    leadId: lead.id,
    sessionId: session.id,
    config,
    room,
    estimate,
    frame: storedLeadFrame(answers, {
      timeframeMonths: (lead.timeframe_months as number | null) ?? null,
      purchaseReason: (lead.purchase_reason as string | null) ?? null,
      housingType: (lead.housing_type as string | null) ?? "unknown",
    }),
    photoCount: (session.photo_paths ?? []).length,
    cover: cover ? { bucket: cover.bucket, path: cover.path } : null,
    provenance: sanitizeProvenance(session.provenance, room),
    botUnverified: lead.bot_check === "unverified",
    publish: false,
  });
  if (input.notifyCustomer) {
    const { error: notifyErr } = await sb.rpc("kw_enqueue", { p_event_type: "project_created", p_payload: { lead_id: lead.id, funnel: "c" } });
    if (notifyErr) console.error("[planner-offers] project_created enqueue failed", notifyErr.message);
  }
  return { tenderStatus, alreadyOpen: false };
}
