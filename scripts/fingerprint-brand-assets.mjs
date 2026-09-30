/**
 * Legt die außerhalb der Website angezeigten Brand-Bilder (E-Mails, PDFs,
 * Structured Data, Link-Vorschauen) mit Inhalts-Hash im Dateinamen unter
 * public/brand/ ab, schreibt das Manifest supabase/functions/_shared/brand-assets.ts
 * und trägt das OG-Bild in index.html ein.
 *
 *   node scripts/fingerprint-brand-assets.mjs
 *
 * Quelle ist die aktuelle Datei in public/; scripts/generate-logo-assets.mjs ruft
 * den Schritt am Ende selbst auf. Ältere Fassungen in public/brand/ werden nie
 * gelöscht: bereits versendete E-Mails laden sie weiter.
 */

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const BRAND_DIR = "brand";
const MANIFEST = path.join(ROOT, "supabase/functions/_shared/brand-assets.ts");
const INDEX_HTML = path.join(ROOT, "index.html");
const HASH_LENGTH = 10;

const ASSETS = [
  { key: "email", file: "logo-email.png", doc: "Wortmarke hell für den dunkelgrünen E-Mail-Header" },
  { key: "wordmark", file: "logo-2x.png", doc: "Wortmarke dunkel auf hell, doppelte Auflösung" },
  { key: "wordmarkWhite", file: "logo-white.png", doc: "Wortmarke hell auf dunkel" },
  { key: "logoSquare", file: "logo.png", doc: "Quadratisches Logo für schema.org (Organization, Publisher)" },
  { key: "ogImage", file: "og-image.jpg", doc: "Open-Graph-Bild für Link-Vorschauen" },
];

const OG_META = /(<meta (?:property="og:image"|name="twitter:image") content="https?:\/\/[^/"]+)[^"]*(")/g;

async function readIfExists(file) {
  try {
    return await fs.readFile(file);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeIfChanged(file, content) {
  const current = await readIfExists(file);
  const unify = (text) => text.replace(/\r\n/g, "\n");
  if (current !== null && unify(current.toString("utf8")) === unify(content)) return false;
  await fs.writeFile(file, content);
  return true;
}

function manifestSource(entries) {
  return [
    "// Generiert von scripts/fingerprint-brand-assets.mjs, nicht von Hand bearbeiten.",
    "//",
    "// Brand-Bilder für Stellen außerhalb der Website (E-Mails, PDFs, Structured",
    "// Data, Link-Vorschauen). Mail-Clients, Bild-Proxys und Messenger cachen ein",
    "// Bild unter derselben URL dauerhaft und ignorieren Query-Strings teilweise;",
    "// der Inhalts-Hash im Pfad gibt deshalb jeder Fassung eine eigene URL.",
    "",
    "export const BRAND_ASSET_PATHS = {",
    ...entries.flatMap(({ key, file, doc, urlPath }) => [`  /** public/${file}: ${doc}. */`, `  ${key}: "${urlPath}",`]),
    "} as const;",
    "",
  ].join("\n");
}

export async function fingerprintBrandAssets() {
  await fs.mkdir(path.join(PUBLIC_DIR, BRAND_DIR), { recursive: true });
  const entries = [];

  for (const asset of ASSETS) {
    const bytes = await fs.readFile(path.join(PUBLIC_DIR, asset.file));
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, HASH_LENGTH);
    const ext = path.extname(asset.file);
    const name = `${path.basename(asset.file, ext)}.${hash}${ext}`;
    const target = path.join(PUBLIC_DIR, BRAND_DIR, name);

    const existing = await readIfExists(target);
    if (existing === null) {
      await fs.writeFile(target, bytes);
      console.log(`  ✓ ${BRAND_DIR}/${name} (neu)`);
    } else if (!existing.equals(bytes)) {
      throw new Error(`${BRAND_DIR}/${name} weicht vom Inhalt ab, den der Hash beschreibt – Datei nicht von Hand ändern.`);
    } else {
      console.log(`  · ${BRAND_DIR}/${name}`);
    }
    entries.push({ ...asset, urlPath: `/${BRAND_DIR}/${name}` });
  }

  if (await writeIfChanged(MANIFEST, manifestSource(entries))) {
    console.log(`  ✓ ${path.relative(ROOT, MANIFEST).replace(/\\/g, "/")} aktualisiert`);
  }

  const ogImage = entries.find((e) => e.key === "ogImage").urlPath;
  const html = await fs.readFile(INDEX_HTML, "utf8");
  const tags = html.match(OG_META) ?? [];
  if (tags.length !== 2) {
    throw new Error(`index.html: og:image und twitter:image erwartet, gefunden ${tags.length}.`);
  }
  if (await writeIfChanged(INDEX_HTML, html.replace(OG_META, `$1${ogImage}$2`))) {
    console.log("  ✓ index.html: og:image/twitter:image aktualisiert");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log("Brand-Assets mit Inhalts-Hash → public/brand");
  await fingerprintBrandAssets();
}
