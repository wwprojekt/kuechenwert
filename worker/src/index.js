// Cloudflare Worker: Pre-Renderer für caravanwert.de
// Version: v7 (2026-03-24)
// Fixes: Robuste Meta-Tag-Entfernung, korrekter waitForSelector, robots.txt,
//        og:locale, twitter:image, optimierte robots-Direktive, Fallback-SEO,
//        synchrones Rendering für Bots, IndexNow-Integration für Bing

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
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
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

// ─── Main Worker ────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const userAgent = request.headers.get("user-agent") || "";

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
