import { useState, useEffect } from 'react';

/**
 * Performance Hooks
 *
 * Browser-compatible performance API for React components
 */

// Extended performance types for browser APIs
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

interface ExtendedResourceTiming {
  decodedBodySize?: number;
  transferSize?: number;
  responseEnd: number;
  requestStart: number;
  name: string;
}

// Performance API with fallbacks
export const performance = {
  now: (): number => {
    if (typeof window !== 'undefined' && window.performance?.now) {
      return window.performance.now();
    }
    return Date.now();
  },

  mark: (name: string): void => {
    if (typeof window !== 'undefined' && window.performance?.mark) {
      window.performance.mark(name);
    }
  },

  measure: (name: string, startMark: string, endMark?: string): void => {
    if (typeof window !== 'undefined' && window.performance?.measure) {
      window.performance.measure(name, startMark, endMark);
    }
  },

  getEntriesByName: (name: string, type?: string): PerformanceEntry[] => {
    if (typeof window !== 'undefined' && window.performance?.getEntriesByName) {
      return window.performance.getEntriesByName(name, type);
    }
    return [];
  },

  getEntriesByType: (type: string): PerformanceEntry[] => {
    if (typeof window !== 'undefined' && window.performance?.getEntriesByType) {
      return window.performance.getEntriesByType(type);
    }
    return [];
  },
};

// Performance observer for monitoring
export class PerformanceObserver {
  private callback: (
    entries: PerformanceObserverEntryList,
    observer: PerformanceObserver
  ) => void;
  private observer: PerformanceObserver | null = null;

  constructor(
    callback: (
      entries: PerformanceObserverEntryList,
      observer: PerformanceObserver
    ) => void
  ) {
    this.callback = callback;
  }

  observe(options: PerformanceObserverInit): void {
    if (typeof window !== 'undefined' && window.PerformanceObserver) {
      const NativeObserver = window.PerformanceObserver;
      // Use native PerformanceObserver directly
      const nativeObserver = new NativeObserver(
        (entries: PerformanceObserverEntryList) => {
          this.callback(entries, this);
        }
      );
      this.observer = nativeObserver as unknown as PerformanceObserver;
      nativeObserver.observe(options);
    }
  }

  disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

// React hook for performance monitoring
export function usePerformanceMonitor(componentName: string) {
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const startTime = performance.now();

  useEffect(() => {
    const endTime = performance.now();
    const renderTime = endTime - startTime;

    setMetrics((prev) => ({
      ...prev,
      [`${componentName}_render`]: renderTime,
    }));

    performance.mark(`${componentName}_render_end`);
    performance.measure(
      `${componentName}_render`,
      `${componentName}_render_start`,
      `${componentName}_render_end`
    );

    return () => {
      // Type cast to access non-standard performance methods
      if (typeof window !== 'undefined' && window.performance) {
        window.performance.clearMarks?.(`${componentName}_render_start`);
        window.performance.clearMarks?.(`${componentName}_render_end`);
        window.performance.clearMeasures?.(`${componentName}_render`);
      }
    };
  }, [componentName]);

  return metrics;
}

// Custom performance hooks
export function useRenderCount(componentName: string) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount((prev) => prev + 1);
    performance.mark(`${componentName}_render_count_${count + 1}`);
  });

  return count;
}

export function useRenderTime(_componentName: string) {
  const [renderTime, setRenderTime] = useState(0);

  useEffect(() => {
    const start = performance.now();
    return () => {
      const end = performance.now();
      setRenderTime(end - start);
    };
  });

  return renderTime;
}

// Types
export interface PerformanceEntry {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
}

export interface PerformanceObserverCallback {
  (entries: PerformanceObserverEntryList, observer: PerformanceObserver): void;
}

export interface PerformanceObserverInit {
  entryTypes: string[];
  buffered?: boolean;
}

export interface PerformanceObserverEntryList {
  getEntries(): PerformanceEntry[];
  getEntriesByName(name: string, type?: string): PerformanceEntry[];
  getEntriesByType(type: string): PerformanceEntry[];
}

export interface IPerformanceObserver {
  observe(options: PerformanceObserverInit): void;
  disconnect(): void;
  takeRecords(): PerformanceObserverEntryList;
}

// Memory API with fallbacks
export const memory = {
  usedJSHeapSize: 0,
  totalJSHeapSize: 0,
  jsHeapSizeLimit: 0,
};

// Update memory stats if available
if (typeof window !== 'undefined') {
  const perfWithMemory = window.performance as
    | PerformanceWithMemory
    | undefined;
  if (perfWithMemory?.memory) {
    Object.assign(memory, {
      usedJSHeapSize: perfWithMemory.memory.usedJSHeapSize || 0,
      totalJSHeapSize: perfWithMemory.memory.totalJSHeapSize || 0,
      jsHeapSizeLimit: perfWithMemory.memory.jsHeapSizeLimit || 0,
    });
  }
}

// Timing API with fallbacks
export const timing = {
  navigationStart: Date.now(),
  loadEventEnd: 0,
  domContentLoadedEventEnd: 0,
};

// Update timing stats if available
if (typeof window !== 'undefined' && window.performance?.timing) {
  Object.assign(timing, window.performance.timing);
}

// Resource timing utilities
export const getResourceTiming = (): PerformanceResourceTiming[] => {
  if (typeof window !== 'undefined' && window.performance?.getEntriesByType) {
    return window.performance.getEntriesByType(
      'resource'
    ) as PerformanceResourceTiming[];
  }
  return [];
};

// Navigation timing utilities
export const getNavigationTiming = (): PerformanceNavigationTiming | null => {
  if (typeof window !== 'undefined' && window.performance?.getEntriesByType) {
    const entries = window.performance.getEntriesByType('navigation');
    return entries.length > 0
      ? (entries[0] as PerformanceNavigationTiming)
      : null;
  }
  return null;
};

// Performance metrics calculation
export const calculateMetrics = {
  // Calculate page load time
  pageLoadTime: (): number => {
    const navTiming = getNavigationTiming();
    if (navTiming) {
      // Use startTime as the baseline (navigationStart is deprecated)
      return navTiming.loadEventEnd - navTiming.startTime;
    }
    return timing.loadEventEnd - timing.navigationStart;
  },

  // Calculate DOM content load time
  domContentLoadedTime: (): number => {
    const navTiming = getNavigationTiming();
    if (navTiming) {
      // Use startTime as the baseline (navigationStart is deprecated)
      return navTiming.domContentLoadedEventEnd - navTiming.startTime;
    }
    return timing.domContentLoadedEventEnd - timing.navigationStart;
  },

  // Calculate first paint time
  firstPaintTime: (): number => {
    const paintEntries =
      (typeof window !== 'undefined'
        ? window.performance?.getEntriesByType('paint')
        : undefined) || [];
    const firstPaint = paintEntries.find(
      (entry) => entry.name === 'first-paint'
    );
    return firstPaint ? firstPaint.startTime : 0;
  },

  // Calculate first contentful paint time
  firstContentfulPaintTime: (): number => {
    const paintEntries =
      (typeof window !== 'undefined'
        ? window.performance?.getEntriesByType('paint')
        : undefined) || [];
    const firstContentfulPaint = paintEntries.find(
      (entry) => entry.name === 'first-contentful-paint'
    );
    return firstContentfulPaint ? firstContentfulPaint.startTime : 0;
  },

  // Calculate resource load time
  resourceLoadTime: (url: string): number => {
    const resources = getResourceTiming();
    const resource = resources.find((r) => r.name === url);
    return resource ? resource.responseEnd - resource.requestStart : 0;
  },

  // Calculate total resource load time
  totalResourceLoadTime: (): number => {
    const resources = getResourceTiming();
    return resources.reduce((total, resource) => {
      return total + (resource.responseEnd - resource.requestStart);
    }, 0);
  },
};

// Performance monitoring utilities
export const performanceUtils = {
  // Mark performance points
  mark: (name: string): void => {
    performance.mark(name);
  },

  // Measure performance between marks
  measure: (name: string, startMark: string, endMark?: string): number => {
    performance.measure(name, startMark, endMark);
    const entries = performance.getEntriesByName(name, 'measure');
    const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;
    return lastEntry?.duration || 0;
  },

  // Get memory usage
  getMemoryUsage: () => ({
    used: memory.usedJSHeapSize,
    total: memory.totalJSHeapSize,
    limit: memory.jsHeapSizeLimit,
    percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
  }),

  // Get resource timing summary
  getResourceTimingSummary: () => {
    const resources = getResourceTiming();
    const summary = {
      count: resources.length,
      totalSize: 0,
      totalTransferSize: 0,
      totalTime: 0,
      averageTime: 0,
      slowestResource: null as PerformanceResourceTiming | null,
      fastestResource: null as PerformanceResourceTiming | null,
    };

    if (resources.length === 0) {
      return summary;
    }

    let totalSize = 0;
    let totalTransferSize = 0;
    let totalTime = 0;
    let slowestTime = 0;
    let fastestTime = Infinity;
    let slowestResource: PerformanceResourceTiming | null = null;
    let fastestResource: PerformanceResourceTiming | null = null;

    resources.forEach((resource) => {
      const loadTime = resource.responseEnd - resource.requestStart;
      const extResource = resource as ExtendedResourceTiming;
      totalSize += extResource.decodedBodySize || 0;
      totalTransferSize += resource.transferSize || 0;
      totalTime += loadTime;

      if (loadTime > slowestTime) {
        slowestTime = loadTime;
        slowestResource = resource;
      }

      if (loadTime < fastestTime) {
        fastestTime = loadTime;
        fastestResource = resource;
      }
    });

    return {
      ...summary,
      totalSize,
      totalTransferSize,
      totalTime,
      averageTime: totalTime / resources.length,
      slowestResource,
      fastestResource,
    };
  },
};
