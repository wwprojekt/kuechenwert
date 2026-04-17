/**
 * Post-build sourcemap relocation.
 *
 * Vite is configured with `build.sourcemap: "hidden"` → .map files are written
 * to dist/assets/ but NOT referenced from the .js bundles (no
 * //# sourceMappingURL comment). This script moves those .map files out of
 * dist/ into a local .sourcemaps/<sha>/ directory BEFORE Netlify syncs dist/,
 * so the maps never reach a public CDN but remain available locally for
 * decoding production stack traces.
 *
 * Runs on BOTH local and CI builds:
 *  - Local: developer keeps .sourcemaps/<sha>/ on disk, usable with
 *    `npm run decode-stack`.
 *  - CI (Netlify): .sourcemaps/ is discarded after the build — that's fine;
 *    the developer can check out the same SHA locally and rebuild to get
 *    byte-equivalent maps.
 */
import { execSync } from "child_process";
import { existsSync } from "fs";
import { mkdir, readdir, rename, writeFile } from "fs/promises";
import { join } from "path";

const DIST_ASSETS = "dist/assets";
const SOURCEMAP_ROOT = ".sourcemaps";

function resolveSha() {
  if (process.env.COMMIT_REF) return process.env.COMMIT_REF.slice(0, 12);
  try {
    return execSync("git rev-parse --short=12 HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

async function main() {
  if (!existsSync(DIST_ASSETS)) {
    console.log("⚠️  strip-sourcemaps: dist/assets not found, skipping");
    return;
  }

  const sha = resolveSha();
  const target = join(SOURCEMAP_ROOT, sha);
  await mkdir(target, { recursive: true });

  const files = await readdir(DIST_ASSETS);
  const mapFiles = files.filter((f) => f.endsWith(".map"));

  if (mapFiles.length === 0) {
    console.log("ℹ️  strip-sourcemaps: no .map files in dist/assets (sourcemap disabled?)");
    return;
  }

  let moved = 0;
  for (const file of mapFiles) {
    await rename(join(DIST_ASSETS, file), join(target, file));
    moved++;
  }

  // Write a manifest so `decode-stack.mjs` can find the right directory
  // without having to guess the SHA.
  const manifest = {
    sha,
    generatedAt: new Date().toISOString(),
    mapCount: moved,
    node: process.version,
  };
  await writeFile(join(target, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`\n🗺️  Sourcemaps: moved ${moved} file(s) → ${target}/`);
  console.log(`   Use: npm run decode-stack -- <error_log_id_or_file>\n`);
}

main().catch((err) => {
  console.error("⚠️  strip-sourcemaps failed:", err.message);
  process.exit(0); // never fail the build because of sourcemap handling
});
