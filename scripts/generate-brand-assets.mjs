/**
 * Erzeugt die KüchenWert-Bildwelt (Hero, Vorher/Nachher, Lifestyle, Studio)
 * über fal.ai und legt optimierte WebP-Dateien unter src/assets/ ab.
 *
 * Aufruf:  node --env-file=.env.local scripts/generate-brand-assets.mjs [name ...]
 * Benötigt FAL_KEY (oder FAL_API_KEY). Ohne Namen werden alle Motive erzeugt.
 *
 * "kitchen-after" entsteht wie im Produkt per Bild-Edit aus "kitchen-before",
 * damit der Vorher/Nachher-Vergleich auf der Website echt ist.
 */

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY;
if (!FAL_KEY) {
  console.error("FAL_KEY fehlt (node --env-file=.env.local ...)");
  process.exit(1);
}

const OUT_DIR = path.resolve("src/assets");
const RAW_DIR = path.resolve(".tmp-brand-assets");
const TEXT_MODEL = "fal-ai/flux-2-pro";
const EDIT_MODEL = "fal-ai/nano-banana-pro/edit";

const STYLE =
  "photorealistic, architectural interior photography, natural daylight, soft shadows, calm premium styling, no text, no logos, no watermark";

const MOTIFS = {
  "hero-kitchen": {
    size: { width: 1920, height: 1088 },
    width: 1920,
    prompt: `Wide-angle photo of a bright modern German kitchen with a large island in an open-plan living space: matte soft sage-green handleless fronts, light natural oak tall units, white marble-look quartz worktop, brushed brass tap, two paper pendant lamps, large window on the right with morning sun. The left third of the image is calm and bright (pale plaster wall, soft light) to leave room for text. ${STYLE}`,
  },
  "kitchen-before": {
    size: { width: 1600, height: 1200 },
    width: 1600,
    prompt: `Realistic smartphone photo of an outdated 1990s kitchen in a German apartment before renovation: beige laminate cabinets with light wood trim, brown small-format wall tiles, old white electric stove, fluorescent ceiling light, window on the right, slightly cluttered worktop, eye-level camera from the doorway, ordinary daylight. Photorealistic, no people, no text.`,
  },
  "couple-kitchen": {
    size: { width: 1600, height: 900 },
    width: 1600,
    prompt: `Candid lifestyle photo of a happy couple in their late thirties cooking together in their newly installed modern kitchen with white matte fronts and oak worktop, warm afternoon light, genuine smiles, shallow depth of field. ${STYLE.replace("no text, no logos, no watermark", "no text, no logos")}`,
  },
  "studio-consultant": {
    size: { width: 1920, height: 1088 },
    width: 1920,
    prompt: `Portrait of a friendly professional kitchen designer (woman, around 40, business casual) standing in a bright kitchen showroom, display kitchens with oak and dark green fronts and stone worktops in the background, holding a tablet, confident and approachable. ${STYLE}`,
  },
  "kitchen-consultation": {
    size: { width: 1600, height: 900 },
    width: 1600,
    prompt: `Close-up of a kitchen planning consultation at a table in a kitchen studio: a floor plan printout, front material samples in oak, sage green and white, a quartz worktop sample, hands of a designer and a customer pointing at the plan, warm light. ${STYLE}`,
  },
  "kitchen-showroom": {
    size: { width: 1600, height: 900 },
    width: 1600,
    prompt: `Elegant kitchen studio showroom with several display kitchens side by side: handleless white kitchen, dark forest green kitchen with brass details, oak island with ceramic worktop, soft spotlights, polished concrete floor. ${STYLE}`,
  },
};

const AFTER_PROMPT =
  "Edit this photo into a photorealistic image of the very same room after a complete kitchen renovation. Remove the existing kitchen furniture, tiles and appliances and install a brand-new L-shaped kitchen: matte soft sage-green handleless fronts, light oak open shelves instead of wall cabinets on one wall, two floor-to-ceiling tall units with built-in oven at eye level, white marble-look quartz worktop and matching backsplash, flush induction hob, black undermount sink with brushed brass tap, warm LED strip lighting. Keep the architecture exactly as in the photo: identical walls, window, door, ceiling, floor area, camera position, perspective and daylight direction. Tidy, high-end interior magazine photo, no people, no text, no watermark.";

async function falRun(model, input) {
  const submit = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!submit.ok) throw new Error(`submit ${submit.status}: ${await submit.text()}`);
  const { status_url, response_url } = await submit.json();
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    const st = await fetch(status_url, { headers: { Authorization: `Key ${FAL_KEY}` } }).then((r) => r.json());
    if (st.status === "COMPLETED") break;
  }
  const result = await fetch(response_url, { headers: { Authorization: `Key ${FAL_KEY}` } });
  if (!result.ok) throw new Error(`result ${result.status}: ${await result.text()}`);
  const data = await result.json();
  const url = data?.images?.[0]?.url;
  if (!url) throw new Error(`no image: ${JSON.stringify(data).slice(0, 300)}`);
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}

async function writeWebp(name, buffer, width) {
  await fs.mkdir(RAW_DIR, { recursive: true });
  await fs.writeFile(path.join(RAW_DIR, `${name}.png`), buffer);
  const out = path.join(OUT_DIR, `${name}.webp`);
  await sharp(buffer).resize({ width, withoutEnlargement: true }).webp({ quality: 78, effort: 6 }).toFile(out);
  const { size } = await fs.stat(out);
  console.log(`✓ ${name}.webp (${Math.round(size / 1024)} KB)`);
}

async function main() {
  const wanted = process.argv.slice(2);
  const names = wanted.length ? wanted : [...Object.keys(MOTIFS), "kitchen-after"];

  for (const name of names.filter((n) => n in MOTIFS)) {
    const m = MOTIFS[name];
    console.log(`… ${name}`);
    const png = await falRun(TEXT_MODEL, { prompt: m.prompt, image_size: m.size, output_format: "png", safety_tolerance: "2" });
    await writeWebp(name, png, m.width);
  }

  if (names.includes("kitchen-after")) {
    console.log("… kitchen-after (Bild-Edit aus kitchen-before)");
    const before = await fs.readFile(path.join(RAW_DIR, "kitchen-before.png"));
    const dataUri = `data:image/png;base64,${before.toString("base64")}`;
    const png = await falRun(EDIT_MODEL, {
      prompt: AFTER_PROMPT,
      image_urls: [dataUri],
      num_images: 1,
      aspect_ratio: "auto",
      resolution: "2K",
      output_format: "png",
    });
    await writeWebp("kitchen-after", png, 1600);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
