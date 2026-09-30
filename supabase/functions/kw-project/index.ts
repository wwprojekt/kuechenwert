/**
 * kw-project — Projektseite für Endkunden (Capability-Link /projekt/<token>)
 *
 * Aktionen (POST { action, token, ... }):
 *   get            Projekt, Ausschreibung, Angebote, Visualisierungen, Auftrag
 *   accept         Angebot eines Studios annehmen (bid_id)
 *   cancel         Projekt beenden (reason)
 *   add-phone      Telefonnummer nachtragen (phone, consent_call), nur solange keine hinterlegt ist
 *   order-confirm  Montage bestätigen (nach Kaufvertrag)
 *   order-problem  Problem zum Auftrag melden (message)
 *   export-data    Alle gespeicherten Daten als JSON (Art. 15/20 DSGVO)
 *   delete-data    Projekt beenden und personenbezogene Daten löschen (email zur Bestätigung)
 *   upload-files   Unterlagen nachreichen (alle Funnels): Dateien ankündigen → signierte Upload-URLs
 *   attach-files   Nach dem Upload eintragen (upload_token, files); meldet dem Team per Outbox
 *   save-details   Angaben vervollständigen (details: Raum, Technik, Beratung, Hinweis);
 *                  Studios am Projekt erfahren es über die Outbox (project_updated)
 *   ai-consent     Einwilligung zur KI-Verbesserung erteilen oder widerrufen (granted);
 *                  Widerruf löscht die Trainingskopien sofort
 *   request-offers Funnel C ohne Ausschreibung (nur Visualisierung): Angebote
 *                  nachträglich anfordern (consent_share, timeframe_months)
 *   resend         Projektlink(s) per E-Mail neu zusenden (email) – ohne Token
 *
 * Der Token wird nie gespeichert, nur sein SHA-256-Hash (lead_access_tokens).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import {
  HttpError,
  cleanText,
  clientIp,
  enforceRateLimit,
  isEmail,
  jsonResponse,
  normalizePhone,
  readJson,
  serve,
  serviceClient,
  sha256Hex,
  validIp,
} from "../_shared/kw-http.ts";
import { MAX_FILES_PER_LEAD, attachUploadedFiles, issueUploads, parseAnnouncedFiles } from "../_shared/lead-files.ts";
import { forgetTrainingSamples, storeTrainingSamples } from "../_shared/ai-training.ts";
import { PLANNER_TIMEFRAMES } from "../_shared/kitchen-catalog.ts";
import { sanitizeCustomerDetails } from "../_shared/lead-details.ts";
import { requestPlannerOffers } from "../_shared/planner-offers.ts";

const TIMEFRAMES = new Set(PLANNER_TIMEFRAMES.map((t) => t.months));

const SIGNED_URL_TTL = 60 * 60;
const CONSENT_TEXT_VERSION = "kw-telefon-2026-09-28";
const AI_CONSENT_TEXT_VERSION = "kw-ki-verbesserung-2026-09-28";
const CLOSED_TENDER_STATUSES = new Set(["awarded", "cancelled", "expired"]);

async function resolveLead(sb: SupabaseClient, req: Request, token: unknown): Promise<string> {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{32,64}$/.test(token)) {
    throw new HttpError(404, "Dieser Projektlink ist ungültig.", "invalid_token");
  }
  await enforceRateLimit(sb, `kw:project:${clientIp(req)}`, 300, 120);
  const { data, error } = await sb.rpc("kw_project_resolve_token", { p_token_hash: await sha256Hex(token) });
  if (error) throw error;
  if (!data) throw new HttpError(404, "Dieser Projektlink ist ungültig oder abgelaufen.", "invalid_token");
  return data as string;
}

type MediaRef = { bucket: string; path: string | null };

async function signMedia<T extends MediaRef>(sb: SupabaseClient, items: T[]): Promise<Array<T & { url: string | null }>> {
  return Promise.all(
    items.map(async (item) => {
      if (!item.path) return { ...item, url: null };
      const { data } = await sb.storage.from(item.bucket).createSignedUrl(item.path, SIGNED_URL_TTL);
      return { ...item, url: data?.signedUrl ?? null };
    }),
  );
}

async function projectView(sb: SupabaseClient, leadId: string) {
  const { data, error } = await sb.rpc("kw_project_view", { p_lead_id: leadId });
  if (error) throw error;
  if (!data) throw new HttpError(404, "Projekt nicht gefunden.", "not_found");
  const view = data as Record<string, unknown> & {
    renders: MediaRef[];
    planner: Record<string, unknown> | null;
  };
  const renders = await signMedia(sb, view.renders ?? []);

  let photos: Array<{ path: string; url: string | null }> = [];
  let aiTraining: { granted: boolean } | null = null;
  if (view.planner) {
    const { data: session } = await sb
      .from("planner_sessions")
      .select("photo_paths, ai_training_consent")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    photos = (await signMedia(sb, (session?.photo_paths ?? []).map((p: string) => ({ bucket: "planner-media", path: p })))).map(
      ({ path, url }) => ({ path: path as string, url }),
    );
    if (photos.length > 0) aiTraining = { granted: session?.ai_training_consent === true };
    delete (view.planner as Record<string, unknown>).session_token;
  }
  const { data: order, error: orderErr } = await sb.rpc("kw_project_order", { p_lead_id: leadId });
  if (orderErr) throw orderErr;
  const upload = await uploadState(sb, leadId);
  return {
    ...view,
    renders,
    photos,
    ai_training: aiTraining,
    order: order ?? null,
    files: upload.files,
    can_upload_files: upload.allowed,
  };
}

/** Einwilligung zur KI-Verbesserung ändern; ein Widerruf löscht die Kopien, bevor er protokolliert wird. */
async function actionAiConsent(req: Request, sb: SupabaseClient, leadId: string, body: Record<string, unknown>) {
  await enforceRateLimit(sb, `kw:ai-consent:${leadId}`, 3600, 20);
  const granted = body.granted === true;
  const { data: session, error } = await sb
    .from("planner_sessions")
    .select("id, photo_paths, spec, room")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!session || !(session.photo_paths ?? []).length) {
    throw new HttpError(409, "Zu diesem Projekt gibt es keine Raumfotos.", "no_photos");
  }
  if (!granted) await forgetTrainingSamples(sb, leadId);

  const now = new Date().toISOString();
  const { error: sessionErr } = await sb
    .from("planner_sessions")
    .update({ ai_training_consent: granted, ai_training_consent_at: granted ? now : null })
    .eq("id", session.id);
  if (sessionErr) throw sessionErr;
  const { data: lead } = await sb.from("leads").select("user_id").eq("id", leadId).maybeSingle();
  const { error: consentErr } = await sb.from("lead_consents").insert({
    lead_id: leadId,
    user_id: lead?.user_id ?? null,
    purpose: "ai_training",
    granted,
    text_version: AI_CONSENT_TEXT_VERSION,
    ip_address: validIp(clientIp(req)),
    user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
  });
  if (consentErr) throw consentErr;

  if (granted) {
    await storeTrainingSamples(sb, {
      sessionId: session.id,
      leadId,
      photoPaths: session.photo_paths,
      config: session.spec ?? {},
      room: session.room ?? {},
      consentTextVersion: AI_CONSENT_TEXT_VERSION,
    });
  }
  return jsonResponse(req, await projectView(sb, leadId));
}

/** Unterlagen des Leads und ob der Kunde noch welche nachreichen darf (alle Funnels, Projekt offen). */
async function uploadState(sb: SupabaseClient, leadId: string) {
  const [{ data: lead, error: leadErr }, { data: tender, error: tenderErr }, { data: files, error: filesErr }] = await Promise.all([
    sb.from("leads").select("anonymized_at").eq("id", leadId).maybeSingle(),
    sb.from("lead_auctions").select("status").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("lead_files").select("file_name, category, created_at").eq("lead_id", leadId).order("created_at", { ascending: true }),
  ]);
  if (leadErr) throw leadErr;
  if (tenderErr) throw tenderErr;
  if (filesErr) throw filesErr;
  const list = (files ?? []).map((f) => ({ name: f.file_name as string, category: f.category as string, created_at: f.created_at as string }));
  const allowed =
    !!lead && !lead.anonymized_at && !CLOSED_TENDER_STATUSES.has((tender?.status as string | undefined) ?? "") && list.length < MAX_FILES_PER_LEAD;
  return { files: list, allowed };
}

/** Angaben vervollständigen: ersetzt die Ergänzungen des Kunden (die des Teams bleiben). */
async function actionSaveDetails(req: Request, sb: SupabaseClient, leadId: string, body: Record<string, unknown>) {
  await enforceRateLimit(sb, `kw:project-details:${leadId}`, 3600, 30);
  const { data: lead, error } = await sb.from("leads").select("kitchen_form, anonymized_at").eq("id", leadId).maybeSingle();
  if (error) throw error;
  if (!lead || lead.anonymized_at) throw new HttpError(404, "Projekt nicht gefunden.", "not_found");
  const customer = sanitizeCustomerDetails(body.details, lead.kitchen_form as string | null);
  const { error: saveErr } = await sb.from("kw_lead_details").upsert({ lead_id: leadId, customer }, { onConflict: "lead_id" });
  if (saveErr) throw saveErr;
  return jsonResponse(req, await projectView(sb, leadId));
}

async function actionUploadFiles(req: Request, sb: SupabaseClient, leadId: string, body: Record<string, unknown>) {
  await enforceRateLimit(sb, `kw:project-files:${leadId}`, 3600, 20);
  const files = parseAnnouncedFiles(body.files);
  if (files.length === 0) throw new HttpError(422, "Bitte mindestens eine Datei auswählen.", "files");
  const state = await uploadState(sb, leadId);
  if (!state.allowed) {
    throw new HttpError(409, "Für dieses Projekt können keine Unterlagen mehr hochgeladen werden.", "files_not_allowed");
  }
  if (state.files.length + files.length > MAX_FILES_PER_LEAD) {
    throw new HttpError(422, `Pro Projekt sind höchstens ${MAX_FILES_PER_LEAD} Dateien möglich.`, "files");
  }
  return jsonResponse(req, await issueUploads(sb, leadId, files));
}

async function actionAttachFiles(req: Request, sb: SupabaseClient, leadId: string, body: Record<string, unknown>) {
  await enforceRateLimit(sb, `kw:project-attach:${clientIp(req)}`, 3600, 30);
  const { attached, missing } = await attachUploadedFiles(sb, body.upload_token, body.files, leadId);
  if (attached > 0) {
    const { error } = await sb.rpc("kw_enqueue", { p_event_type: "lead_files_added", p_payload: { lead_id: leadId, count: attached } });
    if (error) console.error("[kw-project] lead_files_added enqueue failed", error.message);
  }
  return jsonResponse(req, { ok: true, attached, missing });
}

async function actionResend(req: Request, sb: SupabaseClient, body: Record<string, unknown>) {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isEmail(email)) throw new HttpError(422, "Bitte eine gültige E-Mail-Adresse angeben.", "email");
  await enforceRateLimit(sb, `kw:resend:${clientIp(req)}`, 3600, 5);
  await enforceRateLimit(sb, `kw:resend-mail:${email}`, 3600, 3);
  const since = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
  const { data: leads } = await sb
    .from("leads")
    .select("id")
    .eq("email", email)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(3);
  for (const lead of leads ?? []) {
    await sb.rpc("kw_enqueue", { p_event_type: "project_link", p_payload: { lead_id: lead.id } });
  }
  return jsonResponse(req, { ok: true });
}

async function actionAddPhone(req: Request, sb: SupabaseClient, leadId: string, body: Record<string, unknown>) {
  const ip = clientIp(req);
  await enforceRateLimit(sb, `kw:phone:${ip}`, 3600, 10);
  const phone = normalizePhone(body.phone);
  if (!phone) throw new HttpError(422, "Bitte eine gültige Telefonnummer angeben.", "phone");

  const { data: lead, error } = await sb.from("leads").select("phone, user_id").eq("id", leadId).maybeSingle();
  if (error) throw error;
  if (!lead) throw new HttpError(404, "Projekt nicht gefunden.", "not_found");
  if (typeof lead.phone === "string" && lead.phone.trim()) return jsonResponse(req, { ok: true, already: true });

  const consentCall = body.consent_call === true;
  const { data: updated, error: updateErr } = await sb
    .from("leads")
    .update({ phone, consent_call: consentCall })
    .eq("id", leadId)
    .or('phone.is.null,phone.eq.""')
    .select("id");
  if (updateErr) throw updateErr;
  if (!updated?.length) return jsonResponse(req, { ok: true, already: true });

  const { error: consentErr } = await sb.from("lead_consents").insert({
    lead_id: leadId,
    user_id: lead.user_id ?? null,
    purpose: "contact_by_phone",
    granted: consentCall,
    text_version: CONSENT_TEXT_VERSION,
    ip_address: validIp(ip),
    user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
  });
  if (consentErr) console.error("[kw-project] consent insert failed", consentErr.message);
  return jsonResponse(req, { ok: true });
}

async function actionRequestOffers(req: Request, sb: SupabaseClient, leadId: string, body: Record<string, unknown>) {
  await enforceRateLimit(sb, `kw:project-offers:${leadId}`, 3600, 5);
  if (body.consent_share !== true) {
    throw new HttpError(422, "Bitte stimmen Sie der Weitergabe an geprüfte Küchenstudios zu.", "consent");
  }
  await requestPlannerOffers(sb, {
    leadId,
    timeframeMonths: TIMEFRAMES.has(Number(body.timeframe_months)) ? Number(body.timeframe_months) : null,
    contactByPhone: body.contact_by_phone === true,
    meta: { userId: null, ip: validIp(clientIp(req)), userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null },
  });
  return jsonResponse(req, await projectView(sb, leadId));
}

async function actionExportData(req: Request, sb: SupabaseClient, leadId: string) {
  await enforceRateLimit(sb, `kw:export:${leadId}`, 3600, 10);
  const { data, error } = await sb.rpc("kw_project_export", { p_lead_id: leadId });
  if (error) throw error;
  return jsonResponse(req, data);
}

async function actionDeleteData(req: Request, sb: SupabaseClient, leadId: string, body: Record<string, unknown>) {
  await enforceRateLimit(sb, `kw:erase:${clientIp(req)}`, 3600, 5);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const { data: lead, error } = await sb.from("leads").select("email").eq("id", leadId).maybeSingle();
  if (error) throw error;
  if (!lead) throw new HttpError(404, "Projekt nicht gefunden.", "not_found");
  if (!isEmail(email) || (lead.email ?? "").toLowerCase() !== email) {
    throw new HttpError(422, "Die E-Mail-Adresse stimmt nicht mit Ihrer Anfrage überein.", "email");
  }

  // Erst die Dateien, dann die Datenbank: schlägt das Löschen einer Datei fehl,
  // bleibt der Lead unverändert und der Kunde kann es erneut versuchen.
  await forgetTrainingSamples(sb, leadId);
  const { data: files, error: filesErr } = await sb.rpc("kw_lead_storage_paths", { p_lead_id: leadId });
  if (filesErr) throw filesErr;
  const byBucket = new Map<string, string[]>();
  for (const f of (files ?? []) as Array<{ bucket: string; path: string }>) {
    byBucket.set(f.bucket, [...(byBucket.get(f.bucket) ?? []), f.path]);
  }
  for (const [bucket, paths] of byBucket) {
    const { error: removeErr } = await sb.storage.from(bucket).remove(paths);
    if (removeErr) throw removeErr;
  }

  const { error: eraseErr } = await sb.rpc("kw_project_erase", { p_lead_id: leadId });
  if (eraseErr) throw eraseErr;
  return jsonResponse(req, { ok: true });
}

serve(async (req) => {
  const body = await readJson(req);
  const sb = serviceClient();

  if (body.action === "resend") return actionResend(req, sb, body);

  const leadId = await resolveLead(sb, req, body.token);
  switch (body.action) {
    case "get":
      return jsonResponse(req, await projectView(sb, leadId));
    case "accept": {
      const bidId = String(body.bid_id ?? "");
      if (!/^[0-9a-f-]{36}$/.test(bidId)) throw new HttpError(400, "Ungültiges Angebot.", "invalid_bid");
      const { error } = await sb.rpc("kw_project_accept_offer", { p_lead_id: leadId, p_bid_id: bidId });
      if (error) throw error;
      return jsonResponse(req, await projectView(sb, leadId));
    }
    case "cancel": {
      const { error } = await sb.rpc("kw_project_cancel", { p_lead_id: leadId, p_reason: cleanText(body.reason, 500) });
      if (error) throw error;
      return jsonResponse(req, await projectView(sb, leadId));
    }
    case "add-phone":
      return actionAddPhone(req, sb, leadId, body);
    case "order-confirm": {
      const { error } = await sb.rpc("kw_project_order_confirm", { p_lead_id: leadId });
      if (error) throw error;
      return jsonResponse(req, await projectView(sb, leadId));
    }
    case "order-problem": {
      await enforceRateLimit(sb, `kw:order-problem:${leadId}`, 3600, 3);
      const { error } = await sb.rpc("kw_project_order_report", { p_lead_id: leadId, p_message: cleanText(body.message, 1000) });
      if (error) throw error;
      return jsonResponse(req, await projectView(sb, leadId));
    }
    case "export-data":
      return actionExportData(req, sb, leadId);
    case "delete-data":
      return actionDeleteData(req, sb, leadId, body);
    case "upload-files":
      return actionUploadFiles(req, sb, leadId, body);
    case "attach-files":
      return actionAttachFiles(req, sb, leadId, body);
    case "save-details":
      return actionSaveDetails(req, sb, leadId, body);
    case "ai-consent":
      return actionAiConsent(req, sb, leadId, body);
    case "request-offers":
      return actionRequestOffers(req, sb, leadId, body);
    default:
      throw new HttpError(400, "Unbekannte Aktion.", "unknown_action");
  }
});
