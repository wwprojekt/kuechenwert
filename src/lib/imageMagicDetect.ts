/**
 * Browser-side image format detection from raw byte content (magic bytes).
 *
 * Mirror of `supabase/functions/_shared/image-detect.ts`. Used by the
 * Admin/Seller photo managers and the wizard to refuse HEIC files BEFORE
 * upload, since `file.type` is unreliable on iOS Safari (sometimes reports
 * "image/jpeg" for HEIC payloads) and file extensions can be renamed.
 */

export type DetectedFormat =
  | "jpeg"
  | "png"
  | "webp"
  | "gif"
  | "avif"
  | "heic"
  | "heif"
  | "bmp"
  | "tiff"
  | "unknown";

export interface DetectedImage {
  format: DetectedFormat;
  /** Canonical MIME type, or "application/octet-stream" if unknown. */
  mime: string;
  /** Canonical extension WITHOUT a leading dot. */
  extension: string;
  /** Whether browsers can render this format directly inside an <img>. */
  browserRenderable: boolean;
}

const FORMAT_INFO: Record<Exclude<DetectedFormat, "unknown">, Omit<DetectedImage, "format">> = {
  jpeg: { mime: "image/jpeg", extension: "jpg", browserRenderable: true },
  png:  { mime: "image/png",  extension: "png", browserRenderable: true },
  webp: { mime: "image/webp", extension: "webp", browserRenderable: true },
  gif:  { mime: "image/gif",  extension: "gif", browserRenderable: true },
  avif: { mime: "image/avif", extension: "avif", browserRenderable: true },
  heic: { mime: "image/heic", extension: "heic", browserRenderable: false },
  heif: { mime: "image/heif", extension: "heif", browserRenderable: false },
  bmp:  { mime: "image/bmp",  extension: "bmp", browserRenderable: true },
  tiff: { mime: "image/tiff", extension: "tiff", browserRenderable: false },
};

const UNKNOWN: DetectedImage = {
  format: "unknown",
  mime: "application/octet-stream",
  extension: "bin",
  browserRenderable: false,
};

export function detectImageFormat(bytes: Uint8Array): DetectedImage {
  if (bytes.length < 4) return UNKNOWN;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { format: "jpeg", ...FORMAT_INFO.jpeg };
  }
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return { format: "png", ...FORMAT_INFO.png };
  }
  if (
    bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61
  ) {
    return { format: "gif", ...FORMAT_INFO.gif };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { format: "webp", ...FORMAT_INFO.webp };
  }
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return { format: "bmp", ...FORMAT_INFO.bmp };
  }
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
    (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)
  ) {
    return { format: "tiff", ...FORMAT_INFO.tiff };
  }

  // ISOBMFF (HEIC/HEIF/AVIF): bytes 4..7 == "ftyp", brand at 8..11
  if (bytes.length >= 12 &&
      bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (brand === "avif" || brand === "avis") return { format: "avif", ...FORMAT_INFO.avif };
    if (
      brand === "heic" || brand === "heix" || brand === "hevc" || brand === "hevx" ||
      brand === "heim" || brand === "heis" || brand === "hevm" || brand === "hevs"
    ) return { format: "heic", ...FORMAT_INFO.heic };
    if (brand === "mif1" || brand === "msf1") return { format: "heif", ...FORMAT_INFO.heif };
    return { format: "heif", ...FORMAT_INFO.heif };
  }

  return UNKNOWN;
}

export async function detectFromFile(file: File | Blob): Promise<DetectedImage> {
  const head = file.slice(0, 32);
  const buf = new Uint8Array(await head.arrayBuffer());
  return detectImageFormat(buf);
}

export const HEIC_FAMILY = new Set<DetectedFormat>(["heic", "heif"]);

/** True when the file's actual byte content is HEIC/HEIF, regardless of
 *  the extension or `file.type` the OS reported. */
export async function isHeicFile(file: File | Blob): Promise<boolean> {
  const detected = await detectFromFile(file);
  return HEIC_FAMILY.has(detected.format);
}
