import React, { Suspense, lazy, type ComponentType } from 'react';
import { Loader2 } from 'lucide-react';

interface LazyLoadProps {
  loader: () => Promise<{ default: ComponentType<Record<string, unknown>> }>;
  fallback?: React.ReactNode;
  error?: React.ReactNode;
  delay?: number;
  className?: string;
}

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  className?: string;
}

export function LoadingSpinner({
  size = 'md',
  message = 'Loading...',
  className = '',
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={`flex items-center justify-center p-4 ${className}`}>
      <div className="flex flex-col items-center space-y-2">
        <Loader2 className={`animate-spin ${sizeClasses[size]} text-primary`} />
        <span className="text-sm text-muted-foreground">{message}</span>
      </div>
    </div>
  );
}

export function ErrorFallback({
  message = 'Failed to load component',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-red-500 mb-2">⚠️</div>
        <p className="text-sm text-muted-foreground mb-2">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: {
    children: React.ReactNode;
    fallback?: React.ReactNode;
  }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('LazyLoad Error Boundary:', error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message;
      return (
        this.props.fallback || (
          <ErrorFallback {...(errorMessage && { message: errorMessage })} />
        )
      );
    }

    return this.props.children;
  }
}

export function OptimizedLazyLoad({
  loader,
  fallback,
  error,
  delay = 200,
  className = '',
}: LazyLoadProps) {
  const LazyComponent = lazy(() => {
    return loader().catch((err) => {
      console.error('Failed to load component:', err);
      const fallbackNode = React.isValidElement(error)
        ? error
        : <ErrorFallback message={typeof error === 'string' ? error : 'Failed to load component'} />;
      return { default: () => fallbackNode };
    });
  });

  const [showFallback, setShowFallback] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShowFallback(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  const defaultFallback = (
    <LoadingSpinner
      size="lg"
      message="Loading component..."
      className={className}
    />
  );

  const normalizedFallback = React.isValidElement(error)
    ? error
    : (error
        ? <ErrorFallback message={typeof error === 'string' ? error : 'Failed to load component'} />
        : undefined);

  return (
    <ErrorBoundary fallback={normalizedFallback}>
      <Suspense
        fallback={
          showFallback ? (
            fallback || defaultFallback
          ) : (
            <div className={className} />
          )
        }
      >
        <LazyComponent />
      </Suspense>
    </ErrorBoundary>
  );
}

// Preload utilities
export function preloadComponent(
  loader: () => Promise<{ default: ComponentType<Record<string, unknown>> }>
) {
  // Start loading the component in the background
  loader().catch(() => {
    // Ignore errors during preloading
  });
}

// Intersection Observer for lazy loading
export function useIntersectionObserver(
  ref: React.RefObject<Element | null>,
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          setIsIntersecting(entry.isIntersecting);
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options,
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [ref, options.threshold, options.rootMargin]);

  return isIntersecting;
}

// Hook for lazy loading components when they come into view
export function useLazyLoad(
  loader: () => Promise<{ default: ComponentType<Record<string, unknown>> }>,
  options: IntersectionObserverInit = {}
) {
  const [Component, setComponent] = React.useState<ComponentType<
    Record<string, unknown>
  > | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);
  const isIntersecting = useIntersectionObserver(ref, options);

  React.useEffect(() => {
    if (isIntersecting && !Component && !loading) {
      setLoading(true);
      loader()
        .then(({ default: LoadedComponent }) => {
          setComponent(() => LoadedComponent);
          setError(null);
        })
        .catch((err) => {
          setError(err);
          setComponent(null);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isIntersecting, loader, Component, loading]);

  return { Component, loading, error, ref };
}

// Component for lazy loading with intersection observer
export function LazyLoadOnIntersection({
  loader,
  fallback,
  error,
  className = '',
}: Omit<LazyLoadProps, 'delay'> & { className?: string }) {
  const { Component, loading, error: loadError, ref } = useLazyLoad(loader);

  if (loading) {
    return (
      <div ref={ref} className={className}>
        {fallback || <LoadingSpinner size="md" />}
      </div>
    );
  }

  if (loadError) {
    return (
      <div ref={ref} className={className}>
        {error || <ErrorFallback message={loadError.message} />}
      </div>
    );
  }

  if (Component) {
    return <Component />;
  }

  return <div ref={ref} className={className} />;
}

// Resource hint utilities
export function addPrefetchLink(href: string) {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  document.head.appendChild(link);
}

export function addPreloadLink(href: string, as: string) {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = as;
  document.head.appendChild(link);
}

// Image lazy loading component
export function LazyImage({
  src,
  alt,
  className = '',
  placeholder = '/placeholder.svg',
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & { placeholder?: string }) {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [isInView, setIsInView] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className={`relative ${className}`}>
      <img
        ref={imgRef}
        src={isInView ? src : placeholder}
        alt={alt}
        className={`transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-70'
        } ${className}`}
        onLoad={() => setIsLoaded(true)}
        loading="lazy"
        {...props}
      />
    </div>
  );
}

// Bundle size monitoring
export function useBundleSizeMonitor() {
  const [bundleSize, setBundleSize] = React.useState<number | null>(null);

  React.useEffect(() => {
    // Monitor performance entries for bundle loading
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        if (entry.name.includes('chunk') || entry.name.includes('bundle')) {
          const resource = entry as PerformanceResourceTiming;
          if (resource.transferSize) {
            setBundleSize((prev) => (prev || 0) + resource.transferSize);
          }
        }
      }
    });

    try {
      observer.observe({ entryTypes: ['resource'] });
    } catch (error) {
      console.debug('Performance observer not supported');
    }

    return () => observer.disconnect();
  }, []);

  return bundleSize;
}
