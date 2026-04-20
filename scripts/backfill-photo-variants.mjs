#!/usr/bin/env node
// Backfill: 480px (card_url) + 1024px (medium_url) WebP-Varianten für alle
// motorhome_photos die noch keine haben — inklusive der Originale > 2 MB,
// die die Edge Function `process-photo` skipt (jsquash-WASM crasht bei
// > 2 MB im 256 MB Function-Memory).
//
// Lokal mit Node.js + sharp ausgeführt, weil:
//  1) sharp läuft im nativen libvips-Adressraum, nicht im 256 MB-Sandbox
//  2) Wir Bandbreite vom Office-Netz statt Function-Egress nutzen
//  3) One-Shot-Migration, keine Cron-Schedule-Komplikation
//
// Vorbedingungen:
//   $env:SERVICE_KEY = "<supabase service role key>"
//   npm install --no-save sharp
//
// Aufruf:
//   node scripts/backfill-photo-variants.mjs
//   node scripts/backfill-photo-variants.mjs --limit 50           (Test mit 50)
//   node scripts/backfill-photo-variants.mjs --concurrency 2      (langsamer)
//   node scripts/backfill-photo-variants.mjs --only-too-large     (nur die geskippten)
//   node scripts/backfill-photo-variants.mjs --dry-run            (kein Upload, kein DB-Write)

import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { setTimeout as sleep } from "node:timers/promises";

const SUPABASE_URL = "https://zcrwqxsyptjwkuxfacvq.supabase.co";
const SERVICE_KEY = process.env.SERVICE_KEY;
const BUCKET = "motorhome-photos";

const CARD_WIDTH = 480;
const MEDIUM_WIDTH = 1024;
const WEBP_QUALITY = 78;
const VARIANT_CACHE_CONTROL = "public, max-age=31536000, immutable";

const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = args[i + 1];
  return v && !v.startsWith("--") ? v : true;
}

const LIMIT = Number(arg("limit", 0)) || 0;            // 0 = alle
const CONCURRENCY = Number(arg("concurrency", 3));
const ONLY_TOO_LARGE = !!arg("only-too-large", false);
const DRY_RUN = !!arg("dry-run", false);
const RETRIES = 2;

if (!SERVICE_KEY) {
  console.error("FATAL: $env:SERVICE_KEY ist nicht gesetzt.");
  console.error("Setze: $env:SERVICE_KEY = '<service-role-key>'");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`Backfill-Konfiguration:`);
console.log(`  Limit:        ${LIMIT || "all"}`);
console.log(`  Concurrency:  ${CONCURRENCY}`);
console.log(`  Mode:         ${ONLY_TOO_LARGE ? "only original_too_large" : "all missing variants"}`);
console.log(`  Dry-Run:      ${DRY_RUN}`);
console.log("");

// ────────────────────────────────────────────────────────────────────────────
// Selection
// ────────────────────────────────────────────────────────────────────────────
async function selectBatch() {
  let q = sb
    .from("motorhome_photos")
    .select("id, motorhome_id, url, processing_error, processing_attempts, card_url, medium_url");

  if (ONLY_TOO_LARGE) {
    q = q.eq("processing_error", "original_too_large");
  } else {
    // Photos die noch keine Variante haben ODER deren Verarbeitung fehlgeschlagen ist
    q = q.or("card_url.is.null,medium_url.is.null,processing_error.not.is.null");
  }

  // Nicht infinite-retry bei chronisch kaputten Bildern
  q = q.lt("processing_attempts", 5);
  // Stabile Reihenfolge → reproduzierbare Batches
  q = q.order("created_at", { ascending: true });

  if (LIMIT > 0) q = q.limit(LIMIT);
  else q = q.limit(2000);

  const { data, error } = await q;
  if (error) throw new Error(`Select failed: ${error.message}`);
  return data ?? [];
}

// ────────────────────────────────────────────────────────────────────────────
// Per-Photo
// ────────────────────────────────────────────────────────────────────────────
function variantPath(motorhomeId, photoId, size) {
  return `${motorhomeId}/variants/${photoId}_${size}.webp`;
}

function publicUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function downloadOriginal(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

async function uploadVariant(path, bytes) {
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: "image/webp",
      cacheControl: VARIANT_CACHE_CONTROL,
      upsert: true,
    });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
}

async function processOne(photo, idx, total) {
  const tag = `[${idx}/${total}] ${photo.id.slice(0, 8)}…`;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const original = await downloadOriginal(photo.url);
      const sizeMB = (original.length / 1024 / 1024).toFixed(2);

      // sharp pipeline:
      //  - rotate() respektiert EXIF-Orientation (Smartphones speichern oft
      //    Hochformat als Querformat-mit-EXIF-Hint)
      //  - withoutEnlargement: kleine Originale werden nicht hoch-skaliert
      //  - WebP q78: liefert gute Qualität bei ~50% kleinerer Datei vs JPEG q85
      const card = await sharp(original)
        .rotate()
        .resize({ width: CARD_WIDTH, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();

      const medium = await sharp(original)
        .rotate()
        .resize({ width: MEDIUM_WIDTH, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();

      const cardKB = (card.length / 1024).toFixed(0);
      const medKB = (medium.length / 1024).toFixed(0);

      if (DRY_RUN) {
        console.log(`${tag} dry: ${sizeMB} MB → card ${cardKB} KB / med ${medKB} KB`);
        return { ok: true };
      }

      const cardPath = variantPath(photo.motorhome_id, photo.id, "card");
      const mediumPath = variantPath(photo.motorhome_id, photo.id, "medium");

      await uploadVariant(cardPath, card);
      await uploadVariant(mediumPath, medium);

      const { error: updateErr } = await sb
        .from("motorhome_photos")
        .update({
          card_url: publicUrl(cardPath),
          medium_url: publicUrl(mediumPath),
          processed_at: new Date().toISOString(),
          processing_error: null,
          processing_attempts: (photo.processing_attempts ?? 0) + 1,
        })
        .eq("id", photo.id);

      if (updateErr) throw new Error(`db update: ${updateErr.message}`);

      console.log(`${tag} ok: ${sizeMB} MB → card ${cardKB} KB / med ${medKB} KB`);
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < RETRIES) {
        console.warn(`${tag} retry ${attempt + 1}: ${msg}`);
        await sleep(1000 * (attempt + 1));
      } else {
        console.error(`${tag} FAILED: ${msg}`);
        if (!DRY_RUN) {
          await sb
            .from("motorhome_photos")
            .update({
              processing_error: msg.slice(0, 200),
              processing_attempts: (photo.processing_attempts ?? 0) + 1,
            })
            .eq("id", photo.id);
        }
        return { ok: false, error: msg };
      }
    }
  }
  return { ok: false, error: "exhausted retries" };
}

// ────────────────────────────────────────────────────────────────────────────
// Run
// ────────────────────────────────────────────────────────────────────────────
async function run() {
  const photos = await selectBatch();
  if (photos.length === 0) {
    console.log("Nichts zu tun — alle Photos haben bereits Varianten.");
    return;
  }

  console.log(`Gefunden: ${photos.length} Photos.\n`);
  const start = Date.now();
  let done = 0;
  let failed = 0;

  // Simple manual concurrency pool
  const queue = [...photos];
  const total = queue.length;

  async function worker() {
    while (queue.length > 0) {
      const photo = queue.shift();
      if (!photo) break;
      const idx = total - queue.length;
      const res = await processOne(photo, idx, total);
      done++;
      if (!res.ok) failed++;
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  const sec = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nFertig. ${done} verarbeitet, ${failed} fehlgeschlagen, ${sec} s.`);
}

run().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
