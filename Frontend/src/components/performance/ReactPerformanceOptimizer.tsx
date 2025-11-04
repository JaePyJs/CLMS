import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
  Profiler,
} from 'react';
import type { ComponentType, ReactNode, ProfilerOnRenderCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Activity, BarChart3 } from 'lucide-react';

// Performance monitoring types
interface PerformanceMetrics {
  renderTime: number;
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  slowestRender: number;
  fastestRender: number;
}

interface ComponentPerformanceData {
  [componentName: string]: PerformanceMetrics;
}

// Memoized component factory with performance tracking
export const createMemoizedComponent = <P extends object>(
  Component: ComponentType<P>,
  componentName?: string
): ComponentType<P> => {
  const MemoizedComponent = memo(Component, (prevProps, nextProps) => {
    // Custom comparison function for optimization
    const keys = Object.keys(prevProps) as (keyof P)[];

    return keys.every(key => {
      const prev = prevProps[key];
      const next = nextProps[key];

      // Handle different types of comparisons
      if (typeof prev === 'function' && typeof next === 'function') {
        return prev.toString() === next.toString();
      }

      if (Array.isArray(prev) && Array.isArray(next)) {
        if (prev.length !== next.length) return false;
        return prev.every((item, index) => item === next[index]);
      }

      if (typeof prev === 'object' && prev !== null &&
          typeof next === 'object' && next !== null) {
        return JSON.stringify(prev) === JSON.stringify(next);
      }

      return prev === next;
    });
  });

  MemoizedComponent.displayName = `Memoized(${componentName || Component.displayName || Component.name})`;

  return MemoizedComponent;
};

// Performance monitoring HOC
export const withPerformanceMonitoring = <P extends object>(
  Component: ComponentType<P>,
  componentName?: string
): ComponentType<P> => {
  const name = componentName || Component.displayName || Component.name;

  const MonitoredComponent = memo((props: P) => {
    const [metrics, setMetrics] = useState<PerformanceMetrics>({
      renderTime: 0,
      renderCount: 0,
      lastRenderTime: 0,
      averageRenderTime: 0,
      slowestRender: 0,
      fastestRender: Infinity,
    });

    const renderStartTime = useRef<number>(Date.now());

    const onRender: ProfilerOnRenderCallback = (
      _id,
      _phase,
      actualDuration,
      _baseDuration,
      _startTime,
      _commitTime
    ) => {
      const renderTime = actualDuration;
      renderStartTime.current = Date.now();

      setMetrics(prev => {
        const newRenderCount = prev.renderCount + 1;
        const totalTime = prev.averageRenderTime * prev.renderCount + renderTime;
        const newAverage = totalTime / newRenderCount;

        return {
          renderTime,
          renderCount: newRenderCount,
          lastRenderTime: renderTime,
          averageRenderTime: newAverage,
          slowestRender: Math.max(prev.slowestRender, renderTime),
          fastestRender: Math.min(prev.fastestRender, renderTime),
        };
      });

      // Log performance warnings in development
      if (process.env.NODE_ENV === 'development') {
        if (renderTime > 16) {
          console.warn(`⚠️ Slow render detected in ${name}: ${renderTime.toFixed(2)}ms`);
        }
        if (renderTime > 100) {
          console.error(`🚨 Very slow render in ${name}: ${renderTime.toFixed(2)}ms`);
        }
      }
    };

    return (
      <Profiler id={name} onRender={onRender}>
        <Component {...props} />
        {process.env.NODE_ENV === 'development' && (
          <div className="fixed bottom-4 right-4 bg-black/80 text-white p-2 rounded text-xs">
            {name}: {metrics.renderTime.toFixed(2)}ms ({metrics.renderCount} renders)
          </div>
        )}
      </Profiler>
    );
  });

  MonitoredComponent.displayName = `WithPerformanceMonitoring(${name})`;
  return MonitoredComponent;
};

// Virtualized List Component
interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number | ((index: number) => number);
  renderItem: (item: T, index: number) => ReactNode;
  height: number;
  width?: number;
  overscanCount?: number;
  className?: string;
  estimateSize?: (index: number) => number;
}

export const VirtualizedList = <T,>({
  items,
  itemHeight,
  renderItem,
  height,
  width = 300,
  overscanCount = 5,
  className = '',
}: VirtualizedListProps<T>) => {
  const [scrollTop, setScrollTop] = useState(0);
  
  const containerHeight = typeof height === 'number' ? height : 400;
  const itemSize = typeof itemHeight === 'function' ? 50 : itemHeight;
  
  const startIndex = Math.floor(scrollTop / itemSize);
  const endIndex = Math.min(
    startIndex + Math.ceil(containerHeight / itemSize) + overscanCount,
    items.length
  );
  
  const visibleItems = items.slice(startIndex, endIndex);
  
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  return (
    <div 
      className={className} 
      style={{ 
        height: containerHeight, 
        width, 
        overflow: 'auto',
        position: 'relative'
      }}
      onScroll={handleScroll}
    >
      <div style={{ height: items.length * itemSize, position: 'relative' }}>
        {visibleItems.map((item, index) => (
          <div
            key={startIndex + index}
            style={{
              position: 'absolute',
              top: (startIndex + index) * itemSize,
              height: itemSize,
              width: '100%',
            }}
          >
            {renderItem(item, startIndex + index)}
          </div>
        ))}
      </div>
    </div>
  );
};

// Expensive calculation hook
export const useExpensiveCalculation = <T,>(
  calculation: () => T,
  dependencies: React.DependencyList
): T => {
  return useMemo(calculation, dependencies);
};

// Stable callback hook
export const useStableCallback = <T extends (...args: any[]) => any>(
  callback: T,
  dependencies: React.DependencyList
): T => {
  return useCallback(callback, dependencies);
};

// Performance optimization utilities
export const performanceUtils = {
  // Debounce function for expensive operations
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  // Throttle function for frequent operations
  throttle: <T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  // Memoize expensive computations
  memoize: <T extends (...args: any[]) => any>(func: T): T => {
    const cache = new Map();
    return ((...args: Parameters<T>) => {
      const key = JSON.stringify(args);
      if (cache.has(key)) {
        return cache.get(key);
      }
      const result = func(...args);
      cache.set(key, result);
      return result;
    }) as T;
  },
};

// Performance Dashboard Component
export const PerformanceDashboard: React.FC = () => {
  const [performanceData, setPerformanceData] = useState<ComponentPerformanceData>({});
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Listen for custom performance events
    const handlePerformanceUpdate = (event: CustomEvent) => {
      setPerformanceData(prev => ({
        ...prev,
        [event.detail.componentName]: event.detail.metrics,
      }));
    };

    window.addEventListener('performance-update', handlePerformanceUpdate as EventListener);

    return () => {
      window.removeEventListener('performance-update', handlePerformanceUpdate as EventListener);
    };
  }, []);

  const getPerformanceGrade = (averageTime: number): { grade: string; color: string } => {
    if (averageTime < 10) return { grade: 'A', color: 'text-green-600' };
    if (averageTime < 20) return { grade: 'B', color: 'text-yellow-600' };
    if (averageTime < 50) return { grade: 'C', color: 'text-orange-600' };
    return { grade: 'D', color: 'text-red-600' };
  };

  const totalRenders = Object.values(performanceData).reduce((sum, metrics) => sum + metrics.renderCount, 0);
  const averageRenderTime = Object.values(performanceData).reduce((sum, metrics) => sum + metrics.averageRenderTime, 0) / Object.keys(performanceData).length || 0;

  if (!isVisible) {
    return (
      <Button
        onClick={() => setIsVisible(true)}
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50"
      >
        <BarChart3 className="h-4 w-4 mr-2" />
        Performance
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-96 max-h-96 overflow-y-auto z-50 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Performance Dashboard
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(false)}
            className="h-6 w-6 p-0"
          >
            ×
          </Button>
        </div>
        <CardDescription className="text-xs">
          Real-time component performance metrics
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded">
            <div className="text-xs text-slate-600 dark:text-slate-400">Total Renders</div>
            <div className="text-lg font-semibold">{totalRenders}</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded">
            <div className="text-xs text-slate-600 dark:text-slate-400">Avg Time</div>
            <div className="text-lg font-semibold">
              {averageRenderTime.toFixed(1)}ms
            </div>
          </div>
        </div>

        {/* Component Details */}
        <div className="space-y-2">
          {Object.entries(performanceData).map(([componentName, metrics]) => {
            const grade = getPerformanceGrade(metrics.averageRenderTime);

            return (
              <div key={componentName} className="border rounded p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium truncate">{componentName}</span>
                  <Badge variant="outline" className={grade.color}>
                    {grade.grade}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-1 text-xs text-slate-600 dark:text-slate-400">
                  <div>
                    <div className="font-medium">Renders</div>
                    <div>{metrics.renderCount}</div>
                  </div>
                  <div>
                    <div className="font-medium">Avg</div>
                    <div>{metrics.averageRenderTime.toFixed(1)}ms</div>
                  </div>
                  <div>
                    <div className="font-medium">Last</div>
                    <div>{metrics.lastRenderTime.toFixed(1)}ms</div>
                  </div>
                </div>
                {metrics.averageRenderTime > 20 && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-orange-600">
                    <AlertCircle className="h-3 w-3" />
                    <span>Consider optimization</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Performance Tips */}
        <div className="border-t pt-2">
          <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Tips:</div>
          <ul className="text-xs space-y-1 text-slate-500 dark:text-slate-400">
            <li>• Use React.memo for pure components</li>
            <li>• Memoize expensive calculations with useMemo</li>
            <li>• Use useCallback for stable function references</li>
            <li>• Virtualize large lists with react-window</li>
            <li>• Avoid inline objects in render props</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

// Custom hook for performance optimization
export const usePerformanceOptimization = () => {
  const [metrics, setMetrics] = useState<ComponentPerformanceData>({});

  const recordPerformance = useCallback((componentName: string, renderTime: number) => {
    setMetrics(prev => {
      const existing = prev[componentName] || {
        renderTime: 0,
        renderCount: 0,
        lastRenderTime: 0,
        averageRenderTime: 0,
        slowestRender: 0,
        fastestRender: Infinity,
      };

      const newRenderCount = existing.renderCount + 1;
      const totalTime = existing.averageRenderTime * existing.renderCount + renderTime;
      const newAverage = totalTime / newRenderCount;

      const updated = {
        renderTime,
        renderCount: newRenderCount,
        lastRenderTime: renderTime,
        averageRenderTime: newAverage,
        slowestRender: Math.max(existing.slowestRender, renderTime),
        fastestRender: Math.min(existing.fastestRender, renderTime),
      };

      // Emit custom event for dashboard
      window.dispatchEvent(new CustomEvent('performance-update', {
        detail: { componentName, metrics: updated }
      }));

      return {
        ...prev,
        [componentName]: updated,
      };
    });
  }, []);

  return { metrics, recordPerformance };
};

export default {
  createMemoizedComponent,
  withPerformanceMonitoring,
  VirtualizedList,
  useExpensiveCalculation,
  useStableCallback,
  performanceUtils,
  PerformanceDashboard,
  usePerformanceOptimization,
};
