/**
 * Edge Function: resize-photo-variants
 *
 * Verarbeitet `motorhome_photos`-Rows mit `processed_at IS NULL` und generiert
 * pro Foto zwei verkleinerte JPEG-Variants:
 *   • card_url    →  ~480 px Breite, JPEG q80    (Listings/Cards)
 *   • medium_url  →  ~1024 px Breite, JPEG q82  (Detail-Seite)
 *
 * Originale werden NIE überschrieben — sie dienen weiterhin als
 *   - Backup
 *   - hochauflösender Lightbox-View
 *   - Fallback in extrem seltenen Fällen, in denen die Variant-Generierung
 *     dauerhaft fehlschlägt (Frontend `card_url ?? url`)
 *
 * Variants landen im selben Bucket unter:
 *   motorhome-photos/{motorhome_id}/variants/{photo_id}_card.jpg
 *   motorhome-photos/{motorhome_id}/variants/{photo_id}_medium.jpg
 *
 * Die {photo_id} im Pfad sorgt dafür, dass beim Re-Processing dieselben
 * Pfade entstehen — `upsert: true` sorgt für Idempotenz.
 *
 * AUFRUF-MODI:
 *   POST { batchSize?: number = 10, photoIds?: string[] }
 *
 *   Cron-Modus (häufigster Fall):  Body {} oder {batchSize: 10}
 *     → Holt sich die ältesten ≤batchSize Photos mit
 *       processed_at IS NULL AND processing_attempts < 5 und verarbeitet sie.
 *
 *   Targeted-Modus:  { photoIds: ["uuid", ...] }
 *     → Verarbeitet nur die genannten Photos (z. B. für manuelles Re-Processing).
 *
 * AUTH:
 *   Service-Role-Token im Authorization-Header. Wird vom Cron-Job
 *   (pg_cron + pg_net + Vault.SUPABASE_SERVICE_ROLE_KEY) aufgerufen.
 *
 * RATE-CONTROL:
 *   batchSize default = 10. imagescript ist pure-JS und braucht
 *   für ein 6-MP-JPEG ~1.5 s decode + 1.5 s resize+encode.
 *   10 Photos ≈ 30 s Wall-Clock — sicher unter dem 60s-Function-Timeout.
 *
 * ERROR-HANDLING:
 *   • Pro-Photo-Try/Catch — eine kaputte Datei bricht den Batch nicht ab
 *   • Bei Fehler: processing_attempts += 1, processing_error wird gesetzt
 *   • Nach 5 Fehlversuchen ignoriert der Cron das Photo dauerhaft (Index-Filter)
 *   • Bei Erfolg: processed_at = now(), processing_error = NULL
 *
 * NOTE: CORS-Helper sind inline (nicht aus _shared/cors.ts importiert), weil
 * der Edge-Function-Bundler Pfade aus _shared nicht zuverlässig auflöst.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import {
  Image,
  decode as imagescriptDecode,
} from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "motorhome-photos";

// Card-Variant: passend für 480x320 Card-Slots auf /kaufen + Listings.
// Wir resizen nur auf BREITE 480 — Höhe folgt dem Aspect-Ratio. Das
// CSS auf den Cards macht object-fit: cover und cropt visuell auf 320 px.
const CARD_WIDTH = 480;
const CARD_QUALITY = 80;

// Medium-Variant: für die AuctionDetail-Hauptanzeige.
// 1024 px Breite reicht für FullHD-Displays ohne sichtbare Pixelung.
const MEDIUM_WIDTH = 1024;
const MEDIUM_QUALITY = 82;

const MAX_BATCH_SIZE = 25;
const DEFAULT_BATCH_SIZE = 10;

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

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowedOrigin = isAllowedOrigin(origin) ? origin! : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Vary": "Origin",
  };
}

interface ProcessResult {
  scanned: number;
  succeeded: number;
  failed: number;
  skippedUnsupported: number;
  errors: Array<{ id: string; message: string }>;
  durationMs: number;
}

interface PhotoRow {
  id: string;
  motorhome_id: string;
  url: string;
  processing_attempts: number | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }

  const headers = { ...getCorsHeaders(req), "Content-Type": "application/json" };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  }

  // Service-role-only auth. Wir akzeptieren BEIDE service-role-Token-Formate:
  //   • Den Legacy-JWT-Key (eyJ...) — verwendet von existierenden Cron-Jobs
  //     über vault.service_role_key
  //   • Den neuen `sb_secret_...` Key — vom Admin-CLI/Frontend verwendet
  // Der Edge-Function-Runtime stellt aktuell `SUPABASE_SERVICE_ROLE_KEY` auf
  // den neuen sb_secret_ Key. Vault speichert noch den Legacy-JWT.
  // → JWT-Format-Erkennung über decode-Roundtrip + ref-Match.
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  let authorized = false;
  if (token && token === SUPABASE_SERVICE_ROLE_KEY) {
    authorized = true;
  } else if (token.startsWith("eyJ")) {
    // Legacy JWT-Format: payload decoden und role + project-ref prüfen.
    const payload = decodeJwtPayload(token);
    if (payload?.role === "service_role" && payload?.ref === "zcrwqxsyptjwkuxfacvq") {
      authorized = true;
    }
  }

  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers,
    });
  }

  const startedAt = Date.now();

  let body: { batchSize?: number; photoIds?: string[] } = {};
  try {
    if (req.headers.get("Content-Length") !== "0") {
      body = (await req.json()) as typeof body;
    }
  } catch {
    // Empty/invalid body is fine for cron-mode.
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Pick die zu verarbeitenden Rows. Im Cron-Modus: älteste unprozessierte
  // Photos zuerst (FIFO über den Partial-Index `idx_motorhome_photos_unprocessed`).
  let query = adminClient
    .from("motorhome_photos")
    .select("id, motorhome_id, url, processing_attempts");

  if (body.photoIds && body.photoIds.length > 0) {
    query = query.in("id", body.photoIds);
  } else {
    query = query
      .is("processed_at", null)
      .lt("processing_attempts", 5)
      .order("created_at", { ascending: true });
  }

  const batchSize = Math.min(
    Math.max(1, body.batchSize ?? DEFAULT_BATCH_SIZE),
    MAX_BATCH_SIZE,
  );
  query = query.limit(batchSize);

  const { data: rows, error: fetchError } = await query;
  if (fetchError) {
    return new Response(
      JSON.stringify({ error: `Fetch failed: ${fetchError.message}` }),
      { status: 500, headers },
    );
  }

  const result: ProcessResult = {
    scanned: 0,
    succeeded: 0,
    failed: 0,
    skippedUnsupported: 0,
    errors: [],
    durationMs: 0,
  };

  for (const row of (rows ?? []) as PhotoRow[]) {
    result.scanned++;
    try {
      await processPhoto(adminClient, row);
      result.succeeded++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      // UNSUPPORTED-Format: kein Retry sinnvoll, finalisieren mit
      // processed_at=now() und processing_error=Grund. Originale URL
      // bleibt als Fallback (card_url=null, medium_url=null).
      if (message.startsWith("UNSUPPORTED:")) {
        result.skippedUnsupported++;
        await adminClient
          .from("motorhome_photos")
          .update({
            processed_at: new Date().toISOString(),
            processing_error: message,
            processing_attempts: (row.processing_attempts ?? 0) + 1,
          })
          .eq("id", row.id);
        continue;
      }

      result.failed++;
      result.errors.push({ id: row.id, message });
      await adminClient
        .from("motorhome_photos")
        .update({
          processing_attempts: (row.processing_attempts ?? 0) + 1,
          processing_error: message.slice(0, 500),
        })
        .eq("id", row.id);
    }
  }

  result.durationMs = Date.now() - startedAt;
  return new Response(JSON.stringify(result, null, 2), { status: 200, headers });
});

// ─── Per-Photo Processing ────────────────────────────────────────────────

async function processPhoto(
  adminClient: ReturnType<typeof createClient>,
  row: PhotoRow,
): Promise<void> {
  const storagePath = extractStoragePath(row.url, BUCKET);
  if (!storagePath) {
    throw new Error(
      `URL not in bucket "${BUCKET}": ${row.url.slice(0, 100)}`,
    );
  }

  const { data: blob, error: dlError } = await adminClient.storage
    .from(BUCKET)
    .download(storagePath);
  if (dlError || !blob) {
    throw new Error(`download failed: ${dlError?.message ?? "no blob"}`);
  }

  const originalBytes = new Uint8Array(await blob.arrayBuffer());
  if (originalBytes.length === 0) {
    throw new Error("downloaded 0 bytes");
  }

  let decoded: Image;
  try {
    const result = await imagescriptDecode(originalBytes);
    // Animated formats (GIF) yield Frame[]. Wir verwenden nur den ersten Frame.
    decoded = Array.isArray(result) ? result[0] : result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`UNSUPPORTED: decode failed (${msg.slice(0, 80)})`);
  }

  if (!decoded || decoded.width === 0 || decoded.height === 0) {
    throw new Error("UNSUPPORTED: decoded image has zero dimensions");
  }

  const motorhomeId = row.motorhome_id;
  const photoId = row.id;
  const variantsPrefix = `${motorhomeId}/variants/${photoId}`;

  const cardUrl = await generateAndUploadVariant(
    adminClient,
    decoded,
    `${variantsPrefix}_card.jpg`,
    CARD_WIDTH,
    CARD_QUALITY,
  );

  const mediumUrl = await generateAndUploadVariant(
    adminClient,
    decoded,
    `${variantsPrefix}_medium.jpg`,
    MEDIUM_WIDTH,
    MEDIUM_QUALITY,
  );

  const { error: updateError } = await adminClient
    .from("motorhome_photos")
    .update({
      card_url: cardUrl,
      medium_url: mediumUrl,
      processed_at: new Date().toISOString(),
      processing_error: null,
      processing_attempts: (row.processing_attempts ?? 0) + 1,
    })
    .eq("id", photoId);

  if (updateError) {
    throw new Error(`db update failed: ${updateError.message}`);
  }
}

async function generateAndUploadVariant(
  adminClient: ReturnType<typeof createClient>,
  source: Image,
  storagePath: string,
  targetWidth: number,
  quality: number,
): Promise<string> {
  // Skip-Resize wenn Original schon kleiner ist als das Ziel.
  let working = source.clone();
  if (working.width > targetWidth) {
    const scale = targetWidth / working.width;
    const targetHeight = Math.round(working.height * scale);
    working = working.resize(targetWidth, targetHeight);
  }

  const jpegBytes = await working.encodeJPEG(quality);

  const { error: upError } = await adminClient.storage
    .from(BUCKET)
    .upload(storagePath, jpegBytes, {
      contentType: "image/jpeg",
      upsert: true,
      // Variants sind per photoId immutable — wir cachen 1 Jahr + immutable.
      cacheControl: "31536000, immutable",
    });

  if (upError) {
    throw new Error(`variant upload failed (${storagePath}): ${upError.message}`);
  }

  const { data: { publicUrl } } = adminClient.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  return publicUrl;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function extractStoragePath(publicUrl: string, bucket: string): string | null {
  try {
    const u = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx < 0) return null;
    return decodeURIComponent(u.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}
