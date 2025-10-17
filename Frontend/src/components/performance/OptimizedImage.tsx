import React, { useState, useRef, useEffect, memo, forwardRef, useImperativeHandle } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  placeholder?: string;
  blurDataURL?: string;
  priority?: boolean;
  quality?: number;
  format?: 'webp' | 'avif' | 'png' | 'jpg';
  sizes?: string;
  srcSet?: string;
  onLoad?: () => void;
  onError?: () => void;
  lazy?: boolean;
  fadeDuration?: number;
  style?: React.CSSProperties;
  aspectRatio?: number;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  decoding?: 'async' | 'auto' | 'sync';
  loading?: 'lazy' | 'eager';
  fetchPriority?: 'high' | 'low' | 'auto';
}

interface ImageState {
  isLoading: boolean;
  isLoaded: boolean;
  hasError: boolean;
  currentSrc: string;
}

// Generate responsive srcSet
const generateSrcSet = (
  src: string,
  format: string,
  quality: number,
  sizes: number[] = [320, 640, 768, 1024, 1280, 1536]
): string => {
  return sizes
    .map(size => `${src}?w=${size}&f=${format}&q=${quality} ${size}w`)
    .join(', ');
};

// Generate placeholder image
const generatePlaceholder = (width: number, height: number): string => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, 0, width, height);
  }
  return canvas.toDataURL('image/jpeg', 0.1);
};

const OptimizedImage = forwardRef<HTMLImageElement, OptimizedImageProps>((props, ref) => {
  const {
    src,
    alt,
    width,
    height,
    className = '',
    placeholder,
    blurDataURL,
    priority = false,
    quality = 75,
    format = 'webp',
    sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
    srcSet,
    onLoad,
    onError,
    lazy = true,
    fadeDuration = 300,
    style,
    aspectRatio,
    objectFit = 'cover',
    decoding = 'async',
    loading = 'lazy',
    fetchPriority = 'auto',
  } = props;
  const [imageState, setImageState] = useState<ImageState>({
    isLoading: true,
    isLoaded: false,
    hasError: false,
    currentSrc: src,
  });

  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Expose ref to parent component
  useImperativeHandle(ref, () => imgRef.current!);

  // Generate placeholder if not provided
  const placeholderSrc = placeholder || (width && height ? generatePlaceholder(width, height) : '');

  // Generate responsive srcSet if not provided
  const generatedSrcSet = srcSet || generateSrcSet(src, format, quality);

  // Handle image load
  const handleLoad = () => {
    setImageState(prev => ({
      ...prev,
      isLoading: false,
      isLoaded: true,
    }));
    onLoad?.();
  };

  // Handle image error
  const handleError = () => {
    setImageState(prev => ({
      ...prev,
      isLoading: false,
      hasError: true,
    }));
    onError?.();
  };

  // Setup intersection observer for lazy loading
  useEffect(() => {
    if (!lazy || priority) return;

    const img = imgRef.current;
    if (!img) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          img.loading = 'lazy';
          img.decoding = decoding;
          observerRef.current?.disconnect();
        }
      },
      {
        rootMargin: '50px', // Start loading 50px before image comes into view
        threshold: 0.01,
      }
    );

    observerRef.current.observe(img);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [lazy, priority, decoding]);

  // Preload priority images
  useEffect(() => {
    if (priority && src) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      // link.fetchPriority = 'high'; // fetchPriority not supported on link elements
      document.head.appendChild(link);

      return () => {
        document.head.removeChild(link);
      };
    }
  }, [priority, src]);

  // Calculate aspect ratio style
  const aspectRatioStyle = aspectRatio ? {
    aspectRatio: `${aspectRatio}`,
    ...style,
  } : style;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={aspectRatioStyle}
    >
      {/* Loading/Placeholder State */}
      {(imageState.isLoading || imageState.hasError) && placeholderSrc && (
        <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800">
          <img
            src={placeholderSrc}
            alt=""
            className="w-full h-full object-cover"
            style={{
              filter: blurDataURL ? 'blur(20px)' : 'none',
              transform: 'scale(1.1)',
              transition: 'opacity 0.3s ease-in-out',
            }}
          />
        </div>
      )}

      {/* Loading Indicator */}
      {imageState.isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 dark:bg-gray-900/80">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {/* Error State */}
      {imageState.hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
          <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
          <span className="text-sm text-gray-600 dark:text-gray-400">Failed to load image</span>
        </div>
      )}

      {/* Main Image */}
      <img
        ref={imgRef}
        src={src}
        srcSet={generatedSrcSet}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : loading}
        decoding={decoding}
        fetchpriority={priority ? 'high' : fetchPriority}
        className={`w-full h-full object-${objectFit} transition-opacity duration-${fadeDuration} ${
          imageState.isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={handleLoad}
        onError={handleError}
        style={{
          objectFit,
        }}
      />

      {/* Priority Indicator for Development */}
      {process.env.NODE_ENV === 'development' && priority && (
        <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
          Priority
        </div>
      )}
    </div>
  );
});

OptimizedImage.displayName = 'OptimizedImage';

export default OptimizedImage;

// Higher-order component for image optimization
export const withImageOptimization = <P extends object>(
  Component: ComponentType<P>
): ComponentType<P & OptimizedImageProps> => {
  const OptimizedComponent = memo((props: P & OptimizedImageProps) => {
    return <Component {...props} />;
  });

  OptimizedComponent.displayName = `withImageOptimization(${Component.displayName || Component.name})`;
  return OptimizedComponent;
};

// Utility function to preload images
export const preloadImage = (src: string, priority: 'high' | 'low' = 'low'): Promise<void> => {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    // link.fetchPriority = priority; // fetchPriority not supported on link elements
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to preload image: ${src}`));
    document.head.appendChild(link);
  });
};

// Utility function to get optimal image format
export const getOptimalFormat = (): 'avif' | 'webp' | 'png' | 'jpg' => {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'png';

  // Check for AVIF support
  if (canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0) {
    return 'avif';
  }

  // Check for WebP support
  if (canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0) {
    return 'webp';
  }

  // Fallback to PNG
  return 'png';
};

// Responsive image component for art direction
export const ResponsiveImage: ComponentType<{
  sources: Array<{
    srcSet: string;
    media?: string;
    type?: string;
  }>;
  fallbackSrc: string;
  alt: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}> = memo(({ sources, fallbackSrc, alt, className, onLoad, onError }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  return (
    <picture className={className}>
      {sources.map((source, index) => (
        <source
          key={index}
          srcSet={source.srcSet}
          media={source.media}
          type={source.type}
        />
      ))}
      <img
        src={fallbackSrc}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
      )}
    </picture>
  );
});

ResponsiveImage.displayName = 'ResponsiveImage';
