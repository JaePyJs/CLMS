'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  performanceMonitor,
  type PerformanceMetric,
  type LogEntry,
} from '@/lib/performance-monitor';

interface PerformanceContextType {
  metrics: PerformanceMetric[];
  logs: LogEntry[];
  sessionId: string;
  userId: string | null;
  setUserId: (userId: string) => void;
  clearUserId: () => void;
  flush: () => void;
  getSummary: () => {
    metricsCount: number;
    logsCount: number;
    activeEntriesCount: number;
    sessionId: string;
    userId: string | null;
  };
}

const PerformanceContext = createContext<PerformanceContextType | null>(null);

interface PerformanceProviderProps {
  children: React.ReactNode;
  config?: {
    enableConsoleLogging?: boolean;
    enableRemoteLogging?: boolean;
    remoteEndpoint?: string;
    sampleRate?: number;
    flushInterval?: number;
  };
}

export function PerformanceProvider({
  children,
  config,
}: PerformanceProviderProps) {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [userId, setUserIdState] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update performance monitor config if provided
  useEffect(() => {
    if (config) {
      // Note: In a real implementation, you'd need to reinitialize the monitor
      // For now, we'll just log that config was updated
      performanceMonitor.info('Performance provider config updated', {
        config,
      });
    }
  }, [config]);

  // Periodically sync data from monitor
  useEffect(() => {
    const syncData = () => {
      setMetrics(performanceMonitor.getMetrics());
      setLogs(performanceMonitor.getLogs());
    };

    // Initial sync
    syncData();

    // Set up periodic sync
    intervalRef.current = setInterval(syncData, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Set user ID in monitor when it changes
  const setUserId = (newUserId: string) => {
    setUserIdState(newUserId);
    performanceMonitor.setUserId(newUserId);
  };

  const clearUserId = () => {
    setUserIdState(null);
    performanceMonitor.clearUserId();
  };

  const flush = () => {
    performanceMonitor.flushNow();
    // Update local state after flush
    setTimeout(() => {
      setMetrics(performanceMonitor.getMetrics());
      setLogs(performanceMonitor.getLogs());
    }, 100);
  };

  const getSummary = () => performanceMonitor.getSummary();

  const contextValue: PerformanceContextType = {
    metrics,
    logs,
    sessionId: performanceMonitor['sessionId'],
    userId,
    setUserId,
    clearUserId,
    flush,
    getSummary,
  };

  return (
    <PerformanceContext.Provider value={contextValue}>
      {children}
    </PerformanceContext.Provider>
  );
}

export function usePerformanceContext() {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error(
      'usePerformanceContext must be used within a PerformanceProvider'
    );
  }
  return context;
}

/**
 * Hook for accessing performance metrics
 */
export function usePerformanceMetrics() {
  const { metrics } = usePerformanceContext();
  return metrics;
}

/**
 * Hook for accessing performance logs
 */
export function usePerformanceLogs() {
  const { logs } = usePerformanceContext();
  return logs;
}

/**
 * Hook for performance session management
 */
export function usePerformanceSession() {
  const { sessionId, userId, setUserId, clearUserId, flush, getSummary } =
    usePerformanceContext();
  return { sessionId, userId, setUserId, clearUserId, flush, getSummary };
}

export default PerformanceProvider;
