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
 * Cloudflare Worker Image-Proxy Hostname.
 *
 * Warum: Supabase Storage's /object/public/ Endpoint sendet HARDCODED
 * `Cache-Control: no-cache`, unabhängig von dem `cacheControl`-Param beim
 * Upload. Folge: Cloudflare CDN bypassed den Edge-Cache (`REVALIDATED` auf
 * jedem Request) → 700ms-2.4s Latenz pro Bild bei jedem Page-Load.
 *
 * Lösung: Worker `caravanwert.de/img/<bucket>/<path>` proxied das Bild und
 * überschreibt Cache-Control mit `max-age=31536000, immutable`. Cloudflare
 * cached dann 1 Jahr im Edge → <50ms HIT global.
 *
 * In DEV (Vite localhost) bleibt es bei Original-URLs, da der Worker nur auf
 * caravanwert.de läuft.
 */
const IMAGE_PROXY_HOST = import.meta.env.DEV ? null : 'https://caravanwert.de';

/**
 * Erlaubte Resize-Breiten. MUSS deckungsgleich mit `ALLOWED_RESIZE_WIDTHS`
 * im Worker (`worker/src/index.js`) sein, sonst wird der Worker den Resize
 * ignorieren und das Original ausliefern.
 *
 * Whitelist verhindert dass jemand `?w=99999` spammed und den Edge-Cache
 * mit unique URLs flutet.
 */
export type AllowedResizeWidth = 320 | 480 | 640 | 768 | 960 | 1024 | 1280 | 1536 | 1920;

export interface ProxiedImageOptions {
  /** Zielbreite in Pixel. Muss eine `AllowedResizeWidth` sein. */
  width?: AllowedResizeWidth;
  /** JPEG-Qualität 30–95. Default 75 (Worker-seitig). */
  quality?: number;
}

/**
 * Wandelt eine Supabase Storage Public-URL in eine /img/-Proxy-URL um, die
 * über den Cloudflare Worker geht und CDN-cached wird.
 *
 * - Public-Storage-URLs (`/storage/v1/object/public/...`) → `caravanwert.de/img/...`
 * - Render-Image-URLs (`/storage/v1/render/image/public/...`) → unverändert
 *   (haben eigene Cache-Header von Supabase Image Transformation)
 * - Externe URLs, signed URLs, leere Strings → unverändert
 * - DEV-Mode (Vite) → unverändert (Worker läuft nur auf caravanwert.de)
 *
 * Mit `opts.width` aktiviert sich der **on-demand Resize**: Der Worker fetcht
 * die transformierte Variant via Supabase Image Transformation und cached sie
 * 1 Jahr im CF-Edge. So funktionieren Cards/Detail-Photos auch wenn die
 * `process-photo` Edge Function noch keine pre-baked `card_url`/`medium_url`
 * generiert hat — kein Fallback auf 5-MB-Originale mehr nötig.
 *
 * Sicher zu callen mit beliebigem String — niemals Crash, niemals Bruch.
 */
export function proxiedImageUrl(
  url: string | null | undefined,
  opts: ProxiedImageOptions = {},
): string {
  if (!url || typeof url !== 'string') return url ?? '';
  if (!IMAGE_PROXY_HOST) {
    // DEV-Mode: kein Worker → Fallback auf Supabase Image Transformation direkt,
    // damit DEV-Bilder ähnlich klein sind und das Layout nicht abweicht.
    if (opts.width) return getStorageImageUrl(url, { width: opts.width, quality: opts.quality ?? 75, resize: 'contain' });
    return url;
  }
  const idx = url.indexOf(STORAGE_PUBLIC_MARKER);
  if (idx === -1) return url;
  const subPath = url.substring(idx + STORAGE_PUBLIC_MARKER.length);
  const base = `${IMAGE_PROXY_HOST}/img/${subPath}`;
  if (!opts.width) return base;
  const q = opts.quality ? `&q=${opts.quality}` : '';
  return `${base}?w=${opts.width}${q}`;
}

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

  // Nicht-Supabase-URLs: unverändert lassen (oder schon /img/-Proxy-URLs vom Worker)
  if (!url.includes(STORAGE_PUBLIC_MARKER) && !url.includes('/img/')) {
    return { src: url, srcSet: '', sizes: opts.sizes };
  }

  // 2026-04-22: srcSet läuft jetzt über den CF-Worker /img/?w= Proxy statt
  // direkt über die Supabase /render/image/-URLs. Vorteil: Der Worker cached
  // die transformierten Variants 1 Jahr im CF-Edge (Supabase's eigene
  // Cache-Header sind kürzer + bypass-anfällig). Ergebnis: erste Anfrage
  // 200 ms (Supabase resize), alle weiteren <50 ms global vom CF-Edge.
  // Whitelist-Widths (siehe ProxiedImageOptions) müssen mit dem Worker
  // synchron sein — andernfalls fällt der Worker auf das Original zurück.
  const safeWidths = widths.filter((w): w is AllowedResizeWidth =>
    ([320, 480, 640, 768, 960, 1024, 1280, 1536, 1920] as number[]).includes(w),
  );
  const widthsToUse = safeWidths.length > 0 ? safeWidths : ([480, 1024] as AllowedResizeWidth[]);

  const srcSet = widthsToUse
    .map((w) => `${proxiedImageUrl(url, { width: w, quality })} ${w}w`)
    .join(', ');

  const defaultSafeWidth = (widthsToUse.includes(defaultWidth as AllowedResizeWidth)
    ? (defaultWidth as AllowedResizeWidth)
    : widthsToUse[Math.floor(widthsToUse.length / 2)]);
  const src = proxiedImageUrl(url, { width: defaultSafeWidth, quality });

  // resize-Parameter ist im Worker hardcoded `contain`. `getResponsiveImageProps`
  // exposed die Option nur für API-Konsistenz mit getStorageImageUrl.
  // (Wir nutzen sie hier explizit nicht, damit der Worker-Cache greift.)
  void resize;

  return { src, srcSet, sizes: opts.sizes };
}
