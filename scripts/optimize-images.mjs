/**
 * Post-build image optimization script.
 * Runs after `vite build` to compress images in dist/ and create
 * smaller responsive variants (e.g. -sm.webp for mobile).
 *
 * Installs sharp on-the-fly if not already present (avoids lockfile changes).
 */
import { execSync } from 'child_process';
import { readdir, stat } from 'fs/promises';
import { join, extname, basename } from 'path';

const WEBP_QUALITY = 72;
const JPEG_QUALITY = 75;

const RESPONSIVE_BREAKPOINTS = [
  { suffix: '-sm', width: 400 },
  { suffix: '-md', width: 800 },
];

const DIRS_TO_OPTIMIZE = ['dist/images', 'dist/assets'];

const NEEDS_RESPONSIVE = [
  'hero-motorhome',
  'motorhome-integrated',
  'motorhome-alcove',
  'motorhome-van',
  'caravan-touring',
];

async function ensureSharp() {
  try {
    await import('sharp');
    return (await import('sharp')).default;
  } catch {
    console.log('  Installing sharp...');
    try {
      execSync('npm install --no-save sharp@0.33.5 2>&1', { stdio: 'pipe' });
      return (await import('sharp')).default;
    } catch (err) {
      console.warn('  Could not install sharp, skipping image optimization.');
      console.warn('  ', err.message?.slice(0, 200));
      return null;
    }
  }
}

async function dirExists(dir) {
  try {
    const s = await stat(dir);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function optimizeImage(sharp, filePath) {
  const ext = extname(filePath).toLowerCase();
  if (!['.webp', '.jpg', '.jpeg', '.png'].includes(ext)) return;

  const fileStat = await stat(filePath);
  const originalSize = fileStat.size;
  if (originalSize < 5000) return;

  const metadata = await sharp(filePath).metadata();

  let pipeline = sharp(filePath);
  if (ext === '.webp') {
    pipeline = pipeline.webp({ quality: WEBP_QUALITY, effort: 6 });
  } else if (ext === '.jpg' || ext === '.jpeg') {
    pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
  } else if (ext === '.png') {
    pipeline = pipeline.png({ compressionLevel: 9 });
  }

  const buffer = await pipeline.toBuffer();
  if (buffer.length < originalSize) {
    await sharp(buffer).toFile(filePath);
    const saved = ((originalSize - buffer.length) / 1024).toFixed(1);
    console.log(`  ✓ ${basename(filePath)}: ${(originalSize/1024).toFixed(1)}KB → ${(buffer.length/1024).toFixed(1)}KB (-${saved}KB)`);
  } else {
    console.log(`  ○ ${basename(filePath)}: already optimal`);
  }

  const name = basename(filePath, ext);
  const needsResponsive = NEEDS_RESPONSIVE.some(n => name.includes(n));
  if (needsResponsive && metadata.width > 500) {
    for (const bp of RESPONSIVE_BREAKPOINTS) {
      if (metadata.width <= bp.width) continue;
      const outPath = filePath.replace(ext, `${bp.suffix}${ext}`);
      let resPipeline = sharp(filePath)
        .resize({ width: bp.width, withoutEnlargement: true });
      if (ext === '.webp') {
        resPipeline = resPipeline.webp({ quality: WEBP_QUALITY, effort: 6 });
      } else if (ext === '.jpg' || ext === '.jpeg') {
        resPipeline = resPipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
      } else if (ext === '.png') {
        resPipeline = resPipeline.png({ compressionLevel: 9 });
      }
      const resBuffer = await resPipeline.toBuffer();
      await sharp(resBuffer).toFile(outPath);
      console.log(`  + ${basename(outPath)}: ${(resBuffer.length/1024).toFixed(1)}KB (${bp.width}px)`);
    }
  }
}

async function optimizeDir(sharp, dir) {
  if (!(await dirExists(dir))) {
    console.log(`  Skip ${dir} (not found)`);
    return;
  }
  const files = await readdir(dir);
  for (const file of files) {
    const filePath = join(dir, file);
    const s = await stat(filePath);
    if (s.isFile()) {
      await optimizeImage(sharp, filePath);
    }
  }
}

async function main() {
  console.log('\n🖼️  Optimizing images...\n');

  const sharp = await ensureSharp();
  if (!sharp) {
    console.log('⚠️  Skipping — sharp not available\n');
    return;
  }

  for (const dir of DIRS_TO_OPTIMIZE) {
    console.log(`📁 ${dir}/`);
    await optimizeDir(sharp, dir);
    console.log('');
  }

  console.log('✅ Image optimization complete!\n');
}

main().catch(err => {
  console.error('Image optimization failed:', err.message);
  process.exit(0);
});
