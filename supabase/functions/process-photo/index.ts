/**
 * Edge Function: process-photo
 *
 * Generiert pro `motorhome_photos`-Row zwei pre-resized WebP-Variants:
 *   • card_url   →  480 px Breite, WebP q80   (Listings/Cards)
 *   • medium_url → 1024 px Breite, WebP q82  (Detail-Seite)
 *
 * **Ersetzt die alte `resize-photo-variants`-Function**, die mit imagescript
 * regelmässig mit HTTP 546 (WORKER_RESOURCE_LIMIT) crashte. Diese Function
 * nutzt jsquash WASM-Decoder, die deutlich speicherärmer arbeiten — aber
 * trotzdem Memory-Limits haben (siehe SKIP-LOGIK unten).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SKIP-LOGIK für grosse Originale
 * ─────────────────────────────────────────────────────────────────────────
 * Originale > 2 MB werden NICHT verarbeitet, weil jsquash-WASM bei sehr
 * grossen Bildern (z.B. 14 MB iPhone-ProRAW) im 256 MB Function-Memory
 * zerschlägt. Solche Photos werden:
 *
 *   1) Bei NEUEM Upload via Browser (Canvas API) auf max 2400px JPEG q85
 *      heruntergerechnet, BEVOR sie überhaupt zur Edge Function kommen.
 *      → kommt nie wieder vor (siehe `src/lib/imageCompress.ts`).
 *
 *   2) Für die bestehenden ~778 grossen Photos (erstellt vor dem Browser-
 *      Compress-Rollout): einmaliges lokales Backfill-Script mit
 *      `sharp` (siehe `scripts/backfill-photos.mjs`), das die Originale
 *      shrinkt und dann diese Function pro Photo aufruft.
 *
 * Bei Skip wird `processing_error = "original_too_large"` gesetzt, damit
 * das Backfill-Script weiss welche Photos noch shrink+reprocess brauchen.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * AUFRUF-MODI
 * ─────────────────────────────────────────────────────────────────────────
 *   POST { photoId: "uuid" }
 *     → Verarbeitet exakt dieses eine Photo. Wird vom Backfill-Script
 *       aufgerufen, nachdem das Original shrunken wurde.
 *
 *   POST { batchSize?: number, priority?: "active_covers" | "fifo" }
 *     → Cron-Modus. Holt sich `batchSize` (max 10) Photos mit
 *       processed_at IS NULL AND processing_attempts < 5.
 *       priority="active_covers" priorisiert display_order=0 von aktiven
 *       Auktionen (sichtbar auf /kaufen).
 *
 *   GET  → Status / Progress. Gibt {total, done, todo, errored}.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * AUTH
 * ─────────────────────────────────────────────────────────────────────────
 * Service-Role-Key im Authorization-Header. Akzeptiert sowohl das neue
 * `sb_secret_*` Format (matched gegen SUPABASE_SERVICE_ROLE_KEY env var)
 * als auch den legacy JWT mit role=service_role (für pg_cron-Kompatibilität).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "motorhome-photos";

const CARD_WIDTH = 480;
const CARD_QUALITY = 80;
const MEDIUM_WIDTH = 1024;
const MEDIUM_QUALITY = 82;

// 2026-04-20: Versucht 20 → triggert WORKER_RESOURCE_LIMIT (HTTP 546).
// 2026-04-20: Auf 10 reduziert — laut Edge Function Logs crasht es mit 10 weiterhin
//             bei ~100% der Aufrufe (siehe Edge Logs: nur 546 Responses, 0 200).
// 2026-04-21: Auf 3 reduziert. jsquash WASM-Module akkumulieren Memory zwischen
//             sequentiellen Decodes (Cache hält Heap am Leben), und das 256 MB
//             Function-Memory-Limit reicht nur für ~3 Photos in derselben Invocation.
// 2026-04-22: Auf 1 reduziert. Bei v6/v7 crasht der Worker mit HTTP 546
//             AUCH bei kleinen 1-MB-JPEGs, sobald 2-3 Photos sequenziell
//             verarbeitet werden — die jsquash WASM-Heap überlebt jede
//             Photo-Iteration und kumuliert über die 256-MB-Grenze. Mit
//             batchSize=1 startet jede Invocation mit frischem Heap.
//             Throughput: */5 active_covers + */10 fifo = 6+3 = 9 photos/h
//             — reicht für tägliches Upload-Volumen (typisch <50/Tag).
//             Backlog wird via lokalem sharp-Backfill geleert
//             (scripts/backfill-photo-variants.mjs).
const MAX_BATCH_SIZE = 3;
const DEFAULT_BATCH_SIZE = 1;

// Skip-Threshold: Originale ≤ 2 MB sind sicher für jsquash-WASM in 256 MB
// Function-Memory. Empirisch bestätigt 2026-04-20: 1.4 MB JPEG mit 2040×1530
// braucht ~150 MB peak, 5 MB JPEG triggert WORKER_RESOURCE_LIMIT.
const MAX_INPUT_BYTES = 2 * 1024 * 1024;

// Cache: 1 Jahr (immutable). Variant-Pfade enthalten {photo_id} + {size},
// d.h. eine Datei ändert sich nie. Cloudflare cached → kostenlose CDN.
// HINWEIS: Supabase Storage SDK pre-pendet automatisch `max-age=` an diesen
// Wert. Wir übergeben also NUR die Sekunden + zusätzliche Direktiven.
// Resultat im Response-Header: `Cache-Control: max-age=31536000, immutable`.
// Vorher hatten wir hier `"public, max-age=31536000, immutable"` — das wurde
// zu `max-age=public, max-age=31536000, immutable` (kaputter Header, von
// Browsern + CDN teilweise ignoriert).
const VARIANT_CACHE_CONTROL = "31536000, immutable";

// ─── CORS ──────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://caravanwert.de",
  "https://www.caravanwert.de",
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.netlify\.app$/.test(origin)) return true;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
  if (/^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;
  return false;
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowed = isAllowedOrigin(origin) ? origin! : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

// ─── AUTH (dual: sb_secret_ key OR legacy JWT) ─────────────────────────────
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const padded = parts[1].padEnd(parts[1].length + (4 - parts[1].length % 4) % 4, "=");
    const decoded = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function isAuthorized(req: Request): boolean {
  const header = req.headers.get("Authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return false;
  const token = header.slice(7).trim();
  if (!token) return false;
  if (token === SUPABASE_SERVICE_ROLE_KEY) return true;
  if (token.startsWith("eyJ")) {
    const payload = decodeJwtPayload(token);
    if (payload?.role === "service_role" && payload?.ref === "gzqayoalwtmypndrmqes") {
      return true;
    }
  }
  return false;
}

// ─── Image-Format-Detection (Magic Bytes) ─────────────────────────────────
type SupportedFormat = "jpeg" | "png" | "webp";

function detectFormat(bytes: Uint8Array): SupportedFormat | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "png";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "webp";
  return null;
}

// ─── jsquash Lazy-Imports ──────────────────────────────────────────────────
// Imports passieren erst on-demand, damit die Function quick-startet wenn
// nur ein GET-Status angefragt wird.
async function decodeImage(bytes: Uint8Array, format: SupportedFormat): Promise<ImageData> {
  if (format === "jpeg") {
    const mod = await import("https://esm.sh/@jsquash/jpeg@1.5.0?bundle");
    return await mod.decode(bytes);
  }
  if (format === "png") {
    const mod = await import("https://esm.sh/@jsquash/png@3.1.0?bundle");
    return await mod.decode(bytes);
  }
  if (format === "webp") {
    const mod = await import("https://esm.sh/@jsquash/webp@1.5.0?bundle");
    return await mod.decode(bytes);
  }
  throw new Error(`unsupported format: ${format}`);
}

async function resizeImage(
  source: ImageData,
  targetWidth: number,
): Promise<ImageData> {
  const mod = await import("https://esm.sh/@jsquash/resize@2.1.0?bundle");
  const scale = targetWidth / source.width;
  return await mod.default(source, {
    width: targetWidth,
    height: Math.max(1, Math.round(source.height * scale)),
    method: "lanczos3",
    fitMethod: "stretch",
    premultiply: true,
    linearRGB: true,
  });
}

async function encodeWebp(image: ImageData, quality: number): Promise<Uint8Array> {
  const mod = await import("https://esm.sh/@jsquash/webp@1.5.0?bundle");
  const result = await mod.encode(image, { quality });
  return result instanceof Uint8Array ? result : new Uint8Array(result);
}

// ─── Storage-Helpers ──────────────────────────────────────────────────────
function variantPath(motorhomeId: string, photoId: string, size: "card" | "medium"): string {
  return `${motorhomeId}/variants/${photoId}_${size}.webp`;
}

function publicUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

interface ProcessResult {
  ok: boolean;
  photoId: string;
  card_url?: string;
  medium_url?: string;
  card_kb?: number;
  medium_kb?: number;
  original_kb?: number;
  reason?: string;
  ms?: number;
}

// deno-lint-ignore no-explicit-any
async function processOnePhoto(adminClient: any, photoId: string): Promise<ProcessResult> {
  const t0 = performance.now();

  const { data: photo, error: photoErr } = await adminClient
    .from("motorhome_photos")
    .select("id, motorhome_id, url, processing_attempts")
    .eq("id", photoId)
    .single();

  if (photoErr || !photo) {
    return { ok: false, photoId, reason: `photo not found: ${photoErr?.message ?? "no row"}` };
  }

  // ── Pre-flight: Größe per HEAD prüfen, BEVOR wir das Original in den
  //                Speicher laden. Sonst killt ein einziges 14-MB-iPhone-Photo
  //                den ganzen Worker mit HTTP 546 (WORKER_RESOURCE_LIMIT) und
  //                processing_attempts wird NICHT inkrementiert → Endlosloop.
  //                Siehe Incident 2026-04-22.
  const headRes = await fetch(photo.url, { method: "HEAD" });
  if (!headRes.ok) {
    await markFailed(adminClient, photo, `head_failed_${headRes.status}`);
    return { ok: false, photoId, reason: `head ${headRes.status}` };
  }
  const contentLengthRaw = headRes.headers.get("content-length");
  const contentLength = contentLengthRaw ? Number.parseInt(contentLengthRaw, 10) : NaN;
  if (Number.isFinite(contentLength) && contentLength > MAX_INPUT_BYTES) {
    await markFailed(adminClient, photo, "original_too_large");
    return {
      ok: false,
      photoId,
      original_kb: Math.round(contentLength / 1024),
      reason: `original ${Math.round(contentLength / 1024)} KB > ${Math.round(MAX_INPUT_BYTES / 1024)} KB — skipped pre-flight`,
    };
  }

  // ── Original laden (jetzt sicher: ≤ MAX_INPUT_BYTES laut HEAD) ───────────
  const fetchRes = await fetch(photo.url);
  if (!fetchRes.ok) {
    await markFailed(adminClient, photo, `fetch_failed_${fetchRes.status}`);
    return { ok: false, photoId, reason: `fetch ${fetchRes.status}` };
  }
  const originalBytes = new Uint8Array(await fetchRes.arrayBuffer());
  const originalKb = Math.round(originalBytes.length / 1024);

  // Defense-in-depth: Falls HEAD gelogen hat (Content-Length fehlt o.ä.),
  //                   fangen wir hier nochmal ab.
  if (originalBytes.length > MAX_INPUT_BYTES) {
    await markFailed(adminClient, photo, "original_too_large");
    return {
      ok: false,
      photoId,
      original_kb: originalKb,
      reason: `original > ${Math.round(MAX_INPUT_BYTES / 1024)} KB — needs backfill shrink first`,
    };
  }

  // ── Format detection ─────────────────────────────────────────────────────
  const format = detectFormat(originalBytes);
  if (!format) {
    await markFailed(adminClient, photo, "unsupported_format");
    return { ok: false, photoId, original_kb: originalKb, reason: "unsupported format" };
  }

  // ── Decode + Resize + Encode ─────────────────────────────────────────────
  let cardBytes: Uint8Array;
  let mediumBytes: Uint8Array;
  try {
    const decoded = await decodeImage(originalBytes, format);

    // Card 480px (skip resize if already smaller — encode direkt)
    const cardSrc = decoded.width <= CARD_WIDTH ? decoded : await resizeImage(decoded, CARD_WIDTH);
    cardBytes = await encodeWebp(cardSrc, CARD_QUALITY);

    // Medium 1024px
    const mediumSrc = decoded.width <= MEDIUM_WIDTH ? decoded : await resizeImage(decoded, MEDIUM_WIDTH);
    mediumBytes = await encodeWebp(mediumSrc, MEDIUM_QUALITY);
  } catch (e) {
    const msg = String(e).slice(0, 300);
    await markFailed(adminClient, photo, `process_error: ${msg}`);
    return { ok: false, photoId, original_kb: originalKb, reason: msg };
  }

  // ── Upload variants to storage ───────────────────────────────────────────
  const cardPath = variantPath(photo.motorhome_id, photo.id, "card");
  const mediumPath = variantPath(photo.motorhome_id, photo.id, "medium");

  const cardUpload = await adminClient.storage.from(BUCKET).upload(
    cardPath,
    cardBytes,
    { contentType: "image/webp", cacheControl: VARIANT_CACHE_CONTROL, upsert: true },
  );
  if (cardUpload.error) {
    await markFailed(adminClient, photo, `upload_card_failed: ${cardUpload.error.message}`);
    return { ok: false, photoId, original_kb: originalKb, reason: cardUpload.error.message };
  }

  const mediumUpload = await adminClient.storage.from(BUCKET).upload(
    mediumPath,
    mediumBytes,
    { contentType: "image/webp", cacheControl: VARIANT_CACHE_CONTROL, upsert: true },
  );
  if (mediumUpload.error) {
    await markFailed(adminClient, photo, `upload_medium_failed: ${mediumUpload.error.message}`);
    return { ok: false, photoId, original_kb: originalKb, reason: mediumUpload.error.message };
  }

  const cardUrl = publicUrl(cardPath);
  const mediumUrl = publicUrl(mediumPath);

  // ── DB update ────────────────────────────────────────────────────────────
  const { error: updateErr } = await adminClient
    .from("motorhome_photos")
    .update({
      card_url: cardUrl,
      medium_url: mediumUrl,
      processed_at: new Date().toISOString(),
      processing_error: null,
      processing_attempts: (photo.processing_attempts ?? 0) + 1,
    })
    .eq("id", photo.id);

  if (updateErr) {
    return { ok: false, photoId, reason: `db_update_failed: ${updateErr.message}` };
  }

  return {
    ok: true,
    photoId,
    card_url: cardUrl,
    medium_url: mediumUrl,
    card_kb: Math.round(cardBytes.length / 1024),
    medium_kb: Math.round(mediumBytes.length / 1024),
    original_kb: originalKb,
    ms: Math.round(performance.now() - t0),
  };
}

// deno-lint-ignore no-explicit-any
async function markFailed(adminClient: any, photo: { id: string; processing_attempts: number | null }, reason: string) {
  await adminClient
    .from("motorhome_photos")
    .update({
      processing_error: reason,
      processing_attempts: (photo.processing_attempts ?? 0) + 1,
    })
    .eq("id", photo.id);
}

// deno-lint-ignore no-explicit-any
async function selectBatch(adminClient: any, batchSize: number, priority: string): Promise<string[]> {
  if (priority === "active_covers") {
    // Active-Covers: priorisiere display_order=0 von Auctions mit status='active'.
    // Nutzt eine RPC oder explizites Join-Query.
    const { data, error } = await adminClient
      .from("motorhome_photos")
      .select("id, motorhome_id, motorhome:motorhomes!inner(auctions!inner(status))")
      .is("processed_at", null)
      .lt("processing_attempts", 5)
      .eq("display_order", 0)
      .eq("motorhome.auctions.status", "active")
      .limit(batchSize);
    if (error) throw new Error(`active_covers query: ${error.message}`);
    return (data ?? []).map((r: { id: string }) => r.id);
  }
  // FIFO fallback
  const { data, error } = await adminClient
    .from("motorhome_photos")
    .select("id")
    .is("processed_at", null)
    .lt("processing_attempts", 5)
    .order("created_at", { ascending: true })
    .limit(batchSize);
  if (error) throw new Error(`fifo query: ${error.message}`);
  return (data ?? []).map((r: { id: string }) => r.id);
}

// ─── Request Handler ──────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (!isAuthorized(req)) {
    return jsonResponse(req, 401, { error: "Unauthorized" });
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // GET = Status
  if (req.method === "GET") {
    const { data, error } = await adminClient.rpc("photo_processing_stats").single();
    if (error) {
      // Fallback if RPC doesn't exist: inline aggregation
      const { count: total } = await adminClient.from("motorhome_photos").select("*", { count: "exact", head: true });
      const { count: done } = await adminClient.from("motorhome_photos").select("*", { count: "exact", head: true }).not("processed_at", "is", null);
      const { count: errored } = await adminClient.from("motorhome_photos").select("*", { count: "exact", head: true }).gte("processing_attempts", 5);
      return jsonResponse(req, 200, {
        total: total ?? 0,
        done: done ?? 0,
        errored: errored ?? 0,
        todo: (total ?? 0) - (done ?? 0) - (errored ?? 0),
      });
    }
    return jsonResponse(req, 200, data);
  }

  if (req.method !== "POST") {
    return jsonResponse(req, 405, { error: "Method not allowed" });
  }

  let body: { photoId?: string; batchSize?: number; priority?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is OK -> default cron mode
  }

  // Targeted: single photo
  if (body.photoId) {
    const result = await processOnePhoto(adminClient, body.photoId);
    return jsonResponse(req, result.ok ? 200 : 422, result);
  }

  // Batch mode
  const batchSize = Math.min(body.batchSize ?? DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE);
  const priority = body.priority ?? "fifo";
  const tBatch = performance.now();

  let photoIds: string[];
  try {
    photoIds = await selectBatch(adminClient, batchSize, priority);
  } catch (e) {
    return jsonResponse(req, 500, { error: String(e) });
  }

  const results: ProcessResult[] = [];
  for (const id of photoIds) {
    const r = await processOnePhoto(adminClient, id);
    results.push(r);
    // Defensive: wenn ein einzelnes Photo > 30 s braucht, könnte das auf
    // Memory-Druck hindeuten — wir brechen nicht ab, aber loggen.
    if (r.ms && r.ms > 30000) {
      console.warn(`process-photo: slow processing ${r.photoId} took ${r.ms} ms`);
    }
  }

  return jsonResponse(req, 200, {
    batch_priority: priority,
    batch_size_requested: batchSize,
    processed: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    duration_ms: Math.round(performance.now() - tBatch),
    results,
  });
});
