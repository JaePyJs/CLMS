/**
 * Comprehensive Performance Monitoring System
 * Provides APM capabilities, structured logging, and performance metrics
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string> | undefined;
  type: 'duration' | 'counter' | 'gauge' | 'histogram';
  unit?: string | undefined;
}

export interface CustomPerformanceEntry {
  name: string;
  startTime: number;
  duration?: number | undefined;
  metadata?: Record<string, unknown> | undefined;
  status: 'started' | 'completed' | 'error';
  error?: Error | undefined;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
  tags?: Record<string, string>;
  userId?: string;
  sessionId?: string;
  requestId?: string;
}

export interface PerformanceConfig {
  enableConsoleLogging: boolean;
  enableRemoteLogging: boolean;
  remoteEndpoint?: string;
  sampleRate: number; // 0.0 to 1.0
  maxBufferSize: number;
  flushInterval: number;
  enableUserTiming: boolean;
  enableResourceTiming: boolean;
  enableNavigationTiming: boolean;
  enablePaintTiming: boolean;
  customMetrics: Record<string, (data: unknown) => number>;
}

class PerformanceMonitor {
  private config: PerformanceConfig;
  private metrics: PerformanceMetric[] = [];
  private logs: LogEntry[] = [];
  private activeEntries: Map<string, CustomPerformanceEntry> = new Map();
  private flushTimer: number | null = null;
  private sessionId: string;
  private userId: string | null = null;

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      enableConsoleLogging: true,
      enableRemoteLogging: false,
      sampleRate: 1.0,
      maxBufferSize: 1000,
      flushInterval: 30000, // 30 seconds
      enableUserTiming: true,
      enableResourceTiming: true,
      enableNavigationTiming: true,
      enablePaintTiming: true,
      customMetrics: {},
      ...config,
    };

    this.sessionId = this.generateSessionId();
    this.initializeMonitoring();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeMonitoring(): void {
    // Start periodic flush
    this.startFlushTimer();

    // Collect initial performance metrics
    this.collectNavigationTiming();
    this.collectPaintTiming();
    this.collectResourceTiming();

    // Set up performance observers
    if ('PerformanceObserver' in window) {
      this.setupPerformanceObservers();
    }

    // Track page visibility changes
    this.setupVisibilityTracking();

    // Track errors
    this.setupErrorTracking();

    // Log initialization
    this.info('Performance monitoring initialized', {
      sessionId: this.sessionId,
      config: this.config,
    });
  }

  private setupPerformanceObservers(): void {
    // Long task observer
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric('long_task', entry.duration, {
              type: 'duration',
              unit: 'ms',
              tags: { name: entry.name },
            });
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        // Long tasks might not be supported in all browsers
      }

      // Largest contentful paint observer
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          if (lastEntry) {
            this.recordMetric('largest_contentful_paint', lastEntry.startTime, {
              type: 'duration',
              unit: 'ms',
              tags: {
                element:
                  (lastEntry as any).element?.tagName ||
                  (lastEntry as any).url ||
                  'unknown',
              },
            });
          }
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        // LCP might not be supported in all browsers
      }

      // First input delay observer
      try {
        const fidObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric(
              'first_input_delay',
              (entry as any).processingStart - entry.startTime,
              {
                type: 'duration',
                unit: 'ms',
              }
            );
          }
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch (e) {
        // FID might not be supported in all browsers
      }
    }
  }

  private setupVisibilityTracking(): void {
    let visibilityStart = performance.now();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        const visibilityDuration = performance.now() - visibilityStart;
        this.recordMetric('page_visibility_duration', visibilityDuration, {
          type: 'duration',
          unit: 'ms',
        });
      } else {
        visibilityStart = performance.now();
      }
    });
  }

  private setupErrorTracking(): void {
    window.addEventListener('error', (event) => {
      this.error('JavaScript error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled promise rejection', {
        reason: event.reason,
        stack: event.reason?.stack,
      });
    });
  }

  private collectNavigationTiming(): void {
    if (!this.config.enableNavigationTiming) {
      return;
    }

    const timing = performance.timing;
    if (!timing) {
      return;
    }

    const navigationStart = timing.navigationStart;
    const metrics = [
      {
        name: 'dns_lookup',
        start: timing.domainLookupStart,
        end: timing.domainLookupEnd,
      },
      {
        name: 'tcp_connection',
        start: timing.connectStart,
        end: timing.connectEnd,
      },
      {
        name: 'request',
        start: timing.requestStart,
        end: timing.responseStart,
      },
      {
        name: 'response',
        start: timing.responseStart,
        end: timing.responseEnd,
      },
      {
        name: 'dom_processing',
        start: timing.domLoading,
        end: timing.domComplete,
      },
      {
        name: 'load_event',
        start: timing.loadEventStart,
        end: timing.loadEventEnd,
      },
    ];

    metrics.forEach((metric) => {
      const duration = metric.end - metric.start;
      if (duration > 0) {
        this.recordMetric(metric.name, duration, {
          type: 'duration',
          unit: 'ms',
        });
      }
    });

    // Page load time
    const pageLoadTime = timing.loadEventEnd - navigationStart;
    this.recordMetric('page_load_time', pageLoadTime, {
      type: 'duration',
      unit: 'ms',
    });
  }

  private collectPaintTiming(): void {
    if (!this.config.enablePaintTiming) {
      return;
    }

    const paintEntries = performance.getEntriesByType('paint');
    paintEntries.forEach((entry) => {
      this.recordMetric(entry.name, entry.startTime, {
        type: 'duration',
        unit: 'ms',
      });
    });
  }

  private collectResourceTiming(): void {
    if (!this.config.enableResourceTiming) {
      return;
    }

    const resourceEntries = performance.getEntriesByType(
      'resource'
    ) as PerformanceResourceTiming[];
    resourceEntries.forEach((entry) => {
      const duration = entry.responseEnd - entry.startTime;
      const size = entry.transferSize || 0;

      this.recordMetric('resource_duration', duration, {
        type: 'duration',
        unit: 'ms',
        tags: {
          name: entry.name,
          type: this.getResourceType(entry.name),
        },
      });

      if (size > 0) {
        this.recordMetric('resource_size', size, {
          type: 'gauge',
          unit: 'bytes',
          tags: {
            name: entry.name,
            type: this.getResourceType(entry.name),
          },
        });
      }
    });
  }

  private getResourceType(url: string): string {
    if (url.match(/\.(js|mjs)$/)) {
      return 'script';
    }
    if (url.match(/\.(css)$/)) {
      return 'stylesheet';
    }
    if (url.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) {
      return 'image';
    }
    if (url.match(/\.(woff|woff2|ttf|eot)$/)) {
      return 'font';
    }
    return 'other';
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      return;
    }

    this.flushTimer = window.setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  private flush(): void {
    if (!this.shouldSample()) {
      return;
    }

    const data = {
      metrics: this.metrics.slice(),
      logs: this.logs.slice(),
      sessionId: this.sessionId,
      userId: this.userId,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Clear buffers
    this.metrics = [];
    this.logs = [];

    // Send to remote endpoint if configured
    if (this.config.enableRemoteLogging && this.config.remoteEndpoint) {
      this.sendToRemote(data);
    }

    // Console logging for debugging
    if (this.config.enableConsoleLogging) {
      console.group('Performance Monitor Flush');
      console.log('Metrics:', data.metrics);
      console.log('Logs:', data.logs);
      console.groupEnd();
    }
  }

  private async sendToRemote(data: unknown): Promise<void> {
    if (!this.config.remoteEndpoint) {
      return;
    }

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error('Failed to send performance data:', error);
    }
  }

  // Public API

  /**
   * Start timing a performance entry
   */
  start(name: string, metadata?: Record<string, unknown>): string {
    const id = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const entry: CustomPerformanceEntry = {
      name,
      startTime: performance.now(),
      metadata,
      status: 'started',
    };

    this.activeEntries.set(id, entry);
    return id;
  }

  /**
   * End timing a performance entry
   */
  end(id: string, error?: Error): void {
    const entry = this.activeEntries.get(id);
    if (!entry) {
      return;
    }

    const endTime = performance.now();
    const duration = endTime - entry.startTime;

    if (error) {
      entry.status = 'error';
      entry.error = error;
      this.error(`Performance entry failed: ${entry.name}`, {
        duration,
        error: error.message,
        metadata: entry.metadata,
      });
    } else {
      entry.status = 'completed';
      entry.duration = duration;
      this.recordMetric(entry.name, duration, {
        type: 'duration',
        unit: 'ms',
        tags: { status: 'success' },
      });
    }

    this.activeEntries.delete(id);
  }

  /**
   * Record a performance metric
   */
  recordMetric(
    name: string,
    value: number,
    options?: {
      type?: 'duration' | 'counter' | 'gauge' | 'histogram';
      unit?: string;
      tags?: Record<string, string>;
    }
  ): void {
    if (!this.shouldSample()) {
      return;
    }

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      type: options?.type || 'gauge',
      unit: options?.unit,
      tags: options?.tags,
    };

    this.metrics.push(metric);

    // Apply custom metric transformations
    if (this.config.customMetrics[name]) {
      const transformedValue = this.config.customMetrics[name](value);
      const metric: PerformanceMetric = {
        name: `${name}_transformed`,
        value: transformedValue,
        timestamp: Date.now(),
        type: 'gauge',
      };
      if (options?.tags) {
        metric.tags = options.tags;
      }
      this.metrics.push(metric);
    }

    // Buffer management
    if (this.metrics.length >= this.config.maxBufferSize) {
      this.flush();
    }
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  /**
   * Log an error message
   */
  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  private log(
    level: LogEntry['level'],
    message: string,
    context?: Record<string, unknown>
  ): void {
    if (!this.shouldSample()) {
      return;
    }

    const logEntry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      sessionId: this.sessionId,
    };

    if (context) {
      logEntry.context = context;
    }
    if (this.userId) {
      logEntry.userId = this.userId;
    }

    this.logs.push(logEntry);

    // Console logging
    if (this.config.enableConsoleLogging) {
      const consoleMethod =
        level === 'error'
          ? console.error
          : level === 'warn'
            ? console.warn
            : level === 'info'
              ? console.info
              : console.debug;
      consoleMethod(`[${level.toUpperCase()}] ${message}`, context);
    }

    // Buffer management
    if (this.logs.length >= this.config.maxBufferSize) {
      this.flush();
    }
  }

  /**
   * Set the current user ID for tracking
   */
  setUserId(userId: string): void {
    this.userId = userId;
    this.info('User ID set', { userId });
  }

  /**
   * Clear the current user ID
   */
  clearUserId(): void {
    this.userId = null;
    this.info('User ID cleared');
  }

  /**
   * Force flush all buffered data
   */
  flushNow(): void {
    this.flush();
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get current logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Clear all buffered data
   */
  clear(): void {
    this.metrics = [];
    this.logs = [];
    this.activeEntries.clear();
  }

  /**
   * Destroy the performance monitor
   */
  destroy(): void {
    this.stopFlushTimer();
    this.flushNow();
    this.clear();
  }

  /**
   * Get performance summary
   */
  getSummary(): {
    metricsCount: number;
    logsCount: number;
    activeEntriesCount: number;
    sessionId: string;
    userId: string | null;
  } {
    return {
      metricsCount: this.metrics.length,
      logsCount: this.logs.length,
      activeEntriesCount: this.activeEntries.size,
      sessionId: this.sessionId,
      userId: this.userId,
    };
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor({
  enableConsoleLogging: process.env.NODE_ENV === 'development',
  enableRemoteLogging: process.env.NODE_ENV === 'production',
  sampleRate: 0.1, // 10% sampling in production
  maxBufferSize: 500,
  flushInterval: 30000,
});

// Export class for custom instances
export { PerformanceMonitor };
export default performanceMonitor;
