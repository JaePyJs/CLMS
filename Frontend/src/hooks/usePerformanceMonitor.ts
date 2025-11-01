import { useEffect, useRef, useCallback, useState } from 'react';
import { performanceMonitor } from '@/lib/performance-monitor';

/**
 * Hook for performance monitoring with automatic cleanup
 */
export function usePerformanceMonitor(componentName?: string) {
  const metricsRef = useRef<string[]>([]);

  // Start timing when component mounts
  useEffect(() => {
    const mountTime = performance.now();
    const entryId = performanceMonitor.start('component_mount', {
      componentName: componentName || 'unknown',
    });

    return () => {
      // Record unmount time
      const unmountTime = performance.now();
      const duration = unmountTime - mountTime;

      performanceMonitor.end(entryId);
      performanceMonitor.recordMetric('component_lifetime', duration, {
        type: 'duration',
        unit: 'ms',
        tags: { componentName: componentName || 'unknown' },
      });
    };
  }, [componentName]);

  const startTiming = useCallback((name: string, metadata?: Record<string, unknown>) => {
    const id = performanceMonitor.start(name, {
      ...metadata,
      componentName: componentName || 'unknown',
    });
    metricsRef.current.push(id);
    return id;
  }, [componentName]);

  const endTiming = useCallback((id: string, error?: Error) => {
    performanceMonitor.end(id, error);
    metricsRef.current = metricsRef.current.filter(existingId => existingId !== id);
  }, []);

  const recordMetric = useCallback((
    name: string,
    value: number,
    options?: {
      type?: 'duration' | 'counter' | 'gauge' | 'histogram';
      unit?: string;
      tags?: Record<string, string>;
    }
  ) => {
    performanceMonitor.recordMetric(name, value, {
      ...options,
      tags: {
        ...options?.tags,
        componentName: componentName || 'unknown',
      },
    });
  }, [componentName]);

  const log = useCallback((
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: Record<string, unknown>
  ) => {
    performanceMonitor[level](message, {
      ...context,
      componentName: componentName || 'unknown',
    });
  }, [componentName]);

  // Cleanup any remaining metrics on unmount
  useEffect(() => {
    return () => {
      metricsRef.current.forEach(id => {
        performanceMonitor.end(id, new Error('Component unmounted with active timing'));
      });
      metricsRef.current = [];
    };
  }, []);

  return {
    startTiming,
    endTiming,
    recordMetric,
    log,
  };
}

/**
 * Hook for monitoring API calls
 */
export function useApiPerformance(apiName: string) {
  const { startTiming, endTiming } = usePerformanceMonitor('api_calls');

  const trackApiCall = useCallback(async <T>(
    apiCall: () => Promise<T>,
    options?: {
      metadata?: Record<string, unknown>;
      onError?: (error: Error) => void;
    }
  ): Promise<T> => {
    const id = startTiming(`api_${apiName}`, {
      ...options?.metadata,
    });

    try {
      const result = await apiCall();
      endTiming(id);
      return result;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('API call failed');
      endTiming(id, errorObj);
      options?.onError?.(errorObj);
      throw errorObj;
    }
  }, [apiName, startTiming, endTiming]);

  return { trackApiCall };
}

/**
 * Hook for monitoring render performance
 */
export function useRenderPerformance(componentName?: string) {
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(performance.now());

  useEffect(() => {
    renderCountRef.current += 1;
    const now = performance.now();
    const timeSinceLastRender = now - lastRenderTimeRef.current;
    lastRenderTimeRef.current = now;

    performanceMonitor.recordMetric('component_render', 1, {
      type: 'counter',
      tags: {
        componentName: componentName || 'unknown',
        renderCount: renderCountRef.current.toString(),
      },
    });

    performanceMonitor.recordMetric('time_between_renders', timeSinceLastRender, {
      type: 'duration',
      unit: 'ms',
      tags: {
        componentName: componentName || 'unknown',
      },
    });
  });

  return {
    renderCount: renderCountRef.current,
  };
}

/**
 * Hook for monitoring user interactions
 */
export function useInteractionTracking(componentName?: string) {
  const { recordMetric, log } = usePerformanceMonitor(componentName);

  const trackInteraction = useCallback((
    interactionType: string,
    metadata?: Record<string, unknown>
  ) => {
    recordMetric('user_interaction', 1, {
      type: 'counter',
      tags: {
        interactionType,
        componentName: componentName || 'unknown',
      },
    });

    log('info', `User interaction: ${interactionType}`, metadata);
  }, [recordMetric, log, componentName]);

  const trackClick = useCallback((element: string, metadata?: Record<string, unknown>) => {
    trackInteraction('click', { element, ...metadata });
  }, [trackInteraction]);

  const trackFormSubmit = useCallback((formName: string, metadata?: Record<string, unknown>) => {
    trackInteraction('form_submit', { formName, ...metadata });
  }, [trackInteraction]);

  const trackPageView = useCallback((page: string, metadata?: Record<string, unknown>) => {
    trackInteraction('page_view', { page, ...metadata });
  }, [trackInteraction]);

  const trackSearch = useCallback((query: string, resultsCount?: number, metadata?: Record<string, unknown>) => {
    trackInteraction('search', { query, resultsCount, ...metadata });
  }, [trackInteraction]);

  return {
    trackInteraction,
    trackClick,
    trackFormSubmit,
    trackPageView,
    trackSearch,
  };
}

/**
 * Hook for monitoring resource loading
 */
export function useResourceMonitoring() {
  const [resourceMetrics, setResourceMetrics] = useState<{
    totalResources: number;
    totalSize: number;
    slowResources: Array<{ name: string; duration: number; size: number }>;
  }>({
    totalResources: 0,
    totalSize: 0,
    slowResources: [],
  });

  useEffect(() => {
    const updateResourceMetrics = () => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const slowThreshold = 1000; // 1 second

      let totalSize = 0;
      const slowResources: Array<{ name: string; duration: number; size: number }> = [];

      resources.forEach(resource => {
        const duration = resource.responseEnd - resource.startTime;
        const size = resource.transferSize || 0;

        totalSize += size;

        if (duration > slowThreshold) {
          slowResources.push({
            name: resource.name,
            duration,
            size,
          });
        }
      });

      setResourceMetrics({
        totalResources: resources.length,
        totalSize,
        slowResources,
      });
    };

    // Update metrics periodically
    const interval = setInterval(updateResourceMetrics, 5000);

    // Initial update
    updateResourceMetrics();

    return () => clearInterval(interval);
  }, []);

  return resourceMetrics;
}

/**
 * Hook for monitoring Core Web Vitals
 */
export function useCoreWebVitals() {
  const [vitals, setVitals] = useState<{
    lcp?: number;
    fid?: number;
    cls?: number;
    fcp?: number;
    ttfb?: number;
  }>({});

  useEffect(() => {
    // Largest Contentful Paint (LCP)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          if (lastEntry) {
            setVitals(prev => ({ ...prev, lcp: lastEntry.startTime }));
          }
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        console.warn('LCP not supported');
      }

      // First Input Delay (FID)
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const firstInput = entries[0];
          if (firstInput) {
            const fid = (firstInput as any).processingStart - firstInput.startTime;
            setVitals(prev => ({ ...prev, fid }));
          }
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch (e) {
        console.warn('FID not supported');
      }

      // Cumulative Layout Shift (CLS)
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          setVitals(prev => ({ ...prev, cls: clsValue }));
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        console.warn('CLS not supported');
      }
    }

    // First Contentful Paint (FCP)
    const paintEntries = performance.getEntriesByType('paint');
    const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    if (fcpEntry) {
      setVitals(prev => ({ ...prev, fcp: fcpEntry.startTime }));
    }

    // Time to First Byte (TTFB)
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      const ttfb = navigation.responseStart - navigation.requestStart;
      setVitals(prev => ({ ...prev, ttfb }));
    }
  }, []);

  return vitals;
}

/**
 * Hook for monitoring memory usage
 */
export function useMemoryMonitoring() {
  const [memoryInfo, setMemoryInfo] = useState<{
    usedJSHeapSize?: number;
    totalJSHeapSize?: number;
    jsHeapSizeLimit?: number;
    memoryPressure?: 'low' | 'medium' | 'high';
  }>({});

  useEffect(() => {
    const updateMemoryInfo = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const used = memory.usedJSHeapSize;
        const total = memory.totalJSHeapSize;
        const limit = memory.jsHeapSizeLimit;

        const usageRatio = used / limit;
        let memoryPressure: 'low' | 'medium' | 'high' = 'low';
        if (usageRatio > 0.8) {
          memoryPressure = 'high';
        } else if (usageRatio > 0.6) {
          memoryPressure = 'medium';
        }

        setMemoryInfo({
          usedJSHeapSize: used,
          totalJSHeapSize: total,
          jsHeapSizeLimit: limit,
          memoryPressure,
        });
      }
    };

    // Update memory info every 5 seconds
    const interval = setInterval(updateMemoryInfo, 5000);

    // Initial update
    updateMemoryInfo();

    return () => clearInterval(interval);
  }, []);

  return memoryInfo;
}

/**
 * Hook for creating performance-aware async operations
 */
export function useAsyncPerformance<T>(
  asyncFn: () => Promise<T>,
  operationName: string
) {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: Error | null;
    progress: number;
  }>({
    data: null,
    loading: false,
    error: null,
    progress: 0,
  });

  const { startTiming, endTiming, recordMetric } = usePerformanceMonitor('async_operations');

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null, progress: 0 }));
    const id = startTiming(operationName);

    try {
      const result = await asyncFn();
      endTiming(id);
      setState({
        data: result,
        loading: false,
        error: null,
        progress: 100,
      });
      recordMetric(`${operationName}_success`, 1, { type: 'counter' });
      return result;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Async operation failed');
      endTiming(id, errorObj);
      setState({
        data: null,
        loading: false,
        error: errorObj,
        progress: 0,
      });
      recordMetric(`${operationName}_error`, 1, { type: 'counter' });
      throw errorObj;
    }
  }, [asyncFn, operationName, startTiming, endTiming, recordMetric]);

  return {
    ...state,
    execute,
  };
}