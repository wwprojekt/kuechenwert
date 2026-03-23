// Cloudflare Worker: Pre-Renderer für caravanwert.de
// Strategie:
// 1. KV-Cache prüfen → gecachtes HTML sofort zurückgeben
// 2. Meta-Injection sofort zurückgeben (schnell, für SEO-Basics)
// 3. Im Hintergrund: REST API Browser Rendering für vollen Content → KV-Cache

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
  return `render:v4:${path}`;
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

// ─── Meta-Tag Injection (fast fallback) ─────────────────────────────────────

function injectMeta(html, path) {
  const seoData = SEO_ROUTES[path];
  if (!seoData) return null;

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
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index, follow" />
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

  html = html.replace(/<title>[^<]*<\/title>/, "");
  html = html.replace("</head>", metaTags + "\n  </head>");
  html = html.replace(
    '<div id="root"></div>',
    '<div id="root"></div>' + noscriptContent
  );

  return html;
}

// ─── REST API Browser Rendering ─────────────────────────────────────────────

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
        url: url,
        rejectResourceTypes: ["image", "font", "media"],
        waitForSelector: {
          selector: "#root > *",
          timeout: 10000
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

    // Skip static assets and private paths
    if (shouldSkip(url.pathname)) {
      return fetch(request);
    }

    // Only process bot requests
    if (!isBot(userAgent)) {
      return fetch(request);
    }

    // Only handle HTML requests
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
            "cache-control": "public, max-age=3600, s-maxage=86400",
          }
        });
      }
    } catch (e) {
      console.error("KV read error:", e.message);
    }

    // ── Step 2: Immediately return meta-injected version ──
    console.log(`Cache MISS - meta-injection for: ${path}`);

    let originResponse;
    try {
      originResponse = await fetch(request);
    } catch (e) {
      console.error("Origin fetch error:", e.message);
      return new Response("Service unavailable", { status: 503 });
    }

    if (!originResponse.ok) {
      return originResponse;
    }

    let html = await originResponse.text();
    const injectedHtml = injectMeta(html, path);

    // ── Step 3: Background REST API rendering → KV cache ──
    ctx.waitUntil(
      (async () => {
        try {
          const targetUrl = `https://caravanwert.de${path}`;
          console.log(`Background: REST API render for ${path}`);
          const rendered = await renderWithRestApi(targetUrl, env);

          if (rendered && rendered.length > 1000) {
            await env.PRERENDER_CACHE.put(cacheKey, rendered, {
              expirationTtl: CACHE_TTL
            });
            console.log(`Background: cached REST API render for ${path} (${rendered.length} bytes)`);
          } else {
            // Cache meta-injected as fallback
            if (injectedHtml) {
              await env.PRERENDER_CACHE.put(cacheKey, injectedHtml, {
                expirationTtl: CACHE_TTL
              });
            }
          }
        } catch (e) {
          console.error(`Background render error for ${path}:`, e.message);
          // Cache meta-injected version as fallback
          if (injectedHtml) {
            try {
              await env.PRERENDER_CACHE.put(cacheKey, injectedHtml, {
                expirationTtl: CACHE_TTL
              });
            } catch (e2) {}
          }
        }
      })()
    );

    // Return meta-injected version immediately
    if (injectedHtml) {
      return new Response(injectedHtml, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "x-prerender": "meta-injected",
          "x-prerender-path": path,
          "cache-control": "public, max-age=3600, s-maxage=86400",
        }
      });
    }

    // Unknown path - return origin response as-is
    return new Response(html, {
      headers: originResponse.headers,
    });
  }
};
