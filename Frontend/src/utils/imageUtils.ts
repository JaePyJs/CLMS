/**
 * Image Utility Functions
 *
 * Common utility functions for image handling, optimization,
 * and performance monitoring in the CLMS application.
 */

import { imageOptimizationService } from '@/services/imageOptimizationService';

// Common image sizes for the CLMS application
export const IMAGE_SIZES = {
  // Profile pictures
  AVATAR: {
    small: { width: 32, height: 32 },
    medium: { width: 64, height: 64 },
    large: { width: 128, height: 128 },
  },
  // Student photos
  STUDENT_PHOTO: {
    thumbnail: { width: 150, height: 200 },
    medium: { width: 300, height: 400 },
    large: { width: 600, height: 800 },
  },
  // Book covers
  BOOK_COVER: {
    thumbnail: { width: 80, height: 120 },
    medium: { width: 160, height: 240 },
    large: { width: 320, height: 480 },
  },
  // Equipment images
  EQUIPMENT: {
    thumbnail: { width: 100, height: 100 },
    medium: { width: 200, height: 200 },
    large: { width: 400, height: 400 },
  },
  // Barcode/QR codes
  BARCODE: {
    small: { width: 200, height: 80 },
    medium: { width: 400, height: 160 },
    large: { width: 600, height: 240 },
  },
  // Background images
  BACKGROUND: {
    small: { width: 800, height: 600 },
    medium: { width: 1200, height: 900 },
    large: { width: 1920, height: 1080 },
  },
} as const;

// Responsive breakpoints for image loading
export const IMAGE_BREAKPOINTS = {
  mobile: 640,
  tablet: 1024,
  desktop: 1280,
  large: 1536,
} as const;

/**
 * Generate responsive image sizes based on container and device
 */
export const generateResponsiveSizes = (
  containerSize: 'small' | 'medium' | 'large' = 'medium'
): string => {
  const sizes = {
    small: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
    medium: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
    large: '(max-width: 640px) 100vw, (max-width: 1024px) 75vw, 50vw',
  };

  return sizes[containerSize];
};

/**
 * Generate image srcSet for different screen densities
 */
export const generateDensitySrcSet = (
  baseUrl: string,
  width?: number,
  height?: number,
  quality: number = 75
): string => {
  const densities = [1, 2, 3];
  return densities
    .map(density => {
      const w = width ? width * density : undefined;
      const h = height ? height * density : undefined;
      const url = imageOptimizationService.generateOptimizedUrl(baseUrl, {
        width: w,
        height: h,
        quality: Math.max(quality - (density - 1) * 10, 50), // Reduce quality for higher densities
      });
      return `${url} ${density}x`;
    })
    .join(', ');
};

/**
 * Get optimal image dimensions for a specific use case
 */
export const getOptimalDimensions = (
  useCase: keyof typeof IMAGE_SIZES,
  size: 'small' | 'medium' | 'large' = 'medium'
) => {
  return IMAGE_SIZES[useCase][size];
};

/**
 * Generate optimized image URL for specific use case
 */
export const generateOptimizedImageUrl = (
  baseUrl: string,
  useCase: keyof typeof IMAGE_SIZES,
  size: 'small' | 'medium' | 'large' = 'medium',
  quality: number = 75
): string => {
  const dimensions = getOptimalDimensions(useCase, size);
  return imageOptimizationService.generateOptimizedUrl(baseUrl, {
    ...dimensions,
    quality,
    format: imageOptimizationService.getOptimalFormat(),
  });
};

/**
 * Preload critical images for better performance
 */
export const preloadCriticalImages = async (
  imageUrls: string[],
  priority: 'high' | 'low' = 'high'
): Promise<void[]> => {
  const promises = imageUrls.map(url =>
    imageOptimizationService.preloadImage(url, priority).catch(error => {
      console.warn(`Failed to preload image: ${url}`, error);
      return null;
    })
  );

  return Promise.all(promises);
};

/**
 * Generate placeholder image for specific dimensions
 */
export const generatePlaceholder = (
  width: number,
  height: number,
  type: 'solid' | 'gradient' = 'gradient'
): string => {
  const color = type === 'solid' ? '#e5e7eb' : '#f3f4f6';
  return imageOptimizationService.generatePlaceholder(width, height, color);
};

/**
 * Validate image URL
 */
export const isValidImageUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url, window.location.origin);
    return /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(urlObj.pathname);
  } catch {
    return false;
  }
};

/**
 * Extract file extension from image URL
 */
export const getImageExtension = (url: string): string | null => {
  try {
    const urlObj = new URL(url, window.location.origin);
    const match = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
};

/**
 * Convert image to blob (for uploads)
 */
export const urlToBlob = async (url: string): Promise<Blob> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  return response.blob();
};

/**
 * Convert file to data URL
 */
export const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Compress image file before upload
 */
export const compressImageFile = (
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1080,
  quality: number = 0.8
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;

      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }

      if (height > maxHeight) {
        width = (maxHeight / height) * width;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Get image file size in human readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Calculate image aspect ratio
 */
export const getAspectRatio = (width: number, height: number): number => {
  return width / height;
};

/**
 * Generate common aspect ratios
 */
export const ASPECT_RATIOS = {
  square: 1,
  portrait: 3/4,
  landscape: 4/3,
  widescreen: 16/9,
  cinema: 21/9,
} as const;

/**
 * Generate image loading priority based on position
 */
export const getImagePriority = (
  position: 'above-fold' | 'below-fold' | 'hidden'
): 'high' | 'low' | 'auto' => {
  const priorities = {
    'above-fold': 'high',
    'below-fold': 'auto',
    'hidden': 'low',
  };
  return priorities[position];
};

/**
 * Generate blur placeholder for image
 */
export const generateBlurPlaceholder = async (
  imageUrl: string,
  width: number = 40,
  height: number = 40
): Promise<string> => {
  try {
    return await imageOptimizationService.generateBlurPlaceholder(imageUrl, width, height);
  } catch (error) {
    console.warn('Failed to generate blur placeholder:', error);
    return generatePlaceholder(width, height, 'solid');
  }
};

/**
 * Check if image is loading from cache
 */
export const isImageCached = async (imageUrl: string): Promise<boolean> => {
  try {
    const response = await fetch(imageUrl, { method: 'HEAD' });
    return response.headers.get('x-cache') === 'HIT';
  } catch {
    return false;
  }
};

/**
 * Create responsive picture element sources
 */
export const createPictureSources = (
  baseUrl: string,
  breakpoints: {
    mobile?: { width?: number; height?: number };
    tablet?: { width?: number; height?: number };
    desktop?: { width?: number; height?: number };
  } = {}
) => {
  const sources = [];

  if (breakpoints.desktop) {
    sources.push({
      srcSet: imageOptimizationService.generateSrcSet(baseUrl, {
        ...breakpoints.desktop,
        format: 'avif',
      }),
      media: '(min-width: 1024px)',
      type: 'image/avif',
    });

    sources.push({
      srcSet: imageOptimizationService.generateSrcSet(baseUrl, {
        ...breakpoints.desktop,
        format: 'webp',
      }),
      media: '(min-width: 1024px)',
      type: 'image/webp',
    });
  }

  if (breakpoints.tablet) {
    sources.push({
      srcSet: imageOptimizationService.generateSrcSet(baseUrl, {
        ...breakpoints.tablet,
        format: 'avif',
      }),
      media: '(min-width: 640px)',
      type: 'image/avif',
    });

    sources.push({
      srcSet: imageOptimizationService.generateSrcSet(baseUrl, {
        ...breakpoints.tablet,
        format: 'webp',
      }),
      media: '(min-width: 640px)',
      type: 'image/webp',
    });
  }

  // Mobile fallback
  sources.push({
    srcSet: imageOptimizationService.generateSrcSet(baseUrl, {
      ...breakpoints.mobile,
      format: 'avif',
    }),
    type: 'image/avif',
  });

  sources.push({
    srcSet: imageOptimizationService.generateSrcSet(baseUrl, {
      ...breakpoints.mobile,
      format: 'webp',
    }),
    type: 'image/webp',
  });

  return sources;
};

// Export commonly used image configurations
export const DEFAULT_IMAGE_CONFIG = {
  quality: 75,
  format: 'webp' as const,
  loading: 'lazy' as const,
  decoding: 'async' as const,
  fetchPriority: 'auto' as const,
};