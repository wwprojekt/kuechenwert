import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_ASSET_PATHS } from "../../../supabase/functions/_shared/brand-assets.ts";
import { BRAND_LOGO_URLS } from "../../../supabase/functions/_shared/brand-config.ts";
import { imageInfo } from "../../../supabase/functions/_shared/image-size.ts";
import { BRAND } from "@/lib/brand/config";
import { BRAND_ASSET_URLS, BRAND_LOGOS } from "@/lib/brand/assets";

const ROOT = process.cwd();
const PUBLIC_DIR = resolve(ROOT, "public");
const FINGERPRINTED = /^\/brand\/([a-z0-9-]+)\.([0-9a-f]{10})\.([a-z0-9]+)$/;
const REGENERATE = "node scripts/fingerprint-brand-assets.mjs ausführen";

const hashOf = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex").slice(0, 10);

function sourceFile(urlPath: string): string {
  const match = FINGERPRINTED.exec(urlPath);
  if (!match) throw new Error(`${urlPath} hat keinen Inhalts-Hash im Namen`);
  return `${match[1]}.${match[3]}`;
}

function listFiles(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(path, pattern);
    return pattern.test(entry.name) ? [path] : [];
  });
}

function metaContent(html: string, attr: "property" | "name", key: string): string | undefined {
  return html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))?.[1];
}

describe("Brand-Assets mit Inhalts-Hash", () => {
  it("jede Manifest-Datei existiert, der Hash passt zum Namen und die Bytes zur Quelle in public/", () => {
    for (const urlPath of Object.values(BRAND_ASSET_PATHS)) {
      const bytes = readFileSync(join(PUBLIC_DIR, urlPath));
      expect(hashOf(bytes), urlPath).toBe(FINGERPRINTED.exec(urlPath)?.[2]);
      const source = sourceFile(urlPath);
      expect(bytes.equals(readFileSync(join(PUBLIC_DIR, source))), `public/${source} geändert: ${REGENERATE}`).toBe(true);
    }
  });

  it("ältere Fassungen unter public/brand/ bleiben unverändert", () => {
    for (const file of readdirSync(join(PUBLIC_DIR, "brand"))) {
      const urlPath = `/brand/${file}`;
      expect(FINGERPRINTED.test(urlPath), file).toBe(true);
      expect(hashOf(readFileSync(join(PUBLIC_DIR, urlPath))), file).toBe(FINGERPRINTED.exec(urlPath)?.[2]);
    }
  });

  it("E-Mails, Structured Data und Mail-Vorschau nutzen die Manifest-Pfade", () => {
    for (const url of Object.values(BRAND_LOGO_URLS)) {
      expect(url.startsWith(`${BRAND.baseUrl}/brand/`), url).toBe(true);
      expect(Object.values(BRAND_ASSET_PATHS)).toContain(url.slice(BRAND.baseUrl.length));
    }
    expect(BRAND_LOGO_URLS.email).toBe(`${BRAND.baseUrl}${BRAND_ASSET_PATHS.email}`);
    expect(BRAND_LOGOS.email).toBe(BRAND_ASSET_PATHS.email);
    expect(BRAND_ASSET_URLS.logoSquare).toBe(`${BRAND.baseUrl}${BRAND_ASSET_PATHS.logoSquare}`);
    expect(BRAND_ASSET_URLS.ogImage).toBe(`${BRAND.baseUrl}${BRAND_ASSET_PATHS.ogImage}`);
  });

  it("index.html zeigt das OG-Bild aus dem Manifest mit seinen echten Maßen", () => {
    const html = readFileSync(resolve(ROOT, "index.html"), "utf8");
    const ogUrl = `${BRAND.baseUrl}${BRAND_ASSET_PATHS.ogImage}`;
    expect(metaContent(html, "property", "og:image"), REGENERATE).toBe(ogUrl);
    expect(metaContent(html, "name", "twitter:image"), REGENERATE).toBe(ogUrl);
    const info = imageInfo(new Uint8Array(readFileSync(join(PUBLIC_DIR, BRAND_ASSET_PATHS.ogImage))));
    expect(info?.mime).toBe("image/jpeg");
    expect(metaContent(html, "property", "og:image:width")).toBe(String(info?.width));
    expect(metaContent(html, "property", "og:image:height")).toBe(String(info?.height));
  });

  it("nginx liefert /brand/ unveränderlich cachebar, mit Sicherheits-Headern und echtem 404", () => {
    const conf = readFileSync(resolve(ROOT, "docker/default.conf"), "utf8");
    const block = conf.match(/location \^~ \/brand\/ \{([^}]*)\}/)?.[1] ?? "";
    expect(block).toContain("include /etc/nginx/snippets/security-headers.conf;");
    expect(block).toContain('add_header Cache-Control "public, max-age=31536000, immutable" always;');
    expect(block).toContain("try_files $uri @asset_404;");
  });

  // Favicons und Manifest-Icons fragen Browser und Crawler unter festen Pfaden
  // ab; die SVG-Icons in BRAND_LOGOS zeigt nur die Website selbst, nginx lässt
  // sie nach einem Tag neu prüfen. Beide behalten ihre Dateinamen.
  it("verweist in Code und index.html nirgends ohne Hash auf diese Bilder", () => {
    const names = Object.values(BRAND_ASSET_PATHS).map((p) => sourceFile(p).replace(/[.-]/g, "\\$&"));
    // Wurzelpfad: direkt nach Anführungszeichen, Klammer, Leerzeichen, Template-Platzhalter oder Domain.
    const unhashed = new RegExp(`(?:^|[\\s"'\`(=}]|\\.de)/(?:${names.join("|")})(?![\\w.-])`, "m");
    const files = [
      ...listFiles(resolve(ROOT, "src"), /\.(?:ts|tsx)$/),
      ...listFiles(resolve(ROOT, "supabase/functions"), /\.(?:ts|tsx)$/),
      resolve(ROOT, "index.html"),
    ];
    const offenders = files
      .filter((file) => unhashed.test(readFileSync(file, "utf8")))
      .map((file) => relative(ROOT, file).replace(/\\/g, "/"));
    expect(offenders).toEqual([]);
  });
});
