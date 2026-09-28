/**
 * Unterlagen zu einem Lead (Angebot, Planung, Fotos) im privaten Bucket
 * lead-files. Genutzt von kw-lead-b (Funnel B) und kw-project (Nachreichen
 * über den Projektlink).
 *
 * Ablauf: Der Browser kündigt Dateien an (Kategorie, Typ, Größe), bekommt ein
 * Upload-Token plus signierte Upload-URLs, lädt direkt in den Bucket und
 * meldet danach die Pfade. Erst dann prüfen wir den tatsächlichen Inhalt,
 * entfernen Bild-Metadaten (GPS) und tragen die Dateien in lead_files ein.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { HttpError, cleanText, randomToken, sha256Hex } from "./kw-http.ts";
import { detectImageFormat } from "./image-detect.ts";
import { stripImageMetadata } from "./image-meta.ts";

export const LEAD_FILES_BUCKET = "lead-files";
/** Entspricht storage.buckets.file_size_limit für lead-files. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_FILES_PER_REQUEST = 10;
export const MAX_FILES_PER_LEAD = 20;
const UPLOAD_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

/** angebot = schriftliches Angebot, grundriss = Planung (Grundriss, Ansichten), kueche_bild = Fotos. */
const FILE_CATEGORIES = new Set(["kueche_bild", "angebot", "grundriss"]);
const FILE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};
const STORED_PATH_RE = /^[0-9a-f-]{36}\/(kueche_bild|angebot|grundriss)-[0-9a-f-]{36}\.(jpg|png|webp|heic|heif|pdf)$/;

export type AnnouncedFile = { category: string; name: string; type: string; size: number };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function parseAnnouncedFiles(value: unknown): AnnouncedFile[] {
  if (!Array.isArray(value)) return [];
  if (value.length > MAX_FILES_PER_REQUEST) {
    throw new HttpError(422, `Bitte höchstens ${MAX_FILES_PER_REQUEST} Dateien auf einmal hochladen.`, "files");
  }
  return value.map((raw) => {
    const f = asRecord(raw);
    const category = typeof f.category === "string" ? f.category : "";
    const type = typeof f.type === "string" ? f.type.toLowerCase() : "";
    const size = typeof f.size === "number" && Number.isFinite(f.size) ? f.size : NaN;
    if (!FILE_CATEGORIES.has(category)) throw new HttpError(422, "Unbekannte Dateiart.", "files");
    if (!FILE_EXTENSIONS[type]) throw new HttpError(422, "Bitte nur Bilder (JPG, PNG, WebP, HEIC) oder PDF hochladen.", "files");
    if (!(size >= 1 && size <= MAX_FILE_BYTES)) {
      throw new HttpError(422, `Eine Datei ist größer als ${MAX_FILE_BYTES / 1024 / 1024} MB.`, "files");
    }
    return { category, type, size, name: cleanText(f.name, 120) ?? "datei" };
  });
}

export async function issueUploads(
  sb: SupabaseClient,
  leadId: string,
  files: AnnouncedFile[],
): Promise<{ upload_token?: string; uploads?: { index: number; path: string; token: string }[] }> {
  if (!files.length) return {};
  const uploadToken = randomToken();
  const { error: tokenErr } = await sb.from("lead_upload_tokens").insert({
    token_hash: await sha256Hex(uploadToken),
    lead_id: leadId,
    expires_at: new Date(Date.now() + UPLOAD_TOKEN_TTL_MS).toISOString(),
  });
  if (tokenErr) throw tokenErr;

  const uploads = [];
  for (const [index, file] of files.entries()) {
    const path = `${leadId}/${file.category}-${crypto.randomUUID()}.${FILE_EXTENSIONS[file.type]}`;
    const { data, error } = await sb.storage.from(LEAD_FILES_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error("signed upload url failed");
    uploads.push({ index, path: data.path, token: data.token });
  }
  return { upload_token: uploadToken, uploads };
}

/**
 * Prüft den Dateiinhalt (nicht die Angabe des Browsers) und entfernt aus
 * JPG/PNG eingebettete Metadaten wie GPS-Position. Andere Inhalte als Bilder
 * oder PDF werden gelöscht; Rückgabe false = Datei nicht übernehmen.
 */
async function sanitizeStoredFile(sb: SupabaseClient, path: string): Promise<boolean> {
  const { data: blob, error } = await sb.storage.from(LEAD_FILES_BUCKET).download(path);
  if (error || !blob) return false;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const isPdf = bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  const format = detectImageFormat(bytes.subarray(0, 32)).format;
  if (!isPdf && !["jpeg", "png", "webp", "heic", "heif"].includes(format)) {
    await sb.storage.from(LEAD_FILES_BUCKET).remove([path]);
    return false;
  }
  const stripped = isPdf ? null : stripImageMetadata(bytes);
  if (stripped?.changed) {
    const { error: upErr } = await sb.storage.from(LEAD_FILES_BUCKET).upload(path, stripped.data, {
      contentType: format === "png" ? "image/png" : "image/jpeg",
      cacheControl: "31536000, immutable",
      upsert: true,
    });
    if (upErr) throw upErr;
  }
  return true;
}

/**
 * Trägt hochgeladene Dateien zum Upload-Token ein. `expectedLeadId`: Das
 * Token muss zu diesem Lead gehören (Aufruf über den Projektlink).
 */
export async function attachUploadedFiles(
  sb: SupabaseClient,
  uploadToken: unknown,
  requestedFiles: unknown,
  expectedLeadId?: string,
): Promise<{ leadId: string; attached: number; missing: number }> {
  const token = typeof uploadToken === "string" ? uploadToken : "";
  if (token.length < 20) throw new HttpError(401, "Der Upload-Link ist ungültig.", "upload_token");
  const { data: tokenRow } = await sb
    .from("lead_upload_tokens")
    .select("lead_id, expires_at")
    .eq("token_hash", await sha256Hex(token))
    .maybeSingle();
  if (!tokenRow || new Date(tokenRow.expires_at as string).getTime() < Date.now()) {
    throw new HttpError(401, "Der Upload-Link ist abgelaufen.", "upload_token");
  }
  const leadId = tokenRow.lead_id as string;
  if (expectedLeadId && leadId !== expectedLeadId) {
    throw new HttpError(401, "Der Upload-Link gehört zu einem anderen Projekt.", "upload_token");
  }

  const requested = (Array.isArray(requestedFiles) ? requestedFiles : []).slice(0, MAX_FILES_PER_REQUEST).map(asRecord);
  const { data: objects, error: listErr } = await sb.storage.from(LEAD_FILES_BUCKET).list(leadId, { limit: 100 });
  if (listErr) throw listErr;
  const stored = new Map((objects ?? []).map((o) => [`${leadId}/${o.name}`, o]));
  const { data: existingRows } = await sb.from("lead_files").select("file_url").eq("lead_id", leadId);
  const alreadyAttached = new Set((existingRows ?? []).map((r) => r.file_url as string));

  const rows = [];
  const missing: string[] = [];
  for (const f of requested) {
    const path = typeof f.path === "string" ? f.path : "";
    const object = stored.get(path);
    const size = Number((object?.metadata as Record<string, unknown> | undefined)?.size ?? f.size ?? 0);
    const category = path.split("/")[1]?.split("-")[0] ?? "";
    if (!path.startsWith(`${leadId}/`) || !STORED_PATH_RE.test(path) || !object || size > MAX_FILE_BYTES) {
      missing.push(path);
      continue;
    }
    if (alreadyAttached.has(path)) continue;
    if (!(await sanitizeStoredFile(sb, path))) {
      missing.push(path);
      continue;
    }
    const type = typeof f.type === "string" && FILE_EXTENSIONS[f.type.toLowerCase()] ? f.type.toLowerCase() : "application/octet-stream";
    rows.push({
      lead_id: leadId,
      file_url: path,
      file_name: cleanText(f.name, 120) ?? "datei",
      file_type: type,
      file_size_bytes: size || null,
      category,
    });
  }
  if (rows.length) {
    const { error } = await sb.from("lead_files").insert(rows);
    if (error) throw error;
  }
  if (missing.length) console.warn("[lead-files] Dateien fehlen oder ungültig", leadId, missing.length);
  return { leadId, attached: rows.length, missing: missing.length };
}
