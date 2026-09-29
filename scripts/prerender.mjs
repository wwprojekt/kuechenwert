/**
 * Build-Zeit-Prerendering der öffentlichen Seiten.
 *
 *   PRERENDER=1 node scripts/prerender.mjs [--dist dist]
 *
 * Rendert die Routen unten mit Headless-Chrome gegen den fertigen Vite-Build
 * und schreibt das HTML nach dist/<route>/index.html (Startseite:
 * dist/index.html). Die unveränderte SPA-Shell bleibt als dist/spa.html
 * erhalten; nginx liefert sie für alle übrigen Routen und für 404 aus
 * (docker/default.conf). Beim Laden rendert React neu (createRoot), zeigt aber
 * bis dahin das HTML innerhalb von [data-kw-route] (src/lib/initialRouteHtml.ts),
 * so bleibt die Seite ab dem ersten Paint sichtbar.
 *
 * Im Prerender-Modus lädt die App weder Tracking noch Cookie-Banner noch
 * Service Worker: Ein Init-Skript setzt window.__KW_PRERENDER__ (src/main.tsx,
 * public/js/tracking-loader.js), der User-Agent enthält "KWPrerenderBot" (der
 * Cookie-Banner überspringt Bots). Jeder Browser-Kontext startet leer, es wird
 * nichts gespeichert. An Supabase gehen nur Lesezugriffe, alles andere wird
 * blockiert.
 *
 * Umgebungsvariablen:
 *   PRERENDER=1            ohne diese Variable passiert nichts
 *   PRERENDER_CHROME       Pfad zu Chrome/Chromium, sonst Suche in üblichen Pfaden
 *   PRERENDER_OFFLINE=1    nur Anfragen an den lokalen Server (lokaler Test)
 *   PRERENDER_TIMEOUT_MS   Timeout je Route, Standard 30000
 *
 * Fehler brechen den Build nie ab: Fehlt Chrome oder scheitert eine Route,
 * bleibt es dort bei der SPA-Shell.
 */

import { createServer } from "node:http";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROUTES = [
  "/",
  "/formular",
  "/funnel/b",
  "/funnel/c",
  "/kuechenrechner",
  "/haendler",
  "/kuechenstudios",
  "/preise",
  "/faq",
  "/ueber-uns",
  "/kontakt",
  "/ratgeber",
  "/impressum",
  "/datenschutz",
  "/agb",
  "/konditionen",
  "/barrierefreiheit",
  "/blog",
];

const CHROME_CANDIDATES = [
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/usr/local/bin/google-chrome",
  "/usr/bin/google-chrome",
];

const SITE_ORIGIN = "https://kuechenwert24.de";
const READ_ONLY_RPCS = new Set(["get_public_site_settings"]);
const TRACKER_HOST = /(^|\.)(google|googletagmanager|google-analytics|doubleclick|googleadservices|facebook|bing|clarity|cloudflareinsights)\./;

const MIME_TYPES = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
};

const argIndex = process.argv.indexOf("--dist");
const DIST = path.resolve(argIndex !== -1 && process.argv[argIndex + 1] ? process.argv[argIndex + 1] : "dist");
const OFFLINE = process.env.PRERENDER_OFFLINE === "1";
const TIMEOUT_MS = Number(process.env.PRERENDER_TIMEOUT_MS) || 30000;

const log = (message) => console.log(`[prerender] ${message}`);
const warn = (message) => console.warn(`[prerender] WARNUNG: ${message}`);

function findChrome() {
  const configured = process.env.PRERENDER_CHROME;
  if (configured && existsSync(configured)) return configured;
  if (configured) warn(`PRERENDER_CHROME=${configured} existiert nicht, suche weiter.`);
  return CHROME_CANDIDATES.find((candidate) => existsSync(candidate)) ?? null;
}

async function loadChromium() {
  // playwright-core ist bei pnpm nur transitiv (über @playwright/test) installiert.
  for (const name of ["playwright-core", "@playwright/test", "playwright"]) {
    try {
      const mod = await import(name);
      if (mod.chromium) return mod.chromium;
    } catch {
      // nächstes Paket probieren
    }
  }
  return null;
}

/** Statischer Server über dist/: Dateien mit Endung direkt, alles andere bekommt die Shell. */
function startServer(shell) {
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
      const ext = path.extname(pathname).toLowerCase();
      if (ext && ext !== ".html") {
        const file = path.join(DIST, path.normalize(pathname));
        const stat = file.startsWith(DIST + path.sep) ? await fs.stat(file).catch(() => null) : null;
        if (!stat?.isFile()) {
          res.writeHead(404).end();
          return;
        }
        res.writeHead(200, { "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream" });
        res.end(await fs.readFile(file));
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(shell);
    } catch {
      res.writeHead(500).end();
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function handleRequest(route, localOrigin) {
  const request = route.request();
  const url = new URL(request.url());
  if (url.origin === localOrigin) return route.continue();
  if (OFFLINE) return route.abort();

  const method = request.method();
  if (url.hostname.endsWith(".supabase.co")) {
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      return READ_ONLY_RPCS.has(url.pathname.slice("/rest/v1/rpc/".length)) ? route.continue() : route.abort();
    }
    const readOnly = method === "GET" || method === "HEAD";
    const readable = url.pathname.startsWith("/rest/v1/") || url.pathname.startsWith("/storage/v1/");
    return readOnly && readable ? route.continue() : route.abort();
  }
  if (request.resourceType() === "image" && method === "GET" && !TRACKER_HOST.test(url.hostname)) {
    return route.continue();
  }
  return route.abort();
}

/** Läuft im Browser: Laufzeit-Reste entfernen, Dokument serialisieren. */
function serializePage(shellScriptSources) {
  const removeAll = (selector) => document.querySelectorAll(selector).forEach((el) => el.remove());

  // Toaster (sonner, Radix) und Popover-Container gehören nicht ins statische HTML.
  removeAll("[data-sonner-toaster]");
  removeAll('section[aria-label^="Notifications"]');
  removeAll('[role="region"][aria-label^="Notifications"]');
  removeAll("[data-radix-popper-content-wrapper]");
  // Cookie-Banner, falls er trotz Bot-Kennung gerendert wurde.
  document.querySelectorAll("#root div.fixed").forEach((el) => {
    if (/cookie/i.test(el.textContent ?? "") && el.querySelector("button")) el.remove();
  });
  // Von Bibliotheken zur Laufzeit in <head> eingefügte Styles setzt die App selbst neu.
  removeAll("head style");
  // Nachgeladene Skripte (z. B. Turnstile) lädt die App selbst; sonst liefen sie doppelt.
  // JSON-LD bleibt, die Shell enthält kein Inline-Skript (CSP ohne 'unsafe-inline').
  document.querySelectorAll("script").forEach((el) => {
    const src = el.getAttribute("src");
    if (src ? !shellScriptSources.includes(src) : el.type !== "application/ld+json") el.remove();
  });

  return `<!doctype html>\n${document.documentElement.outerHTML}\n`;
}

function tagAttributes(html, tagName) {
  return [...html.matchAll(new RegExp(`<${tagName}\\b([^>]*)>`, "gi"))].map((match) =>
    Object.fromEntries([...match[1].matchAll(/([\w:-]+)="([^"]*)"/g)].map((attr) => [attr[1].toLowerCase(), attr[2]])),
  );
}

function inspectHead(html) {
  const metas = tagAttributes(html, "meta");
  const links = tagAttributes(html, "link");
  const metaValues = (key, value) => metas.filter((m) => m[key] === value).map((m) => m.content ?? "");
  return {
    titles: [...html.matchAll(/<title[^>]*>([^<]*)<\/title>/gi)].map((m) => m[1].trim()),
    descriptions: metaValues("name", "description"),
    robots: metaValues("name", "robots"),
    ogTitles: metaValues("property", "og:title"),
    canonicals: links.filter((l) => l.rel === "canonical").map((l) => l.href ?? ""),
  };
}

function validate(html, head) {
  const problems = [];
  if (head.titles.length !== 1 || !head.titles[0]) problems.push("<title> fehlt/doppelt");
  if (head.descriptions.length !== 1 || !head.descriptions[0]) problems.push("meta description fehlt/doppelt");
  if (head.ogTitles.length !== 1 || !head.ogTitles[0]) problems.push("og:title fehlt/doppelt");
  if (head.canonicals.length !== 1 || !head.canonicals[0].startsWith(SITE_ORIGIN)) problems.push("canonical fehlt/doppelt/fremd");
  if (head.robots.length > 1) problems.push("robots doppelt");
  if (!/<div id="root">\s*<[a-z]/i.test(html)) problems.push("#root leer");
  if (!/<script type="module"[^>]*src="\/assets\//.test(html)) problems.push("App-Bundle fehlt");
  return problems;
}

function targetFile(route) {
  return route === "/" ? path.join(DIST, "index.html") : path.join(DIST, route.slice(1), "index.html");
}

/** Nach einem Fehler kein HTML aus einem früheren Lauf stehen lassen: nginx liefert dann spa.html. */
async function resetRoute(route, shell) {
  if (route === "/") await fs.writeFile(targetFile(route), shell);
  else await fs.rm(targetFile(route), { force: true });
}

async function renderRoute(browser, localOrigin, route, userAgent, shellScriptSources) {
  const started = Date.now();
  const context = await browser.newContext({
    userAgent,
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    viewport: { width: 1280, height: 900 },
    serviceWorkers: "block",
    reducedMotion: "reduce",
  });
  try {
    await context.addInitScript(() => {
      window.__KW_PRERENDER__ = true;
    });
    await context.route("**/*", (r) => handleRequest(r, localOrigin));
    if (typeof context.routeWebSocket === "function") {
      await context.routeWebSocket(/.*/, (ws) => ws.close());
    }

    const page = await context.newPage();
    await page.goto(localOrigin + route, { waitUntil: "load", timeout: TIMEOUT_MS });
    await page.waitForLoadState("networkidle", { timeout: TIMEOUT_MS }).catch(() => {
      warn(`${route}: kein Netzwerk-Leerlauf innerhalb des Timeouts, rendere trotzdem`);
    });
    // Helmet schreibt den Seitenkopf per requestAnimationFrame; canonical setzt nur die Seite.
    await page.waitForFunction(
      () => !!document.querySelector('link[rel="canonical"]') && !!document.querySelector("#root h1"),
      null,
      { timeout: TIMEOUT_MS },
    );
    await page.waitForTimeout(300);

    const status = await page.evaluate(
      () => document.querySelector('meta[name="prerender-status-code"]')?.getAttribute("content") ?? null,
    );
    if (status && status !== "200") throw new Error(`Seite meldet Status ${status}`);

    let html = await page.evaluate(serializePage, shellScriptSources);
    const leaks = html.split(localOrigin).length - 1;
    if (leaks > 0) {
      warn(`${route}: ${leaks}× lokale Server-URL im HTML, ersetzt durch ${SITE_ORIGIN}`);
      html = html.split(localOrigin).join(SITE_ORIGIN);
    }

    const head = inspectHead(html);
    const problems = validate(html, head);
    if (problems.length > 0) throw new Error(problems.join(", "));

    const target = targetFile(route);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, html);
    return { route, ok: true, bytes: Buffer.byteLength(html), ms: Date.now() - started, head };
  } catch (error) {
    const message = String(error?.message ?? error).split("\n")[0];
    warn(`${route}: ${message} – bleibt SPA-Shell`);
    return { route, ok: false, error: message };
  } finally {
    await context.close().catch(() => {});
  }
}

function report(results, shellBytes) {
  log(`SPA-Shell (spa.html): ${shellBytes} Bytes`);
  for (const result of results) {
    if (!result.ok) {
      log(`  ${result.route.padEnd(18)} FEHLER: ${result.error}`);
      continue;
    }
    const { titles, canonicals, robots } = result.head;
    log(
      `  ${result.route.padEnd(18)} ${String(result.bytes).padStart(7)} Bytes  ${String(result.ms).padStart(5)} ms  ` +
        `${canonicals[0]}  robots="${robots[0] ?? "-"}"  title="${titles[0]}"`,
    );
  }
  const done = results.filter((result) => result.ok).length;
  log(`${done}/${results.length} Routen vorgerendert${OFFLINE ? " (offline)" : ""}.`);
}

async function main() {
  if (process.env.PRERENDER !== "1") {
    log("PRERENDER ist nicht 1, übersprungen.");
    return;
  }
  const indexFile = path.join(DIST, "index.html");
  const spaFile = path.join(DIST, "spa.html");
  if (!existsSync(indexFile)) {
    warn(`${indexFile} fehlt, kein Prerendering.`);
    return;
  }

  // Bei einem erneuten Lauf ist index.html bereits vorgerendert, die Shell liegt in spa.html.
  const shell = await fs.readFile(existsSync(spaFile) ? spaFile : indexFile, "utf8");
  await fs.writeFile(spaFile, shell);
  const shellScriptSources = [...shell.matchAll(/<script\b[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);

  const chromePath = findChrome();
  if (!chromePath) {
    warn("Kein Chrome/Chromium gefunden (PRERENDER_CHROME), es bleibt beim SPA-Build.");
    return;
  }
  const chromium = await loadChromium();
  if (!chromium) {
    warn("Playwright ist nicht installiert, es bleibt beim SPA-Build.");
    return;
  }

  const server = await startServer(shell);
  const localOrigin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: chromePath,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
    log(`${chromePath} (${browser.version()}), ${ROUTES.length} Routen, dist: ${DIST}`);
    const userAgent =
      `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ` +
      `Chrome/${browser.version()} Safari/537.36 KWPrerenderBot/1.0`;
    const results = [];
    for (const route of ROUTES) {
      const result = await renderRoute(browser, localOrigin, route, userAgent, shellScriptSources);
      if (!result.ok) await resetRoute(route, shell).catch((error) => warn(`${route}: ${error.message}`));
      results.push(result);
    }
    report(results, Buffer.byteLength(shell));
  } catch (error) {
    warn(`Prerendering abgebrochen, es bleibt beim SPA-Build: ${error?.message ?? error}`);
  } finally {
    await browser?.close().catch(() => {});
    server.close();
  }
}

main()
  .catch((error) => warn(`Unerwarteter Fehler: ${error?.stack ?? error}`))
  .finally(() => {
    process.exitCode = 0;
  });
