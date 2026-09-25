/**
 * Erzeugt alle Raster-Brand-Assets in public/ aus den SVG-Quellen und
 * src/assets-Bildern – reproduzierbar statt handgebaut.
 *
 *   node scripts/generate-logo-assets.mjs
 *
 * Quellen:  public/favicon.svg (Icon farbig), public/logo-white.svg (Icon hell),
 *           src/assets/kitchen-before.webp + kitchen-after.webp (OG-Motiv)
 * Wortmarke und OG-Bild rendert Chromium (Playwright) in Fira Sans, der
 * Website-Schrift; Icons, WebP und ICO erzeugt sharp.
 */

import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import sharp from "sharp";

const OUT = "public";
const NAME_A = "Küchen";
const NAME_B = "Wert";
const TAGLINE = "Traumküche planen & Angebote vergleichen";
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Fira+Sans:wght@500;600;700;800&display=block";

const iconSvg = await fs.readFile(`${OUT}/favicon.svg`, "utf8");
const iconWhiteSvg = await fs.readFile(`${OUT}/logo-white.svg`, "utf8");
const fullBleedSvg = iconSvg.replace(/ rx="14" ry="14"/, "");
const dataUri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

async function rasterIcon(svg, size) {
  return sharp(Buffer.from(svg), { density: (72 * size) / 64 }).resize(size, size).png().toBuffer();
}

/** ICO mit eingebetteten PNGs (von allen Browsern seit IE Vista unterstützt). */
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

async function write(file, buffer) {
  await fs.writeFile(`${OUT}/${file}`, buffer);
  console.log(`  ✓ ${file.padEnd(22)} ${(buffer.length / 1024).toFixed(1)} KB`);
}

const wordmarkHtml = ({ icon, dark }) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${FONT_CSS}">
<style>
  html,body{margin:0;background:transparent}
  .wm{display:flex;align-items:center;gap:18px;padding:13px 16px 13px 13px;width:max-content;font-family:'Fira Sans',sans-serif}
  .wm img{width:104px;height:104px;flex:none}
  .name{font-size:54px;font-weight:700;letter-spacing:-1px;line-height:1;color:${dark ? "#ffffff" : "#1c2622"}}
  .name b{font-weight:700;color:${dark ? "#a8d5bd" : "#336753"}}
  .tag{margin-top:9px;font-size:17.5px;font-weight:500;letter-spacing:.1px;color:${dark ? "#d3e0d8" : "#5b6b63"};white-space:nowrap}
</style></head><body>
<div class="wm"><img src="${dataUri(icon)}" alt=""><div><div class="name">${NAME_A}<b>${NAME_B}</b></div><div class="tag">${TAGLINE}</div></div></div>
</body></html>`;

async function imageDataUri(path, width) {
  const buf = await sharp(path).resize({ width }).jpeg({ quality: 90 }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

const ogHtml = ({ after, before }) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${FONT_CSS}">
<style>
  *{box-sizing:border-box;margin:0}
  body{width:1200px;height:630px;overflow:hidden;font-family:'Fira Sans',sans-serif}
  .og{position:relative;width:1200px;height:630px;background:#19372b;overflow:hidden}
  .photo{position:absolute;inset:0 0 0 360px;background:url(${after}) center/cover}
  .shade{position:absolute;inset:0;background:linear-gradient(90deg,#15302a 0%,#15302a 33%,rgba(21,48,42,.86) 45%,rgba(21,48,42,.25) 62%,rgba(21,48,42,0) 74%)}
  .content{position:absolute;left:60px;top:54px;bottom:54px;width:610px;display:flex;flex-direction:column;color:#fff}
  .brand{display:flex;align-items:center;gap:14px}
  .brand img{width:58px;height:58px}
  .brand span{font-size:38px;font-weight:700;letter-spacing:-.6px}
  .brand b{color:#a8d5bd;font-weight:700}
  h1{margin-top:50px;font-size:60px;line-height:1.04;font-weight:800;letter-spacing:-1.4px}
  h1 em{font-style:normal;color:#a8d5bd}
  p{margin-top:22px;font-size:25px;line-height:1.36;color:#d3e0d8;font-weight:500;max-width:560px}
  .chips{margin-top:auto;display:flex;gap:10px}
  .chip{border:1.5px solid rgba(255,255,255,.34);border-radius:999px;padding:9px 16px;font-size:18px;font-weight:600;background:rgba(255,255,255,.08);white-space:nowrap}
  .ki{position:absolute;right:44px;top:44px;background:#fff;color:#19372b;font-weight:800;font-size:19px;padding:10px 18px;border-radius:999px;box-shadow:0 10px 30px rgba(0,0,0,.25)}
  .before{position:absolute;right:44px;bottom:44px;width:270px;height:180px;border-radius:16px;overflow:hidden;border:4px solid #fff;box-shadow:0 18px 40px rgba(0,0,0,.35)}
  .before img{width:100%;height:100%;object-fit:cover;display:block}
  .before span{position:absolute;left:10px;top:10px;background:rgba(17,24,39,.82);color:#fff;font-size:15px;font-weight:700;padding:5px 11px;border-radius:999px}
</style></head><body>
<div class="og">
  <div class="photo"></div><div class="shade"></div>
  <div class="content">
    <div class="brand"><img src="${dataUri(iconWhiteSvg)}" alt=""><span>${NAME_A}<b>${NAME_B}</b></span></div>
    <h1>Ihre Traumküche –<br><em>im eigenen Raum</em> visualisiert.</h1>
    <p>Foto hochladen, Küche konfigurieren, Preis sehen – und Angebote geprüfter Küchenstudios vergleichen.</p>
    <div class="chips"><span class="chip">KI-Vorschau</span><span class="chip">Sofort-Preisschätzung</span><span class="chip">Studios bieten</span></div>
  </div>
  <div class="ki">KI-Vorschau</div>
  <div class="before"><img src="${before}" alt=""><span>Vorher</span></div>
</div>
</body></html>`;

async function renderHtml(browser, html, { width, height, scale = 1, selector, transparent }) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const ok = await page.evaluate(() => document.fonts.check("700 40px 'Fira Sans'"));
  if (!ok) throw new Error("Fira Sans nicht geladen – Netzwerkzugriff auf fonts.googleapis.com nötig.");
  const target = selector ? page.locator(selector) : page;
  const buf = await target.screenshot({ type: "png", omitBackground: transparent, scale: "device" });
  await page.close();
  return buf;
}

console.log("Brand-Assets →", OUT);

// Icons
const icon512 = await rasterIcon(iconSvg, 512);
await write("favicon.png", icon512);
await write("favicon.webp", await sharp(icon512).webp({ quality: 92, alphaQuality: 100 }).toBuffer());
await write("logo.png", icon512);
await write("icon-192.png", await rasterIcon(fullBleedSvg, 192));
await write("icon-512.png", await rasterIcon(fullBleedSvg, 512));
await write("apple-touch-icon.png", await sharp(await rasterIcon(fullBleedSvg, 180)).flatten({ background: "#336753" }).png().toBuffer());
await write(
  "favicon.ico",
  buildIco(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await rasterIcon(iconSvg, size) })))),
);

const browser = await chromium.launch();
try {
  // Wortmarken (482×130 @1x, 964×260 @2x)
  const fit = async (html, scale) => {
    const raw = await renderHtml(browser, html, { width: 800, height: 200, scale, selector: ".wm", transparent: true });
    return sharp(raw).resize({ width: 482 * scale, height: 130 * scale, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  };
  const light1x = await fit(wordmarkHtml({ icon: iconSvg, dark: false }), 1);
  const light2x = await fit(wordmarkHtml({ icon: iconSvg, dark: false }), 2);
  const dark1x = await fit(wordmarkHtml({ icon: iconWhiteSvg, dark: true }), 1);
  const dark2x = await fit(wordmarkHtml({ icon: iconWhiteSvg, dark: true }), 2);

  await write("logo.webp", await sharp(light1x).webp({ quality: 95, alphaQuality: 100 }).toBuffer());
  await write("logo-2x.png", light2x);
  await write("logo-2x.webp", await sharp(light2x).webp({ quality: 95, alphaQuality: 100 }).toBuffer());
  await write("logo-white.png", dark1x);
  await write("logo-white.webp", await sharp(dark1x).webp({ quality: 95, alphaQuality: 100 }).toBuffer());
  // E-Mail-Header ist dunkelgrün → helle Wortmarke, 2x für Retina (angezeigt mit 220 px Breite).
  await write("logo-email.png", await sharp(dark2x).png({ compressionLevel: 9, palette: true, quality: 100 }).toBuffer());
  await write("logo-email.webp", await sharp(dark2x).webp({ quality: 95, alphaQuality: 100 }).toBuffer());

  // Open-Graph-Bild 1200×630
  const og = await renderHtml(
    browser,
    ogHtml({
      after: await imageDataUri("src/assets/kitchen-after.webp", 1400),
      before: await imageDataUri("src/assets/kitchen-before.webp", 600),
    }),
    { width: 1200, height: 630, selector: ".og" },
  );
  await write("og-image.jpg", await sharp(og).jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: "4:4:4" }).toBuffer());
  await write("og-image.png", await sharp(og).png({ compressionLevel: 9, palette: true, quality: 95 }).toBuffer());
  await write("og-image.webp", await sharp(og).webp({ quality: 86 }).toBuffer());
} finally {
  await browser.close();
}
