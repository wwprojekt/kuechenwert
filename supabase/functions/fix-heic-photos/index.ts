/**
 * Edge Function: fix-heic-photos
 *
 * Scans `motorhome_photos` (and optionally `damage_photos`) for files in
 * Supabase Storage that claim to be JPEGs but are actually HEIC (iPhone)
 * encoded. For each such file, downloads it, decodes the HEIC payload,
 * re-encodes it as a real JPEG, and replaces the storage object in place
 * (same path, same URL) so no DB updates are required.
 *
 * AUTH: admin only. Caller must be authenticated and have role 'admin'
 * in `user_roles`. We rely on the JWT in `Authorization: Bearer <token>`.
 *
 * INPUT (JSON body, all fields optional):
 *   {
 *     "photoIds":     ["<motorhome_photos.id>", ...],   // process specific rows
 *     "motorhomeId":  "<motorhomes.id>",                 // process all photos of one motorhome
 *     "scanAll":      false,                              // process every motorhome_photos row
 *     "limit":        100,                                // max rows per call (default 50)
 *     "dryRun":       false                               // detect only, do not convert
 *   }
 *
 * OUTPUT:
 *   {
 *     "scanned": <n>,
 *     "converted": <n>,
 *     "skippedAlreadyJpeg": <n>,
 *     "errors": [ { id, url, message } ]
 *   }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { detectImageFormat } from "../_shared/image-detect.ts";

// HEIC decoder (pure WASM, works in Deno via esm.sh)
// libheif-js publishes a Browser/Worker WASM build that runs in Deno.
import libheif from "https://esm.sh/libheif-js@1.18.2/wasm-bundle?target=denonext";
// JPEG encoder. jpeg-js is a pure-JS encoder/decoder that works everywhere.
import jpeg from "https://esm.sh/jpeg-js@0.4.4?target=denonext";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "motorhome-photos";

interface ConvertResult {
  scanned: number;
  converted: number;
  skippedAlreadyJpeg: number;
  errors: Array<{ id: string; url: string; message: string }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCorsPreflightRequest(req);

  const headers = { ...getCorsHeaders(req), "Content-Type": "application/json" };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  // ── Auth: caller must be an admin OR present the service-role key ──────
  // The service-role bypass is intentional so this one-shot migration can be
  // invoked from a CLI / server context without an admin user session.
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return new Response(JSON.stringify({ error: "Missing bearer token" }), { status: 401, headers });
  }
  const token = authHeader.slice(7).trim();

  let authorized = false;
  let authMode = "unknown";

  // Branch 1 — exact match against the configured SERVICE_ROLE secret.
  if (token === SUPABASE_SERVICE_ROLE_KEY) {
    authorized = true;
    authMode = "service-role-exact";
  } else {
    // Branch 2 — decode JWT payload and accept role=service_role from the
    // same project. Falls back to admin user check otherwise.
    const claims = decodeJwtPayload(token);
    if (claims?.role === "service_role") {
      authorized = true;
      authMode = "service-role-jwt";
    } else {
      const { data: userResult, error: userError } = await adminClient.auth.getUser(token);
      if (userError || !userResult?.user) {
        return new Response(
          JSON.stringify({ error: "Invalid token", debug: { authMode, hasClaims: !!claims } }),
          { status: 401, headers },
        );
      }
      const { data: roles, error: rolesError } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userResult.user.id);
      if (rolesError) {
        return new Response(JSON.stringify({ error: "Role lookup failed" }), { status: 500, headers });
      }
      authorized = (roles ?? []).some((r) => r.role === "admin");
      authMode = authorized ? "admin-user" : "user-no-admin";
    }
  }
  if (!authorized) {
    return new Response(JSON.stringify({ error: "Admin only", debug: { authMode } }), { status: 403, headers });
  }

  // ── Parse input ────────────────────────────────────────────────────────
  type Body = {
    photoIds?: string[];
    motorhomeId?: string;
    scanAll?: boolean;
    limit?: number;
    dryRun?: boolean;
  };
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    // empty body is fine
  }
  const dryRun = !!body.dryRun;
  const limit = Math.max(1, Math.min(500, body.limit ?? 50));

  // ── Load candidate rows ────────────────────────────────────────────────
  let query = adminClient.from("motorhome_photos").select("id, url, motorhome_id");
  if (body.photoIds?.length) {
    query = query.in("id", body.photoIds);
  } else if (body.motorhomeId) {
    query = query.eq("motorhome_id", body.motorhomeId);
  } else if (!body.scanAll) {
    return new Response(
      JSON.stringify({ error: "Pass photoIds[], motorhomeId, or scanAll:true" }),
      { status: 400, headers },
    );
  }
  query = query.limit(limit);

  const { data: rows, error: rowsError } = await query;
  if (rowsError) {
    return new Response(JSON.stringify({ error: rowsError.message }), { status: 500, headers });
  }

  const result: ConvertResult = {
    scanned: 0,
    converted: 0,
    skippedAlreadyJpeg: 0,
    errors: [],
  };

  for (const row of rows ?? []) {
    result.scanned++;
    try {
      const storagePath = extractStoragePath(row.url, BUCKET);
      if (!storagePath) {
        result.errors.push({ id: row.id, url: row.url, message: "URL not in motorhome-photos bucket" });
        continue;
      }

      // Download bytes via service-role (works for both public and private buckets)
      const { data: blob, error: dlErr } = await adminClient.storage
        .from(BUCKET)
        .download(storagePath);
      if (dlErr || !blob) {
        result.errors.push({ id: row.id, url: row.url, message: `download failed: ${dlErr?.message ?? "no blob"}` });
        continue;
      }
      const bytes = new Uint8Array(await blob.arrayBuffer());

      const detected = detectImageFormat(bytes);
      if (detected.format === "jpeg" || detected.format === "png" || detected.format === "webp") {
        result.skippedAlreadyJpeg++;
        continue;
      }
      if (detected.format !== "heic" && detected.format !== "heif") {
        result.errors.push({
          id: row.id,
          url: row.url,
          message: `unsupported format ${detected.format} (first bytes: ${hexHead(bytes)})`,
        });
        continue;
      }

      if (dryRun) {
        // Just report that it WOULD be converted
        result.converted++;
        continue;
      }

      // Decode HEIC → RGBA → JPEG
      const jpegBytes = await heicToJpeg(bytes);

      // Re-upload at the SAME path with proper Content-Type, overwriting the broken file
      const { error: upErr } = await adminClient.storage
        .from(BUCKET)
        .upload(storagePath, jpegBytes, {
          contentType: "image/jpeg",
          upsert: true,
          cacheControl: "public, max-age=31536000, immutable",
        });
      if (upErr) {
        result.errors.push({ id: row.id, url: row.url, message: `upload failed: ${upErr.message}` });
        continue;
      }

      result.converted++;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      result.errors.push({ id: row.id, url: row.url, message });
    }
  }

  return new Response(JSON.stringify(result, null, 2), { status: 200, headers });
});

// ─── Helpers ────────────────────────────────────────────────────────────

function decodeJwtPayload(token: string): { role?: string; ref?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}


/** From a public-storage URL, extract the path inside the bucket. */
function extractStoragePath(publicUrl: string, bucket: string): string | null {
  try {
    const u = new URL(publicUrl);
    // Public URL pattern:  /storage/v1/object/public/<bucket>/<path...>
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx < 0) return null;
    return decodeURIComponent(u.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

function hexHead(bytes: Uint8Array): string {
  return Array.from(bytes.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
}

/** Largest edge of the re-encoded JPEG. iPhone 12MP HEICs are 3024x4032,
 *  which produces a 48 MB RGBA buffer that, together with libheif state
 *  and the jpeg encoder, blows the Edge Function's ~150 MB memory limit.
 *  1600 px is plenty for vehicle listings and brings RGBA down to ~10 MB. */
const MAX_OUTPUT_EDGE = 1600;
const JPEG_QUALITY = 85;

/**
 * Decode a HEIC/HEIF byte array and re-encode as JPEG, capped at
 * MAX_OUTPUT_EDGE on the longest side. Uses libheif-js (WASM) for decode
 * and jpeg-js for encode.
 */
async function heicToJpeg(heicBytes: Uint8Array): Promise<Uint8Array> {
  // libheif-js exposes a HeifDecoder constructor. Some bundlers expose it
  // on `default`, others on the module object — accept both shapes.
  // deno-lint-ignore no-explicit-any
  const heif: any = (libheif as any).default ?? libheif;
  const decoder = new heif.HeifDecoder();
  const images = decoder.decode(heicBytes);
  if (!images || images.length === 0) {
    throw new Error("libheif returned no images");
  }

  const image = images[0];
  const width: number = image.get_width();
  const height: number = image.get_height();

  // libheif's display() fills an RGBA buffer asynchronously via callback.
  const rgba = await new Promise<Uint8ClampedArray>((resolve, reject) => {
    const buffer = new Uint8ClampedArray(width * height * 4);
    image.display({ data: buffer, width, height }, (out: { data: Uint8ClampedArray } | null) => {
      if (!out) return reject(new Error("libheif display() returned null"));
      resolve(out.data);
    });
  });

  // Downsample to keep memory under the Edge Function quota.
  const scale = Math.min(1, MAX_OUTPUT_EDGE / Math.max(width, height));
  let outBuf: Uint8Array;
  let outW: number;
  let outH: number;
  if (scale === 1) {
    outBuf = new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength);
    outW = width;
    outH = height;
  } else {
    outW = Math.max(1, Math.round(width * scale));
    outH = Math.max(1, Math.round(height * scale));
    outBuf = new Uint8Array(outW * outH * 4);
    // Nearest-neighbor: fast, low-memory; quality is fine for thumbnails and
    // listing photos. Switch to bilinear if visible aliasing becomes an issue.
    const xRatio = width / outW;
    const yRatio = height / outH;
    for (let y = 0; y < outH; y++) {
      const sy = Math.min(height - 1, Math.floor(y * yRatio));
      const srcRow = sy * width;
      const dstRow = y * outW;
      for (let x = 0; x < outW; x++) {
        const sx = Math.min(width - 1, Math.floor(x * xRatio));
        const si = (srcRow + sx) * 4;
        const di = (dstRow + x) * 4;
        outBuf[di] = rgba[si];
        outBuf[di + 1] = rgba[si + 1];
        outBuf[di + 2] = rgba[si + 2];
        outBuf[di + 3] = rgba[si + 3];
      }
    }
  }

  const encoded = jpeg.encode({ data: outBuf, width: outW, height: outH }, JPEG_QUALITY);
  return new Uint8Array(encoded.data.buffer, encoded.data.byteOffset, encoded.data.byteLength);
}
