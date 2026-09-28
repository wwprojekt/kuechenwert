/**
 * Prüft, dass die App mit der CSP aus docker/security-headers.conf läuft
 * (script-src ohne 'unsafe-inline' und 'unsafe-eval').
 *
 *   node scripts/check-csp.mjs [--no-build] [--tracking]
 *
 * Baut die App nach /tmp/c-dist, liefert sie über einen kleinen Node-Server
 * mit dieser CSP und SPA-Fallback wie nginx aus (vorgerenderte
 * <route>/index.html, sonst spa.html bzw. index.html) und öffnet die Seiten
 * unten in Headless-Chrome. Fehlschlag bei CSP-Verstößen oder wenn React
 * keine <h1> rendert. Anfragen an fremde Hosts (auch Supabase) werden
 * blockiert; die Seiten laufen mit ihren Rückfallwerten.
 *
 *   --no-build   vorhandenes /tmp/c-dist verwenden (z. B. nach prerender.mjs)
 *   --tracking   Einwilligung simulieren: der Tracking-Loader lädt gtag.js,
 *                fbevents.js und bat.js (nur diese Skriptdateien, keine Beacons);
 *                Fehlschlag auch, wenn eines davon nicht ausgeführt wurde
 *
 * Chrome: CHECK_CSP_CHROME, Standard /usr/local/bin/google-chrome.
 */

import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";

const OUT_DIR = "/tmp/c-dist";
const ROUTES = ["/", "/formular", "/funnel/c", "/kontakt", "/datenschutz"];
const CHROME = process.env.CHECK_CSP_CHROME || "/usr/local/bin/google-chrome";
const BUILD = !process.argv.includes("--no-build");
const TRACKING = process.argv.includes("--tracking");
const TAG_SCRIPT_HOSTS = new Set(["www.googletagmanager.com", "connect.facebook.net", "bat.bing.com"]);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

function readCsp() {
  const conf = readFileSync("docker/security-headers.conf", "utf8");
  const match = conf.match(/add_header\s+Content-Security-Policy\s+"([^"]+)"/);
  if (!match) throw new Error("Content-Security-Policy nicht in docker/security-headers.conf gefunden");
  return match[1];
}

async function loadChromium() {
  for (const name of ["playwright-core", "@playwright/test", "playwright"]) {
    try {
      const mod = await import(name);
      if (mod.chromium) return mod.chromium;
    } catch {
      // nächstes Paket probieren
    }
  }
  throw new Error("Playwright nicht gefunden (playwright-core / @playwright/test)");
}

async function isFile(file) {
  return (await fs.stat(file).catch(() => null))?.isFile() ?? false;
}

async function resolveFile(pathname) {
  const ext = path.extname(pathname);
  if (ext && ext !== ".html") return path.join(OUT_DIR, path.normalize(pathname));
  const candidates = pathname === "/" ? ["index.html"] : [path.join(pathname, "index.html"), "spa.html", "index.html"];
  for (const candidate of candidates) {
    const file = path.join(OUT_DIR, path.normalize(candidate));
    if (await isFile(file)) return file;
  }
  return null;
}

function startServer(csp) {
  const server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    const file = await resolveFile(pathname);
    if (!file || !file.startsWith(OUT_DIR + path.sep) || !(await isFile(file))) {
      res.writeHead(404, { "Content-Security-Policy": csp }).end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(file)] ?? "application/octet-stream",
      "Content-Security-Policy": csp,
    });
    res.end(await fs.readFile(file));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function checkRoute(browser, origin, route) {
  const context = await browser.newContext({ serviceWorkers: "block", locale: "de-DE" });
  const cspMessages = [];
  const pageErrors = [];
  try {
    await context.addInitScript((tracking) => {
      window.__cspViolations = [];
      document.addEventListener("securitypolicyviolation", (event) => {
        window.__cspViolations.push(`${event.effectiveDirective} ${event.blockedURI || "inline"}`);
      });
      if (tracking) {
        const consent = { necessary: true, functional: true, analytics: true, marketing: true, timestamp: Date.now() };
        localStorage.setItem("cookie-consent", JSON.stringify(consent));
        localStorage.setItem(
          "tracking-config-cache",
          JSON.stringify({ ga4: "G-CSPTEST000", gads: "AW-000000000", fb: "000000000000000", uet: "000000000" }),
        );
      }
    }, TRACKING);
    await context.route("**/*", (r) => {
      const request = r.request();
      const url = new URL(request.url());
      if (url.origin === origin) return r.continue();
      const tagScript = TRACKING && request.resourceType() === "script" && TAG_SCRIPT_HOSTS.has(url.hostname);
      return tagScript ? r.continue() : r.abort();
    });

    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error" && /Content[ -]Security[ -]Policy/i.test(message.text())) {
        cspMessages.push(message.text());
      }
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto(origin + route, { waitUntil: "load", timeout: 30000 });
    // Vorgerenderte Seiten enthalten die <h1> schon im HTML: zählen soll nur eine von React gerenderte.
    const h1 = await page
      .waitForFunction(
        () => {
          const el = document.querySelector("#root h1");
          return el && Object.keys(el).some((key) => key.startsWith("__reactFiber$")) ? el.textContent : null;
        },
        null,
        { timeout: 20000 },
      )
      .then((handle) => handle.jsonValue())
      .catch(() => null);
    // Der Tracking-Loader startet per requestIdleCallback (spätestens nach 3 s).
    await page.waitForTimeout(TRACKING ? 5000 : 1500);
    const violations = await page.evaluate(() => window.__cspViolations);
    // Globale, die erst die nachgeladenen Tag-Skripte selbst anlegen (nicht die Stubs des Loaders).
    const tags = TRACKING
      ? await page.evaluate(() => ({
          gtag: !!window.google_tag_manager,
          fbq: typeof window.fbq?.callMethod === "function",
          uet: typeof window.UET === "function",
        }))
      : {};
    const missingTags = Object.keys(tags).filter((name) => !tags[name]);

    return {
      route,
      h1: h1?.trim() ?? null,
      violations: [...new Set([...violations, ...cspMessages])],
      missingTags,
      pageErrors,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  if (BUILD) {
    console.log(`[check-csp] vite build → ${OUT_DIR}`);
    const build = spawnSync(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "build", "--outDir", OUT_DIR, "--emptyOutDir", "--logLevel", "warn"],
      { stdio: "inherit" },
    );
    if (build.status !== 0) throw new Error("vite build fehlgeschlagen");
  }

  const csp = readCsp();
  if (/script-src[^;]*'unsafe-(inline|eval)'/.test(csp)) {
    throw new Error("script-src enthält noch 'unsafe-inline' oder 'unsafe-eval'");
  }

  const chromium = await loadChromium();
  const server = await startServer(csp);
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  let failed = false;
  try {
    console.log(`[check-csp] ${origin}, Chrome ${browser.version()}${TRACKING ? ", mit Tracking-Einwilligung" : ""}`);
    for (const route of ROUTES) {
      const result = await checkRoute(browser, origin, route);
      const ok = result.h1 && result.violations.length === 0 && result.missingTags.length === 0;
      failed ||= !ok;
      console.log(`${ok ? "OK  " : "FAIL"} ${route.padEnd(14)} h1=${JSON.stringify(result.h1)}  CSP-Verstöße: ${result.violations.length}`);
      result.violations.forEach((violation) => console.log(`       CSP: ${violation}`));
      if (result.missingTags.length > 0) console.log(`       Tag-Skripte nicht ausgeführt: ${result.missingTags.join(", ")}`);
      result.pageErrors.forEach((error) => console.log(`       JS-Fehler (Info): ${error.split("\n")[0]}`));
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failed) {
    console.error("[check-csp] fehlgeschlagen");
    process.exitCode = 1;
  } else {
    console.log("[check-csp] alle Seiten ohne CSP-Verstoß gerendert");
  }
}

main().catch((error) => {
  console.error(`[check-csp] ${error.message}`);
  process.exitCode = 1;
});
