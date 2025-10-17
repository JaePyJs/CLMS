import React, { Suspense, lazy, Component, memo } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Loader2, AlertCircle, Wifi, WifiOff } from 'lucide-react';

// Lazy loading component states
type LoadingState = 'idle' | 'loading' | 'success' | 'error' | 'retry';

interface LazyLoadProps {
  loader?: ReactNode;
  fallback?: ReactNode;
  errorFallback?: ReactNode;
  delay?: number;
  retryCount?: number;
  maxRetries?: number;
  retryDelay?: number;
  onRetry?: () => void;
  onError?: (error: Error) => void;
  onLoad?: () => void;
  prefetch?: boolean;
  threshold?: number;
  rootMargin?: string;
  trigger?: boolean;
}

interface LoadingIndicatorProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  showSpinner?: boolean;
  skeleton?: boolean;
}

interface ErrorFallbackProps {
  error: Error;
  retryCount: number;
  onRetry: () => void;
  maxRetries: number;
  component?: string;
}

// Loading indicator component
const LoadingIndicator = memo(({ size = 'md', message = 'Loading...', showSpinner = true, skeleton = false }: LoadingIndicatorProps) => {
  if (skeleton) {
    return (
      <div className="animate-pulse">
        <div className="bg-slate-200 dark:bg-slate-700 rounded-lg h-32 w-full mb-2"></div>
        <div className="bg-slate-200 dark:bg-slate-700 rounded h-4 w-3/4 mb-2"></div>
        <div className="bg-slate-200 dark:bg-slate-700 rounded h-4 w-1/2"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      {showSpinner && (
        <Loader2
          className={`animate-spin ${
            size === 'sm' ? 'h-4 w-4' :
            size === 'lg' ? 'h-8 w-8' : 'h-6 w-6'
          } text-primary mb-4`}
        />
      )}
      <p className="text-sm text-muted-foreground font-medium">{message}</p>
    </div>
  );
});

// Error fallback component
const ErrorFallback = memo(({ error, retryCount, onRetry, maxRetries, component = 'Component' }: ErrorFallbackProps) => {
  const canRetry = retryCount < maxRetries;

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-3 mb-4">
        <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        Failed to Load {component}
      </h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md">
        {error.message || 'An error occurred while loading this component.'}
      </p>
      {canRetry && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Retry {retryCount} of {maxRetries}
          </p>
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Try Again
          </button>
        </div>
      )}
      {!canRetry && (
        <p className="text-xs text-red-600 dark:text-red-400">
          Maximum retries reached. Please refresh the page.
        </p>
      )}
    </div>
  );
});

// Network detection component
const NetworkStatus = memo(() => {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const [hasConnection, setHasConnection] = React.useState(true);

  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setHasConnection(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const checkConnection = async () => {
      try {
        const response = await fetch('/api/health', {
          method: 'HEAD',
          cache: 'no-store',
          signal: AbortSignal.timeout(3000)
        });
        setHasConnection(response.ok);
      } catch (error) {
        setHasConnection(false);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    checkConnection();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-1 text-sm rounded-md border">
      {isOnline && hasConnection ? (
        <>
          <Wifi className="h-3 w-3 text-green-500" />
          <span className="text-green-600 dark:text-green-400">Online</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3 text-red-500" />
          <span className="text-red-600 dark:text-red-400">
            {!isOnline ? 'Offline' : 'No Connection'}
          </span>
        </>
      )}
    </div>
  );
});

// Advanced lazy load component with retry and prefetch
export const createLazyLoad = <T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  options: Partial<LazyLoadProps> = {}
) => {
  const {
    loader = <LoadingIndicator />,
    fallback = <LoadingIndicator />,
    errorFallback,
    delay = 200,
    retryCount = 0,
    maxRetries = 3,
    retryDelay = 1000,
    onRetry,
    onError,
    onLoad,
    prefetch = false,
    threshold = 0.1,
    rootMargin = '50px',
    trigger = true
  } = options;

  const LazyComponent = lazy(importFunc, {
    loading: () => (
      <div style={{ height: '200px' }}>
        {loader}
      </div>
    )
  });

  return memo((props: any) => {
    const [loadingState, setLoadingState] = React.useState<LoadingState>('idle');
    const [currentRetryCount, setCurrentRetryCount] = React.useState(0);

    const handleRetry = React.useCallback(() => {
      setCurrentRetryCount(prev => prev + 1);
      setLoadingState('retry');
      onRetry?.();

      // Reset loading state after delay
      setTimeout(() => {
        setLoadingState('loading');
      }, 100);
    }, [onRetry]);

    const handleError = React.useCallback((error: Error) => {
      setLoadingState('error');
      onError?.(error);
      console.error('Lazy loading error:', error);
    }, [onError]);

    const handleLoad = React.useCallback(() => {
      setLoadingState('success');
      onLoad?.();
    }, [onLoad]);

    // Component implementation with Intersection Observer for prefetching
    const observerRef = React.useRef<IntersectionObserver | null>(null);
    const elementRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
      if (prefetch && elementRef.current && trigger) {
        observerRef.current = new IntersectionObserver(
          (entries) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                // Prefetch the component
                importFunc();
                observerRef.current?.disconnect();
              }
            });
          },
          { threshold, rootMargin }
        );

        observerRef.current.observe(elementRef.current);
      }

      return () => {
        observerRef.current?.disconnect();
      };
    }, [prefetch, trigger, threshold, rootMargin, importFunc]);

    // Reset state when component changes
    React.useEffect(() => {
      setCurrentRetryCount(0);
      setLoadingState('loading');
    }, [importFunc]);

    if (loadingState === 'retry' && currentRetryCount > 0) {
      return (
        <div>
          <LoadingIndicator
            message={`Retrying... (${currentRetryCount}/${maxRetries})`}
            showSpinner
          />
        </div>
      );
    }

    return (
      <div ref={elementRef}>
        <Suspense
          fallback={
            <div style={{ minHeight: delay ? '0px' : '200px' }}>
              {delay === 0 ? fallback : (
                <div style={{ opacity: 0, transition: 'opacity 0.3s ease-in-out' }}>
                  {fallback}
                </div>
              )}
            </div>
          }
        >
          <LazyComponent
            {...props}
            onError={handleError}
            onLoad={handleLoad}
          />
        </Suspense>
      </div>
    );
  });
};

// Preload component for critical resources
export const preloadComponent = <T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>
) => {
  React.useEffect(() => {
    importFunc();
  }, [importFunc]);
};

// Intersection Observer based lazy loading for images
export const LazyImage = memo(({
  src,
  alt,
  className,
  placeholder,
  onLoad,
  onError,
  ...props
}: {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  onLoad?: () => void;
  onError?: () => void;
  [key: string]: any;
}) => {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [isInView, setIsInView] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (isInView && src && !isLoaded && !hasError) {
      if (imgRef.current) {
        imgRef.current.src = src;
      }
    }
  }, [isInView, src, isLoaded, hasError]);

  return (
    <div className={`relative overflow-hidden ${className || ''}`}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-slate-200 dark:bg-slate-700 animate-pulse flex items-center justify-center">
          {placeholder ? (
            <img
              src={placeholder}
              alt={alt}
              className="w-full h-full object-cover opacity-50"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 to-slate-800" />
          )}
        </div>
      )}
      <img
        ref={imgRef}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${hasError ? 'opacity-50' : ''}`}
        onLoad={() => {
          setIsLoaded(true);
          onLoad?.();
        }}
        onError={() => {
          setHasError(true);
          onError?.();
        }}
        {...props}
      />
    </div>
  );
});

LazyImage.displayName = 'LazyImage';

// Bundle analysis and reporting
export const BundleAnalyzer = memo(() => {
  const [bundleSize, setBundleSize] = React.useState(0);
  const [loadTime, setLoadTime] = React.useState(0);
  const [chunkCount, setChunkCount] = React.useState(0);

  React.useEffect(() => {
    // Analyze bundle size if performance API is available
    if ('performance' in window && 'memory' in performance) {
      const analyzeBundle = () => {
        const navigation = performance.getEntriesByType('navigation')[0];
        if (navigation) {
          setLoadTime(Math.round(navigation.loadEventEnd - navigation.loadEventStart));
        }

        // Get resource timing info for chunks
        const resources = performance.getEntriesByType('resource');
        const jsResources = resources.filter(r => r.name.endsWith('.js'));
        setChunkCount(jsResources.length);

        // Calculate approximate bundle size
        const totalSize = jsResources.reduce((sum, resource) => {
          return sum + (resource.transferSize || 0);
        }, 0);
        setBundleSize(totalSize);
      };

      // Analyze after initial load
      setTimeout(analyzeBundle, 1000);
    }
  }, []);

  return (
    <div className="hidden lg:block fixed bottom-4 right-4 bg-black/80 text-white p-3 rounded-lg text-xs">
      <div className="space-y-1">
        <div>Bundle: {(bundleSize / 1024).toFixed(1)}KB</div>
        <div>Chunks: {chunkCount}</div>
        <div>Load: {loadTime}ms</div>
      </div>
    </div>
  );
});

// Performance monitoring HOC
export const withPerformanceMonitoring = <P extends object>(
  Component: ComponentType<P>
) => {
  const MonitoredComponent = memo((props: P) => {
    const [renderCount, setRenderCount] = React.useState(0);
    const [lastRenderTime, setLastRenderTime] = React.useState<number>(Date.now());

    React.useEffect(() => {
      const now = Date.now();
      const timeSinceLastRender = now - lastRenderTime;

      // Log performance metrics in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`Component ${Component.displayName} rendered:`, {
          renderCount: renderCount + 1,
          timeSinceLastRender: `${timeSinceLastRender}ms`,
          props: Object.keys(props).slice(0, 3)
        });
      }

      setRenderCount(prev => prev + 1);
      setLastRenderTime(now);
    });

    return <Component {...props} />;
  });

  MonitoredComponent.displayName = `withPerformanceMonitoring(${Component.displayName || Component.name})`;

  return MonitoredComponent;
};

// Virtual list for large datasets
interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  overscan?: number;
  className?: string;
}

export const VirtualList = <T,>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className
}: VirtualListProps<T>) => {
  const [scrollTop, setScrollTop] = React.useState(0);
  const [startIndex, setStartIndex] = React.useState(0);
  const [endIndex, setEndIndex] = React.useState(0);

  const containerRef = React.useRef<HTMLDivElement>(null);

  // Calculate visible range
  React.useEffect(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    setStartIndex(start);
    setEndIndex(end);
  }, [scrollTop, containerHeight, itemHeight, items.length, overscan]);

  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const visibleItems = items.slice(startIndex, endIndex + 1);

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className || ''}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: startIndex * itemHeight, position: 'relative' }}>
        {visibleItems.map((item, index) => (
          <div
            key={startIndex + index}
            style={{
              position: 'absolute',
              top: (startIndex + index) * itemHeight,
              height: itemHeight,
              width: '100%'
            }}
          >
            {renderItem(item, startIndex + index)}
          </div>
        ))}
      </div>
      {items.length > endIndex + 1 && (
        <div style={{ height: (items.length - endIndex - 1) * itemHeight }}>
          {/* Spacer for remaining items */}
        </div>
      )}
    </div>
  );
};

// Preload critical components
export const preloadCriticalComponents = () => {
  preloadComponent(() => import('@/components/dashboard/DashboardOverview'));
  preloadComponent(() => import('@/components/dashboard/StudentManagement'));
  preloadComponent(() => import('@/components/dashboard/EquipmentDashboard'));
};

export default {
  createLazyLoad,
  preloadComponent,
  LazyImage,
  BundleAnalyzer,
  withPerformanceMonitoring,
  VirtualList,
  preloadCriticalComponents,
  LoadingIndicator,
  ErrorFallback,
  NetworkStatus
};
