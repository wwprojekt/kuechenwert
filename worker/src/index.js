// Cloudflare Worker: Pre-Renderer + Edge-API-Cache für caravanwert.de
// Version: v8 (2026-04-20)
// Fixes: Robuste Meta-Tag-Entfernung, korrekter waitForSelector, robots.txt,
//        og:locale, twitter:image, optimierte robots-Direktive, Fallback-SEO,
//        synchrones Rendering für Bots, IndexNow-Integration für Bing
// v8:    /api/auctions/active Endpoint mit KV-Cache + Stale-While-Revalidate
//        (löst PostgREST-Latenz von 1-2 s auf 30-80 ms für Browse-Pages)

// ─── Bot Detection ──────────────────────────────────────────────────────────

const BOT_AGENTS = [
  "googlebot", "google-inspectiontool", "bingbot", "slurp", "duckduckbot",
  "baiduspider", "yandexbot", "sogou", "exabot", "ia_archiver",
  "facebookexternalhit", "facebot", "twitterbot", "linkedinbot",
  "pinterestbot", "whatsapp", "telegrambot", "slackbot", "discordbot",
  "chatgpt-user", "claudebot", "anthropic-ai", "perplexitybot",
  "cohere-ai", "gptbot", "google-extended", "bytespider",
  "semrushbot", "ahrefsbot", "mj12bot", "dotbot", "rogerbot",
  "screaming frog", "spider", "crawl", "bot/"
];

const SKIP_EXTENSIONS = [
  ".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
  ".woff", ".woff2", ".ttf", ".eot", ".map", ".json", ".xml",
  ".txt", ".pdf", ".zip", ".webp", ".avif", ".mp4", ".webm"
];

const SKIP_PATHS = [
  "/admin", "/dealer", "/api/", "/auth/", "/login", "/register",
  "/forgot-password", "/reset-password", "/supabase/", "/dashboard",
  "/verkaufen/danke", "/test-render"
];

const NOINDEX_PATHS = [
  "/datenschutz", "/agb", "/impressum", "/widerruf",
  "/verkaufen/danke", "/auth/confirm"
];

const CACHE_TTL = 60 * 60 * 24; // 24 hours

// ─── IndexNow Configuration ──────────────────────────────────────────────────

const INDEXNOW_KEY = "67fe483c8b4144049d80db9937f2374a";
const INDEXNOW_HOST = "caravanwert.de";
const INDEXNOW_ENDPOINTS = [
  "https://api.indexnow.org/indexnow",
  "https://www.bing.com/indexnow"
];

function isBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_AGENTS.some(bot => ua.includes(bot));
}

function shouldSkip(pathname) {
  if (SKIP_PATHS.some(p => pathname.startsWith(p))) return true;
  if (SKIP_EXTENSIONS.some(ext => pathname.endsWith(ext))) return true;
  return false;
}

function getCacheKey(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return `render:v6:${path}`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ─── SEO Route Data (injected at build time) ───────────────────────────────

const SEO_ROUTES = __SEO_ROUTES_PLACEHOLDER__;

// ─── Fallback SEO for unknown paths ────────────────────────────────────────

function getFallbackSeo(path) {
  const segments = path.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1] || "";
  const title = lastSegment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    title: `${title || "CaravanWert"} | CaravanWert`,
    description: `Informationen zu ${title || "Wohnmobil-Verkauf"} auf CaravanWert. Ihr Partner für Wohnmobil-Ankauf und Bewertung.`
  };
}

// ─── Meta-Tag Injection (robust, removes all existing SEO tags first) ──────

function injectMeta(html, path) {
  const seoData = SEO_ROUTES[path] || getFallbackSeo(path);
  const { title, description } = seoData;
  const canonicalUrl = "https://caravanwert.de" + path;

  const metaTags = `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="CaravanWert" />
    <meta property="og:image" content="https://caravanwert.de/og-image.png" />
    <meta property="og:locale" content="de_DE" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="https://caravanwert.de/og-image.png" />
    <meta name="robots" content="${NOINDEX_PATHS.some(p => path === p || path.startsWith(p + '/')) ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'}" />
  `;

  const noscriptContent = `
    <noscript>
      <div id="seo-content">
        <h1>${escapeHtml(title.replace(" | CaravanWert", ""))}</h1>
        <p>${escapeHtml(description)}</p>
        <nav>
          <a href="https://caravanwert.de/">Startseite</a> |
          <a href="https://caravanwert.de/verkaufen">Wohnmobil verkaufen</a> |
          <a href="https://caravanwert.de/kaufen">Wohnmobil kaufen</a> |
          <a href="https://caravanwert.de/ratgeber">Ratgeber</a> |
          <a href="https://caravanwert.de/kontakt">Kontakt</a>
        </nav>
      </div>
    </noscript>
  `;

  // Remove ALL existing SEO tags to prevent duplicates
  // This handles React Helmet tags (with data-rh attribute) and standard tags
  html = html.replace(/<title[^>]*>[^<]*<\/title>/gi, "");
  html = html.replace(/<meta\s+name=["']description["'][^>]*>/gi, "");
  html = html.replace(/<meta\s+name=["']robots["'][^>]*>/gi, "");
  html = html.replace(/<meta\s+name=["']keywords["'][^>]*>/gi, "");
  html = html.replace(/<link[^>]*rel=["']canonical["'][^>]*>/gi, "");
  html = html.replace(/<meta\s+property=["']og:[^"']*["'][^>]*>/gi, "");
  html = html.replace(/<meta\s+name=["']twitter:[^"']*["'][^>]*>/gi, "");

  // Inject our clean meta tags before </head>
  html = html.replace("</head>", metaTags + "\n  </head>");

  // Inject noscript content after root div (for crawlers without JS)
  html = html.replace(
    '<div id="root"></div>',
    '<div id="root"></div>' + noscriptContent
  );

  return html;
}

// ─── robots.txt (consolidated, overrides Cloudflare managed) ───────────────

function getRobotsTxt() {
  return `# robots.txt for CaravanWert
# https://caravanwert.de
# Last updated: 2026-03-24

# Default: Allow all search engine crawlers
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /dashboard/
Disallow: /auth/
Disallow: /login
Disallow: /register
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /verkaufen/danke

# Google Ads bots (critical for Google Ads compliance)
User-agent: AdsBot-Google
Allow: /

User-agent: AdsBot-Google-Mobile
Allow: /

# Block AI training bots
User-agent: Amazonbot
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: GPTBot
Disallow: /

User-agent: meta-externalagent
Disallow: /

# Sitemap location
Sitemap: https://caravanwert.de/sitemap.xml
`;
}

// ─── IndexNow Submission ─────────────────────────────────────────────────────

async function submitToIndexNow(urls) {
  if (!urls || urls.length === 0) return;

  const urlList = urls.map(path => `https://${INDEXNOW_HOST}${path}`);

  const body = JSON.stringify({
    host: INDEXNOW_HOST,
    key: INDEXNOW_KEY,
    keyLocation: `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`,
    urlList
  });

  const results = await Promise.allSettled(
    INDEXNOW_ENDPOINTS.map(endpoint =>
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body
      }).then(async (res) => {
        console.log(`IndexNow ${endpoint}: ${res.status}`);
        return res.status;
      })
    )
  );

  return results;
}

// ─── REST API Browser Rendering (synchronous, correct selector) ────────────

async function renderWithRestApi(url, env) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/content`,
    {
      method: "POST",
      headers: {
        "X-Auth-Key": env.CF_API_KEY,
        "X-Auth-Email": env.CF_API_EMAIL,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url,
        rejectResourceTypes: ["image", "font", "media"],
        waitForSelector: {
          selector: "h1, h2, main, footer",
          timeout: 15000
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`REST API ${response.status}: ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  if (!data.success || !data.result) {
    throw new Error("REST API returned no result");
  }
  return data.result;
}

// ─── Edge-API-Cache (Phase 1: /api/auctions/active) ────────────────────────
//
// Warum: Frontend-Direktaufrufe an PostgREST kosten 1-2 s pro Query (Network +
// PostgREST-Compile + JSON-Serialize). Bei 30 s Polling auf /kaufen × N offene
// Tabs entsteht messbare Last + spürbare Wartezeit beim Page-Open.
//
// Strategie: KV als Read-Cache mit Stale-While-Revalidate.
//   FRESH   (≤ 30 s alt)  → sofort ausliefern
//   STALE   (≤ 90 s alt)  → sofort ausliefern + Hintergrund-Refresh
//   EXPIRED (> 90 s alt)  → synchroner Refresh (= heutiges Verhalten als Worst-Case)
//
// Cache-Key versioniert (`v1`) damit wir bei Schema-Änderungen sauber rotieren
// können ohne KV-Purge.

const AUCTIONS_API_PATH = "/api/auctions/active";
// v3 (2026-04-21): photoMap URLs jetzt durch /img/-Proxy geleitet → alter
// Cache mit raw Supabase-URLs muss rotiert werden, sonst landen User noch
// 5 Min lang auf den langsamen no-cache-URLs.
// v4 (2026-04-25): start_time + auction_round ergänzt für "Neu"-Badge
// (siehe src/lib/freshBadge.ts). Key muss rotieren, sonst fehlen die
// Felder im bestehenden KV-Eintrag → Badge erscheint erst nach
// AUCTIONS_KV_TTL (5 min).
const AUCTIONS_CACHE_KEY = "api:auctions:active:v4";
const AUCTIONS_FRESH_MS = 30 * 1000;   // 30 s frisch
const AUCTIONS_STALE_MS = 90 * 1000;   // 90 s gesamt (60 s SWR-Fenster)
const AUCTIONS_KV_TTL = 300;           // 5 min hard-expire (Sicherheitsnetz)

// ─── Edge-API-Cache (Phase 2: /api/auctions/:id) ───────────────────────────
//
// Auctions-Detail-Page (/auktion/:id) macht heute 3 Direktcalls an PostgREST:
//   1) auctions  (mit motorhome + photos joined) — die langsamste, 1-3s wenn
//      Supabase normal, BIS 41s wenn Gateway hickt (gemessen 2026-04-21).
//   2) bids      (alle bids für diese Auktion, ~50-200ms)
//   3) auction_addenda (~50ms, meist leer)
//
// Wir bündeln alle drei in EINEM Worker-Endpoint /api/auctions/:id, cachen
// das Bundle für 30s FRESH / 90s STALE im KV, und das Frontend bekommt eine
// Antwort in 30-80ms statt 1-3s.
//
// Race-Condition-Diskussion:
//   - User öffnet Page mit 30s altem Cache → Realtime-Channel (bleibt direkt
//     zu Supabase WebSocket) füllt frische Bids in ~500ms nach.
//   - place_bid_atomic RPC validiert serverseitig mit Advisory-Lock →
//     veraltete Daten können kein "Stealing" verursachen.
//   - Identisches Race-Window wie heute (Network-Roundtrip ist auch 1-3s).
//
// Sicherheit:
//   - Whitelist EXAKT wie in src/pages/AuctionDetail.tsx Zeile 339-360.
//     KEINE seller_initial_* Spalten — sonst könnte jeder den Reserve-Floor
//     zurückrechnen.
//   - Anon-Key-Permissions begrenzen die Daten ohnehin (RLS auf auctions ist
//     USING(true), reserve_price ist absichtlich public).
const AUCTION_DETAIL_PATH_RE = /^\/api\/auctions\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const AUCTION_DETAIL_CACHE_PREFIX = "api:auction:detail:v1:";
const AUCTION_DETAIL_FRESH_MS = 30 * 1000;
const AUCTION_DETAIL_STALE_MS = 90 * 1000;
const AUCTION_DETAIL_KV_TTL = 300;
// Negative-Cache (404 / not-found) kürzer halten damit eine soeben angelegte
// Auktion schnell sichtbar wird (max 30s Verzögerung statt 5 min).
const AUCTION_DETAIL_NOTFOUND_KV_TTL = 30;

// ─── Edge-API-Cache (Phase 3: /api/site-settings) ───────────────────────────
//
// SettingsContext lädt `public_site_settings` bei JEDEM ersten Page-Mount.
// Bei ~2.4k Page-Loads/24h sind das 2.4k PostgREST-Calls/Tag fuer Daten die
// sich praktisch NIE aendern (nur wenn der Admin im Backend etwas updated).
//
// Strategie: aggressives FRESH-Window (5 min) + langer STALE-Window (30 min).
// Worst-Case-Latenz fuer Admin-Aenderungen: 5 min bis User die neue Logo-URL /
// Brand-Color sehen. Akzeptabel, weil Settings-Aenderungen extrem selten sind
// und der Admin beim Speichern eh seine eigene Page neu laden kann (bypassed
// den Cache durch Reload + Origin-Hit).
//
// Effekt: 2.400 Supabase-Calls/24h -> ~24 (Worker poll alle 5 min wenn Traffic
// da ist). Spart ~99% der site-settings Last.
//
// Logo-URL wird hier auch durch /img/-Proxy geleitet, sodass das Logo gleich
// aus dem CF-Edge-Cache geladen wird (frueher: Supabase Storage no-cache).
const SITE_SETTINGS_API_PATH = "/api/site-settings";
const SITE_SETTINGS_CACHE_KEY = "api:site_settings:v1";
const SITE_SETTINGS_FRESH_MS = 5 * 60 * 1000;   // 5 min frisch
const SITE_SETTINGS_STALE_MS = 30 * 60 * 1000;  // 30 min stale-while-revalidate
const SITE_SETTINGS_KV_TTL = 60 * 60;           // 1h hard-expire
const SITE_SETTINGS_ID = "00000000-0000-0000-0000-000000000000";
// Whitelist 1:1 aus src/pages/AuctionDetail.tsx Z.339-360 übernommen.
// Bei Änderungen dort BEIDE Stellen aktualisieren!
const AUCTION_DETAIL_SELECT =
  "id,motorhome_id,status,starting_bid,current_bid,reserve_price," +
  "start_time,end_time,created_at,updated_at,kaufchance_expires_at," +
  "kaufchance_min_price,soft_close_extension_minutes,auction_round," +
  "marketing_phase_started_at,last_price_reduction_at," +
  "motorhome:motorhomes!left(*,photos:motorhome_photos(*))";

// On-the-fly Image-Transformation Fallback für Photos OHNE pre-resized Variant
// (process-photo Edge Function noch nicht durchgelaufen oder original zu gross).
// Bei /kaufen sind das aktuell 44 von 77 active covers — die werden sonst als
// 1-13 MB Original-JPG ausgeliefert und blockieren die Page-Load.
//
// Supabase Image Transformation: <project>/storage/v1/render/image/public/<path>
// Cloudflare cached die Antwort ans Edge (1 Jahr immutable), Pro-Plan-Quota
// 100k/month, gezählt nur per unique URL → kein Skalierungsproblem.
const STORAGE_OBJECT_PREFIX = "/storage/v1/object/public/";
const STORAGE_RENDER_PREFIX = "/storage/v1/render/image/public/";

// Image-Proxy: caravanwert.de/img/<bucket>/<path> → Supabase Storage Public-URL.
//
// Warum: Supabase Storage's /object/public/ Endpoint sendet HARDCODED
// `Cache-Control: no-cache`, unabhängig von dem was wir beim Upload setzen.
// Folge: Cloudflare CDN bypasst den Edge-Cache (`cf-cache-status: REVALIDATED`
// auf jedem Request) → jeder User-Request triggert einen Origin-Roundtrip
// zu Supabase (700ms-2.4s pro Bild gemessen 2026-04-21).
//
// Lösung: Worker fetched das Bild von Supabase EINMAL, liefert es mit
// `Cache-Control: public, max-age=31536000, immutable` zurück, und Cloudflare
// cached es 1 Jahr im Edge. Subsequent Requests: <50ms HIT weltweit.
//
// Sicherheit: Wir proxien NUR /storage/v1/object/public/ — keine signed URLs,
// keine privaten Buckets. Path-Traversal (`..`, `\`) wird gefiltert.
const IMAGE_PROXY_PREFIX = "/img/";

function proxiedImageUrl(supabaseUrl, opts) {
  if (!supabaseUrl || typeof supabaseUrl !== "string") return supabaseUrl;
  const idx = supabaseUrl.indexOf(STORAGE_OBJECT_PREFIX);
  if (idx === -1) return supabaseUrl;
  const subPath = supabaseUrl.substring(idx + STORAGE_OBJECT_PREFIX.length);
  const base = `https://caravanwert.de${IMAGE_PROXY_PREFIX}${subPath}`;
  if (opts && opts.width) {
    const q = opts.quality ? `&q=${opts.quality}` : "";
    return `${base}?w=${opts.width}${q}`;
  }
  return base;
}

// 2026-04-22: transformImageUrl() entfernt. Direkte Supabase /render/image/-URLs
// werden nicht mehr ans Frontend ausgeliefert — stattdessen IMMER über
// /img/?w= via proxiedImageUrl(url, { width, quality }), damit der CF-Edge-Cache
// 1 Jahr immutable greifen kann (statt Supabase's eigene kürzere Cache-Header).

// Erlaubte Resize-Breiten — Whitelist verhindert dass jemand
// `?w=99999` spammed und den Edge-Cache mit unique URLs flutet
// (jede unique URL = ein KV-Slot + ein Supabase-Image-Transform-Quota-Hit).
// Deckt Card (480), Medium (1024), 2x-DPR (1920), Mobile (320, 640) ab.
const ALLOWED_RESIZE_WIDTHS = new Set([320, 480, 640, 768, 960, 1024, 1280, 1536, 1920]);
const DEFAULT_RESIZE_QUALITY = 75;

async function handleImageProxy(request, env, ctx) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const url = new URL(request.url);
  // /img/<bucket>/<path> → bucket/path
  const subPath = url.pathname.substring(IMAGE_PROXY_PREFIX.length);

  // Path-Traversal verhindern, leere Pfade ablehnen.
  if (!subPath || subPath.includes("..") || subPath.includes("\\")) {
    return new Response("Bad Request", { status: 400 });
  }

  // ── On-Demand Resize via Supabase Image Transformation ─────────────────
  // 2026-04-22: ?w=<width>&q=<quality> wird unterstützt. Wenn vorhanden,
  // routen wir nach /storage/v1/render/image/public/ statt /object/public/
  // und Supabase resized das Original on-the-fly. Cloudflare cached die
  // Response 1 Jahr im Edge — also wird Supabase pro unique URL nur EINMAL
  // belastet. Quota: Supabase Pro = 100k Origin-Bilder/Monat (= unique
  // (path, w, q) Kombinationen).
  //
  // Effekt: Wir brauchen process-photo Edge Function nicht mehr — alle
  // Variants entstehen on-demand und werden dauerhaft gecached.
  // process-photo bleibt als Backup-System (pre-bake card_url, medium_url),
  // aber wenn es crasht, fängt der /img/?w=-Fallback alles auf.
  const requestedW = parseInt(url.searchParams.get("w") || "", 10);
  const requestedQ = parseInt(url.searchParams.get("q") || "", 10);
  const useResize = Number.isFinite(requestedW) && ALLOWED_RESIZE_WIDTHS.has(requestedW);
  const resizeWidth = useResize ? requestedW : null;
  const resizeQuality = (useResize && Number.isFinite(requestedQ) && requestedQ >= 30 && requestedQ <= 95)
    ? requestedQ
    : DEFAULT_RESIZE_QUALITY;

  // Cache-API: hostet die transformierte Antwort 1 Jahr im CF Edge,
  // unabhängig vom Upstream-Cache-Control-Header.
  // Cache-Key MUSS Width + Quality enthalten, sonst kollidieren resized
  // Variants mit dem Original.
  const cache = caches.default;
  const cacheKeyUrl = useResize
    ? `https://caravanwert.de${url.pathname}?w=${resizeWidth}&q=${resizeQuality}`
    : `https://caravanwert.de${url.pathname}`;
  const cacheKey = new Request(cacheKeyUrl, { method: "GET" });

  let cached = await cache.match(cacheKey);
  if (cached) {
    // Edge HIT — Response liefert direkt aus dem CF-Edge-Cache (<50 ms global).
    // Headers neu bauen damit wir x-image-proxy=HIT setzen können (Response
    // headers sind in CF Workers immutable, deshalb kein direktes set).
    const headers = new Headers(cached.headers);
    headers.set("x-image-proxy", "HIT");
    return new Response(cached.body, {
      status: cached.status,
      statusText: cached.statusText,
      headers,
    });
  }

  // Edge MISS — von Supabase Storage holen.
  // Bei Resize: /render/image/public/ Endpoint, sonst /object/public/.
  const upstreamUrl = useResize
    ? `${env.SUPABASE_URL}/storage/v1/render/image/public/${subPath}?width=${resizeWidth}&quality=${resizeQuality}&resize=contain`
    : `${env.SUPABASE_URL}/storage/v1/object/public/${subPath}`;
  const upstreamRes = await fetch(upstreamUrl, {
    cf: {
      // CF eigener Image-Cache zusätzlich aktivieren, ignoriert Origin-Header.
      cacheTtl: 31536000,
      cacheEverything: true,
    },
  });

  if (!upstreamRes.ok) {
    // Errors NICHT cachen — wenn das Bild später existiert, soll es geladen werden.
    return new Response("Image not found", {
      status: upstreamRes.status,
      headers: { "cache-control": "no-store" },
    });
  }

  // Neue Response mit überschriebenen Cache-Headers bauen.
  // Body komplett lesen damit wir 2× verwenden können (Response + Cache.put).
  const body = await upstreamRes.arrayBuffer();
  const response = new Response(body, {
    status: 200,
    headers: {
      "content-type":
        upstreamRes.headers.get("content-type") || "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
      "x-image-proxy": "MISS",
      "access-control-allow-origin": "*",
    },
  });

  // Im Edge cachen — non-blocking, damit der User nicht warten muss.
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

function corsHeaders() {
  // Same-origin in Production (caravanwert.de → caravanwert.de/api/...) braucht
  // theoretisch kein CORS, aber wir setzen es defensiv damit auch
  // localhost-Dev (Vite Port 8080) gegen den live Worker testen kann.
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400"
  };
}

function jsonResponse(payload, status, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(),
      ...extraHeaders
    }
  });
}

async function fetchAuctionsFromSupabase(env) {
  // Identisch zur Frontend-Query in src/pages/Kaufen.tsx (3 parallele Calls)
  // damit das Antwort-Format 1:1 kompatibel ist.
  const supabaseBase = `${env.SUPABASE_URL}/rest/v1`;
  const headers = {
    apikey: env.SUPABASE_ANON_KEY,
    authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
    accept: "application/json"
  };
  const nowIso = new Date().toISOString();

  // 1) Auktionen + Motorhomes (nested embed)
  const auctionsUrl = `${supabaseBase}/auctions?select=` +
    encodeURIComponent(
      "id,motorhome_id,current_bid,starting_bid,end_time,created_at," +
      "start_time,auction_round," +
      "last_price_reduction_at,marketing_phase_started_at," +
      "motorhome:motorhomes(id,manufacturer,model,year,mileage,listing_number," +
      "body_type,country,postal_code,instant_price,sale_channel,status," +
      "account_type,sleeping_places,transmission,accident_free)"
    ) +
    `&status=eq.active&end_time=gt.${encodeURIComponent(nowIso)}` +
    `&order=end_time.asc`;

  // 2) Bid-Counts (auction_id only, gefiltert auf aktive Auktionen)
  const bidsUrl = `${supabaseBase}/bids?select=` +
    encodeURIComponent("auction_id,auction:auctions!inner(status,end_time)") +
    `&auction.status=eq.active&auction.end_time=gt.${encodeURIComponent(nowIso)}`;

  const [auctionsRes, bidsRes] = await Promise.all([
    fetch(auctionsUrl, { headers }),
    fetch(bidsUrl, { headers })
  ]);

  if (!auctionsRes.ok) {
    throw new Error(`auctions fetch ${auctionsRes.status}: ${await auctionsRes.text()}`);
  }
  if (!bidsRes.ok) {
    throw new Error(`bids fetch ${bidsRes.status}: ${await bidsRes.text()}`);
  }

  const auctions = await auctionsRes.json();
  const bids = await bidsRes.json();

  // 3) Cover-Photos (display_order=0) — separat weil PostgREST nested order/limit
  // bei verschachtelten Embeds buggy ist (siehe Kommentar in Kaufen.tsx).
  const motorhomeIds = auctions
    .map((a) => a.motorhome_id)
    .filter(Boolean);

    let photoMap = {};
    if (motorhomeIds.length > 0) {
      const photosUrl = `${supabaseBase}/motorhome_photos?select=` +
        encodeURIComponent("url,card_url,medium_url,motorhome_id") +
        `&display_order=eq.0&motorhome_id=in.(${motorhomeIds.join(",")})`;

      const photosRes = await fetch(photosUrl, { headers });
      if (photosRes.ok) {
        const rows = await photosRes.json();
        for (const p of rows) {
          if (!p.motorhome_id) continue;
          if (!p.url && !p.card_url && !p.medium_url) continue;

          // 2026-04-22: Vereinfacht. Wir nutzen IMMER /img/?w= via Worker-Proxy
          // mit on-demand Resize. Kein Unterschied mehr zwischen "pre-baked
          // card_url existiert" und "muss neu generiert werden":
          //
          // - p.url ist die Original-URL (immer vorhanden bei legitimen Photos)
          //   → /img/<path>?w=480&q=70 für Cards, ?w=1024&q=75 für Detail
          // - p.card_url / p.medium_url werden ignoriert (waren nur Optimization
          //   für den Fall dass Image-Transformation off war — jetzt obsolet)
          //
          // Vorteil: process-photo Edge Function wird irrelevant. Wenn sie crasht,
          // crashed nichts mehr im Frontend. CF-Edge-Cache 1 Jahr immutable
          // → erste Anfrage 200ms, alle weiteren <50ms.
          //
          // Quota-Discipline: Nur whitelisted Widths (480, 1024) werden hier
          // generiert, also max 2 unique URLs pro Photo → weit unter dem
          // Pro-Plan-Limit von 100k Origin-Bilder/Monat.
          const sourceUrl = p.url || p.card_url || p.medium_url;
          if (!sourceUrl) continue;
          photoMap[p.motorhome_id] = {
            url: proxiedImageUrl(sourceUrl, { width: 480, quality: 70 }),
            medium_url: proxiedImageUrl(sourceUrl, { width: 1024, quality: 75 }),
            display_order: 0
          };
        }
      }
      // Photo-Fehler ist non-blocking (wie im Frontend)
    }

  // Bid-Counts aggregieren
  const bidCounts = {};
  for (const b of bids) {
    bidCounts[b.auction_id] = (bidCounts[b.auction_id] || 0) + 1;
  }

  // Stitch: Photo ins motorhome.photos[]-Array hängen (Frontend-kompatibel)
  const stitched = auctions.map((a) => {
    const cover = a.motorhome_id ? photoMap[a.motorhome_id] : null;
    return {
      ...a,
      motorhome: a.motorhome
        ? { ...a.motorhome, photos: cover ? [cover] : [] }
        : null
    };
  });

  return {
    auctions: stitched,
    bidCounts,
    generatedAt: new Date().toISOString()
  };
}

async function refreshAuctionsCache(env) {
  const fresh = await fetchAuctionsFromSupabase(env);
  const now = Date.now();
  const envelope = {
    data: fresh,
    fetchedAt: now,
    freshUntil: now + AUCTIONS_FRESH_MS,
    staleUntil: now + AUCTIONS_STALE_MS
  };
  // KV-Write ist eventually consistent (max ~60 s Propagation), das ist OK
  // weil unser Stale-Window 60 s ist — schlimmstenfalls hat ein anderer PoP
  // noch kurz die alten Daten, was unter dem Polling-Intervall liegt.
  await env.PRERENDER_CACHE.put(AUCTIONS_CACHE_KEY, JSON.stringify(envelope), {
    expirationTtl: AUCTIONS_KV_TTL
  });
  return envelope;
}

// ── Auction-Detail-Bundle: auction + bids + addenda in einem Roundtrip ──

async function fetchAuctionDetailFromSupabase(id, env) {
  const base = `${env.SUPABASE_URL}/rest/v1`;
  const headers = {
    apikey: env.SUPABASE_ANON_KEY,
    authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
    accept: "application/json",
  };

  const auctionUrl =
    `${base}/auctions?select=${encodeURIComponent(AUCTION_DETAIL_SELECT)}` +
    `&id=eq.${id}`;
  const bidsUrl =
    `${base}/bids?select=*&auction_id=eq.${id}&order=created_at.desc`;
  const addendaUrl =
    `${base}/auction_addenda?select=id,content,created_at` +
    `&auction_id=eq.${id}&order=created_at.asc`;

  // Parallele Fetches — bids + addenda dürfen schiefgehen ohne dass die
  // ganze Antwort kaputt ist (das Frontend tolerierte das bisher auch).
  const [aRes, bRes, addRes] = await Promise.all([
    fetch(auctionUrl, { headers }),
    fetch(bidsUrl, { headers }),
    fetch(addendaUrl, { headers }),
  ]);

  if (!aRes.ok) {
    throw new Error(`auction fetch ${aRes.status}: ${await aRes.text()}`);
  }
  const auctionArr = await aRes.json();
  const auction = auctionArr[0] || null;

  if (!auction) {
    return { auction: null, bids: [], addenda: [], notFound: true };
  }

  // Photo-URLs durch Image-Proxy leiten — gleicher Trick wie /active.
  // Schützt vor Supabase Storage's hardcoded Cache-Control: no-cache.
  // 2026-04-22: card_url/medium_url werden zusätzlich on-demand-resized
  // via /img/?w= URLs ersetzt, sodass das Frontend bei NULL card_url
  // automatisch auf das Original mit Resize fällt — ohne process-photo
  // Edge Function-Abhängigkeit.
  if (auction.motorhome && Array.isArray(auction.motorhome.photos)) {
    auction.motorhome.photos = auction.motorhome.photos.map((p) => {
      const sourceUrl = p.url || p.card_url || p.medium_url;
      return {
        ...p,
        url: proxiedImageUrl(p.url),
        // Falls pre-baked Variant existiert, nutzen wir sie (kostenlos & schon im Cache).
        // Falls nicht, resized der Worker on-demand vom Original.
        card_url: p.card_url
          ? proxiedImageUrl(p.card_url)
          : (sourceUrl ? proxiedImageUrl(sourceUrl, { width: 480, quality: 70 }) : null),
        medium_url: p.medium_url
          ? proxiedImageUrl(p.medium_url)
          : (sourceUrl ? proxiedImageUrl(sourceUrl, { width: 1024, quality: 75 }) : null),
      };
    });
  }

  const bids = bRes.ok ? await bRes.json() : [];
  const addenda = addRes.ok ? await addRes.json() : [];

  return {
    auction,
    bids: Array.isArray(bids) ? bids : [],
    addenda: Array.isArray(addenda) ? addenda : [],
    notFound: false,
  };
}

async function refreshAuctionDetailCache(id, env) {
  const fresh = await fetchAuctionDetailFromSupabase(id, env);
  const now = Date.now();
  const envelope = {
    data: fresh,
    fetchedAt: now,
    freshUntil: now + AUCTION_DETAIL_FRESH_MS,
    staleUntil: now + AUCTION_DETAIL_STALE_MS,
  };
  // Negative-Cache (auction not found) kürzer aufbewahren — sonst sehen User
  // eine soeben angelegte Auktion 5 Min lang als 404.
  const ttl = fresh.notFound
    ? AUCTION_DETAIL_NOTFOUND_KV_TTL
    : AUCTION_DETAIL_KV_TTL;
  await env.PRERENDER_CACHE.put(
    `${AUCTION_DETAIL_CACHE_PREFIX}${id}`,
    JSON.stringify(envelope),
    { expirationTtl: ttl },
  );
  return envelope;
}

async function handleAuctionDetailApi(request, env, ctx, id) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== "GET") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return jsonResponse({ error: "supabase env not configured" }, 500);
  }

  const cacheKey = `${AUCTION_DETAIL_CACHE_PREFIX}${id.toLowerCase()}`;
  const now = Date.now();

  let cached = null;
  try {
    cached = await env.PRERENDER_CACHE.get(cacheKey, { type: "json" });
  } catch (e) {
    console.error("KV read error:", e.message);
  }

  // FRESH path
  if (cached && now < cached.freshUntil) {
    if (cached.data && cached.data.notFound) {
      return jsonResponse({ error: "not found" }, 404, {
        "x-cache-status": "FRESH",
        "x-cache-age-ms": String(now - cached.fetchedAt),
        "cache-control": "public, max-age=30",
      });
    }
    return jsonResponse(cached.data, 200, {
      "x-cache-status": "FRESH",
      "x-cache-age-ms": String(now - cached.fetchedAt),
      "cache-control": "public, max-age=30",
    });
  }

  // STALE path: serve cached, refresh in background
  if (cached && now < cached.staleUntil) {
    ctx.waitUntil(
      refreshAuctionDetailCache(id, env).catch((e) =>
        console.error("background refresh failed:", e.message),
      ),
    );
    if (cached.data && cached.data.notFound) {
      return jsonResponse({ error: "not found" }, 404, {
        "x-cache-status": "STALE",
        "x-cache-age-ms": String(now - cached.fetchedAt),
        "cache-control": "public, max-age=30",
      });
    }
    return jsonResponse(cached.data, 200, {
      "x-cache-status": "STALE",
      "x-cache-age-ms": String(now - cached.fetchedAt),
      "cache-control": "public, max-age=30",
    });
  }

  // MISS / EXPIRED path: sync refresh, fall back to stale data on error
  try {
    const fresh = await refreshAuctionDetailCache(id, env);
    if (fresh.data && fresh.data.notFound) {
      return jsonResponse({ error: "not found" }, 404, {
        "x-cache-status": "MISS",
        "x-cache-age-ms": "0",
        "cache-control": "public, max-age=30",
      });
    }
    return jsonResponse(fresh.data, 200, {
      "x-cache-status": "MISS",
      "x-cache-age-ms": "0",
      "cache-control": "public, max-age=30",
    });
  } catch (e) {
    console.error("auction detail sync refresh failed:", e.message);
    if (cached) {
      // Notnagel: alte Daten liefern auch wenn längst stale, damit User auch
      // bei totaler Supabase-Outage noch eine funktionsfähige Page sieht.
      return jsonResponse(cached.data, 200, {
        "x-cache-status": "EMERGENCY",
        "x-cache-age-ms": String(now - cached.fetchedAt),
        "cache-control": "public, max-age=10",
      });
    }
    return jsonResponse(
      { error: "upstream unavailable", message: e.message },
      502,
    );
  }
}

async function handleAuctionsApi(request, env, ctx) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== "GET") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return jsonResponse({ error: "supabase env not configured" }, 500);
  }

  const now = Date.now();

  // 1) Cache lesen
  let cached = null;
  try {
    cached = await env.PRERENDER_CACHE.get(AUCTIONS_CACHE_KEY, { type: "json" });
  } catch (e) {
    console.error("KV read error:", e.message);
  }

  // 2) FRESH path
  if (cached && now < cached.freshUntil) {
    return jsonResponse(cached.data, 200, {
      "x-cache-status": "FRESH",
      "x-cache-age-ms": String(now - cached.fetchedAt),
      "cache-control": "public, max-age=30"
    });
  }

  // 3) STALE path: serve cached, refresh in background
  if (cached && now < cached.staleUntil) {
    ctx.waitUntil(
      refreshAuctionsCache(env).catch((e) =>
        console.error("background refresh failed:", e.message)
      )
    );
    return jsonResponse(cached.data, 200, {
      "x-cache-status": "STALE",
      "x-cache-age-ms": String(now - cached.fetchedAt),
      "cache-control": "public, max-age=30"
    });
  }

  // 4) MISS / EXPIRED path: sync refresh, fall back to stale data on error
  try {
    const fresh = await refreshAuctionsCache(env);
    return jsonResponse(fresh.data, 200, {
      "x-cache-status": "MISS",
      "x-cache-age-ms": "0",
      "cache-control": "public, max-age=30"
    });
  } catch (e) {
    console.error("auctions sync refresh failed:", e.message);
    if (cached) {
      // Letzter Notnagel: alte Daten ausliefern auch wenn längst stale
      return jsonResponse(cached.data, 200, {
        "x-cache-status": "EMERGENCY",
        "x-cache-age-ms": String(now - cached.fetchedAt),
        "cache-control": "public, max-age=10"
      });
    }
    return jsonResponse(
      { error: "upstream unavailable", message: e.message },
      502
    );
  }
}

// ── Site-Settings-Bundle: site_name, logo_url, brand colors, tracking ──

async function fetchSiteSettingsFromSupabase(env) {
  const url =
    `${env.SUPABASE_URL}/rest/v1/public_site_settings` +
    `?select=*&id=eq.${SITE_SETTINGS_ID}&limit=1`;
  const headers = {
    apikey: env.SUPABASE_ANON_KEY,
    authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
    accept: "application/json",
  };

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`site_settings fetch ${res.status}: ${await res.text()}`);
  }
  const arr = await res.json();
  const settings = Array.isArray(arr) && arr[0] ? arr[0] : null;
  if (!settings) {
    throw new Error("site_settings: no row found for default id");
  }

  // Logo + Favicon + TUEV-Badge durchs /img/-Proxy leiten, damit sie
  // 1 Jahr im CF-Edge gecached werden. Frontend's SiteLogo nutzt zwar bereits
  // proxiedImageUrl(), aber so funktioniert es auch fuer Komponenten die das
  // logo_url direkt verwenden (Favicon-Tag, og:image-Fallback, Email-Templates).
  if (settings.logo_url) settings.logo_url = proxiedImageUrl(settings.logo_url);
  if (settings.favicon_url) settings.favicon_url = proxiedImageUrl(settings.favicon_url);
  if (settings.tuv_badge_url) settings.tuv_badge_url = proxiedImageUrl(settings.tuv_badge_url);

  return settings;
}

async function refreshSiteSettingsCache(env) {
  const fresh = await fetchSiteSettingsFromSupabase(env);
  const now = Date.now();
  const envelope = {
    data: fresh,
    fetchedAt: now,
    freshUntil: now + SITE_SETTINGS_FRESH_MS,
    staleUntil: now + SITE_SETTINGS_STALE_MS,
  };
  await env.PRERENDER_CACHE.put(
    SITE_SETTINGS_CACHE_KEY,
    JSON.stringify(envelope),
    { expirationTtl: SITE_SETTINGS_KV_TTL },
  );
  return envelope;
}

async function handleSiteSettingsApi(request, env, ctx) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== "GET") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return jsonResponse({ error: "supabase env not configured" }, 500);
  }

  const now = Date.now();

  let cached = null;
  try {
    cached = await env.PRERENDER_CACHE.get(SITE_SETTINGS_CACHE_KEY, {
      type: "json",
    });
  } catch (e) {
    console.error("KV read error (site_settings):", e.message);
  }

  if (cached && now < cached.freshUntil) {
    return jsonResponse(cached.data, 200, {
      "x-cache-status": "FRESH",
      "x-cache-age-ms": String(now - cached.fetchedAt),
      "cache-control": "public, max-age=300",
    });
  }

  if (cached && now < cached.staleUntil) {
    ctx.waitUntil(
      refreshSiteSettingsCache(env).catch((e) =>
        console.error("background refresh failed (site_settings):", e.message),
      ),
    );
    return jsonResponse(cached.data, 200, {
      "x-cache-status": "STALE",
      "x-cache-age-ms": String(now - cached.fetchedAt),
      "cache-control": "public, max-age=300",
    });
  }

  try {
    const fresh = await refreshSiteSettingsCache(env);
    return jsonResponse(fresh.data, 200, {
      "x-cache-status": "MISS",
      "x-cache-age-ms": "0",
      "cache-control": "public, max-age=300",
    });
  } catch (e) {
    console.error("site_settings sync refresh failed:", e.message);
    if (cached) {
      // Notnagel: alte Daten ausliefern auch wenn KV abgelaufen — die
      // Page rendert ohne Branding-Informationen sonst kaputt.
      return jsonResponse(cached.data, 200, {
        "x-cache-status": "EMERGENCY",
        "x-cache-age-ms": String(now - cached.fetchedAt),
        "cache-control": "public, max-age=10",
      });
    }
    return jsonResponse(
      { error: "upstream unavailable", message: e.message },
      502,
    );
  }
}

// ─── Main Worker ────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const userAgent = request.headers.get("user-agent") || "";

    // ── Image-Proxy: /img/* (höchste Priorität, vor allem anderen) ──
    // Überschreibt Supabase Storage's no-cache mit max-age=1Jahr.
    if (url.pathname.startsWith(IMAGE_PROXY_PREFIX)) {
      return handleImageProxy(request, env, ctx);
    }

    // ── Edge-API-Cache: /api/auctions/active (vor allen anderen Checks) ──
    // Wir behandeln auch OPTIONS hier, daher steht es vor dem GET-Filter.
    if (url.pathname === AUCTIONS_API_PATH) {
      return handleAuctionsApi(request, env, ctx);
    }

    // ── Edge-API-Cache: /api/site-settings (Logo, Brand-Colors, Tracking) ──
    if (url.pathname === SITE_SETTINGS_API_PATH) {
      return handleSiteSettingsApi(request, env, ctx);
    }

    // ── Edge-API-Cache: /api/auctions/:uuid (Detail-Page) ──
    const detailMatch = url.pathname.match(AUCTION_DETAIL_PATH_RE);
    if (detailMatch) {
      return handleAuctionDetailApi(request, env, ctx, detailMatch[1]);
    }

    // Only handle GET requests
    if (request.method !== "GET") {
      return fetch(request);
    }

    // Serve IndexNow key verification file
    if (url.pathname === `/${INDEXNOW_KEY}.txt`) {
      return new Response(INDEXNOW_KEY + "\n", {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "public, max-age=86400"
        }
      });
    }

    // Handle IndexNow bulk submission trigger (protected by secret header)
    if (url.pathname === "/api/indexnow-submit" && request.headers.get("x-indexnow-secret") === INDEXNOW_KEY) {
      const allPaths = Object.keys(SEO_ROUTES);
      try {
        const results = await submitToIndexNow(allPaths);
        return new Response(JSON.stringify({
          success: true,
          submitted: allPaths.length,
          results: results.map((r, i) => ({
            endpoint: INDEXNOW_ENDPOINTS[i],
            status: r.status === "fulfilled" ? r.value : r.reason?.message
          }))
        }), {
          headers: { "content-type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { "content-type": "application/json" }
        });
      }
    }

    // Serve optimized robots.txt (overrides Cloudflare managed + origin)
    if (url.pathname === "/robots.txt") {
      return new Response(getRobotsTxt(), {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "public, max-age=86400",
          "x-robots-source": "worker"
        }
      });
    }

    // Skip static assets and private paths
    if (shouldSkip(url.pathname)) {
      return fetch(request);
    }

    // Non-bot requests: pass through to origin
    if (!isBot(userAgent)) {
      return fetch(request);
    }

    // Only handle HTML requests for bots
    const accept = request.headers.get("accept") || "";
    if (!accept.includes("text/html") && !accept.includes("*/*")) {
      return fetch(request);
    }

    const path = url.pathname.replace(/\/+$/, "") || "/";
    const cacheKey = getCacheKey(path);

    // ── Step 1: Check KV cache for fully rendered version ──
    try {
      const cached = await env.PRERENDER_CACHE.get(cacheKey);
      if (cached) {
        console.log(`Cache HIT: ${path}`);
        return new Response(cached, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "x-prerender": "cached",
            "x-prerender-path": path,
            "cache-control": "public, max-age=3600, s-maxage=86400"
          }
        });
      }
    } catch (e) {
      console.error("KV read error:", e.message);
    }

    console.log(`Cache MISS: ${path}`);

    // ── Step 2: Fetch origin HTML ──
    let originHtml;
    try {
      const originResponse = await fetch(request);
      if (!originResponse.ok) {
        return originResponse;
      }
      originHtml = await originResponse.text();
    } catch (e) {
      console.error("Origin fetch error:", e.message);
      return new Response("Service unavailable", { status: 503 });
    }

    // ── Step 3: Inject meta tags into origin HTML ──
    const injectedHtml = injectMeta(originHtml, path);

    // ── Step 4: Try synchronous Browser Rendering API for full content ──
    try {
      const targetUrl = `https://caravanwert.de${path}`;
      console.log(`Rendering: ${path}`);
      const rendered = await renderWithRestApi(targetUrl, env);

      if (rendered && rendered.length > 5000) {
        // Inject SEO meta tags into the fully rendered HTML as well
        const enrichedHtml = injectMeta(rendered, path);

        // Cache the fully rendered + meta-enriched HTML
        // and notify IndexNow about the freshly rendered page
        ctx.waitUntil(
          env.PRERENDER_CACHE.put(cacheKey, enrichedHtml, { expirationTtl: CACHE_TTL })
            .then(() => {
              console.log(`Cached rendered: ${path} (${enrichedHtml.length} bytes)`);
              return submitToIndexNow([path]);
            })
            .catch((e) => console.error(`Cache/IndexNow error: ${e.message}`))
        );

        return new Response(enrichedHtml, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "x-prerender": "rendered",
            "x-prerender-path": path,
            "cache-control": "public, max-age=3600, s-maxage=86400"
          }
        });
      }
    } catch (e) {
      console.error(`Render error for ${path}: ${e.message}`);
    }

    // ── Step 5: Fallback - serve meta-injected HTML and cache it ──
    ctx.waitUntil(
      env.PRERENDER_CACHE.put(cacheKey, injectedHtml, { expirationTtl: CACHE_TTL })
        .then(() => console.log(`Cached meta-injected: ${path}`))
        .catch((e) => console.error(`Cache write error: ${e.message}`))
    );

    return new Response(injectedHtml, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-prerender": "meta-injected",
        "x-prerender-path": path,
        "cache-control": "public, max-age=3600, s-maxage=86400"
      }
    });
  }
};
