/**
 * kw-project — Projektseite für Endkunden (Capability-Link /projekt/<token>)
 *
 * Aktionen (POST { action, token, ... }):
 *   get        Projekt, Ausschreibung, Angebote, Visualisierungen
 *   accept     Angebot eines Studios annehmen (bid_id)
 *   cancel     Projekt beenden (reason)
 *   add-phone  Telefonnummer nachtragen (phone, consent_call), nur solange keine hinterlegt ist
 *   resend     Projektlink(s) per E-Mail neu zusenden (email) – ohne Token
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

const SIGNED_URL_TTL = 60 * 60;
const CONSENT_TEXT_VERSION = "kw-anfrage-2026-09";

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
      if (item.bucket === "planner-renders") {
        return { ...item, url: sb.storage.from("planner-renders").getPublicUrl(item.path).data.publicUrl };
      }
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
  if (view.planner) {
    const { data: session } = await sb
      .from("planner_sessions")
      .select("photo_paths")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    photos = (await signMedia(sb, (session?.photo_paths ?? []).map((p: string) => ({ bucket: "planner-media", path: p })))).map(
      ({ path, url }) => ({ path: path as string, url }),
    );
    delete (view.planner as Record<string, unknown>).session_token;
  }
  return { ...view, renders, photos };
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
    default:
      throw new HttpError(400, "Unbekannte Aktion.", "unknown_action");
  }
});
