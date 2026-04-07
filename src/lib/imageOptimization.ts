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
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context not supported');
    }
    this.ctx = context;
  }

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
   * Optimize a single image
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
      const { width, height } = this.calculateDimensions(
        img.width,
        img.height,
        config
      );

      // Set canvas dimensions
      this.canvas.width = width;
      this.canvas.height = height;

      // Clear canvas and set high-quality rendering
      this.ctx.clearRect(0, 0, width, height);
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';

      // Draw image to canvas
      this.ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob with specified format and quality
      const blob = await this.canvasToBlob(config.format, config.quality);

      // Create optimized file
      const optimizedFile = new File(
        [blob],
        this.generateFileName(file.name, config.format),
        {
          type: blob.type,
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
  private canvasToBlob(format: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const mimeType = `image/${format}`;
      
      this.canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to convert canvas to blob'));
          }
        },
        mimeType,
        format === 'jpeg' ? quality : quality / 100
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
} as const;
