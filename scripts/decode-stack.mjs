#!/usr/bin/env node
/**
 * Decode a minified production stack trace to original file:line:column
 * positions using local sourcemaps under .sourcemaps/<sha>/.
 *
 * USAGE
 * -----
 *   # Decode from stdin
 *   cat stack.txt | node scripts/decode-stack.mjs
 *
 *   # Decode from file
 *   node scripts/decode-stack.mjs ./stack.txt
 *
 *   # Decode directly from a Supabase error_logs row (most convenient)
 *   node scripts/decode-stack.mjs --log-id <uuid>
 *
 *   # Explicit SHA override (default: read .sourcemaps/<app_version>/ or
 *   # current HEAD)
 *   node scripts/decode-stack.mjs --log-id <uuid> --sha <12-char-sha>
 *
 * HOW IT RESOLVES THE MAPS
 * ------------------------
 *   1. If --sha given → .sourcemaps/<sha>/
 *   2. Else if --log-id given → app_version from the row
 *   3. Else → current `git rev-parse --short=12 HEAD`
 *
 * If no matching directory exists, checks out the exact SHA and rebuilds
 * is not automatic — you must run:
 *     git checkout <sha> && npm ci && npm run build
 * to (re-)generate .sourcemaps/<sha>/.
 *
 * STACK FORMATS UNDERSTOOD
 * ------------------------
 *   • Chrome:   "    at Foo (https://host/assets/index-ABC.js:12:345)"
 *   • Safari:   "foo@https://host/assets/index-ABC.js:12:345"
 *   • Minified: "al@" (no location — left as-is, can't be resolved)
 */
import { readFile, readdir, access } from "fs/promises";
import { existsSync } from "fs";
import { join, basename } from "path";
import { execSync } from "child_process";

let SourceMapConsumer;
try {
  ({ SourceMapConsumer } = await import("source-map"));
} catch {
  console.error(
    "❌ The 'source-map' package is not installed.\n" +
      "   Run: npm install --save-dev source-map\n"
  );
  process.exit(1);
}

// ---------- argv parsing ----------
const args = process.argv.slice(2);
const flags = { logId: null, sha: null, file: null };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--log-id") flags.logId = args[++i];
  else if (a === "--sha") flags.sha = args[++i];
  else if (!a.startsWith("--")) flags.file = a;
}

// ---------- stack input ----------
async function readStackFromStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function fetchStackFromSupabase(logId) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase credentials not found in env. Export SUPABASE_SERVICE_ROLE_KEY " +
        "(preferred) or VITE_SUPABASE_ANON_KEY together with VITE_SUPABASE_URL."
    );
  }
  const res = await fetch(
    `${url}/rest/v1/error_logs?id=eq.${encodeURIComponent(
      logId
    )}&select=id,app_version,original_error,stack_trace,page_path,browser,created_at`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status} ${res.statusText}`);
  const rows = await res.json();
  if (!rows.length) throw new Error(`error_logs row not found: ${logId}`);
  return rows[0];
}

// ---------- map resolution ----------
async function findMapDir(sha) {
  const dir = join(".sourcemaps", sha);
  try {
    await access(dir);
    return dir;
  } catch {
    return null;
  }
}

function currentSha() {
  try {
    return execSync("git rev-parse --short=12 HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

async function loadConsumers(mapDir) {
  // Map each bundle basename (e.g. "AuctionDetail-DxAm9cxQ.js") to its
  // SourceMapConsumer instance, built lazily.
  const files = (await readdir(mapDir)).filter((f) => f.endsWith(".map"));
  const map = new Map();
  for (const f of files) {
    const jsName = f.replace(/\.map$/, "");
    map.set(jsName, {
      path: join(mapDir, f),
      consumer: null,
    });
  }
  return map;
}

async function consumerFor(entry) {
  if (!entry.consumer) {
    const raw = await readFile(entry.path, "utf8");
    entry.consumer = await new SourceMapConsumer(JSON.parse(raw));
  }
  return entry.consumer;
}

// ---------- frame parsing ----------
// Captures the bundle filename (basename) + line + column from either
// Chrome- or Safari-style frames.
const FRAME_RE =
  /(?:[@(\s])?(?:https?:\/\/[^\s)]+\/)?([A-Za-z0-9._-]+\.js)(?:[?#][^:]*)?:(\d+):(\d+)\)?\s*$/;

function parseFrame(line) {
  const m = line.match(FRAME_RE);
  if (!m) return null;
  return {
    file: basename(m[1]),
    line: Number(m[2]),
    column: Number(m[3]),
    raw: line,
  };
}

// ---------- main ----------
async function main() {
  let sha = flags.sha;
  let stack;
  let context = "";

  if (flags.logId) {
    const row = await fetchStackFromSupabase(flags.logId);
    sha = sha || row.app_version;
    stack = row.stack_trace || row.original_error || "";
    context =
      `\n=== error_logs/${row.id} ===\n` +
      `  created_at:  ${row.created_at}\n` +
      `  app_version: ${row.app_version}\n` +
      `  browser:     ${row.browser}\n` +
      `  page_path:   ${row.page_path}\n` +
      `  original:    ${row.original_error}\n`;
  } else if (flags.file) {
    stack = await readFile(flags.file, "utf8");
  } else {
    stack = await readStackFromStdin();
  }

  sha = sha || currentSha() || "unknown";
  const mapDir = await findMapDir(sha);

  if (context) process.stdout.write(context);

  if (!mapDir) {
    console.error(
      `\n❌ No sourcemaps found for SHA '${sha}' under .sourcemaps/.\n` +
        `   Rebuild locally at that commit:\n` +
        `     git checkout ${sha}\n` +
        `     npm ci && npm run build\n` +
        `   Then rerun this command.\n`
    );
    process.exit(2);
  }

  const consumers = await loadConsumers(mapDir);
  console.log(`\n🗺️  Using maps from ${mapDir}/ (${consumers.size} bundles)\n`);

  const lines = stack.split(/\r?\n/);
  const out = [];
  let resolvedCount = 0;
  let unresolvableCount = 0;

  for (const line of lines) {
    if (!line.trim()) {
      out.push(line);
      continue;
    }
    const frame = parseFrame(line);
    if (!frame) {
      // Minified frames like "al@" have no location — nothing we can do.
      if (/^[A-Za-z_$][\w$]*@\s*$/.test(line.trim())) unresolvableCount++;
      out.push(`  ? ${line}`);
      continue;
    }

    const entry = consumers.get(frame.file);
    if (!entry) {
      out.push(`  ? [no map for ${frame.file}] ${line}`);
      continue;
    }
    const consumer = await consumerFor(entry);
    const pos = consumer.originalPositionFor({ line: frame.line, column: frame.column });
    if (!pos.source) {
      out.push(`  ? [unresolved in ${frame.file}:${frame.line}:${frame.column}] ${line}`);
      continue;
    }
    resolvedCount++;
    const src = pos.source.replace(/^[./]*(src\/)/, "$1");
    out.push(`  at ${pos.name || "<anonymous>"} (${src}:${pos.line}:${pos.column})`);
  }

  // Cleanup consumers (frees wasm memory if applicable)
  for (const entry of consumers.values()) {
    if (entry.consumer) entry.consumer.destroy?.();
  }

  console.log(out.join("\n"));
  console.log(
    `\n📊 Summary: ${resolvedCount} frame(s) resolved, ${unresolvableCount} stripped-name frame(s) without location data.`
  );
}

main().catch((err) => {
  console.error("❌ decode-stack failed:", err.message);
  process.exit(1);
});
