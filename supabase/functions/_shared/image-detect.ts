/**
 * Image format detection from raw byte content (magic bytes / file signature).
 *
 * Frontend-supplied `file.type` and file extension are UNTRUSTED:
 * - iOS Safari sometimes reports "image/jpeg" for HEIC files
 * - Users (or buggy upload code) can rename `.HEIC` to `.jpeg`
 * - The previous bug stored 13 HEIC photos as `.jpeg` because of exactly this
 *
 * This helper inspects the actual binary header so the server always knows
 * what format the bytes really are.
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
  /** Canonical file extension WITHOUT a leading dot. */
  extension: string;
  /** Whether browsers can render this format directly inside an <img> tag. */
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

/**
 * Detect image format from the first ~32 bytes of the file.
 *
 * Pass at least 16 bytes; 32 is preferred for ISOBMFF (HEIC/HEIF/AVIF) which
 * needs the `ftyp` brand to disambiguate.
 */
export function detectImageFormat(bytes: Uint8Array): DetectedImage {
  if (bytes.length < 4) return UNKNOWN;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { format: "jpeg", ...FORMAT_INFO.jpeg };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return { format: "png", ...FORMAT_INFO.png };
  }

  // GIF: "GIF87a" or "GIF89a"
  if (
    bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61
  ) {
    return { format: "gif", ...FORMAT_INFO.gif };
  }

  // WEBP: "RIFF" .... "WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { format: "webp", ...FORMAT_INFO.webp };
  }

  // BMP: "BM"
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return { format: "bmp", ...FORMAT_INFO.bmp };
  }

  // TIFF: "II*\0" (little endian) or "MM\0*" (big endian)
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
    // Common HEIC brands: heic, heix, hevc, hevx, heim, heis, hevm, hevs
    // Common HEIF brands: mif1, msf1
    // AVIF brand: avif
    if (brand === "avif" || brand === "avis") {
      return { format: "avif", ...FORMAT_INFO.avif };
    }
    if (
      brand === "heic" || brand === "heix" || brand === "hevc" || brand === "hevx" ||
      brand === "heim" || brand === "heis" || brand === "hevm" || brand === "hevs"
    ) {
      return { format: "heic", ...FORMAT_INFO.heic };
    }
    if (brand === "mif1" || brand === "msf1") {
      return { format: "heif", ...FORMAT_INFO.heif };
    }
    // Unknown ISOBMFF brand — most likely still HEIF-family, treat as HEIF
    return { format: "heif", ...FORMAT_INFO.heif };
  }

  return UNKNOWN;
}

/** Convenience: detect from the first chunk of a File/Blob. */
export async function detectFromBlob(blob: Blob): Promise<DetectedImage> {
  const head = blob.slice(0, 32);
  const buf = new Uint8Array(await head.arrayBuffer());
  return detectImageFormat(buf);
}

export const HEIC_FAMILY: ReadonlySet<DetectedFormat> = new Set(["heic", "heif"]);
