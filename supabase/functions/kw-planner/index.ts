/**
 * kw-planner — Traumküchen-Konfigurator (Funnel C, Version 2)
 *
 * Aktionen (POST { action, ... }):
 *   session       Stand einer Planung laden (Fotos, Renders, Konfiguration)
 *   save          Konfiguration + Maße speichern, Preis serverseitig schätzen
 *   upload-url    Signierte Upload-URL für ein Raumfoto (privater Bucket)
 *   attach-photo  Hochgeladenes Foto an die Session hängen
 *   remove-photo  Foto entfernen
 *   generate      Preis schätzen + KI-Visualisierung einreihen (fal Queue)
 *   status        Render-Status pollen, fertiges Bild speichern
 *   submit        Kontakt erfassen → Lead + Ausschreibung + Projektlink
 *
 * Auth: anonym über session_token (kw_ + 48 hex). Rate-Limits pro IP und
 * Session, Turnstile beim Abschluss. Alle Schreibzugriffe mit service_role.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import {
  HttpError,
  cleanText,
  clientIp,
  enforceRateLimit,
  isEmail,
  isPostalCode,
  jsonResponse,
  normalizePhone,
  randomToken,
  readJson,
  serve,
  serviceClient,
  sha256Hex,
} from "../_shared/kw-http.ts";
import { verifyTurnstileToken } from "../_shared/turnstile.ts";
import {
  APPLIANCES,
  APPLIANCE_LEVELS,
  EXTRAS,
  FRONT_COLORS,
  FRONT_MATERIALS,
  HANDLES,
  PLANNER_SPEC_VERSION,
  QUALITY_LEVELS,
  SERVICES,
  STYLES,
  WALL_CABINETS,
  WORKTOPS,
  WORKTOP_COLORS,
  effectiveAppliances,
  labelOf,
  sanitizeConfig,
  sanitizeRoom,
  type PlannerConfig,
  type RoomInput,
} from "../_shared/kitchen-catalog.ts";
import { describeRoom, estimateKitchenPrice, mergeRateCard, type KitchenEstimate } from "../_shared/kitchen-pricing.ts";
import { buildRenderPrompt } from "../_shared/kitchen-prompt.ts";
import { buildFalInput, falResultImage, falStatus, falSubmit } from "../_shared/fal-queue.ts";
import { BRAND } from "../_shared/brand-config.ts";

const BUCKET = "planner-media";
const MAX_PHOTOS = 3;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_RENDERS_PER_SESSION = 16;
const RENDER_TIMEOUT_MS = 5 * 60 * 1000;
const SIGNED_URL_TTL = 60 * 60;
const CONSENT_TEXT_VERSION = "kw-projekt-2026-09";
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const TIMEFRAMES = new Set([1, 3, 6, 12, 24]);
const HOUSING = new Set(["own", "rent", "unknown"]);

type Session = {
  id: string;
  session_token: string;
  lead_id: string | null;
  status: string;
  spec: Record<string, unknown>;
  room: Record<string, unknown>;
  estimate: KitchenEstimate | null;
  photo_paths: string[];
  current_render_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
};

const SESSION_COLUMNS =
  "id, session_token, lead_id, status, spec, room, estimate, photo_paths, current_render_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term";

function validIp(ip: string): string | null {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip;
  if (/^[0-9a-f:]+$/i.test(ip) && ip.includes(":")) return ip;
  return null;
}

function newSessionToken(): string {
  const buf = new Uint8Array(24);
  crypto.getRandomValues(buf);
  return "kw_" + Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function loadSession(sb: SupabaseClient, token: unknown): Promise<Session | null> {
  if (typeof token !== "string" || !/^kw_[0-9a-f]{48}$/.test(token)) return null;
  const { data, error } = await sb.from("planner_sessions").select(SESSION_COLUMNS).eq("session_token", token).maybeSingle();
  if (error) throw error;
  return (data as Session | null) ?? null;
}

async function requireSession(sb: SupabaseClient, token: unknown): Promise<Session> {
  const session = await loadSession(sb, token);
  if (!session) throw new HttpError(404, "Ihre Planung wurde nicht gefunden. Bitte starten Sie neu.", "session_not_found");
  return session;
}

async function ensureSession(
  sb: SupabaseClient,
  req: Request,
  token: unknown,
  utm: unknown,
): Promise<Session> {
  const existing = await loadSession(sb, token);
  if (existing) return existing;
  const ip = clientIp(req);
  await enforceRateLimit(sb, `kw:session:${ip}`, 3600, 40);
  const u = (utm && typeof utm === "object" ? utm : {}) as Record<string, unknown>;
  const { data, error } = await sb
    .from("planner_sessions")
    .insert({
      session_token: newSessionToken(),
      spec: {},
      spec_version: PLANNER_SPEC_VERSION,
      ip_address: validIp(ip),
      user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
      utm_source: cleanText(u.utm_source, 120),
      utm_medium: cleanText(u.utm_medium, 120),
      utm_campaign: cleanText(u.utm_campaign, 200),
      utm_content: cleanText(u.utm_content, 200),
      utm_term: cleanText(u.utm_term, 200),
    })
    .select(SESSION_COLUMNS)
    .single();
  if (error) throw error;
  return data as Session;
}

async function signedUrl(sb: SupabaseClient, path: string, ttl = SIGNED_URL_TTL): Promise<string | null> {
  const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, ttl);
  return data?.signedUrl ?? null;
}

async function loadRateCard(sb: SupabaseClient) {
  const { data } = await sb
    .from("kitchen_pricing_rate_cards")
    .select("version, overrides")
    .eq("is_active", true)
    .maybeSingle();
  return { card: mergeRateCard(data?.overrides ?? {}), version: (data?.version as number | undefined) ?? null };
}

function buildPublicSummary(
  config: PlannerConfig,
  room: RoomInput,
  estimate: KitchenEstimate,
  extra: {
    timeframeMonths: number | null;
    housingType: string;
    photoCount: number;
    cover: { bucket: string; path: string } | null;
  },
): Record<string, unknown> {
  return {
    source: "c",
    room: {
      form: room.form,
      walls: room.walls,
      ceiling_height_cm: room.ceilingHeightCm ?? null,
      description: describeRoom(room),
      notes: room.notes ?? null,
    },
    config,
    labels: {
      quality: labelOf(QUALITY_LEVELS, config.quality),
      style: labelOf(STYLES, config.style),
      front: `${labelOf(FRONT_MATERIALS, config.front)}, ${labelOf(FRONT_COLORS, config.frontColor)}`,
      handle: labelOf(HANDLES, config.handle),
      wall_cabinets: labelOf(WALL_CABINETS, config.wallCabinets),
      tall_units: config.tallUnits,
      worktop: `${labelOf(WORKTOPS, config.worktop)}, ${labelOf(WORKTOP_COLORS, config.worktopColor)}`,
      appliance_level: labelOf(APPLIANCE_LEVELS, config.applianceLevel),
      appliances: effectiveAppliances(config.appliances).map((id) => labelOf(APPLIANCES, id)),
      extras: config.extras.map((id) => labelOf(EXTRAS, id)),
      services: config.services.map((id) => labelOf(SERVICES, id)),
    },
    wishes: config.wishes ?? null,
    estimate: { min: estimate.min, max: estimate.max, mid: estimate.mid },
    layout: estimate.layout,
    timeframe_months: extra.timeframeMonths,
    housing_type: extra.housingType,
    photo_count: extra.photoCount,
    cover: extra.cover,
  };
}

// ---------------------------------------------------------------------------
// Aktionen
// ---------------------------------------------------------------------------

async function actionSession(req: Request, sb: SupabaseClient, body: Record<string, unknown>) {
  const session = await loadSession(sb, body.session_token);
  if (!session) return jsonResponse(req, { session: null });
  const { data: renders } = await sb
    .from("planner_renders")
    .select("id, version, status, mode, variant_label, image_path, storage_bucket, created_at")
    .eq("session_id", session.id)
    .order("version", { ascending: true });
  const signedRenders = await Promise.all(
    (renders ?? []).map(async (r) => ({
      id: r.id,
      version: r.version,
      status: r.status,
      mode: r.mode,
      variant_label: r.variant_label,
      created_at: r.created_at,
      image_url:
        r.status === "success" && r.image_path
          ? r.storage_bucket === BUCKET
            ? await signedUrl(sb, r.image_path)
            : sb.storage.from(r.storage_bucket).getPublicUrl(r.image_path).data.publicUrl
          : null,
    })),
  );
  const photos = await Promise.all((session.photo_paths ?? []).map(async (p) => ({ path: p, url: await signedUrl(sb, p) })));
  return jsonResponse(req, {
    session: {
      session_token: session.session_token,
      submitted: !!session.lead_id,
      config: session.spec,
      room: session.room,
      estimate: session.estimate,
      photos,
      renders: signedRenders,
    },
  });
}

async function actionUploadUrl(req: Request, sb: SupabaseClient, body: Record<string, unknown>) {
  const session = await ensureSession(sb, req, body.session_token, body.utm);
  if ((session.photo_paths ?? []).length >= MAX_PHOTOS) {
    throw new HttpError(409, `Maximal ${MAX_PHOTOS} Fotos pro Planung.`, "too_many_photos");
  }
  const contentType = String(body.content_type ?? "");
  const ext = ALLOWED_IMAGE_TYPES[contentType];
  if (!ext) throw new HttpError(415, "Bitte ein Foto im Format JPG, PNG oder WebP hochladen.", "unsupported_type");
  const size = Number(body.size ?? 0);
  if (!Number.isFinite(size) || size <= 0 || size > MAX_UPLOAD_BYTES) {
    throw new HttpError(413, "Das Foto ist zu groß (max. 15 MB).", "too_large");
  }
  await enforceRateLimit(sb, `kw:upload:${clientIp(req)}`, 3600, 30);
  const path = `${session.id}/photos/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw error ?? new Error("upload url failed");
  return jsonResponse(req, { session_token: session.session_token, path, token: data.token });
}

async function actionAttachPhoto(req: Request, sb: SupabaseClient, body: Record<string, unknown>) {
  const session = await requireSession(sb, body.session_token);
  const path = String(body.path ?? "");
  const prefix = `${session.id}/photos/`;
  if (!path.startsWith(prefix) || path.includes("..")) throw new HttpError(400, "Ungültiger Dateipfad.", "invalid_path");
  const fileName = path.slice(prefix.length);
  const { data: listed, error } = await sb.storage.from(BUCKET).list(`${session.id}/photos`, { search: fileName, limit: 1 });
  if (error) throw error;
  if (!listed?.some((f) => f.name === fileName)) throw new HttpError(404, "Upload nicht gefunden.", "upload_missing");
  const photos = Array.from(new Set([...(session.photo_paths ?? []), path])).slice(0, MAX_PHOTOS);
  const { error: upErr } = await sb.from("planner_sessions").update({ photo_paths: photos }).eq("id", session.id);
  if (upErr) throw upErr;
  const previews = await Promise.all(photos.map(async (p) => ({ path: p, url: await signedUrl(sb, p) })));
  return jsonResponse(req, { photos: previews });
}

async function actionRemovePhoto(req: Request, sb: SupabaseClient, body: Record<string, unknown>) {
  const session = await requireSession(sb, body.session_token);
  const path = String(body.path ?? "");
  if (!(session.photo_paths ?? []).includes(path)) throw new HttpError(404, "Foto nicht gefunden.", "photo_missing");
  const photos = session.photo_paths.filter((p) => p !== path);
  await sb.from("planner_sessions").update({ photo_paths: photos }).eq("id", session.id);
  await sb.storage.from(BUCKET).remove([path]);
  const previews = await Promise.all(photos.map(async (p) => ({ path: p, url: await signedUrl(sb, p) })));
  return jsonResponse(req, { photos: previews });
}

async function actionGenerate(req: Request, sb: SupabaseClient, body: Record<string, unknown>) {
  const session = await ensureSession(sb, req, body.session_token, body.utm);
  if (session.lead_id) {
    await enforceRateLimit(sb, `kw:gen-after-submit:${session.id}`, 86400, 6);
  }
  await enforceRateLimit(sb, `kw:gen:${clientIp(req)}`, 3600, 12);

  const { count } = await sb
    .from("planner_renders")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id);
  if ((count ?? 0) >= MAX_RENDERS_PER_SESSION) {
    throw new HttpError(429, "Sie haben das Maximum an Visualisierungen für diese Planung erreicht.", "render_limit");
  }

  const config = sanitizeConfig(body.config);
  const room = sanitizeRoom(body.room);
  const postalCode = isPostalCode(body.postal_code) ? body.postal_code : null;
  const photoPath = typeof body.photo_path === "string" && body.photo_path ? body.photo_path : null;
  if (photoPath && !(session.photo_paths ?? []).includes(photoPath)) {
    throw new HttpError(400, "Das gewählte Foto gehört nicht zu dieser Planung.", "invalid_photo");
  }
  const variantHint = cleanText(body.variant_hint, 300);
  const variantLabel = cleanText(body.variant_label, 80);

  const estimate = await persistPlanning(sb, session.id, config, room, postalCode);
  const mode = photoPath ? "edit" : "text";
  const { prompt } = buildRenderPrompt(config, room, { mode, variantHint });

  const { data: last } = await sb
    .from("planner_renders")
    .select("version")
    .eq("session_id", session.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = ((last?.version as number | undefined) ?? 0) + 1;

  const falInputImage = photoPath ? await signedUrl(sb, photoPath, 900) : null;
  if (photoPath && !falInputImage) throw new HttpError(500, "Foto konnte nicht gelesen werden.", "photo_unreadable");
  const { model, input } = buildFalInput(mode, prompt, falInputImage);

  const { data: render, error: insErr } = await sb
    .from("planner_renders")
    .insert({
      session_id: session.id,
      version,
      prompt,
      spec_snapshot: { config, room },
      user_message: variantHint,
      status: "pending",
      model_slug: model,
      mode,
      input_image_path: photoPath,
      storage_bucket: BUCKET,
      variant_label: variantLabel,
    })
    .select("id")
    .single();
  if (insErr || !render) throw insErr ?? new Error("render insert failed");

  try {
    const submission = await falSubmit(model, input);
    await sb
      .from("planner_renders")
      .update({
        fal_request_id: submission.requestId,
        fal_status_url: submission.statusUrl,
        fal_response_url: submission.responseUrl,
      })
      .eq("id", render.id);
  } catch (err) {
    console.error("[kw-planner] fal submit failed", err);
    await sb
      .from("planner_renders")
      .update({ status: "failed", error_message: String(err).slice(0, 500), completed_at: new Date().toISOString() })
      .eq("id", render.id);
    throw new HttpError(502, "Die Visualisierung konnte gerade nicht gestartet werden. Bitte gleich noch einmal versuchen.", "render_unavailable");
  }

  return jsonResponse(req, { session_token: session.session_token, render_id: render.id, version, mode, estimate });
}

async function persistPlanning(
  sb: SupabaseClient,
  sessionId: string,
  config: PlannerConfig,
  room: RoomInput,
  postalCode: string | null,
): Promise<KitchenEstimate> {
  const { card, version: rateCardVersion } = await loadRateCard(sb);
  const estimate = estimateKitchenPrice(config, room, { card, postalCode, rateCardVersion });
  const { error } = await sb
    .from("planner_sessions")
    .update({
      spec: config,
      spec_version: PLANNER_SPEC_VERSION,
      room,
      estimate,
      price_range_min_cents: estimate.min * 100,
      price_range_max_cents: estimate.max * 100,
    })
    .eq("id", sessionId);
  if (error) throw error;
  return estimate;
}

async function actionSave(req: Request, sb: SupabaseClient, body: Record<string, unknown>) {
  const session = await ensureSession(sb, req, body.session_token, body.utm);
  const estimate = await persistPlanning(
    sb,
    session.id,
    sanitizeConfig(body.config),
    sanitizeRoom(body.room),
    isPostalCode(body.postal_code) ? body.postal_code : null,
  );
  return jsonResponse(req, { session_token: session.session_token, estimate });
}

async function actionStatus(req: Request, sb: SupabaseClient, body: Record<string, unknown>) {
  const session = await requireSession(sb, body.session_token);
  const { data: render, error } = await sb
    .from("planner_renders")
    .select("id, version, status, image_path, storage_bucket, fal_status_url, fal_response_url, created_at, error_message, mode")
    .eq("id", String(body.render_id ?? ""))
    .eq("session_id", session.id)
    .maybeSingle();
  if (error) throw error;
  if (!render) throw new HttpError(404, "Visualisierung nicht gefunden.", "render_not_found");

  const failed = (message: string) => jsonResponse(req, { status: "failed", render_id: render.id, error: message });
  const successResponse = async (path: string) =>
    jsonResponse(req, { status: "success", render_id: render.id, version: render.version, image_url: await signedUrl(sb, path) });

  if (render.status === "success" && render.image_path) return successResponse(render.image_path);
  if (render.status === "failed") {
    return failed("Die Visualisierung ist fehlgeschlagen. Bitte versuchen Sie es erneut – oft hilft ein anderes Foto.");
  }

  const markFailed = async (message: string) => {
    await sb
      .from("planner_renders")
      .update({ status: "failed", error_message: message.slice(0, 500), completed_at: new Date().toISOString() })
      .eq("id", render.id)
      .eq("status", "pending");
  };

  if (!render.fal_status_url || !render.fal_response_url) {
    await markFailed("missing fal urls");
    return failed("Die Visualisierung konnte nicht gestartet werden.");
  }
  if (Date.now() - new Date(render.created_at).getTime() > RENDER_TIMEOUT_MS) {
    await markFailed("timeout");
    return failed("Die Visualisierung hat zu lange gedauert. Bitte erneut versuchen.");
  }

  const queueStatus = await falStatus(render.fal_status_url);
  if (queueStatus !== "COMPLETED") return jsonResponse(req, { status: "pending", render_id: render.id, queue: queueStatus });

  try {
    const result = await falResultImage(render.fal_response_url);
    const imageResp = await fetch(result.url);
    if (!imageResp.ok) throw new Error(`image download ${imageResp.status}`);
    const bytes = new Uint8Array(await imageResp.arrayBuffer());
    const contentType = imageResp.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const path = `${session.id}/renders/v${render.version}-${render.id.slice(0, 8)}.${ext}`;
    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, bytes, {
      contentType,
      cacheControl: "31536000, immutable",
      upsert: true,
    });
    if (upErr) throw upErr;
    await sb
      .from("planner_renders")
      .update({
        status: "success",
        image_path: path,
        image_width: result.width ?? null,
        image_height: result.height ?? null,
        completed_at: new Date().toISOString(),
        generation_ms: Date.now() - new Date(render.created_at).getTime(),
      })
      .eq("id", render.id);
    await sb.from("planner_sessions").update({ current_render_id: render.id }).eq("id", session.id);
    return successResponse(path);
  } catch (err) {
    console.error("[kw-planner] result handling failed", err);
    await markFailed(String(err));
    return failed("Die Visualisierung ist fehlgeschlagen. Bitte erneut versuchen.");
  }
}

async function userIdFromAuthHeader(sb: SupabaseClient, req: Request): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const jwt = header.slice(7);
  if (jwt.split(".").length !== 3) return null;
  const { data } = await sb.auth.getUser(jwt);
  return data?.user?.id ?? null;
}

async function actionSubmit(req: Request, sb: SupabaseClient, body: Record<string, unknown>) {
  if (typeof body.website === "string" && body.website.trim().length > 0) {
    return jsonResponse(req, { ok: true, project_url: `${BRAND.baseUrl}/` });
  }
  const ip = clientIp(req);
  const turnstile = await verifyTurnstileToken(body.turnstile_token as string | undefined, ip);
  if (!turnstile.valid) throw new HttpError(403, "Die Sicherheitsprüfung ist fehlgeschlagen. Bitte laden Sie die Seite neu.", "turnstile");
  await enforceRateLimit(sb, `kw:submit:${ip}`, 3600, 6);

  const session = await requireSession(sb, body.session_token);
  const c = (body.contact && typeof body.contact === "object" ? body.contact : {}) as Record<string, unknown>;
  const consents = (body.consents && typeof body.consents === "object" ? body.consents : {}) as Record<string, unknown>;

  const firstName = cleanText(c.first_name, 80);
  const lastName = cleanText(c.last_name, 80);
  const email = typeof c.email === "string" ? c.email.trim().toLowerCase() : "";
  const phone = normalizePhone(c.phone);
  const postalCode = typeof c.postal_code === "string" ? c.postal_code.trim() : "";
  const city = cleanText(c.city, 80);
  if (!firstName || !lastName) throw new HttpError(422, "Bitte Vor- und Nachnamen angeben.", "name");
  if (!isEmail(email)) throw new HttpError(422, "Bitte eine gültige E-Mail-Adresse angeben.", "email");
  if (!phone) throw new HttpError(422, "Bitte eine gültige Telefonnummer angeben.", "phone");
  if (!isPostalCode(postalCode)) throw new HttpError(422, "Bitte eine gültige Postleitzahl angeben.", "postal_code");
  if (consents.share_with_studios !== true) {
    throw new HttpError(422, "Bitte stimmen Sie der Weitergabe an geprüfte Küchenstudios zu.", "consent");
  }
  const timeframe = TIMEFRAMES.has(Number(body.timeframe_months)) ? Number(body.timeframe_months) : null;
  const housingType = HOUSING.has(String(body.housing_type)) ? String(body.housing_type) : "unknown";

  const config = sanitizeConfig(session.spec);
  const room = sanitizeRoom(session.room);
  const { card, version: rateCardVersion } = await loadRateCard(sb);
  const estimate = estimateKitchenPrice(config, room, { card, postalCode, rateCardVersion });

  let leadId = session.lead_id;
  let tenderStatus: string | null = null;

  if (!leadId) {
    const { data: tierRow } = await sb.rpc("kw_lead_tier_score", {
      p_has_photo: (session.photo_paths ?? []).length > 0,
      p_has_dimensions: true,
      p_has_phone: true,
      p_timeframe_months: timeframe,
      p_value_eur: estimate.mid,
    });
    const tier = (Array.isArray(tierRow) ? tierRow[0] : tierRow) ?? { tier: "standard", score: 0 };
    const userId = await userIdFromAuthHeader(sb, req);
    const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

    const { data: lead, error: leadErr } = await sb
      .from("leads")
      .insert({
        user_id: userId,
        funnel_type: "traumkueche",
        funnel_variant: "C2",
        status: "new",
        tier: tier.tier,
        score: tier.score,
        postal_code: postalCode,
        city,
        housing_type: housingType,
        kitchen_form: room.form,
        kitchen_style: config.style,
        timeframe_months: timeframe,
        budget_midpoint: estimate.mid,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        consent_call: consents.contact_by_phone === true,
        consent_marketing: consents.marketing === true,
        funnel_answers: {
          planner_session_id: session.id,
          config,
          room,
          estimate: { min: estimate.min, max: estimate.max, mid: estimate.mid },
        },
        utm_source: session.utm_source,
        utm_medium: session.utm_medium,
        utm_campaign: session.utm_campaign,
        utm_content: session.utm_content,
        utm_term: session.utm_term,
        landing_page: cleanText(body.landing_page, 300),
        ip_address: validIp(ip),
        user_agent: userAgent,
      })
      .select("id")
      .single();
    if (leadErr || !lead) throw leadErr ?? new Error("lead insert failed");
    leadId = lead.id as string;

    const consentRows = [
      { purpose: "share_with_studios", granted: true },
      { purpose: "contact_by_phone", granted: consents.contact_by_phone === true },
      { purpose: "marketing", granted: consents.marketing === true },
    ].map((r) => ({ ...r, lead_id: leadId, user_id: userId, text_version: CONSENT_TEXT_VERSION, ip_address: validIp(ip), user_agent: userAgent }));
    const { error: consentErr } = await sb.from("lead_consents").insert(consentRows);
    if (consentErr) console.error("[kw-planner] consent insert failed", consentErr.message);

    let cover: { bucket: string; path: string } | null = null;
    if (session.current_render_id) {
      const { data: r } = await sb
        .from("planner_renders")
        .select("image_path, storage_bucket, status")
        .eq("id", session.current_render_id)
        .maybeSingle();
      if (r?.status === "success" && r.image_path) cover = { bucket: r.storage_bucket, path: r.image_path };
    }

    const { data: settings } = await sb.from("kw_marketplace_settings").select("auto_publish_funnel_c").maybeSingle();
    const publish = settings?.auto_publish_funnel_c !== false;
    const summary = buildPublicSummary(config, room, estimate, {
      timeframeMonths: timeframe,
      housingType,
      photoCount: (session.photo_paths ?? []).length,
      cover,
    });
    const { error: tenderErr } = await sb.rpc("kw_open_tender", {
      p_lead_id: leadId,
      p_publish: publish,
      p_public_summary: summary,
      p_estimate_min_eur: estimate.min,
      p_estimate_max_eur: estimate.max,
      p_reference_price_eur: estimate.mid,
      p_planner_session_id: session.id,
    });
    if (tenderErr) console.error("[kw-planner] open tender failed", tenderErr.message);
    tenderStatus = publish ? "active" : "draft";

    await sb
      .from("planner_sessions")
      .update({ lead_id: leadId, status: "completed", contact_captured_at: new Date().toISOString(), estimate })
      .eq("id", session.id);
    await sb.rpc("kw_enqueue", { p_event_type: "project_created", p_payload: { lead_id: leadId, funnel: "c" } });
  }

  const token = randomToken();
  const { error: tokenErr } = await sb.rpc("kw_project_issue_token", {
    p_lead_id: leadId,
    p_token_hash: await sha256Hex(token),
  });
  if (tokenErr) throw tokenErr;

  return jsonResponse(req, {
    ok: true,
    lead_id: leadId,
    tender_status: tenderStatus,
    project_token: token,
    project_url: `${BRAND.baseUrl}/projekt/${token}`,
    estimate: { min: estimate.min, max: estimate.max, mid: estimate.mid },
  });
}

serve(async (req) => {
  const body = await readJson(req);
  const sb = serviceClient();
  switch (body.action) {
    case "session":
      return actionSession(req, sb, body);
    case "save":
      return actionSave(req, sb, body);
    case "upload-url":
      return actionUploadUrl(req, sb, body);
    case "attach-photo":
      return actionAttachPhoto(req, sb, body);
    case "remove-photo":
      return actionRemovePhoto(req, sb, body);
    case "generate":
      return actionGenerate(req, sb, body);
    case "status":
      return actionStatus(req, sb, body);
    case "submit":
      return actionSubmit(req, sb, body);
    default:
      throw new HttpError(400, "Unbekannte Aktion.", "unknown_action");
  }
});
