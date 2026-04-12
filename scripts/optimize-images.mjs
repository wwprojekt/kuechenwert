/**
 * Post-build image optimization script.
 * Runs after `vite build` to compress images in dist/ and create
 * smaller responsive variants (e.g. -sm.webp for mobile).
 *
 * Uses sharp for fast, high-quality compression.
 */
import sharp from 'sharp';
import { readdir, stat, mkdir, copyFile } from 'fs/promises';
import { join, extname, basename } from 'path';

const WEBP_QUALITY = 72;
const JPEG_QUALITY = 75;
const PNG_QUALITY = 80;

const RESPONSIVE_BREAKPOINTS = [
  { suffix: '-sm', width: 400 },
  { suffix: '-md', width: 800 },
];

const DIRS_TO_OPTIMIZE = ['dist/images', 'dist/assets'];

// Images that should get responsive variants
const NEEDS_RESPONSIVE = [
  'hero-motorhome',
  'motorhome-integrated',
  'motorhome-alcove',
  'motorhome-van',
  'caravan-touring',
];

async function dirExists(dir) {
  try {
    const s = await stat(dir);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function optimizeImage(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (!['.webp', '.jpg', '.jpeg', '.png'].includes(ext)) return;

  const fileStat = await stat(filePath);
  const originalSize = fileStat.size;

  // Skip tiny files
  if (originalSize < 5000) return;

  const img = sharp(filePath);
  const metadata = await img.metadata();

  let pipeline = sharp(filePath);

  if (ext === '.webp') {
    pipeline = pipeline.webp({ quality: WEBP_QUALITY, effort: 6 });
  } else if (ext === '.jpg' || ext === '.jpeg') {
    pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
  } else if (ext === '.png') {
    pipeline = pipeline.png({ quality: PNG_QUALITY, compressionLevel: 9 });
  }

  const buffer = await pipeline.toBuffer();

  // Only write if actually smaller
  if (buffer.length < originalSize) {
    await sharp(buffer).toFile(filePath);
    const saved = ((originalSize - buffer.length) / 1024).toFixed(1);
    console.log(`  ✓ ${basename(filePath)}: ${(originalSize/1024).toFixed(1)}KB → ${(buffer.length/1024).toFixed(1)}KB (-${saved}KB)`);
  } else {
    console.log(`  ○ ${basename(filePath)}: already optimal (${(originalSize/1024).toFixed(1)}KB)`);
  }

  // Create responsive variants if needed
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
        resPipeline = resPipeline.png({ quality: PNG_QUALITY });
      }

      const resBuffer = await resPipeline.toBuffer();
      await sharp(resBuffer).toFile(outPath);
      console.log(`  + ${basename(outPath)}: ${(resBuffer.length/1024).toFixed(1)}KB (${bp.width}px)`);
    }
  }
}

async function optimizeDir(dir) {
  if (!(await dirExists(dir))) {
    console.log(`  Skip ${dir} (not found)`);
    return;
  }

  const files = await readdir(dir);
  for (const file of files) {
    const filePath = join(dir, file);
    const s = await stat(filePath);
    if (s.isFile()) {
      await optimizeImage(filePath);
    }
  }
}

async function main() {
  console.log('\n🖼️  Optimizing images...\n');

  for (const dir of DIRS_TO_OPTIMIZE) {
    console.log(`📁 ${dir}/`);
    await optimizeDir(dir);
    console.log('');
  }

  console.log('✅ Image optimization complete!\n');
}

main().catch(err => {
  console.error('Image optimization failed:', err);
  // Don't fail the build — images just won't be optimized
  process.exit(0);
});
