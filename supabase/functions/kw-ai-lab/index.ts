/**
 * kw-ai-lab — Modell-Testlauf für /admin/ki: dasselbe Raumfoto mit mehreren
 * Bildmodellen und dem aktuellen Prompt, bevor Kund:innen ein neues Modell
 * oder einen neuen Prompt sehen.
 *
 * Aktionen (POST { action, ... }); nur Admin, Service-Role oder
 * Cron-Geheimnis (Agenten starten Vergleiche per SQL wie bei kw-google-ads):
 *   upload-url  signierte Upload-URL für ein Testfoto (planner-media/ai-lab/photos)
 *   run         Testlauf: Foto, bis zu 4 Bildbearbeitungsmodelle der Registry, Küchenform und
 *               Planung (config wie im Planer, fehlende Werte = Standard)
 *   status      offene Bilder eines Laufs weiterführen; alle Bilder mit signierten URLs
 *   list        letzte Läufe
 *
 * Nur eigene, lizenzfreie oder eingewilligte Fotos (kw_ai_training_samples).
 * Höchstens 4 Bilder je Lauf und 20 Läufe in 24 h; zählt nicht zum
 * Tageslimit der Kund:innen. Löschung nach 90 Tagen (_shared/ai-lab.ts).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { LAB_BUCKET, LAB_PHOTO_PREFIX, labResultPath } from "../_shared/ai-lab.ts";
import { checkCronOrServiceRoleOrAdmin } from "../_shared/auth.ts";
import { buildModelInput, falModel, type FalModel } from "../_shared/fal-models.ts";
import { falResultImage, falStatus, falSubmit } from "../_shared/fal-queue.ts";
import { detectImageFormat } from "../_shared/image-detect.ts";
import { stripImageMetadata } from "../_shared/image-meta.ts";
import { KITCHEN_FORMS, STYLES, sanitizeConfig, sanitizeRoom } from "../_shared/kitchen-catalog.ts";
import { PROMPT_VERSION, buildRenderPrompt } from "../_shared/kitchen-prompt.ts";
import { HttpError, enforceRateLimit, jsonResponse, readJson, serve, serviceClient } from "../_shared/kw-http.ts";

const MAX_MODELS = 4;
const RUNS_PER_DAY = 20;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const SIGNED_URL_TTL = 60 * 60;
const RENDER_TIMEOUT_MS = 5 * 60 * 1000;
const ALLOWED_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type LabRow = {
  id: string;
  run_id: string;
  model_slug: string;
  photo_path: string;
  status: "pending" | "success" | "failed";
  fal_status_url: string | null;
  fal_response_url: string | null;
  image_path: string | null;
  error_message: string | null;
  cost_cents: number | null;
  generation_ms: number | null;
  rating: number | null;
  config: Record<string, unknown>;
  created_at: string;
};

const LAB_COLUMNS =
  "id, run_id, model_slug, photo_path, status, fal_status_url, fal_response_url, image_path, error_message, cost_cents, generation_ms, rating, config, created_at";

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 300);

async function signed(sb: SupabaseClient, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await sb.storage.from(LAB_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  return data?.signedUrl ?? null;
}

async function runView(sb: SupabaseClient, runId: string) {
  const { data, error } = await sb.from("kw_ai_lab_renders").select(LAB_COLUMNS).eq("run_id", runId).order("created_at");
  if (error) throw error;
  const rows = (data ?? []) as LabRow[];
  const photoUrl = await signed(sb, rows[0]?.photo_path ?? null);
  return {
    run_id: runId,
    created_at: rows[0]?.created_at ?? null,
    photo_path: rows[0]?.photo_path ?? null,
    photo_url: photoUrl,
    config: rows[0]?.config ?? null,
    renders: await Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        model: r.model_slug,
        status: r.status,
        error: r.error_message,
        cost_cents: r.cost_cents,
        generation_ms: r.generation_ms,
        rating: r.rating,
        image_url: r.status === "success" ? await signed(sb, r.image_path) : null,
      })),
    ),
  };
}

async function actionUploadUrl(req: Request, sb: SupabaseClient, body: Record<string, unknown>) {
  const ext = ALLOWED_TYPES[String(body.content_type ?? "")];
  if (!ext) throw new HttpError(415, "Bitte ein Foto im Format JPG, PNG oder WebP hochladen.", "unsupported_type");
  const size = Number(body.size ?? 0);
  if (!Number.isFinite(size) || size <= 0 || size > MAX_UPLOAD_BYTES) throw new HttpError(413, "Das Foto ist zu groß (max. 15 MB).", "too_large");
  const path = `${LAB_PHOTO_PREFIX}${crypto.randomUUID()}.${ext}`;
  const { data, error } = await sb.storage.from(LAB_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw error ?? new Error("upload url failed");
  return jsonResponse(req, { path, token: data.token });
}

/** Wie bei Kundenfotos: nur echte Bilder, ohne EXIF/GPS, bevor sie an fal gehen. */
async function sanitizePhoto(sb: SupabaseClient, path: string): Promise<void> {
  const { data: blob, error } = await sb.storage.from(LAB_BUCKET).download(path);
  if (error || !blob) throw new HttpError(404, "Testfoto nicht gefunden.", "photo_missing");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const format = detectImageFormat(bytes.subarray(0, 32)).format;
  if (format !== "jpeg" && format !== "png" && format !== "webp") {
    await sb.storage.from(LAB_BUCKET).remove([path]);
    throw new HttpError(415, "Bitte ein Foto im Format JPG, PNG oder WebP hochladen.", "unsupported_type");
  }
  const stripped = stripImageMetadata(bytes);
  if (!stripped?.changed) return;
  const { error: upErr } = await sb.storage.from(LAB_BUCKET).upload(path, stripped.data, {
    contentType: format === "png" ? "image/png" : "image/jpeg",
    cacheControl: "31536000, immutable",
    upsert: true,
  });
  if (upErr) throw upErr;
}

async function actionRun(req: Request, sb: SupabaseClient, body: Record<string, unknown>) {
  const photoPath = String(body.photo_path ?? "");
  if (!photoPath.startsWith(LAB_PHOTO_PREFIX) || photoPath.includes("..")) throw new HttpError(400, "Ungültiges Testfoto.", "invalid_photo");
  const ids = Array.isArray(body.models) ? [...new Set(body.models.filter((m): m is string => typeof m === "string"))] : [];
  const models = ids.map((id) => falModel(id, "edit")).filter((m): m is FalModel => !!m);
  if (models.length === 0) throw new HttpError(422, "Bitte mindestens ein Bildbearbeitungsmodell wählen.", "no_models");
  if (models.length > MAX_MODELS) throw new HttpError(422, `Höchstens ${MAX_MODELS} Modelle je Testlauf.`, "too_many_models");
  await enforceRateLimit(sb, "kw:ai-lab:runs", 86400, RUNS_PER_DAY, { failClosed: true });

  await sanitizePhoto(sb, photoPath);
  const style = STYLES.find((s) => s.id === body.style)?.id;
  const form = KITCHEN_FORMS.find((f) => f.id === body.form)?.id ?? "l";
  const planned = body.config && typeof body.config === "object" ? (body.config as Record<string, unknown>) : {};
  const config = sanitizeConfig({ ...planned, ...(style ? { style } : {}), wishes: null });
  const room = sanitizeRoom({ form });
  const prompt = buildRenderPrompt(config, room, { mode: "edit" }).prompt;
  const { data: photo } = await sb.storage.from(LAB_BUCKET).createSignedUrl(photoPath, 900);
  if (!photo?.signedUrl) throw new HttpError(500, "Testfoto konnte nicht gelesen werden.", "photo_unreadable");

  const runId = crypto.randomUUID();
  for (const model of models) {
    const { data: row, error } = await sb
      .from("kw_ai_lab_renders")
      .insert({
        run_id: runId,
        model_slug: model.id,
        photo_path: photoPath,
        prompt,
        config: { config, room, prompt_version: PROMPT_VERSION },
        cost_cents: model.costCents,
      })
      .select("id")
      .single();
    if (error || !row) throw error ?? new Error("lab insert failed");
    try {
      const submission = await falSubmit(model.id, buildModelInput(model, { prompt, imageUrl: photo.signedUrl }));
      await sb.from("kw_ai_lab_renders").update({ fal_status_url: submission.statusUrl, fal_response_url: submission.responseUrl }).eq("id", row.id);
    } catch (err) {
      await sb.from("kw_ai_lab_renders").update({ status: "failed", error_message: `submit: ${errorText(err)}` }).eq("id", row.id);
    }
  }
  return jsonResponse(req, await runView(sb, runId));
}

async function advance(sb: SupabaseClient, row: LabRow): Promise<void> {
  const fail = (message: string) =>
    sb.from("kw_ai_lab_renders").update({ status: "failed", error_message: message.slice(0, 500), completed_at: new Date().toISOString() }).eq("id", row.id).eq("status", "pending");
  if (!row.fal_status_url || !row.fal_response_url) return void (await fail("missing fal urls"));
  try {
    const state = await falStatus(row.fal_status_url);
    if (state === "COMPLETED") {
      const result = await falResultImage(row.fal_response_url);
      const resp = await fetch(result.url);
      if (!resp.ok) throw new Error(`image download ${resp.status}`);
      const contentType = resp.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
      const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
      const path = labResultPath(row.run_id, row.id, ext);
      const { error: upErr } = await sb.storage.from(LAB_BUCKET).upload(path, new Uint8Array(await resp.arrayBuffer()), {
        contentType,
        cacheControl: "31536000, immutable",
        upsert: true,
      });
      if (upErr) throw upErr;
      await sb
        .from("kw_ai_lab_renders")
        .update({
          status: "success",
          image_path: path,
          completed_at: new Date().toISOString(),
          generation_ms: Date.now() - new Date(row.created_at).getTime(),
        })
        .eq("id", row.id)
        .eq("status", "pending");
    } else if (Date.now() - new Date(row.created_at).getTime() > RENDER_TIMEOUT_MS) {
      await fail("timeout");
    }
  } catch (err) {
    await fail(errorText(err));
  }
}

async function actionStatus(req: Request, sb: SupabaseClient, body: Record<string, unknown>) {
  const runId = String(body.run_id ?? "");
  if (!UUID_RE.test(runId)) throw new HttpError(400, "Ungültiger Testlauf.", "invalid_run");
  const { data, error } = await sb.from("kw_ai_lab_renders").select(LAB_COLUMNS).eq("run_id", runId).eq("status", "pending");
  if (error) throw error;
  await Promise.all(((data ?? []) as LabRow[]).map((row) => advance(sb, row)));
  return jsonResponse(req, await runView(sb, runId));
}

async function actionList(req: Request, sb: SupabaseClient) {
  const { data, error } = await sb.from("kw_ai_lab_renders").select("run_id, created_at").order("created_at", { ascending: false }).limit(60);
  if (error) throw error;
  const runIds = [...new Set((data ?? []).map((r) => r.run_id as string))].slice(0, 8);
  return jsonResponse(req, { runs: await Promise.all(runIds.map((id) => runView(sb, id))) });
}

serve(async (req) => {
  const auth = await checkCronOrServiceRoleOrAdmin(req, {});
  if (!auth.authorized) throw new HttpError(401, "Nicht autorisiert.", "unauthorized");
  const body = await readJson(req);
  const sb = serviceClient();
  switch (body.action) {
    case "upload-url":
      return actionUploadUrl(req, sb, body);
    case "run":
      return actionRun(req, sb, body);
    case "status":
      return actionStatus(req, sb, body);
    case "list":
      return actionList(req, sb);
    default:
      throw new HttpError(400, "Unbekannte Aktion.", "unknown_action");
  }
});
