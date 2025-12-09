import React, {
  useState,
  useRef,
  useEffect,
  memo,
  forwardRef,
  useImperativeHandle,
  type ComponentType,
} from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number | undefined;
  height?: number | undefined;
  className?: string | undefined;
  placeholder?: string | undefined;
  blurDataURL?: string | undefined;
  priority?: boolean | undefined;
  quality?: number | undefined;
  format?: 'webp' | 'avif' | 'png' | 'jpg' | undefined;
  sizes?: string | undefined;
  srcSet?: string | undefined;
  onLoad?: (() => void) | undefined;
  onError?: (() => void) | undefined;
  lazy?: boolean | undefined;
  fadeDuration?: number | undefined;
  style?: React.CSSProperties | undefined;
  aspectRatio?: number | undefined;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down' | undefined;
  decoding?: 'async' | 'auto' | 'sync' | undefined;
  loading?: 'lazy' | 'eager' | undefined;
  fetchPriority?: 'high' | 'low' | 'auto' | undefined;
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
    .map((size) => `${src}?w=${size}&f=${format}&q=${quality} ${size}w`)
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

const OptimizedImage = forwardRef<HTMLImageElement, OptimizedImageProps>(
  (props, ref) => {
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
    useImperativeHandle(ref, () => imgRef.current as HTMLImageElement);

    // Generate placeholder if not provided
    const placeholderSrc =
      placeholder ||
      (width && height ? generatePlaceholder(width, height) : '');

    // Generate responsive srcSet if not provided
    const generatedSrcSet = srcSet || generateSrcSet(src, format, quality);

    // Handle image load
    const handleLoad = () => {
      setImageState((prev) => ({
        ...prev,
        isLoading: false,
        isLoaded: true,
      }));
      onLoad?.();
    };

    // Handle image error
    const handleError = () => {
      setImageState((prev) => ({
        ...prev,
        isLoading: false,
        hasError: true,
      }));
      onError?.();
    };

    // Setup intersection observer for lazy loading
    useEffect(() => {
      if (!lazy || priority) {
        return;
      }

      const img = imgRef.current;
      if (!img) {
        return;
      }

      observerRef.current = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (entry && entry.isIntersecting) {
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
      // Return undefined for cases where preloading is not needed
      return undefined;
    }, [priority, src]);

    // Calculate aspect ratio style
    const aspectRatioStyle = aspectRatio
      ? {
          aspectRatio: `${aspectRatio}`,
          ...style,
        }
      : style;

    // Ensure width/height attributes exist to prevent layout shift
    useEffect(() => {
      const img = imgRef.current;
      const container = containerRef.current;
      if (!img || !container) {
        return;
      }

      const hasWidthAttr = img.getAttribute('width');
      const hasHeightAttr = img.getAttribute('height');

      if (!hasWidthAttr || !hasHeightAttr) {
        const w = width ?? container.clientWidth ?? img.clientWidth;
        const h =
          height ??
          container.clientHeight ??
          (aspectRatio ? Math.round((w || 0) / aspectRatio) : img.clientHeight);
        if (w && h) {
          img.setAttribute('width', String(w));
          img.setAttribute('height', String(h));
        }
      }
    }, [width, height, aspectRatio]);

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
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Failed to load image
            </span>
          </div>
        )}

        {/* Main Image */}
        <img
          ref={imgRef}
          src={src}
          srcSet={generatedSrcSet}
          sizes={sizes}
          alt={alt}
          {...(width !== undefined ? { width } : {})}
          {...(height !== undefined ? { height } : {})}
          loading={priority ? 'eager' : loading}
          decoding={decoding}
          {...(fetchPriority && fetchPriority !== 'auto'
            ? { fetchpriority: fetchPriority }
            : {})}
          className={`w-full h-full object-${objectFit} transition-opacity duration-${fadeDuration} ${
            imageState.isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            objectFit,
          }}
        />
      </div>
    );
  }
);

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
  return OptimizedComponent as unknown as ComponentType<
    P & OptimizedImageProps
  >;
};

// Utility function to preload images
export const preloadImage = (src: string): Promise<void> => {
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
  if (!ctx) {
    return 'png';
  }

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
