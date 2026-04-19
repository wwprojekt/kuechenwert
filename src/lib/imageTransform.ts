/**
 * Supabase Storage Image Transformation
 *
 * Wandelt eine Supabase Storage Public-URL in eine on-the-fly transformierte URL um.
 * Original-Format:  https://<proj>.supabase.co/storage/v1/object/public/<bucket>/<path>
 * Render-Format:    https://<proj>.supabase.co/storage/v1/render/image/public/<bucket>/<path>?width=…
 *
 * Reduziert typische 300 KB Karten-JPEGs auf ~30 KB (90% kleiner) und liefert sie
 * als WebP, wenn der Browser es unterstützt (Supabase macht das automatisch via Accept-Header).
 *
 * Wichtig:
 * - Funktioniert NUR auf Supabase Pro-Plan (Image Transformation Add-on aktiviert).
 * - Nicht-Supabase-URLs werden unverändert zurückgegeben (kein Crash, kein Wechsel).
 * - Cloudflare cached die transformierte URL aggressiv → erste Anfrage langsam, danach <100 ms.
 */

export interface ImageTransformOptions {
  /** Zielbreite in Pixel. */
  width?: number;
  /** Zielhöhe in Pixel. Wird mit width kombiniert via resize. */
  height?: number;
  /** JPEG-Qualität 1–100. Default 75 (gute Balance Größe/Qualität für Listing-Cards). */
  quality?: number;
  /** Resize-Strategie. cover = füllt den Frame, schneidet ggf. ab. Default 'cover'. */
  resize?: 'cover' | 'contain' | 'fill';
}

const STORAGE_PUBLIC_MARKER = '/storage/v1/object/public/';
const STORAGE_RENDER_MARKER = '/storage/v1/render/image/public/';

/**
 * Erzeugt eine transformierte Storage-URL. Nicht-Supabase-URLs (z. B. externe Fallback-Bilder
 * oder Branding-CDN) werden unverändert zurückgegeben.
 */
export function getStorageImageUrl(
  url: string | null | undefined,
  opts: ImageTransformOptions = {}
): string {
  if (!url) return '';

  const idx = url.indexOf(STORAGE_PUBLIC_MARKER);
  if (idx === -1) return url;

  const transformed = url.slice(0, idx) + STORAGE_RENDER_MARKER + url.slice(idx + STORAGE_PUBLIC_MARKER.length);

  const params = new URLSearchParams();
  if (opts.width) params.set('width', String(opts.width));
  if (opts.height) params.set('height', String(opts.height));
  if (opts.quality) params.set('quality', String(opts.quality));
  if (opts.resize) params.set('resize', opts.resize);

  const qs = params.toString();
  return qs ? `${transformed}?${qs}` : transformed;
}

export interface ResponsiveImageProps {
  /** Default-`src` für ältere Browser ohne srcset-Support. */
  src: string;
  /** `srcset`-String. Leer wenn URL nicht transformierbar ist. */
  srcSet: string;
  /** Bereits konfigurierter `sizes`-Hint (vom Caller übergeben). */
  sizes: string;
}

interface ResponsiveImageOptions {
  /**
   * `sizes`-Attribut, das dem Browser sagt wie groß das Bild *gerendert* wird.
   * Beispiel für Cards in einem responsive Grid:
   *   "(min-width: 1280px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
   */
  sizes: string;
  /** Pixel-Breiten für srcset. Default: deckt Mobile bis 2x Desktop ab. */
  widths?: number[];
  /** JPEG-Qualität, Default 75. */
  quality?: number;
  /** Resize-Strategie, Default 'cover'. */
  resize?: 'cover' | 'contain';
  /** Default-Breite für `src` Fallback. Default 640. */
  defaultWidth?: number;
}

/**
 * Erzeugt `src` + `srcSet` + `sizes` für ein <img>. Der Browser lädt automatisch die
 * passende Auflösung für sein Device-Pixel-Ratio und Viewport.
 *
 * Bei Nicht-Supabase-URLs (z. B. statische Fallback-Bilder) wird srcSet leer gelassen
 * und src bleibt die Original-URL — kein Crash, kein optischer Bruch.
 */
export function getResponsiveImageProps(
  url: string | null | undefined,
  opts: ResponsiveImageOptions
): ResponsiveImageProps {
  const widths = opts.widths ?? [320, 480, 640, 960, 1280];
  const quality = opts.quality ?? 75;
  const resize = opts.resize ?? 'cover';
  const defaultWidth = opts.defaultWidth ?? 640;

  if (!url) {
    return { src: '', srcSet: '', sizes: opts.sizes };
  }

  // Nicht-Supabase-URLs: unverändert lassen
  if (!url.includes(STORAGE_PUBLIC_MARKER)) {
    return { src: url, srcSet: '', sizes: opts.sizes };
  }

  const srcSet = widths
    .map((w) => `${getStorageImageUrl(url, { width: w, quality, resize })} ${w}w`)
    .join(', ');

  const src = getStorageImageUrl(url, { width: defaultWidth, quality, resize });

  return { src, srcSet, sizes: opts.sizes };
}
