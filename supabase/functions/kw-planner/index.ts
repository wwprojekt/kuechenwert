/**
 * kw-planner — Traumküchen-Konfigurator (Funnel C, Version 2)
 *
 * Aktionen (POST { action, ... }):
 *   session       Stand einer Planung laden (Fotos, Renders, Konfiguration)
 *   save          Konfiguration + Maße speichern, Preis serverseitig schätzen
 *   upload-url    Signierte Upload-URL für ein Raumfoto (privater Bucket)
 *   attach-photo  Hochgeladenes Foto an die Session hängen
 *   remove-photo  Foto entfernen
 *   generate      Preis schätzen + KI-Visualisierung einreihen (fal Queue);
 *                 mit base_render_id + variant_hint eine Variante des Bildes
 *   status        Render-Status pollen, bei Fehler oder voller Warteschlange
 *                 einmal auf das Ausweichmodell wechseln, fertiges Bild speichern
 *   feedback      Bewertung einer Visualisierung (1 / -1 / null)
 *   submit        Kontakt erfassen → Lead + Ausschreibung + Projektlink
 *
 * Modelle, A/B-Vergleich und Tageslimit stehen in kw_ai_settings
 * (_shared/fal-models.ts). Auth: anonym über session_token (kw_ + 48 hex).
 * Rate-Limits pro IP (IPv6 je /64) und Session. Ohne gültiges Turnstile-Token
 * beim Abschluss wird die Ausschreibung nicht automatisch veröffentlicht.
 * Schreibzugriffe mit service_role.
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
  rateLimitIp,
  readJson,
  serve,
  serviceClient,
  sha256Hex,
  validIp,
} from "../_shared/kw-http.ts";
import { checkTurnstile, type BotCheck } from "../_shared/turnstile.ts";
import { insertLeadWithConsents, sanitizeClickIds } from "../_shared/lead-intake.ts";
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
import { describeRoom, estimateKitchenPrice, type KitchenEstimate } from "../_shared/kitchen-pricing.ts";
import { loadRateCard } from "../_shared/rate-card.ts";
import { buildRenderPrompt, buildVariantPrompt } from "../_shared/kitchen-prompt.ts";
import {
  abGroup,
  buildModelInput,
  chooseModel,
  falModel,
  fallbackFor,
  fallbackReason,
  resolveAiSettings,
  type AbGroup,
  type AiSettings,
  type AttemptState,
  type FalModel,
} from "../_shared/fal-models.ts";
import { falCancel, falResultImage, falStatus, falSubmit } from "../_shared/fal-queue.ts";
import { storeTrainingSamples } from "../_shared/ai-training.ts";
import { BRAND } from "../_shared/brand-config.ts";
import { detectImageFormat } from "../_shared/image-detect.ts";
import { stripImageMetadata } from "../_shared/image-meta.ts";

const BUCKET = "planner-media";
const MAX_PHOTOS = 3;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_RENDERS_PER_SESSION = 16;
/** So lange gilt eine laufende Visualisierung als „läuft noch“ und wird wiederverwendet. */
const PENDING_REUSE_MS = 3 * 60 * 1000;
const RENDER_TIMEOUT_MS = 5 * 60 * 1000;
/** Nach dem Wechsel aufs Ausweichmodell: so lange darf die neue fal-Anfrage noch fehlen. */
const FALLBACK_SUBMIT_GRACE_MS = 30 * 1000;
const SIGNED_URL_TTL = 60 * 60;
const CONSENT_TEXT_VERSION = "kw-projekt-2026-09-28b";
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const TIMEFRAMES = new Set([1, 3, 6, 12, 24]);
const HOUSING = new Set(["own", "rent", "unknown"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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
  ai_group: AbGroup | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
};

const SESSION_COLUMNS =
  "id, session_token, lead_id, status, spec, room, estimate, photo_paths, current_render_id, ai_group, utm_source, utm_medium, utm_campaign, utm_content, utm_term";

type PendingRender = {
  id: string;
  version: number;
  status: string;
  image_path: string | null;
  storage_bucket: string | null;
  fal_status_url: string | null;
  fal_response_url: string | null;
  created_at: string;
  attempt_started_at: string | null;
  mode: "edit" | "text";
  model_slug: string | null;
  fallback_from: string | null;
  prompt: string;
  input_image_path: string | null;
};

const RENDER_STATUS_COLUMNS =
  "id, version, status, image_path, storage_bucket, fal_status_url, fal_response_url, created_at, attempt_started_at, mode, model_slug, fallback_from, prompt, input_image_path";

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
  await enforceRateLimit(sb, `kw:session:${rateLimitIp(req)}`, 3600, 40);
  const u = (utm && typeof utm === "object" ? utm : {}) as Record<string, unknown>;
  const { data, error } = await sb
    .from("planner_sessions")
    .insert({
      session_token: newSessionToken(),
      spec: {},
      spec_version: PLANNER_SPEC_VERSION,
      ip_address: validIp(clientIp(req)),
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

async function signedUrl(sb: SupabaseClient, path: string, ttl = SIGNED_URL_TTL, bucket = BUCKET): Promise<string | null> {
  const { data } = await sb.storage.from(bucket).createSignedUrl(path, ttl);
  return data?.signedUrl ?? null;
}

async function loadAiSettings(sb: SupabaseClient): Promise<AiSettings> {
  const { data, error } = await sb.from("kw_ai_settings").select("*").eq("id", true).maybeSingle();
  if (error) console.error("[kw-planner] kw_ai_settings nicht lesbar, Standardmodelle", error.message);
  return resolveAiSettings(data);
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
    .select("id, version, status, mode, variant_label, image_path, storage_bucket, created_at, feedback, base_render_id, spec_snapshot")
    .eq("session_id", session.id)
    .order("version", { ascending: true });
  const signedRenders = await Promise.all(
    (renders ?? []).map(async (r) => {
      const spec = (r.spec_snapshot ?? {}) as Record<string, unknown>;
      return {
        id: r.id,
        version: r.version,
        status: r.status,
        mode: r.mode,
        variant_label: r.variant_label,
        created_at: r.created_at,
        feedback: r.feedback ?? null,
        base_render_id: r.base_render_id ?? null,
        // Ältere Renders speicherten das Foto nicht mit: ohne Schlüssel gelten sie nie als veraltet.
        spec: "photo_path" in spec ? { config: spec.config ?? null, room: spec.room ?? null, photo_path: spec.photo_path ?? null } : null,
        image_url:
          r.status === "success" && r.image_path
            ? await signedUrl(sb, r.image_path, SIGNED_URL_TTL, r.storage_bucket || BUCKET)
            : null,
      };
    }),
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
  await enforceRateLimit(sb, `kw:upload:${rateLimitIp(req)}`, 3600, 30, { failClosed: true });
  const path = `${session.id}/photos/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw error ?? new Error("upload url failed");
  return jsonResponse(req, { session_token: session.session_token, path, token: data.token });
}

/**
 * Raumfotos gehen an Studios und an fal.ai: EXIF/GPS und andere Metadaten
 * entfernen, bevor das Foto an der Session hängt. Dateien, die kein
 * JPG/PNG/WebP sind, werden gelöscht und abgelehnt.
 */
async function sanitizeUploadedPhoto(sb: SupabaseClient, path: string): Promise<void> {
  const { data: blob, error } = await sb.storage.from(BUCKET).download(path);
  if (error || !blob) throw error ?? new Error("photo download failed");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const format = detectImageFormat(bytes.subarray(0, 32)).format;
  if (format !== "jpeg" && format !== "png" && format !== "webp") {
    await sb.storage.from(BUCKET).remove([path]);
    throw new HttpError(415, "Bitte ein Foto im Format JPG, PNG oder WebP hochladen.", "unsupported_type");
  }
  const stripped = stripImageMetadata(bytes);
  if (!stripped?.changed) return;
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, stripped.data, {
    contentType: format === "png" ? "image/png" : "image/jpeg",
    cacheControl: "31536000, immutable",
    upsert: true,
  });
  if (upErr) throw upErr;
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
  await sanitizeUploadedPhoto(sb, path);
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

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 300);

async function markFailed(sb: SupabaseClient, renderId: string, message: string) {
  await sb
    .from("planner_renders")
    .update({ status: "failed", error_message: message.slice(0, 500), completed_at: new Date().toISOString() })
    .eq("id", renderId)
    .eq("status", "pending");
}

async function submitAttempt(
  sb: SupabaseClient,
  renderId: string,
  model: FalModel,
  input: { prompt: string; imageUrl: string | null; settings: AiSettings },
): Promise<void> {
  const submission = await falSubmit(
    model.id,
    buildModelInput(model, { prompt: input.prompt, imageUrl: input.imageUrl, lora: input.settings.lora }),
  );
  const { error } = await sb
    .from("planner_renders")
    .update({
      fal_request_id: submission.requestId,
      fal_status_url: submission.statusUrl,
      fal_response_url: submission.responseUrl,
    })
    .eq("id", renderId)
    .eq("model_slug", model.id);
  if (error) throw error;
}

/**
 * Wechselt einmal auf das Ausweichmodell. Der bedingte Update verhindert, dass
 * zwei gleichzeitige Status-Abfragen doppelt einreichen. false = kein
 * Ausweichmodell oder auch dieses ließ sich nicht starten.
 */
async function switchToFallback(
  sb: SupabaseClient,
  settings: AiSettings,
  render: { id: string; model: FalModel; prompt: string; imageUrl: string | null },
  reason: string,
): Promise<boolean> {
  const fallback = fallbackFor(settings, render.model);
  if (!fallback) return false;
  const { data: claimed, error } = await sb
    .from("planner_renders")
    .update({
      fallback_from: render.model.id,
      fallback_reason: reason.slice(0, 300),
      model_slug: fallback.id,
      cost_cents: fallback.costCents,
      fal_request_id: null,
      fal_status_url: null,
      fal_response_url: null,
      attempt_started_at: new Date().toISOString(),
    })
    .eq("id", render.id)
    .eq("status", "pending")
    .is("fallback_from", null)
    .select("id");
  if (error) throw error;
  if (!claimed?.length) return true;
  try {
    await submitAttempt(sb, render.id, fallback, { prompt: render.prompt, imageUrl: render.imageUrl, settings });
    return true;
  } catch (err) {
    console.error("[kw-planner] fallback submit failed", fallback.id, err);
    await markFailed(sb, render.id, `Ausweichmodell ${fallback.id}: ${errorText(err)}`);
    return false;
  }
}

/** Fertige Visualisierung dieser Planung als Ausgangsbild einer Variante. */
async function loadBaseRender(sb: SupabaseClient, sessionId: string, id: unknown) {
  if (typeof id !== "string" || !UUID_RE.test(id)) return null;
  const { data } = await sb
    .from("planner_renders")
    .select("id, image_path, storage_bucket, spec_snapshot")
    .eq("id", id)
    .eq("session_id", sessionId)
    .eq("status", "success")
    .maybeSingle();
  if (!data?.image_path || (data.storage_bucket && data.storage_bucket !== BUCKET)) return null;
  return data as { id: string; image_path: string; storage_bucket: string | null; spec_snapshot: Record<string, unknown> | null };
}

async function actionGenerate(req: Request, sb: SupabaseClient, body: Record<string, unknown>) {
  const session = await ensureSession(sb, req, body.session_token, body.utm);
  const ip = rateLimitIp(req);
  // Jedes Bild kostet Geld: fällt der Zähler aus, wird abgelehnt statt durchgelassen.
  if (session.lead_id) {
    await enforceRateLimit(sb, `kw:gen-after-submit:${session.id}`, 86400, 6, { failClosed: true });
  }
  await enforceRateLimit(sb, `kw:gen:${ip}`, 3600, 12, { failClosed: true });
  await enforceRateLimit(sb, `kw:gen-day:${ip}`, 86400, 30, { failClosed: true });

  const settings = await loadAiSettings(sb);
  if (settings.dailyRenderCap === 0) {
    throw new HttpError(
      503,
      "Die Visualisierung ist gerade pausiert. Ihre Planung und die Preisschätzung bleiben erhalten – Angebote können Sie trotzdem anfordern.",
      "render_paused",
    );
  }
  const { count: rendersToday, error: capErr } = await sb
    .from("planner_renders")
    .select("id", { count: "exact", head: true })
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if (capErr || (rendersToday ?? 0) >= settings.dailyRenderCap) {
    throw new HttpError(
      429,
      "Die Visualisierung ist heute stark gefragt. Bitte versuchen Sie es später noch einmal – Ihre Planung und die Preisschätzung bleiben erhalten, Angebote können Sie trotzdem anfordern.",
      "daily_render_cap",
    );
  }

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

  // Doppelstart (Auto-Start plus Klick, zwei Tabs): die laufende Visualisierung weiterverwenden.
  const { data: running } = await sb
    .from("planner_renders")
    .select("id, version, mode")
    .eq("session_id", session.id)
    .eq("status", "pending")
    .gte("created_at", new Date(Date.now() - PENDING_REUSE_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (running) {
    return jsonResponse(req, {
      session_token: session.session_token,
      render_id: running.id,
      version: running.version,
      mode: running.mode,
      estimate,
    });
  }

  // Variante: das gewählte Bild gezielt ändern statt die Küche neu zu erfinden.
  const base = variantHint ? await loadBaseRender(sb, session.id, body.base_render_id) : null;
  let group = session.ai_group;
  let mode: "edit" | "text";
  let inputPath: string | null;
  let prompt: string;
  let specPhoto: string | null;
  if (base && variantHint) {
    mode = "edit";
    inputPath = base.image_path;
    prompt = buildVariantPrompt(variantHint);
    specPhoto = typeof base.spec_snapshot?.photo_path === "string" ? base.spec_snapshot.photo_path : null;
  } else {
    mode = photoPath ? "edit" : "text";
    inputPath = photoPath;
    prompt = buildRenderPrompt(config, room, { mode, variantHint }).prompt;
    specPhoto = photoPath;
    if (mode === "edit" && !group && settings.challengerEdit) {
      group = abGroup(session.id, settings.challengerShare);
      await sb.from("planner_sessions").update({ ai_group: group }).eq("id", session.id).is("ai_group", null);
    }
  }
  const model = chooseModel(settings, { mode, variant: !!base, group });

  const { data: last } = await sb
    .from("planner_renders")
    .select("version")
    .eq("session_id", session.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = ((last?.version as number | undefined) ?? 0) + 1;

  const inputUrl = inputPath ? await signedUrl(sb, inputPath, 900) : null;
  if (inputPath && !inputUrl) throw new HttpError(500, "Foto konnte nicht gelesen werden.", "photo_unreadable");

  const { data: render, error: insErr } = await sb
    .from("planner_renders")
    .insert({
      session_id: session.id,
      version,
      prompt,
      spec_snapshot: { config, room, photo_path: specPhoto, variant_hint: variantHint },
      user_message: variantHint,
      status: "pending",
      model_slug: model.id,
      cost_cents: model.costCents,
      mode,
      input_image_path: inputPath,
      storage_bucket: BUCKET,
      variant_label: variantLabel,
      base_render_id: base?.id ?? null,
      attempt_started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (insErr || !render) throw insErr ?? new Error("render insert failed");

  try {
    await submitAttempt(sb, render.id, model, { prompt, imageUrl: inputUrl, settings });
  } catch (err) {
    console.error("[kw-planner] fal submit failed", model.id, err);
    const switched = await switchToFallback(sb, settings, { id: render.id, model, prompt, imageUrl: inputUrl }, `submit: ${errorText(err)}`);
    if (!switched) {
      await markFailed(sb, render.id, `submit: ${errorText(err)}`);
      throw new HttpError(502, "Die Visualisierung konnte gerade nicht gestartet werden. Bitte gleich noch einmal versuchen.", "render_unavailable");
    }
  }

  return jsonResponse(req, {
    session_token: session.session_token,
    render_id: render.id,
    version,
    mode,
    base_render_id: base?.id ?? null,
    estimate,
  });
}

async function persistPlanning(
  sb: SupabaseClient,
  sessionId: string,
  config: PlannerConfig,
  room: RoomInput,
  postalCode: string | null,
): Promise<KitchenEstimate> {
  const { card, version: rateCardVersion, calibration } = await loadRateCard(sb);
  const estimate = estimateKitchenPrice(config, room, { card, postalCode, rateCardVersion, calibration });
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

/** Ergebnis von fal übernehmen und im privaten Bucket speichern. */
async function storeResult(sb: SupabaseClient, sessionId: string, render: PendingRender): Promise<string> {
  const result = await falResultImage(render.fal_response_url as string);
  const imageResp = await fetch(result.url);
  if (!imageResp.ok) throw new Error(`image download ${imageResp.status}`);
  const bytes = new Uint8Array(await imageResp.arrayBuffer());
  const contentType = imageResp.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const path = `${sessionId}/renders/v${render.version}-${render.id.slice(0, 8)}.${ext}`;
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    cacheControl: "31536000, immutable",
    upsert: true,
  });
  if (upErr) throw upErr;
  const attemptStarted = new Date(render.attempt_started_at ?? render.created_at).getTime();
  const { data: updated } = await sb
    .from("planner_renders")
    .update({
      status: "success",
      image_path: path,
      image_width: result.width ?? null,
      image_height: result.height ?? null,
      completed_at: new Date().toISOString(),
      generation_ms: Date.now() - attemptStarted,
    })
    .eq("id", render.id)
    .eq("status", "pending")
    .select("id");
  if (updated?.length) await sb.from("planner_sessions").update({ current_render_id: render.id }).eq("id", sessionId);
  return path;
}

async function actionStatus(req: Request, sb: SupabaseClient, body: Record<string, unknown>) {
  const session = await requireSession(sb, body.session_token);
  const { data, error } = await sb
    .from("planner_renders")
    .select(RENDER_STATUS_COLUMNS)
    .eq("id", String(body.render_id ?? ""))
    .eq("session_id", session.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "Visualisierung nicht gefunden.", "render_not_found");
  const render = data as PendingRender;

  const failed = (message: string) => jsonResponse(req, { status: "failed", render_id: render.id, error: message });
  const pending = (queue: string) => jsonResponse(req, { status: "pending", render_id: render.id, queue });
  const successResponse = async (path: string) =>
    jsonResponse(req, { status: "success", render_id: render.id, version: render.version, image_url: await signedUrl(sb, path) });

  if (render.status === "success" && render.image_path) return successResponse(render.image_path);
  if (render.status === "failed") {
    return failed("Die Visualisierung ist fehlgeschlagen. Bitte versuchen Sie es erneut – oft hilft ein anderes Foto.");
  }

  const now = Date.now();
  if (now - new Date(render.created_at).getTime() > RENDER_TIMEOUT_MS) {
    await markFailed(sb, render.id, "timeout");
    return failed("Die Visualisierung hat zu lange gedauert. Bitte erneut versuchen.");
  }
  const attemptStarted = new Date(render.attempt_started_at ?? render.created_at).getTime();
  if (!render.fal_status_url || !render.fal_response_url) {
    if (render.fallback_from && now - attemptStarted < FALLBACK_SUBMIT_GRACE_MS) return pending("FALLBACK");
    await markFailed(sb, render.id, "missing fal urls");
    return failed("Die Visualisierung konnte nicht gestartet werden.");
  }

  let state: AttemptState;
  let problem = "";
  try {
    state = await falStatus(render.fal_status_url);
  } catch (err) {
    state = "ERROR";
    problem = `status: ${errorText(err)}`;
  }

  if (state === "COMPLETED") {
    try {
      return successResponse(await storeResult(sb, session.id, render));
    } catch (err) {
      console.error("[kw-planner] result handling failed", render.model_slug, err);
      state = "ERROR";
      problem = `result: ${errorText(err)}`;
    }
  }

  const reason = fallbackReason(state, now - attemptStarted);
  const current = falModel(render.model_slug);
  if (reason && !render.fallback_from && current) {
    const settings = await loadAiSettings(sb);
    const imageUrl =
      fallbackFor(settings, current) && render.input_image_path ? await signedUrl(sb, render.input_image_path, 900) : null;
    if (fallbackFor(settings, current) && (render.mode === "text" || imageUrl)) {
      if (state === "IN_QUEUE") await falCancel(render.fal_status_url);
      const switched = await switchToFallback(
        sb,
        settings,
        { id: render.id, model: current, prompt: render.prompt, imageUrl },
        problem ? `${reason} (${problem})` : reason,
      );
      return switched ? pending("FALLBACK") : failed("Die Visualisierung ist fehlgeschlagen. Bitte erneut versuchen.");
    }
  }

  if (state === "ERROR") {
    await markFailed(sb, render.id, problem || "error");
    return failed("Die Visualisierung ist fehlgeschlagen. Bitte erneut versuchen.");
  }
  return pending(state);
}

async function actionFeedback(req: Request, sb: SupabaseClient, body: Record<string, unknown>) {
  const session = await requireSession(sb, body.session_token);
  await enforceRateLimit(sb, `kw:feedback:${session.id}`, 3600, 60);
  const renderId = String(body.render_id ?? "");
  if (!UUID_RE.test(renderId)) throw new HttpError(400, "Ungültige Visualisierung.", "invalid_render");
  const value = body.value === 1 || body.value === -1 ? body.value : null;
  const { data, error } = await sb
    .from("planner_renders")
    .update({ feedback: value, feedback_at: value === null ? null : new Date().toISOString() })
    .eq("id", renderId)
    .eq("session_id", session.id)
    .eq("status", "success")
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new HttpError(404, "Visualisierung nicht gefunden.", "render_not_found");
  return jsonResponse(req, { ok: true, feedback: value });
}

async function userIdFromAuthHeader(sb: SupabaseClient, req: Request): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const jwt = header.slice(7);
  if (jwt.split(".").length !== 3) return null;
  const { data } = await sb.auth.getUser(jwt);
  return data?.user?.id ?? null;
}

/** Titelbild für Studios: die gewählte Visualisierung, sonst die zuletzt fertige. */
async function coverRender(sb: SupabaseClient, session: Session, requested: unknown) {
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

async function actionSubmit(req: Request, sb: SupabaseClient, body: Record<string, unknown>) {
  if (typeof body.website === "string" && body.website.trim().length > 0) {
    return jsonResponse(req, { ok: true, project_url: `${BRAND.baseUrl}/` });
  }
  const ip = clientIp(req);
  await enforceRateLimit(sb, `kw:submit:${rateLimitIp(req)}`, 3600, 6);

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
  const photoPaths = session.photo_paths ?? [];
  // Die Frage nach der KI-Verbesserung erscheint nur mit Raumfoto.
  const aiTraining = photoPaths.length > 0 && consents.ai_training === true;

  const config = sanitizeConfig(session.spec);
  const room = sanitizeRoom(session.room);
  const { card, version: rateCardVersion, calibration } = await loadRateCard(sb);
  const estimate = estimateKitchenPrice(config, room, { card, postalCode, rateCardVersion, calibration });

  let leadId = session.lead_id;
  let tenderStatus: string | null = null;
  let alreadySubmitted = !!leadId;
  let botCheck: BotCheck | null = null;

  if (!leadId) {
    botCheck = await checkTurnstile(body.turnstile_token, ip);
    const { data: tierRow } = await sb.rpc("kw_lead_tier_score", {
      p_has_photo: photoPaths.length > 0,
      p_has_dimensions: true,
      p_has_phone: true,
      p_timeframe_months: timeframe,
      p_value_eur: estimate.mid,
    });
    const tier = (Array.isArray(tierRow) ? tierRow[0] : tierRow) ?? { tier: "standard", score: 0 };
    const userId = await userIdFromAuthHeader(sb, req);
    const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

    // Eine Planung ergibt genau einen Lead: session.id dient als submission_id,
    // parallele Absendeversuche landen beim selben Lead.
    const inserted = await insertLeadWithConsents(
      sb,
      {
        submission_id: session.id,
        ...sanitizeClickIds(body.click_ids),
        user_id: userId,
        funnel_type: "traumkueche",
        funnel_variant: "C2",
        status: "new",
        bot_check: botCheck,
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
      },
      [
        { purpose: "share_with_studios", granted: true },
        { purpose: "contact_by_phone", granted: consents.contact_by_phone === true },
        { purpose: "marketing", granted: consents.marketing === true },
        ...(photoPaths.length > 0 ? [{ purpose: "ai_training", granted: aiTraining }] : []),
      ],
      { textVersion: CONSENT_TEXT_VERSION, userId, ip: validIp(ip), userAgent },
    );
    leadId = inserted.leadId;
    alreadySubmitted = inserted.duplicate;
  }

  if (!alreadySubmitted) {
    const cover = await coverRender(sb, session, body.active_render_id);
    const { data: settings } = await sb.from("kw_marketplace_settings").select("auto_publish_funnel_c").maybeSingle();
    const publish = settings?.auto_publish_funnel_c !== false && botCheck !== "unverified";
    const summary = buildPublicSummary(config, room, estimate, {
      timeframeMonths: timeframe,
      housingType,
      photoCount: photoPaths.length,
      cover: cover ? { bucket: cover.bucket, path: cover.path } : null,
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

    const now = new Date().toISOString();
    await sb
      .from("planner_sessions")
      .update({
        lead_id: leadId,
        status: "completed",
        contact_captured_at: now,
        estimate,
        ai_training_consent: aiTraining,
        ai_training_consent_at: aiTraining ? now : null,
        ...(cover ? { current_render_id: cover.id } : {}),
      })
      .eq("id", session.id);
    await sb.rpc("kw_enqueue", { p_event_type: "project_created", p_payload: { lead_id: leadId, funnel: "c" } });

    if (aiTraining && leadId) {
      await storeTrainingSamples(sb, {
        sessionId: session.id,
        leadId,
        photoPaths,
        config,
        room,
        consentTextVersion: CONSENT_TEXT_VERSION,
      }).catch((err) => console.error("[kw-planner] training samples failed", err));
    }
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
    already_submitted: alreadySubmitted,
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
    case "feedback":
      return actionFeedback(req, sb, body);
    case "submit":
      return actionSubmit(req, sb, body);
    default:
      throw new HttpError(400, "Unbekannte Aktion.", "unknown_action");
  }
});
