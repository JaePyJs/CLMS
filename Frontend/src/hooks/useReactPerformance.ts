import { useEffect, useRef, useCallback, useState } from 'react';
import { performance } from './perf_hooks';

interface ComponentMetrics {
  renders: number;
  totalRenderTime: number;
  averageRenderTime: number;
  lastRenderTime: number;
  slowestRender: number;
  fastestRender: number;
  mountTime: number;
  isMounted: boolean;
}

interface PerformanceOptions {
  trackMountTime?: boolean;
  logRenders?: boolean;
  warningThreshold?: number;
  errorThreshold?: number;
}

export const useReactPerformance = (
  componentName: string,
  options: PerformanceOptions = {}
) => {
  const {
    trackMountTime = true,
    logRenders = false,
    warningThreshold = 16,
    errorThreshold = 100,
  } = options;

  const metricsRef = useRef<ComponentMetrics>({
    renders: 0,
    totalRenderTime: 0,
    averageRenderTime: 0,
    lastRenderTime: 0,
    slowestRender: 0,
    fastestRender: Infinity,
    mountTime: 0,
    isMounted: false,
  });

  const mountTimeRef = useRef<number>(Date.now());
  const renderStartRef = useRef<number>(0);

  const [, forceUpdate] = useState({});

  // Track render start
  const startRender = useCallback(() => {
    renderStartRef.current = performance.now();
  }, []);

  // Track render end
  const endRender = useCallback(() => {
    if (renderStartRef.current === 0) {
      return;
    }

    const renderTime = performance.now() - renderStartRef.current;
    const metrics = metricsRef.current;

    metrics.renders++;
    metrics.lastRenderTime = renderTime;
    metrics.totalRenderTime += renderTime;
    metrics.averageRenderTime = metrics.totalRenderTime / metrics.renders;
    metrics.slowestRender = Math.max(metrics.slowestRender, renderTime);
    metrics.fastestRender = Math.min(metrics.fastestRender, renderTime);

    // Log performance warnings
    if (logRenders || process.env.NODE_ENV === 'development') {
      if (renderTime > errorThreshold) {
        console.error(
          `🚨 Very slow render in ${componentName}: ${renderTime.toFixed(2)}ms (threshold: ${errorThreshold}ms)`
        );
      } else if (renderTime > warningThreshold) {
        console.warn(
          `⚠️ Slow render in ${componentName}: ${renderTime.toFixed(2)}ms (threshold: ${warningThreshold}ms)`
        );
      } else if (logRenders) {
        console.log(
          `✅ ${componentName} rendered in ${renderTime.toFixed(2)}ms`
        );
      }
    }

    // Emit performance event
    window.dispatchEvent(
      new CustomEvent('component-performance', {
        detail: {
          componentName,
          metrics: { ...metrics },
          renderTime,
        },
      })
    );

    renderStartRef.current = 0;
  }, [componentName, logRenders, warningThreshold, errorThreshold]);

  // Track mount time
  useEffect(() => {
    if (trackMountTime) {
      const mountTime = Date.now() - mountTimeRef.current;
      metricsRef.current.mountTime = mountTime;
      metricsRef.current.isMounted = true;

      if (logRenders || process.env.NODE_ENV === 'development') {
        console.log(`🚀 ${componentName} mounted in ${mountTime}ms`);
      }
    }

    return () => {
      metricsRef.current.isMounted = false;
    };
  }, [componentName, trackMountTime, logRenders]);

  // Get current metrics
  const getMetrics = useCallback(() => {
    return { ...metricsRef.current };
  }, []);

  // Reset metrics
  const resetMetrics = useCallback(() => {
    metricsRef.current = {
      renders: 0,
      totalRenderTime: 0,
      averageRenderTime: 0,
      lastRenderTime: 0,
      slowestRender: 0,
      fastestRender: Infinity,
      mountTime: metricsRef.current.mountTime,
      isMounted: metricsRef.current.isMounted,
    };
  }, []);

  // Force update for testing purposes
  const forceRerender = useCallback(() => {
    forceUpdate({});
  }, []);

  return {
    startRender,
    endRender,
    getMetrics,
    resetMetrics,
    forceRerender,
  };
};

// Hook for optimizing expensive calculations
export const useOptimizedCalculation = <T>(
  calculation: () => T,
  dependencies: React.DependencyList,
  options: {
    memoize?: boolean;
    debounceMs?: number;
    throttleMs?: number;
  } = {}
) => {
  const { memoize = true, debounceMs = 0, throttleMs = 0 } = options;
  const [result, setResult] = useState<T>(() => calculation());
  const [isCalculating, setIsCalculating] = useState(false);

  const calculateRef = useRef<T>(calculation());
  const dependenciesRef = useRef(dependencies);

  useEffect(() => {
    dependenciesRef.current = dependencies;
  }, [dependencies]);

  const performCalculation = useCallback(async () => {
    setIsCalculating(true);
    const startTime = performance.now();

    try {
      const newResult = calculation();
      calculateRef.current = newResult;
      setResult(newResult);

      const endTime = performance.now();
      if (process.env.NODE_ENV === 'development') {
        console.log(
          `Calculation completed in ${(endTime - startTime).toFixed(2)}ms`
        );
      }
    } catch (error) {
      console.error('Calculation failed:', error);
    } finally {
      setIsCalculating(false);
    }
  }, [calculation]);

  useEffect(() => {
    if (memoize) {
      const hasDependenciesChanged = !dependencies.every(
        (dep, index) => dep === dependenciesRef.current[index]
      );

      if (hasDependenciesChanged) {
        if (debounceMs > 0) {
          const timeout = setTimeout(performCalculation, debounceMs);
          return () => clearTimeout(timeout);
        } else if (throttleMs > 0) {
          const timeout = setTimeout(performCalculation, throttleMs);
          return () => clearTimeout(timeout);
        } else {
          performCalculation();
        }
      }
    }
    return undefined;
  }, [dependencies, memoize, debounceMs, throttleMs, performCalculation]);

  return {
    result,
    isCalculating,
    recalculate: performCalculation,
  };
};

// Hook for stable callbacks
export const useStableCallback = <T extends (...args: any[]) => any>(
  callback: T,
  dependencies: React.DependencyList = []
): T => {
  const callbackRef = useRef(callback);
  const dependenciesRef = useRef(dependencies);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    dependenciesRef.current = dependencies;
  }, [dependencies]);

  return useCallback((...args: Parameters<T>) => {
    if (
      dependencies.every((dep, index) => dep === dependenciesRef.current[index])
    ) {
      return callbackRef.current(...args);
    }
    return callback(...args);
  }, dependencies) as T;
};

// Hook for performance monitoring of async operations
export const useAsyncPerformance = () => {
  const operationsRef = useRef<Map<string, number>>(new Map());

  const startOperation = useCallback((operationName: string) => {
    const startTime = performance.now();
    operationsRef.current.set(operationName, startTime);

    if (process.env.NODE_ENV === 'development') {
      console.log(`⏱️ Started ${operationName}`);
    }

    return startTime;
  }, []);

  const endOperation = useCallback((operationName: string) => {
    const startTime = operationsRef.current.get(operationName);
    if (!startTime) {
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    operationsRef.current.delete(operationName);

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Completed ${operationName} in ${duration.toFixed(2)}ms`);
    }

    // Emit performance event
    window.dispatchEvent(
      new CustomEvent('async-operation-performance', {
        detail: {
          operationName,
          duration,
          startTime,
          endTime,
        },
      })
    );

    return duration;
  }, []);

  const getActiveOperations = useCallback(() => {
    return Array.from(operationsRef.current.keys());
  }, []);

  return {
    startOperation,
    endOperation,
    getActiveOperations,
  };
};

// Performance comparison hook
export const usePerformanceComparison = (variantName: string) => {
  const metricsRef = useRef<number[]>([]);

  const recordMetric = useCallback((value: number) => {
    metricsRef.current.push(value);
  }, []);

  const getStats = useCallback(() => {
    const metrics = metricsRef.current;
    if (metrics.length === 0) {
      return null;
    }

    const sum = metrics.reduce((a, b) => a + b, 0);
    const average = sum / metrics.length;
    const min = Math.min(...metrics);
    const max = Math.max(...metrics);
    const sorted = [...metrics].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return {
      variant: variantName,
      count: metrics.length,
      average,
      min,
      max,
      median,
      p95,
      p99,
      sum,
    };
  }, [variantName]);

  const reset = useCallback(() => {
    metricsRef.current = [];
  }, []);

  return {
    recordMetric,
    getStats,
    reset,
  };
};
