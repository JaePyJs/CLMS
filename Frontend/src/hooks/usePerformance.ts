/**
 * Performance Hooks for CLMS Frontend
 *
 * This module provides performance monitoring and optimization hooks
 * for tracking render performance, API calls, and user interactions.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { UseQueryOptions } from '@tanstack/react-query';

// Performance monitoring types
interface PerformanceMetrics {
  renderTime: number;
  componentMountTime: number;
  apiCallTime: number;
  interactionTime: number;
  memoryUsage: number;
  bundleSize: number;
}

interface HookPerformanceEntry {
  name: string;
  startTime: number;
  duration: number;
  type: 'render' | 'api' | 'interaction' | 'navigation';
  metadata?: Record<string, any>;
}

interface PerformanceConfig {
  enableMonitoring: boolean;
  enableAPITracking: boolean;
  enableRenderTracking: boolean;
  enableInteractionTracking: boolean;
  sampleRate: number;
  maxEntries: number;
  reportingEndpoint?: string;
}

// Performance monitoring configuration
const PERFORMANCE_CONFIG: PerformanceConfig = {
  enableMonitoring:
    import.meta.env.PROD ||
    import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING === 'true',
  enableAPITracking: import.meta.env.VITE_ENABLE_API_TRACKING !== 'false',
  enableRenderTracking: import.meta.env.VITE_ENABLE_RENDER_TRACKING !== 'false',
  enableInteractionTracking:
    import.meta.env.VITE_ENABLE_INTERACTION_TRACKING !== 'false',
  sampleRate: parseFloat(import.meta.env.VITE_PERFORMANCE_SAMPLE_RATE || '0.1'), // 10% sampling
  maxEntries: 100,
  reportingEndpoint: import.meta.env.VITE_PERFORMANCE_ENDPOINT,
};

// Global performance store
class PerformanceStore {
  private entries: HookPerformanceEntry[] = [];
  private observers: PerformanceObserver[] = [];
  private isSupported =
    'performance' in window && 'PerformanceObserver' in window;

  constructor() {
    if (this.isSupported && PERFORMANCE_CONFIG.enableMonitoring) {
      this.setupObservers();
    }
  }

  private setupObservers(): void {
    try {
      // Observer for navigation timing
      const navObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            this.addEntry({
              name: 'page-navigation',
              startTime: entry.startTime,
              duration: entry.duration,
              type: 'navigation',
              metadata: {
                domContentLoaded:
                  (entry as any).domContentLoadedEventEnd -
                  (entry as any).domContentLoadedEventStart,
                loadComplete:
                  (entry as any).loadEventEnd - (entry as any).loadEventStart,
              },
            });
          }
        });
      });
      navObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navObserver);

      // Observer for resource timing
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'resource') {
            this.addEntry({
              name: entry.name,
              startTime: entry.startTime,
              duration: entry.duration,
              type: 'api',
              metadata: {
                size: (entry as any).transferSize,
                type: (entry as any).initiatorType,
              },
            });
          }
        });
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.push(resourceObserver);

      // Observer for paint timing
      const paintObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'paint') {
            this.addEntry({
              name: entry.name,
              startTime: entry.startTime,
              duration: 0,
              type: 'render',
              metadata: { type: 'paint' },
            });
          }
        });
      });
      paintObserver.observe({ entryTypes: ['paint'] });
      this.observers.push(paintObserver);
    } catch (error) {
      console.warn('Performance observers setup failed:', error);
    }
  }

  addEntry(entry: HookPerformanceEntry): void {
    if (!PERFORMANCE_CONFIG.enableMonitoring) {
      return;
    }

    // Sample rate filtering
    if (Math.random() > PERFORMANCE_CONFIG.sampleRate) {
      return;
    }

    this.entries.push(entry);

    // Keep only the most recent entries
    if (this.entries.length > PERFORMANCE_CONFIG.maxEntries) {
      this.entries = this.entries.slice(-PERFORMANCE_CONFIG.maxEntries);
    }

    // Report to endpoint if configured
    if (PERFORMANCE_CONFIG.reportingEndpoint) {
      this.reportEntry(entry);
    }
  }

  private async reportEntry(entry: HookPerformanceEntry): Promise<void> {
    try {
      if (!navigator.sendBeacon) {
        return;
      }

      const data = {
        ...entry,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
      };

      navigator.sendBeacon(
        PERFORMANCE_CONFIG.reportingEndpoint!,
        JSON.stringify(data)
      );
    } catch (error) {
      console.warn('Performance reporting failed:', error);
    }
  }

  getEntries(type?: HookPerformanceEntry['type']): HookPerformanceEntry[] {
    if (type) {
      return this.entries.filter((entry) => entry.type === type);
    }
    return [...this.entries];
  }

  getMetrics(): PerformanceMetrics {
    const renderEntries = this.getEntries('render');
    const apiEntries = this.getEntries('api');
    const interactionEntries = this.getEntries('interaction');

    const avgRenderTime =
      renderEntries.length > 0
        ? renderEntries.reduce((sum, entry) => sum + entry.duration, 0) /
          renderEntries.length
        : 0;

    const avgApiTime =
      apiEntries.length > 0
        ? apiEntries.reduce((sum, entry) => sum + entry.duration, 0) /
          apiEntries.length
        : 0;

    const avgInteractionTime =
      interactionEntries.length > 0
        ? interactionEntries.reduce((sum, entry) => sum + entry.duration, 0) /
          interactionEntries.length
        : 0;

    return {
      renderTime: avgRenderTime,
      componentMountTime:
        renderEntries.find((e) => e.name === 'component-mount')?.duration || 0,
      apiCallTime: avgApiTime,
      interactionTime: avgInteractionTime,
      memoryUsage: this.getMemoryUsage(),
      bundleSize: this.getBundleSize(),
    };
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  }

  private getBundleSize(): number {
    // This would be calculated from the actual bundle size
    // For now, return an estimated value
    return 2.5; // MB
  }

  clear(): void {
    this.entries = [];
  }

  destroy(): void {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
    this.entries = [];
  }
}

// Global performance store instance
const performanceStore = new PerformanceStore();

// Performance hooks
export const usePerformanceMonitor = (componentName: string) => {
  const mountTime = useRef<number>(0);
  const renderCount = useRef<number>(0);

  useEffect(() => {
    mountTime.current = performance.now();
    renderCount.current = 0;

    // Track component mount
    if (PERFORMANCE_CONFIG.enableRenderTracking) {
      performanceStore.addEntry({
        name: 'component-mount',
        startTime: 0,
        duration: 0,
        type: 'render',
        metadata: { component: componentName },
      });
    }

    return () => {
      const duration = performance.now() - mountTime.current;

      if (PERFORMANCE_CONFIG.enableRenderTracking) {
        performanceStore.addEntry({
          name: 'component-unmount',
          startTime: mountTime.current,
          duration,
          type: 'render',
          metadata: {
            component: componentName,
            renderCount: renderCount.current,
          },
        });
      }
    };
  }, [componentName]);

  useEffect(() => {
    renderCount.current++;

    if (PERFORMANCE_CONFIG.enableRenderTracking && renderCount.current > 1) {
      performanceStore.addEntry({
        name: 'component-render',
        startTime: 0,
        duration: 0,
        type: 'render',
        metadata: {
          component: componentName,
          renderCount: renderCount.current,
        },
      });
    }
  });

  const trackInteraction = useCallback(
    (interactionName: string, startTime?: number) => {
      if (!PERFORMANCE_CONFIG.enableInteractionTracking) {
        return;
      }

      const start = startTime || performance.now();

      return {
        end: () => {
          const duration = performance.now() - start;
          performanceStore.addEntry({
            name: interactionName,
            startTime: start,
            duration,
            type: 'interaction',
            metadata: { component: componentName },
          });
        },
      };
    },
    [componentName]
  );

  return {
    trackInteraction,
    renderCount: renderCount.current,
    mountTime: mountTime.current,
  };
};

// Enhanced query hook with performance tracking
export const useTrackedQuery = <T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  options?: UseQueryOptions<T>
) => {
  const startTime = useRef<number>(0);

  const query = useQuery({
    queryKey,
    queryFn: () => {
      startTime.current = performance.now();
      return queryFn();
    },
    ...options,
  });

  // Handle success/error with useEffect (React Query v5 pattern)
  useEffect(() => {
    if (PERFORMANCE_CONFIG.enableAPITracking && startTime.current) {
      const duration = performance.now() - startTime.current;

      if (query.isSuccess && query.data !== undefined) {
        performanceStore.addEntry({
          name: `api-${Array.isArray(queryKey) ? queryKey.join('-') : String(queryKey)}`,
          startTime: startTime.current,
          duration,
          type: 'api',
          metadata: {
            queryKey: Array.isArray(queryKey)
              ? queryKey.join('.')
              : String(queryKey),
            success: true,
          },
        });
      } else if (query.isError) {
        performanceStore.addEntry({
          name: `api-${Array.isArray(queryKey) ? queryKey.join('-') : String(queryKey)}`,
          startTime: startTime.current,
          duration,
          type: 'api',
          metadata: {
            queryKey: Array.isArray(queryKey)
              ? queryKey.join('.')
              : String(queryKey),
            success: false,
            error: query.error?.message || 'Unknown error',
          },
        });
      }
    }
  }, [query.isSuccess, query.isError, query.data, query.error, queryKey]);

  return query;
};

// Enhanced mutation hook with performance tracking
export const useTrackedMutation = <T, V>(
  mutationFn: (variables: V) => Promise<T>,
  options?: any
) => {
  const startTime = useRef<number>(0);

  const mutation = useMutation({
    mutationFn,
    onMutate: async (variables: V) => {
      startTime.current = performance.now();
      return options?.onMutate?.(variables);
    },
    ...options,
  });

  // Handle success/error with useEffect (React Query v5 pattern)
  useEffect(() => {
    if (PERFORMANCE_CONFIG.enableAPITracking && startTime.current) {
      const duration = performance.now() - startTime.current;

      if (mutation.isSuccess && mutation.data !== undefined) {
        performanceStore.addEntry({
          name: `mutation-${mutationFn.name || 'unknown'}`,
          startTime: startTime.current,
          duration,
          type: 'api',
          metadata: {
            success: true,
            variables: mutation.variables
              ? JSON.stringify(mutation.variables)?.slice(0, 100)
              : '', // Limit size
          },
        });
      } else if (mutation.isError) {
        performanceStore.addEntry({
          name: `mutation-${mutationFn.name || 'unknown'}`,
          startTime: startTime.current,
          duration,
          type: 'api',
          metadata: {
            success: false,
            error: mutation.error?.message || 'Unknown error',
            variables: mutation.variables
              ? JSON.stringify(mutation.variables)?.slice(0, 100)
              : '',
          },
        });
      }
    }
  }, [
    mutation.isSuccess,
    mutation.isError,
    mutation.data,
    mutation.error,
    mutation.variables,
    mutationFn.name,
  ]);

  return mutation;
};

// Hook for lazy loading with performance tracking
export const useLazyLoad = <T>(
  loader: () => Promise<T>,
  options: {
    threshold?: number;
    rootMargin?: string;
    triggerOnce?: boolean;
  } = {}
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  const { threshold = 0.1, rootMargin = '0px', triggerOnce = true } = options;

  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      async (entries) => {
        const [entry] = entries;

        if (entry && entry.isIntersecting) {
          setLoading(true);
          setError(null);

          const startTime = performance.now();

          try {
            const loadedData = await loader();
            const duration = performance.now() - startTime;

            setData(loadedData);

            if (PERFORMANCE_CONFIG.enableMonitoring) {
              performanceStore.addEntry({
                name: 'lazy-load',
                startTime,
                duration,
                type: 'interaction',
                metadata: {
                  dataType: typeof loadedData,
                  size: JSON.stringify(loadedData).length,
                },
              });
            }
          } catch (err) {
            setError(err as Error);
          } finally {
            setLoading(false);

            if (triggerOnce) {
              observer.unobserve(element);
            }
          }
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [loader, threshold, rootMargin, triggerOnce]);

  return {
    ref: elementRef,
    data,
    loading,
    error,
  };
};

// Hook for image optimization and lazy loading
export const useOptimizedImage = (
  src: string,
  options: {
    placeholder?: string;
    threshold?: number;
    sizes?: string;
    quality?: number;
  } = {}
) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const {
    placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCAyNkMxNy4yMzg2IDI2IDE1IDIzLjc2MTQgMTUgMjFDMTUgMTguMjM4NiAxNy4yMzg2IDE2IDIwIDE2QzIyLjc2MTQgMTYgMjUgMTguMjM4NiAyNSAyMUMyNSAyMy43NjE0IDIyLjc2MTQgMjYgMjAgMjZaIiBmaWxsPSIjOUNBM0FGIi8+Cjwvc3ZnPg==',
    threshold = 0.1,
    sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
    quality = 75,
  } = options;

  useEffect(() => {
    const image = imgRef.current;
    if (!image) {
      return;
    }

    const observer = new IntersectionObserver(
      async (entries) => {
        const [entry] = entries;

        if (entry && entry.isIntersecting) {
          const startTime = performance.now();

          try {
            // Create optimized image URL with quality parameter
            const optimizedSrc = `${src}?auto=format&fit=crop&w=${image.offsetWidth}&h=${image.offsetHeight}&q=${quality}`;

            await new Promise((resolve, reject) => {
              const img = new Image();
              img.onload = resolve;
              img.onerror = reject;
              img.src = optimizedSrc;
            });

            setImageSrc(optimizedSrc);
            setIsLoading(false);

            if (PERFORMANCE_CONFIG.enableMonitoring) {
              const duration = performance.now() - startTime;
              performanceStore.addEntry({
                name: 'image-load',
                startTime,
                duration,
                type: 'interaction',
                metadata: {
                  src: src.split('/').pop(),
                  size: `${image.offsetWidth}x${image.offsetHeight}`,
                  quality,
                },
              });
            }
          } catch (err) {
            setError(err as Error);
            setIsLoading(false);
          }

          observer.unobserve(image);
        }
      },
      { threshold }
    );

    observer.observe(image);

    return () => {
      observer.unobserve(image);
    };
  }, [src, threshold, quality]);

  return {
    ref: imgRef,
    src: imageSrc || placeholder,
    isLoading,
    error,
    sizes,
  };
};

// Hook for performance metrics
export const usePerformanceMetrics = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>(() =>
    performanceStore.getMetrics()
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(performanceStore.getMetrics());
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const clearMetrics = useCallback(() => {
    performanceStore.clear();
    setMetrics(performanceStore.getMetrics());
  }, []);

  return {
    metrics,
    clearMetrics,
    getEntries: performanceStore.getEntries.bind(performanceStore),
  };
};

// Utility function to measure performance
export const measurePerformance = <T>(
  name: string,
  fn: () => T | Promise<T>
): T | Promise<T> => {
  if (!PERFORMANCE_CONFIG.enableMonitoring) {
    return fn();
  }

  const startTime = performance.now();

  if (fn.constructor.name === 'AsyncFunction') {
    return (async () => {
      try {
        const result = await fn();
        const duration = performance.now() - startTime;

        performanceStore.addEntry({
          name,
          startTime,
          duration,
          type: 'interaction',
        });

        return result;
      } catch (error) {
        const duration = performance.now() - startTime;

        performanceStore.addEntry({
          name,
          startTime,
          duration,
          type: 'interaction',
          metadata: { success: false, error: (error as Error).message },
        });

        throw error;
      }
    })();
  } else {
    try {
      const result = fn();
      const duration = performance.now() - startTime;

      performanceStore.addEntry({
        name,
        startTime,
        duration,
        type: 'interaction',
      });

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      performanceStore.addEntry({
        name,
        startTime,
        duration,
        type: 'interaction',
        metadata: { success: false, error: (error as Error).message },
      });

      throw error;
    }
  }
};

// Export performance store for advanced usage
export { performanceStore };
export default performanceStore;
