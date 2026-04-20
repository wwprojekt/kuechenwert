/**
 * Client-side Image Optimization Library
 * Handles image compression, resizing, and format conversion
 */

import { logger } from './logger';

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1 for JPEG, 0-100 for WebP
  format?: 'jpeg' | 'webp' | 'png';
  maintainAspectRatio?: boolean;
  enableProgressive?: boolean;
}

export interface OptimizedImage {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  width: number;
  height: number;
  format: string;
}

export interface ImageMetadata {
  width: number;
  height: number;
  size: number;
  type: string;
  name: string;
  lastModified: number;
}

class ImageOptimizer {
  // Mobile canvas pixel limit (conservative: 4096*4096 = 16.7M).
  // Source images beyond this are likely to corrupt drawImage silently.
  private static readonly MAX_SOURCE_PIXELS = 16_777_216;

  // Minimum blob size (bytes) we accept from canvas.toBlob.
  // A valid JPEG of even 1×1 pixel is ~600 bytes.
  // If the blob is smaller, canvas likely produced garbage.
  private static readonly MIN_BLOB_SIZE = 500;

  /**
   * Get image metadata without loading the full image
   */
  async getImageMetadata(file: File): Promise<ImageMetadata> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({
          width: img.width,
          height: img.height,
          size: file.size,
          type: file.type,
          name: file.name,
          lastModified: file.lastModified,
        });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image metadata'));
      };

      img.src = url;
    });
  }

  /**
   * Load image from file
   */
  private async loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          reject(new Error('Image loaded but has 0×0 dimensions'));
          return;
        }
        resolve(img);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }

  /**
   * Calculate optimal dimensions while maintaining aspect ratio
   */
  private calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    options: ImageOptimizationOptions
  ): { width: number; height: number } {
    let { width, height } = { width: originalWidth, height: originalHeight };

    if (options.maxWidth && width > options.maxWidth) {
      height = (height * options.maxWidth) / width;
      width = options.maxWidth;
    }

    if (options.maxHeight && height > options.maxHeight) {
      width = (width * options.maxHeight) / height;
      height = options.maxHeight;
    }

    return { width: Math.round(width), height: Math.round(height) };
  }

  /**
   * Verify canvas actually contains visible pixel data (not all-transparent/all-black).
   * Samples a few pixels across the canvas to detect silent drawImage failures.
   */
  private verifyCanvasHasContent(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
    const samplePoints = [
      [Math.floor(width / 4), Math.floor(height / 4)],
      [Math.floor(width / 2), Math.floor(height / 2)],
      [Math.floor(width * 3 / 4), Math.floor(height * 3 / 4)],
      [Math.floor(width / 2), Math.floor(height / 4)],
      [Math.floor(width / 4), Math.floor(height / 2)],
    ];

    let allBlack = true;
    for (const [x, y] of samplePoints) {
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      // pixel is [R, G, B, A] — if ANY sample has non-black content, we're good
      if (pixel[0] > 5 || pixel[1] > 5 || pixel[2] > 5) {
        allBlack = false;
        break;
      }
    }
    return !allBlack;
  }

  /**
   * Optimize a single image (uses a fresh canvas per call for concurrency safety)
   */
  async optimizeImage(
    file: File,
    options: ImageOptimizationOptions = {}
  ): Promise<OptimizedImage> {
    const defaultOptions: Required<ImageOptimizationOptions> = {
      maxWidth: 1920,
      maxHeight: 1080,
      quality: 0.8,
      format: 'jpeg',
      maintainAspectRatio: true,
      enableProgressive: true,
    };

    const config = { ...defaultOptions, ...options };

    try {
      const img = await this.loadImage(file);

      const sourcePixels = img.naturalWidth * img.naturalHeight;
      if (sourcePixels > ImageOptimizer.MAX_SOURCE_PIXELS) {
        logger.warn(
          `Image too large for canvas: ${img.naturalWidth}×${img.naturalHeight} = ${sourcePixels}px (limit ${ImageOptimizer.MAX_SOURCE_PIXELS}px). Skipping optimization.`
        );
        throw new Error(`Source image exceeds safe canvas limit (${sourcePixels}px)`);
      }

      const { width, height } = this.calculateDimensions(
        img.naturalWidth,
        img.naturalHeight,
        config
      );

      if (width <= 0 || height <= 0) {
        throw new Error(`Invalid canvas dimensions: ${width}×${height}`);
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context not supported');

      canvas.width = width;
      canvas.height = height;

      // Fill with white background BEFORE drawing the image.
      // Canvas defaults to transparent black (rgba(0,0,0,0)).
      // JPEG doesn't support transparency, so without this fill,
      // any transparent pixels become BLACK in the output.
      if (config.format === 'jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Verify canvas has visible content. On mobile browsers with memory
      // pressure, drawImage can silently fail leaving the canvas empty.
      if (!this.verifyCanvasHasContent(ctx, width, height)) {
        logger.warn(
          `Canvas verification failed: drawImage produced no visible content for ${file.name} (${img.naturalWidth}×${img.naturalHeight}). Skipping optimization.`
        );
        throw new Error('Canvas drawImage produced empty/black output');
      }

      const blob = await this.canvasToBlob(canvas, config.format, config.quality);

      if (blob.size < ImageOptimizer.MIN_BLOB_SIZE) {
        logger.warn(
          `Suspiciously small blob (${blob.size} bytes) for ${width}×${height} canvas. Skipping optimization.`
        );
        throw new Error(`Canvas produced suspiciously small output (${blob.size} bytes)`);
      }

      // Release canvas memory immediately
      canvas.width = 0;
      canvas.height = 0;

      const optimizedFile = new File(
        [blob],
        this.generateFileName(file.name, config.format),
        {
          type: blob.type || `image/${config.format}`,
          lastModified: Date.now(),
        }
      );

      return {
        file: optimizedFile,
        originalSize: file.size,
        compressedSize: blob.size,
        compressionRatio: Math.round(((file.size - blob.size) / file.size) * 100),
        width,
        height,
        format: config.format,
      };
    } catch (error) {
      throw new Error(`Image optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert canvas to blob with specified format and quality
   */
  private canvasToBlob(canvas: HTMLCanvasElement, format: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const mimeType = `image/${format}`;
      
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size > 0) {
            resolve(blob);
          } else {
            reject(new Error('Failed to convert canvas to blob (null or empty)'));
          }
        },
        mimeType,
        quality > 1 ? quality / 100 : quality
      );
    });
  }

  /**
   * Generate optimized file name
   */
  private generateFileName(originalName: string, format: string): string {
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
    const timestamp = Date.now();
    return `${nameWithoutExt}_optimized_${timestamp}.${format}`;
  }

  /**
   * Create thumbnail from image
   */
  async createThumbnail(
    file: File,
    size: number = 150,
    format: 'jpeg' | 'webp' = 'jpeg'
  ): Promise<File> {
    const optimized = await this.optimizeImage(file, {
      maxWidth: size,
      maxHeight: size,
      quality: 0.7,
      format,
      maintainAspectRatio: true,
    });

    const thumbnailFile = new File(
      [optimized.file],
      this.generateThumbnailName(file.name, format),
      {
        type: optimized.file.type,
        lastModified: Date.now(),
      }
    );

    return thumbnailFile;
  }

  /**
   * Generate thumbnail file name
   */
  private generateThumbnailName(originalName: string, format: string): string {
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
    return `${nameWithoutExt}_thumb.${format}`;
  }

  /**
   * Batch optimize multiple images
   */
  async optimizeImages(
    files: File[],
    options: ImageOptimizationOptions = {},
    onProgress?: (progress: number, current: number, total: number) => void
  ): Promise<OptimizedImage[]> {
    const results: OptimizedImage[] = [];
    const total = files.length;

    for (let i = 0; i < files.length; i++) {
      try {
        const optimized = await this.optimizeImage(files[i], options);
        results.push(optimized);
        
        if (onProgress) {
          onProgress(Math.round(((i + 1) / total) * 100), i + 1, total);
        }
      } catch (error) {
        logger.error(`Failed to optimize image ${files[i].name}:`, error);
        // Continue with other images even if one fails
      }
    }

    return results;
  }

  /**
   * Check if image needs optimization
   */
  async shouldOptimize(
    file: File,
    options: ImageOptimizationOptions = {}
  ): Promise<boolean> {
    const metadata = await this.getImageMetadata(file);
    
    // Check file size (optimize if > 1MB)
    if (metadata.size > 1024 * 1024) {
      return true;
    }

    // Check dimensions
    if (options.maxWidth && metadata.width > options.maxWidth) {
      return true;
    }

    if (options.maxHeight && metadata.height > options.maxHeight) {
      return true;
    }

    // Check format (optimize if not in preferred format)
    const preferredFormat = options.format || 'jpeg';
    if (!metadata.type.includes(preferredFormat)) {
      return true;
    }

    return false;
  }

  /**
   * Validate image file
   */
  validateImageFile(file: File): { valid: boolean; error?: string } {
    // Check supported formats
    const supportedFormats = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif'];
    
    // Some mobile browsers (especially iOS Safari) report HEIC/HEIF files with
    // empty MIME type or 'application/octet-stream'. We detect them by file extension.
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const heicExtensions = ['heic', 'heif'];
    const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'heic', 'heif', 'bmp', 'tiff', 'tif'];
    const isHeicByExtension = heicExtensions.includes(ext);
    const isImageByExtension = imageExtensions.includes(ext);

    // Check file type - allow if MIME starts with image/ OR if extension is a known image format
    if (!file.type.startsWith('image/') && !isImageByExtension) {
      // Special case: empty MIME or octet-stream with image extension
      if (file.type === '' || file.type === 'application/octet-stream') {
        if (!isImageByExtension) {
          return { valid: false, error: 'Datei ist kein Bild. Bitte laden Sie JPG, PNG, WebP oder HEIC hoch.' };
        }
      } else {
        return { valid: false, error: 'Datei ist kein Bild. Bitte laden Sie JPG, PNG, WebP oder HEIC hoch.' };
      }
    }

    // Check supported MIME types (skip check for HEIC by extension since MIME may be wrong)
    if (!isHeicByExtension && file.type && !supportedFormats.includes(file.type) && file.type !== 'application/octet-stream') {
      return { valid: false, error: 'Nicht unterstütztes Bildformat. Erlaubt: JPG, PNG, WebP, HEIC, AVIF.' };
    }

    // Check file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return { valid: false, error: 'Bild zu groß (max. 50 MB). Bitte verkleinern Sie das Bild.' };
    }

    return { valid: true };
  }
}

// Export singleton instance
export const imageOptimizer = new ImageOptimizer();

// Export convenience functions
export const optimizeImage = (file: File, options?: ImageOptimizationOptions) =>
  imageOptimizer.optimizeImage(file, options);

export const optimizeImages = (
  files: File[],
  options?: ImageOptimizationOptions,
  onProgress?: (progress: number, current: number, total: number) => void
) => imageOptimizer.optimizeImages(files, options, onProgress);

export const createThumbnail = (file: File, size?: number, format?: 'jpeg' | 'webp') =>
  imageOptimizer.createThumbnail(file, size, format);

export const getImageMetadata = (file: File) =>
  imageOptimizer.getImageMetadata(file);

export const shouldOptimizeImage = (file: File, options?: ImageOptimizationOptions) =>
  imageOptimizer.shouldOptimize(file, options);

export const validateImageFile = (file: File) =>
  imageOptimizer.validateImageFile(file);

// Predefined optimization presets
export const OPTIMIZATION_PRESETS = {
  // High quality for hero images
  HIGH_QUALITY: {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.9,
    format: 'jpeg' as const,
  },
  
  // Standard quality for regular images
  STANDARD: {
    maxWidth: 1200,
    maxHeight: 800,
    quality: 0.8,
    format: 'jpeg' as const,
  },
  
  // Compressed for thumbnails
  THUMBNAIL: {
    maxWidth: 300,
    maxHeight: 300,
    quality: 0.7,
    format: 'jpeg' as const,
  },
  
  // WebP for modern browsers
  WEBP_STANDARD: {
    maxWidth: 1200,
    maxHeight: 800,
    quality: 80,
    format: 'webp' as const,
  },

  // Wizard upload: höhere Auflösung als STANDARD (Verkäufer wollen Detail-
  // schärfe für Käufer in Lightbox), aber garantiert < 2 MB damit die
  // serverseitige `process-photo` Edge Function (jsquash WASM, 256 MB
  // Function-Memory) das Original sicher dekodieren kann.
  // 2400×1600 q82 JPEG produziert empirisch ~600-1500 KB für typische
  // Wohnmobil-Innenraum-Aufnahmen. Wer high-res-Originale braucht, lädt
  // sie nachträglich über AdminPhotoManager hoch (kein 2-MB-Limit).
  WIZARD_UPLOAD: {
    maxWidth: 2400,
    maxHeight: 1600,
    quality: 0.82,
    format: 'jpeg' as const,
  },
} as const;
