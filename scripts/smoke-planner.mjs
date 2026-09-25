/**
 * Smoke-Test für den Traumküchen-Planer (Edge Function kw-planner).
 *
 *   node scripts/smoke-planner.mjs [pfad/zum/raumfoto.jpg]
 *
 * Ablauf wie im Browser: Session → (optional) Foto-Upload per signierter URL
 * → Visualisierung einreihen → Status pollen. Legt KEINEN Lead an.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://gzqayoalwtmypndrmqes.supabase.co";
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_y310eCMmlhSjvXbOKDgY1Q_p2v56GAz";
const sb = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

async function call(body) {
  const { data, error } = await sb.functions.invoke("kw-planner", { body });
  if (error) {
    const detail = error.context ? await error.context.text().catch(() => "") : "";
    throw new Error(`${body.action}: ${error.message} ${detail}`);
  }
  return data;
}

const config = {
  quality: "mittel",
  style: "modern_grifflos",
  front: "lack_matt",
  frontColor: "salbei",
  handle: "grifflos",
  wallCabinets: "regale",
  tallUnits: 2,
  worktop: "quarzstein",
  worktopColor: "marmor",
  applianceLevel: "mittel",
  appliances: ["backofen", "induktion", "haube", "geschirrspueler", "kuehl"],
  sink: "granit",
  tap: "ausziehbar",
  extras: ["led", "nischenrueckwand"],
  services: ["lieferung_montage", "altkueche"],
};
const room = { form: "l", walls: { a: 320, b: 240 }, ceilingHeightCm: 250 };

async function poll(sessionToken, renderId) {
  const started = Date.now();
  for (;;) {
    await new Promise((r) => setTimeout(r, 3000));
    const s = await call({ action: "status", session_token: sessionToken, render_id: renderId });
    process.stdout.write(`  status=${s.status}${s.queue ? ` (${s.queue})` : ""}\n`);
    if (s.status !== "pending") return { ...s, seconds: Math.round((Date.now() - started) / 1000) };
  }
}

async function main() {
  const photo = process.argv[2];
  let sessionToken;
  let photoPath = null;

  if (photo) {
    const bytes = await fs.readFile(photo);
    const up = await call({ action: "upload-url", content_type: "image/jpeg", size: bytes.length });
    sessionToken = up.session_token;
    const { error } = await sb.storage.from("planner-media").uploadToSignedUrl(up.path, up.token, bytes, {
      contentType: "image/jpeg",
      cacheControl: "31536000, immutable",
    });
    if (error) throw error;
    const attached = await call({ action: "attach-photo", session_token: sessionToken, path: up.path });
    photoPath = up.path;
    console.log(`✓ Foto hochgeladen (${attached.photos.length} in Session): ${path.basename(photo)}`);
  }

  const gen = await call({
    action: "generate",
    session_token: sessionToken,
    config,
    room,
    postal_code: "30159",
    photo_path: photoPath,
  });
  sessionToken = gen.session_token;
  console.log(`✓ Render eingereiht (${gen.mode}), Schätzung ${gen.estimate.min} – ${gen.estimate.max} €`);
  const result = await poll(sessionToken, gen.render_id);
  console.log(`${result.status === "success" ? "✓" : "✗"} ${result.status} nach ${result.seconds}s`);
  if (result.image_url) console.log(`  ${result.image_url.slice(0, 120)}…`);
  if (result.status !== "success") process.exit(1);
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
