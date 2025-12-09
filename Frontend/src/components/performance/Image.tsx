import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  type ComponentType,
} from 'react';
import OptimizedImage from './OptimizedImage';
import { imageOptimizationService } from '@/services/imageOptimizationService';
import {
  generateResponsiveSizes,
  generateOptimizedImageUrl,
  generateBlurPlaceholder,
  preloadCriticalImages,
  getImagePriority,
  createPictureSources,
  DEFAULT_IMAGE_CONFIG,
} from '@/utils/imageUtils';

interface ImageProps {
  src: string;
  alt: string;
  useCase?:
    | 'AVATAR'
    | 'STUDENT_PHOTO'
    | 'BOOK_COVER'
    | 'EQUIPMENT'
    | 'BARCODE'
    | 'BACKGROUND';
  size?: 'small' | 'medium' | 'large';
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  position?: 'above-fold' | 'below-fold' | 'hidden';
  quality?: number;
  format?: 'webp' | 'avif' | 'png' | 'jpg';
  lazy?: boolean;
  placeholder?: 'blur' | 'solid' | 'gradient' | 'none';
  aspectRatio?: number;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  onLoad?: () => void;
  onError?: () => void;
  style?: React.CSSProperties;
  sizes?: string;
  srcSet?: string;
  // Advanced options
  enableResponsive?: boolean;
  breakpoints?: {
    mobile?: { width?: number; height?: number };
    tablet?: { width?: number; height?: number };
    desktop?: { width?: number; height?: number };
  };
  // Performance monitoring
  trackPerformance?: boolean;
  // Fallback options
  fallbackSrc?: string;
  retryCount?: number;
  maxRetries?: number;
}

const PerformanceImage: ComponentType<ImageProps> = forwardRef<
  HTMLDivElement,
  ImageProps
>(
  (
    {
      src,
      alt,
      useCase,
      size = 'medium',
      width,
      height,
      className = '',
      priority = false,
      position = 'below-fold',
      quality = DEFAULT_IMAGE_CONFIG.quality,
      format,
      lazy = true,
      placeholder = 'blur',
      aspectRatio,
      objectFit = 'cover',
      onLoad,
      onError,
      style,
      sizes,
      srcSet,
      enableResponsive = true,
      breakpoints,
      trackPerformance = true,
      fallbackSrc,
      maxRetries = 3,
    },
    ref
  ) => {
    const [imageState, setImageState] = useState({
      isLoading: true,
      isLoaded: false,
      hasError: false,
      currentSrc: src,
      retryCount: 0,
    });

    const [blurPlaceholder, setBlurPlaceholder] = useState<string>('');
    const [_performanceMetrics, setPerformanceMetrics] =
      useState<unknown>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);

    // Generate optimized image URL
    const optimizedSrc = React.useMemo(() => {
      if (useCase) {
        return generateOptimizedImageUrl(src, useCase, size, quality);
      }

      return imageOptimizationService.generateOptimizedUrl(src, {
        quality,
        format: format || imageOptimizationService.getOptimalFormat(),
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
      });
    }, [src, useCase, size, width, height, quality, format]);

    // Generate responsive sizes
    const responsiveSizes = React.useMemo(() => {
      if (sizes) {
        return sizes;
      }
      if (enableResponsive) {
        return generateResponsiveSizes(size);
      }
      return undefined;
    }, [sizes, enableResponsive, size]);

    // Generate srcSet
    const generatedSrcSet = React.useMemo(() => {
      if (srcSet) {
        return srcSet;
      }
      if (useCase) {
        return imageOptimizationService.generateSrcSet(optimizedSrc, {
          quality,
          format: format || imageOptimizationService.getOptimalFormat(),
        });
      }
      return undefined;
    }, [srcSet, useCase, optimizedSrc, quality, format]);

    // Generate blur placeholder
    useEffect(() => {
      if (placeholder === 'blur' && !blurPlaceholder) {
        generateBlurPlaceholder(optimizedSrc)
          .then(setBlurPlaceholder)
          .catch(() => {
            // Fallback to solid placeholder
            setBlurPlaceholder(
              imageOptimizationService.generatePlaceholder(
                width || 300,
                height || 200
              )
            );
          });
      }
    }, [placeholder, optimizedSrc, width, height, blurPlaceholder]);

    // Preload priority images
    useEffect(() => {
      if (priority && optimizedSrc) {
        preloadCriticalImages([optimizedSrc], 'high');
      }
    }, [priority, optimizedSrc]);

    // Track performance
    useEffect(() => {
      if (trackPerformance && !imageState.isLoaded && !imageState.hasError) {
        const startTime = performance.now();

        const handleLoad = () => {
          const loadTime = performance.now() - startTime;
          setPerformanceMetrics({
            loadTime: Math.round(loadTime),
            format: format || imageOptimizationService.getOptimalFormat(),
            src: optimizedSrc,
            timestamp: new Date().toISOString(),
          });

          // Log performance in development
          if (process.env.NODE_ENV === 'development') {
            console.info(`Image loaded: ${alt} in ${loadTime.toFixed(2)}ms`);
          }
        };

        const img = new window.Image();
        img.onload = handleLoad;
        img.onerror = () =>
          console.warn('Failed to load image for performance tracking');
        img.src = optimizedSrc;
      }
    }, [
      trackPerformance,
      imageState.isLoaded,
      imageState.hasError,
      alt,
      optimizedSrc,
      format,
    ]);

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
      const shouldRetry = imageState.retryCount < maxRetries;

      if (shouldRetry && fallbackSrc && imageState.retryCount === 0) {
        // Try fallback source (already validated as non-null by the if condition)
        setImageState((prev) => ({
          ...prev,
          currentSrc: fallbackSrc,
          retryCount: prev.retryCount + 1,
        }));
      } else if (shouldRetry) {
        // Retry the same image
        setTimeout(
          () => {
            setImageState((prev) => ({
              ...prev,
              retryCount: prev.retryCount + 1,
            }));
          },
          1000 * Math.pow(2, imageState.retryCount)
        ); // Exponential backoff
      } else {
        // Final error state
        setImageState((prev) => ({
          ...prev,
          isLoading: false,
          hasError: true,
        }));
        onError?.();
      }
    };

    // Reset state when src changes
    useEffect(() => {
      setImageState({
        isLoading: true,
        isLoaded: false,
        hasError: false,
        currentSrc: src,
        retryCount: 0,
      });
      setPerformanceMetrics(null);
    }, [src]);

    // Calculate fetch priority
    const fetchPriority = getImagePriority(position);

    // Generate picture sources for responsive images
    const pictureSources = React.useMemo(() => {
      if (!enableResponsive || !breakpoints) {
        return [];
      }
      return createPictureSources(optimizedSrc, breakpoints);
    }, [enableResponsive, breakpoints, optimizedSrc]);

    // Render responsive picture element
    if (enableResponsive && pictureSources.length > 0) {
      return (
        <div
          ref={ref || containerRef}
          className={`relative ${className}`}
          style={style}
        >
          <picture className="w-full h-full">
            {pictureSources.map((source, index) => (
              <source
                key={index}
                srcSet={source.srcSet}
                media={source.media}
                type={source.type}
              />
            ))}
            <OptimizedImage
              ref={imageRef}
              src={imageState.currentSrc}
              alt={alt}
              width={width}
              height={height}
              quality={quality}
              format={format}
              sizes={responsiveSizes}
              srcSet={generatedSrcSet}
              onLoad={handleLoad}
              onError={handleError}
              placeholder={placeholder === 'blur' ? blurPlaceholder : undefined}
              aspectRatio={aspectRatio}
              objectFit={objectFit}
              loading={priority ? 'eager' : lazy ? 'lazy' : 'eager'}
              fetchPriority={fetchPriority}
              className="w-full h-full"
            />
          </picture>
        </div>
      );
    }

    // Render simple optimized image
    return (
      <div
        ref={ref || containerRef}
        className={`relative ${className}`}
        style={style}
      >
        <OptimizedImage
          ref={imageRef}
          src={imageState.currentSrc}
          alt={alt}
          width={width ?? undefined}
          height={height ?? undefined}
          quality={quality ?? undefined}
          format={format ?? undefined}
          sizes={responsiveSizes ?? undefined}
          srcSet={generatedSrcSet ?? undefined}
          onLoad={handleLoad}
          onError={handleError}
          placeholder={placeholder === 'blur' ? blurPlaceholder : undefined}
          aspectRatio={aspectRatio ?? undefined}
          objectFit={objectFit ?? undefined}
          loading={priority ? 'eager' : lazy ? 'lazy' : 'eager'}
          fetchPriority={fetchPriority ?? undefined}
          className="w-full h-full"
        />
      </div>
    );
  }
);

PerformanceImage.displayName = 'PerformanceImage';

export default PerformanceImage;

// Specialized components for common use cases
export const AvatarImage: ComponentType<
  Omit<ImageProps, 'useCase' | 'size'>
> = (props) => <PerformanceImage {...props} useCase="AVATAR" />;

export const StudentPhotoImage: ComponentType<
  Omit<ImageProps, 'useCase' | 'size'>
> = (props) => <PerformanceImage {...props} useCase="STUDENT_PHOTO" />;

export const BookCoverImage: ComponentType<
  Omit<ImageProps, 'useCase' | 'size'>
> = (props) => <PerformanceImage {...props} useCase="BOOK_COVER" />;

export const EquipmentImage: ComponentType<
  Omit<ImageProps, 'useCase' | 'size'>
> = (props) => <PerformanceImage {...props} useCase="EQUIPMENT" />;

export const BarcodeImage: ComponentType<
  Omit<ImageProps, 'useCase' | 'size'>
> = (props) => (
  <PerformanceImage {...props} useCase="BARCODE" lazy={false} priority={true} />
);

export const BackgroundImage: ComponentType<
  Omit<ImageProps, 'useCase' | 'size'>
> = (props) => (
  <PerformanceImage
    {...props}
    useCase="BACKGROUND"
    lazy={false}
    priority={props.priority || false}
  />
);
