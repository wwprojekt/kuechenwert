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
const AUCTIONS_CACHE_KEY = "api:auctions:active:v2";
const AUCTIONS_FRESH_MS = 30 * 1000;   // 30 s frisch
const AUCTIONS_STALE_MS = 90 * 1000;   // 90 s gesamt (60 s SWR-Fenster)
const AUCTIONS_KV_TTL = 300;           // 5 min hard-expire (Sicherheitsnetz)

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

function transformImageUrl(originalUrl, width, quality) {
  if (!originalUrl || typeof originalUrl !== "string") return originalUrl;
  // Funktioniert nur für Public-Bucket-URLs (motorhome-photos).
  // Already-transformed oder externe URLs bleiben unverändert.
  if (!originalUrl.includes(STORAGE_OBJECT_PREFIX)) return originalUrl;
  const transformed = originalUrl.replace(STORAGE_OBJECT_PREFIX, STORAGE_RENDER_PREFIX);
  const sep = transformed.includes("?") ? "&" : "?";
  return `${transformed}${sep}width=${width}&quality=${quality}&resize=contain`;
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

          // Bevorzugt: pre-resized Variant (process-photo Edge Function).
          // Fallback: On-the-fly Image-Transformation auf das Original
          // (löst die "5 MB JPG"-Loads für noch unprozessierte Photos).
          // Weiterer Fallback: Raw-Original (nur falls Original-URL fehlt
          // ODER nicht im public bucket liegt, sehr selten).
          const small = p.card_url
            ? p.card_url
            : (p.url ? transformImageUrl(p.url, 480, 70) : p.medium_url);
          const medium = p.medium_url
            ? p.medium_url
            : (p.url ? transformImageUrl(p.url, 1024, 75) : null);

          photoMap[p.motorhome_id] = {
            url: small,
            medium_url: medium,
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

// ─── Main Worker ────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const userAgent = request.headers.get("user-agent") || "";

    // ── Edge-API-Cache: /api/auctions/active (vor allen anderen Checks) ──
    // Wir behandeln auch OPTIONS hier, daher steht es vor dem GET-Filter.
    if (url.pathname === AUCTIONS_API_PATH) {
      return handleAuctionsApi(request, env, ctx);
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
