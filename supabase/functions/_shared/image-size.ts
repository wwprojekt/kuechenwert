/**
 * Format und Maße aus dem Header von JPEG- und PNG-Dateien, ohne Bildbibliothek.
 * Reines Modul: kw-google-ads prüft damit Anzeigenbilder vor dem Upload,
 * src/lib/__tests__/google-ads-plan.test.ts die Dateien in public/ads/.
 */

export interface ImageInfo {
  mime: "image/jpeg" | "image/png";
  width: number;
  height: number;
}

const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function pngInfo(b: Uint8Array): ImageInfo | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 24 || !signature.every((v, i) => b[i] === v)) return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { mime: "image/png", width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegInfo(b: Uint8Array): ImageInfo | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    const length = (b[i + 2] << 8) | b[i + 3];
    if (SOF_MARKERS.has(marker)) {
      return { mime: "image/jpeg", height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
    }
    i += 2 + length;
  }
  return null;
}

export function imageInfo(bytes: Uint8Array): ImageInfo | null {
  return pngInfo(bytes) ?? jpegInfo(bytes);
}
