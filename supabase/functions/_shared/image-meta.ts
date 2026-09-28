/**
 * Entfernt eingebettete Metadaten aus Fotos, bevor sie an Studios oder den
 * KI-Dienstleister gehen: EXIF und XMP (u. a. GPS-Position, Gerät, Aufnahmezeit),
 * IPTC und Kommentare. Farbprofil (ICC) und Farbraum-Angaben bleiben erhalten,
 * damit das Bild unverändert aussieht.
 *
 * Ohne Abhängigkeiten, damit Edge Functions und Vitest dieselbe Datei nutzen.
 */

export interface StripResult {
  data: Uint8Array;
  /** true, wenn Metadaten entfernt wurden. */
  changed: boolean;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

// APP0 (JFIF), APP2 (ICC-Profil) und APP14 (Adobe-Farbraum) sind für die
// Darstellung nötig; alle übrigen APPn-Segmente und COM tragen nur Metadaten.
const JPEG_KEEP_APP = new Set([0xe0, 0xe2, 0xee]);

/** Liefert null, wenn die Daten kein vollständiges JPEG sind. */
export function stripJpegMetadata(bytes: Uint8Array): StripResult | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const keep: Uint8Array[] = [bytes.subarray(0, 2)];
  let changed = false;
  let i = 2;
  while (i + 1 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    let marker = bytes[i + 1];
    while (marker === 0xff && i + 2 < bytes.length) {
      i += 1;
      marker = bytes[i + 1];
    }
    // SOS: ab hier folgen die Bilddaten; EOI: Ende ohne Bilddaten.
    if (marker === 0xda || marker === 0xd9) {
      keep.push(bytes.subarray(i));
      return { data: changed ? concat(keep) : bytes, changed };
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      keep.push(bytes.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 4 > bytes.length) return null;
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    const end = i + 2 + length;
    if (length < 2 || end > bytes.length) return null;
    const isApp = marker >= 0xe0 && marker <= 0xef;
    if (marker === 0xfe || (isApp && !JPEG_KEEP_APP.has(marker))) {
      changed = true;
    } else {
      keep.push(bytes.subarray(i, end));
    }
    i = end;
  }
  return null;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_DROP_CHUNKS = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

/** Liefert null, wenn die Daten kein vollständiges PNG sind. */
export function stripPngMetadata(bytes: Uint8Array): StripResult | null {
  if (bytes.length < 8 || PNG_SIGNATURE.some((b, idx) => bytes[idx] !== b)) return null;
  const keep: Uint8Array[] = [bytes.subarray(0, 8)];
  let changed = false;
  let i = 8;
  while (i + 12 <= bytes.length) {
    const length = ((bytes[i] << 24) >>> 0) + (bytes[i + 1] << 16) + (bytes[i + 2] << 8) + bytes[i + 3];
    const type = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
    const end = i + 12 + length;
    if (end > bytes.length) return null;
    if (PNG_DROP_CHUNKS.has(type)) {
      changed = true;
    } else {
      keep.push(bytes.subarray(i, end));
    }
    i = end;
    if (type === "IEND") return { data: changed ? concat(keep) : bytes, changed };
  }
  return null;
}

/** JPEG oder PNG bereinigen; andere Formate: null. */
export function stripImageMetadata(bytes: Uint8Array): StripResult | null {
  return stripJpegMetadata(bytes) ?? stripPngMetadata(bytes);
}
