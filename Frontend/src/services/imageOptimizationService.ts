/**
 * Image Optimization Service
 *
 * Provides utilities for image optimization, format detection,
 * and performance monitoring for images in the CLMS application.
 */

interface ImageConfig {
  quality: number;
  format: 'webp' | 'avif' | 'png' | 'jpg';
  width?: number;
  height?: number;
  crop?: boolean;
  resize?: 'fit' | 'fill' | 'crop';
  blur?: number;
  grayscale?: boolean;
  rotate?: number;
}

interface ImageMetrics {
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  loadTime: number;
  format: string;
  dimensions: { width: number; height: number };
}

interface OptimizationResult {
  optimizedUrl: string;
  metrics: ImageMetrics;
  savings: {
    size: number;
    percentage: number;
  };
}

class ImageOptimizationService {
  private static instance: ImageOptimizationService;
  private supportedFormats: Set<string> = new Set();
  private imageCache: Map<string, OptimizationResult> = new Map();
  private performanceMetrics: Map<string, ImageMetrics[]> = new Map();

  private constructor() {
    this.detectSupportedFormats();
    this.setupPerformanceObserver();
  }

  public static getInstance(): ImageOptimizationService {
    if (!ImageOptimizationService.instance) {
      ImageOptimizationService.instance = new ImageOptimizationService();
    }
    return ImageOptimizationService.instance;
  }

  /**
   * Detect supported image formats in the browser
   */
  private detectSupportedFormats(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Test AVIF support
    try {
      const avifData = canvas.toDataURL('image/avif');
      if (avifData.indexOf('data:image/avif') === 0) {
        this.supportedFormats.add('avif');
      }
    } catch (e) {
      console.debug('AVIF not supported');
    }

    // Test WebP support
    try {
      const webpData = canvas.toDataURL('image/webp');
      if (webpData.indexOf('data:image/webp') === 0) {
        this.supportedFormats.add('webp');
      }
    } catch (e) {
      console.debug('WebP not supported');
    }

    // Fallback formats are always supported
    this.supportedFormats.add('png');
    this.supportedFormats.add('jpg');
    this.supportedFormats.add('jpeg');
  }

  /**
   * Get the best supported format for the current browser
   */
  public getOptimalFormat(): 'avif' | 'webp' | 'png' | 'jpg' {
    if (this.supportedFormats.has('avif')) return 'avif';
    if (this.supportedFormats.has('webp')) return 'webp';
    return 'jpg';
  }

  /**
   * Generate optimized image URL with transformation parameters
   */
  public generateOptimizedUrl(
    baseUrl: string,
    config: Partial<ImageConfig> = {}
  ): string {
    const defaultConfig: ImageConfig = {
      quality: 75,
      format: this.getOptimalFormat(),
      resize: 'fit',
    };

    const finalConfig = { ...defaultConfig, ...config };
    const url = new URL(baseUrl, window.location.origin);

    // Add optimization parameters
    Object.entries(finalConfig).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value.toString());
      }
    });

    // Add cache-busting for development
    if (process.env.NODE_ENV === 'development') {
      url.searchParams.set('v', Date.now().toString());
    }

    return url.toString();
  }

  /**
   * Generate responsive srcSet for images
   */
  public generateSrcSet(
    baseUrl: string,
    config: Partial<ImageConfig> = {},
    sizes: number[] = [320, 640, 768, 1024, 1280, 1536]
  ): string {
    return sizes
      .map(size => {
        const url = this.generateOptimizedUrl(baseUrl, {
          ...config,
          width: size,
        });
        return `${url} ${size}w`;
      })
      .join(', ');
  }

  /**
   * Generate sizes attribute for responsive images
   */
  public generateSizes(breakpoints: {
    mobile?: string;
    tablet?: string;
    desktop?: string;
  } = {}): string {
    const {
      mobile = '100vw',
      tablet = '50vw',
      desktop = '33vw',
    } = breakpoints;

    return '(max-width: 640px) ' + mobile + ', ' +
           '(max-width: 1024px) ' + tablet + ', ' +
           desktop;
  }

  /**
   * Preload an image with specified priority
   */
  public async preloadImage(
    url: string,
    priority: 'high' | 'low' = 'low'
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      link.fetchPriority = priority as "auto" | "high" | "low";

      link.onload = () => {
        document.head.removeChild(link);
        resolve();
      };

      link.onerror = () => {
        document.head.removeChild(link);
        reject(new Error(`Failed to preload image: ${url}`));
      };

      document.head.appendChild(link);
    });
  }

  /**
   * Load and measure image performance
   */
  public async loadImageWithMetrics(
    url: string,
    config: Partial<ImageConfig> = {}
  ): Promise<OptimizationResult> {
    const startTime = performance.now();
    const optimizedUrl = this.generateOptimizedUrl(url, config);

    // Check cache first
    if (this.imageCache.has(optimizedUrl)) {
      return this.imageCache.get(optimizedUrl)!;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      let originalSize = 0;
      let optimizedSize = 0;

      // Load original image for comparison
      const originalImg = new Image();
      originalImg.crossOrigin = 'anonymous';
      originalImg.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = originalImg.naturalWidth;
        canvas.height = originalImg.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(originalImg, 0, 0);
          originalSize = canvas.toDataURL('image/jpeg', 0.9).length * 0.75; // Approximate size
        }
      };

      originalImg.src = url;

      img.onload = () => {
        const loadTime = performance.now() - startTime;

        // Get optimized image size (approximation)
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          optimizedSize = canvas.toDataURL('image/jpeg', config.quality || 0.75).length * 0.75;
        }

        const metrics: ImageMetrics = {
          originalSize,
          optimizedSize,
          compressionRatio: originalSize > 0 ? originalSize / optimizedSize : 1,
          loadTime,
          format: config.format || this.getOptimalFormat(),
          dimensions: {
            width: img.naturalWidth,
            height: img.naturalHeight,
          },
        };

        const result: OptimizationResult = {
          optimizedUrl,
          metrics,
          savings: {
            size: originalSize - optimizedSize,
            percentage: originalSize > 0 ? ((originalSize - optimizedSize) / originalSize) * 100 : 0,
          },
        };

        // Cache the result
        this.imageCache.set(optimizedUrl, result);

        // Store performance metrics
        const urlMetrics = this.performanceMetrics.get(url) || [];
        urlMetrics.push(metrics);
        this.performanceMetrics.set(url, urlMetrics.slice(-10)); // Keep last 10 measurements

        resolve(result);
      };

      img.onerror = () => {
        reject(new Error(`Failed to load image: ${optimizedUrl}`));
      };

      img.src = optimizedUrl;
    });
  }

  /**
   * Batch optimize multiple images
   */
  public async batchOptimizeImages(
    images: Array<{ url: string; config?: Partial<ImageConfig> }>
  ): Promise<OptimizationResult[]> {
    const promises = images.map(({ url, config }) =>
      this.loadImageWithMetrics(url, config).catch(error => ({
        optimizedUrl: url,
        metrics: {
          originalSize: 0,
          optimizedSize: 0,
          compressionRatio: 1,
          loadTime: 0,
          format: 'jpg',
          dimensions: { width: 0, height: 0 },
        },
        savings: { size: 0, percentage: 0 },
        error: error.message,
      }))
    );

    return Promise.all(promises);
  }

  /**
   * Get performance metrics for an image
   */
  public getImageMetrics(url: string): ImageMetrics[] {
    return this.performanceMetrics.get(url) || [];
  }

  /**
   * Get aggregated performance statistics
   */
  public getPerformanceStats(): {
    totalImages: number;
    averageLoadTime: number;
    averageCompressionRatio: number;
    totalSavings: number;
    formatDistribution: Record<string, number>;
  } {
    const allMetrics = Array.from(this.performanceMetrics.values()).flat();

    if (allMetrics.length === 0) {
      return {
        totalImages: 0,
        averageLoadTime: 0,
        averageCompressionRatio: 0,
        totalSavings: 0,
        formatDistribution: {},
      };
    }

    const totalLoadTime = allMetrics.reduce((sum, m) => sum + m.loadTime, 0);
    const totalCompressionRatio = allMetrics.reduce((sum, m) => sum + m.compressionRatio, 0);
    const totalSavings = allMetrics.reduce((sum, m) => sum + (m.originalSize - m.optimizedSize), 0);

    const formatDistribution: Record<string, number> = {};
    allMetrics.forEach(m => {
      formatDistribution[m.format] = (formatDistribution[m.format] || 0) + 1;
    });

    return {
      totalImages: allMetrics.length,
      averageLoadTime: totalLoadTime / allMetrics.length,
      averageCompressionRatio: totalCompressionRatio / allMetrics.length,
      totalSavings,
      formatDistribution,
    };
  }

  /**
   * Clear image cache
   */
  public clearCache(): void {
    this.imageCache.clear();
    this.performanceMetrics.clear();
  }

  /**
   * Setup performance observer for monitoring
   */
  private setupPerformanceObserver(): void {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const resourceEntry = entry as PerformanceResourceTiming;
          if (resourceEntry.initiatorType === 'img') {
            // Track image loading performance
            const url = entry.name;
            const loadTime = entry.duration;

            console.debug(`Image loaded: ${url} in ${loadTime.toFixed(2)}ms`);
          }
        });
      });

      observer.observe({ entryTypes: ['resource'] });
    }
  }

  /**
   * Generate placeholder image data URL
   */
  public generatePlaceholder(
    width: number,
    height: number,
    color: string = '#e5e7eb'
  ): string {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, width, height);

      // Add subtle gradient
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }

    return canvas.toDataURL('image/jpeg', 0.1);
  }

  /**
   * Generate blur placeholder
   */
  public generateBlurPlaceholder(
    imageUrl: string,
    width: number = 40,
    height: number = 40
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          // Draw scaled down and blurred image
          ctx.filter = 'blur(10px)';
          ctx.drawImage(img, 0, 0, width, height);

          const blurDataUrl = canvas.toDataURL('image/jpeg', 0.1);
          resolve(blurDataUrl);
        } else {
          reject(new Error('Could not get canvas context'));
        }
      };

      img.onerror = () => reject(new Error('Failed to load image for blur placeholder'));
      img.src = imageUrl;
    });
  }

  /**
   * Check if image format is supported
   */
  public isFormatSupported(format: string): boolean {
    return this.supportedFormats.has(format.toLowerCase());
  }

  /**
   * Get all supported formats
   */
  public getSupportedFormats(): string[] {
    return Array.from(this.supportedFormats);
  }
}

// Export singleton instance
export const imageOptimizationService = ImageOptimizationService.getInstance();
export default imageOptimizationService;

// Export types
export type { ImageConfig, ImageMetrics, OptimizationResult };