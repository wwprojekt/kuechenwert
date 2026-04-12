/**
 * Post-build image optimization using native cwebp CLI tool.
 * No Node.js image libraries needed — uses libwebp-tools from Alpine.
 *
 * - Compresses all .webp files in dist/ with quality 72
 * - Creates responsive variants (-sm 400px, -md 800px) for key images
 */
import { execSync } from 'child_process';
import { readdir, stat } from 'fs/promises';
import { join, extname, basename } from 'path';

const QUALITY = 72;
const DIRS = ['dist/images', 'dist/assets'];

const NEEDS_RESPONSIVE = [
  'hero-motorhome',
  'motorhome-integrated',
  'motorhome-alcove',
  'motorhome-van',
  'caravan-touring',
];

const BREAKPOINTS = [
  { suffix: '-sm', width: 400 },
  { suffix: '-md', width: 800 },
];

function hasCwebp() {
  try {
    execSync('cwebp -version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function dirExists(dir) {
  try { return (await stat(dir)).isDirectory(); }
  catch { return false; }
}

async function processDir(dir) {
  if (!(await dirExists(dir))) {
    console.log(`  Skip ${dir} (not found)`);
    return;
  }

  console.log(`📁 ${dir}/`);
  const files = await readdir(dir);

  for (const file of files) {
    const ext = extname(file).toLowerCase();
    if (ext !== '.webp') continue;

    const filePath = join(dir, file);
    const fileStat = await stat(filePath);
    if (fileStat.size < 5000) continue;

    const originalKB = (fileStat.size / 1024).toFixed(1);

    // Compress in-place: decode webp → re-encode with lower quality
    const tmpPath = filePath + '.tmp.png';
    if (run(`dwebp "${filePath}" -o "${tmpPath}"`) &&
        run(`cwebp -q ${QUALITY} -m 6 "${tmpPath}" -o "${filePath}"`)) {
      const newStat = await stat(filePath);
      const newKB = (newStat.size / 1024).toFixed(1);
      const saved = (fileStat.size - newStat.size) / 1024;
      if (saved > 1) {
        console.log(`  ✓ ${file}: ${originalKB}KB → ${newKB}KB (-${saved.toFixed(1)}KB)`);
      } else {
        console.log(`  ○ ${file}: already optimal (${originalKB}KB)`);
      }
    }
    run(`rm -f "${tmpPath}"`);

    // Create responsive variants for key images
    const name = basename(file, ext);
    if (!NEEDS_RESPONSIVE.some(n => name.includes(n))) continue;

    for (const bp of BREAKPOINTS) {
      const outFile = file.replace(ext, `${bp.suffix}${ext}`);
      const outPath = join(dir, outFile);

      if (run(`dwebp "${filePath}" -o "${tmpPath}"`) &&
          run(`cwebp -q ${QUALITY} -m 6 -resize ${bp.width} 0 "${tmpPath}" -o "${outPath}"`)) {
        const outStat = await stat(outPath);
        console.log(`  + ${outFile}: ${(outStat.size / 1024).toFixed(1)}KB (${bp.width}px)`);
      }
      run(`rm -f "${tmpPath}"`);
    }
  }
}

async function main() {
  console.log('\n🖼️  Optimizing images...\n');

  if (!hasCwebp()) {
    console.log('⚠️  cwebp not found — skipping image optimization');
    console.log('   Install with: apk add libwebp-tools\n');
    return;
  }

  for (const dir of DIRS) {
    await processDir(dir);
    console.log('');
  }

  console.log('✅ Image optimization complete!\n');
}

main().catch(err => {
  console.error('⚠️  Image optimization failed:', err.message);
  process.exit(0);
});
