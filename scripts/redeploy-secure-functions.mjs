#!/usr/bin/env node
/**
 * Deployt alle Edge Functions neu, die `checkServiceRoleOrAdmin` aus
 * `_shared/auth.ts` nutzen, und prüft danach mit einem gefälschten
 * service_role-Token, dass sie 401 liefern (Security-Fix vom 26.09.2026).
 *
 * Hintergrund: Bis zur Härtung von `_shared/auth.ts` akzeptierten diese
 * Functions ein selbst gebautes JWT mit role=service_role. Jede Function
 * bündelt ihre eigene Kopie von auth.ts, der Fix greift also erst nach
 * einem Neu-Deploy. admin-delete-user, generate-invoice-pdf,
 * send-invoice-email und send-dealer-notification sind bereits neu deployt;
 * dieses Skript zieht den Rest nach (erneutes Deployen schadet nicht).
 *
 * Voraussetzung: Supabase-CLI angemeldet – entweder `supabase login`
 * (öffnet den Browser) ODER Umgebungsvariable SUPABASE_ACCESS_TOKEN mit
 * einem Personal Access Token (supabase.com -> Account -> Access Tokens).
 *
 * Aufruf (aus dem Repo-Root):
 *   node scripts/redeploy-secure-functions.mjs           # deployen + prüfen
 *   node scripts/redeploy-secure-functions.mjs --dry-run # nur auflisten
 *
 * Geprobt wird nur direkt nach einem erfolgreichen Deploy: Eine noch nicht
 * gefixte Function würde den gefälschten Token akzeptieren und mit leerem
 * Body laufen – bei Batch-Jobs (process-scheduled-emails,
 * send-inactivity-email, …) hieße das einen echten Lauf samt Mails.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PROJECT_REF = "gzqayoalwtmypndrmqes";
const FUNCTIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "functions");
const DRY_RUN = process.argv.includes("--dry-run");

/** Alle Functions, deren index.ts checkServiceRoleOrAdmin importiert. */
function affectedFunctions() {
  return readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== "_shared")
    .map((e) => e.name)
    .filter((name) => {
      const entry = join(FUNCTIONS_DIR, name, "index.ts");
      return existsSync(entry) && readFileSync(entry, "utf8").includes("checkServiceRoleOrAdmin");
    })
    .sort();
}

function b64url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Selbst gebautes, unsigniertes service_role-JWT – muss nach dem Fix 401 liefern. */
function forgedToken() {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ role: "service_role", ref: PROJECT_REF, iss: "supabase" }));
  return `${header}.${payload}.forged-signature`;
}

function ensureAuthenticated() {
  const res = spawnSync("supabase", ["projects", "list"], { encoding: "utf8", shell: process.platform === "win32" });
  if (res.status !== 0) {
    console.error("\nSupabase-CLI ist nicht angemeldet.");
    console.error("  -> `supabase login`  ODER  SUPABASE_ACCESS_TOKEN setzen");
    console.error("  (supabase.com -> Account -> Access Tokens)\n");
    process.exit(1);
  }
}

function deploy(name) {
  // --use-api bündelt serverseitig (kein Docker nötig); verify_jwt kommt aus supabase/config.toml.
  const res = spawnSync(
    "supabase",
    ["functions", "deploy", name, "--project-ref", PROJECT_REF, "--use-api"],
    { encoding: "utf8", stdio: "inherit", shell: process.platform === "win32" },
  );
  return res.status === 0;
}

async function probe(name) {
  const url = `https://${PROJECT_REF}.supabase.co/functions/v1/${name}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${forgedToken()}` },
      body: "{}",
    });
    return res.status; // erwartet: 401
  } catch (err) {
    return `ERR ${err instanceof Error ? err.message : String(err)}`;
  }
}

const fns = affectedFunctions();
console.log(`\n${fns.length} Functions mit checkServiceRoleOrAdmin:\n  ${fns.join("\n  ")}\n`);
if (DRY_RUN) process.exit(0);
ensureAuthenticated();

const results = [];
for (const name of fns) {
  console.log(`\n=== deploy ${name} ===`);
  if (!deploy(name)) {
    // Kein Probe: die alte, angreifbare Version ist noch live und würde laufen.
    results.push({ name, deployed: "FEHLER", status: "nicht geprüft", secure: false });
    console.log("   Deploy fehlgeschlagen – nicht geprobt.");
    continue;
  }
  const status = await probe(name);
  const secure = status === 401;
  results.push({ name, deployed: "ok", status, secure });
  console.log(`   Probe (gefälschter Token): HTTP ${status} ${secure ? "OK" : "NICHT ABGESICHERT"}`);
}

console.log("\n──────── Zusammenfassung ────────");
for (const r of results) {
  console.log(`${r.secure ? "OK  " : "FAIL"}  ${r.name.padEnd(34)} deploy=${r.deployed} probe=${r.status}`);
}
const failed = results.filter((r) => !r.secure);
console.log(`\n${results.length - failed.length}/${results.length} abgesichert (401 bei gefälschtem Token).`);
if (failed.length) {
  console.log("Nicht abgesichert: " + failed.map((r) => r.name).join(", "));
  process.exit(1);
}
