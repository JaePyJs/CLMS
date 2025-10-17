import { EventEmitter } from 'events';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '@/utils/logger';
import { PrismaClient } from '@prisma/client';

// Performance metrics interfaces
interface PerformanceMetric {
  timestamp: number;
  category: 'database' | 'api' | 'cache' | 'memory' | 'import';
  operation: string;
  duration: number;
  success: boolean;
  metadata?: Record<string, any>;
}

interface SystemMetrics {
  timestamp: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  eventLoop: {
    utilization: number;
    delay: number;
  };
  gc: {
    collections: number;
    duration: number;
  };
}

interface PerformanceSummary {
  timeRange: {
    start: number;
    end: number;
  };
  categories: {
    [key: string]: {
      count: number;
      avgDuration: number;
      minDuration: number;
      maxDuration: number;
      p95Duration: number;
      p99Duration: number;
      successRate: number;
      errorsPerMinute: number;
    };
  };
  systemMetrics: {
    avgMemoryUsage: number;
    maxMemoryUsage: number;
    avgCpuUsage: number;
    maxCpuUsage: number;
  };
  alerts: PerformanceAlert[];
}

interface PerformanceAlert {
  id: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  message: string;
  metric: string;
  value: number;
  threshold: number;
  resolved: boolean;
  resolvedAt?: number;
}

interface PerformanceThresholds {
  [key: string]: {
    warning: number;
    critical: number;
  };
}

/**
 * Performance Monitoring Service
 * 
 * Collects, analyzes, and reports on various performance metrics
 * across the CLMS application.
 */
export class PerformanceMonitoringService extends EventEmitter {
  private metrics: PerformanceMetric[] = [];
  private systemMetrics: SystemMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private thresholds: PerformanceThresholds = {
    'database.createStudent': { warning: 50, critical: 100 },
    'database.readStudent': { warning: 30, critical: 50 },
    'database.updateStudent': { warning: 40, critical: 80 },
    'database.deleteStudent': { warning: 30, critical: 50 },
    'database.complexQuery': { warning: 200, critical: 500 },
    'api.studentList': { warning: 100, critical: 200 },
    'api.bookList': { warning: 150, critical: 300 },
    'api.searchQuery': { warning: 200, critical: 400 },
    'api.analytics': { warning: 1000, critical: 2000 },
    'cache.setOperation': { warning: 10, critical: 20 },
    'cache.getOperation': { warning: 5, critical: 10 },
    'cache.batchOperation': { warning: 2, critical: 5 },
    'memory.usage': { warning: 80, critical: 90 },
    'memory.growthRate': { warning: 10, critical: 20 },
    'import.smallDataset': { warning: 2000, critical: 5000 },
    'import.mediumDataset': { warning: 10000, critical: 20000 },
    'import.largeDataset': { warning: 30000, critical: 60000 }
  };

  private intervals: NodeJS.Timeout[] = [];
  private metricsDir: string;
  private maxMetricsCount: number = 10000;
  private maxSystemMetricsCount: number = 1440; // 24 hours at 1 minute intervals
  private isCollecting: boolean = false;

  constructor(metricsDir?: string) {
    super();
    this.metricsDir = metricsDir || join(process.cwd(), 'performance-metrics');
    
    // Ensure metrics directory exists
    if (!existsSync(this.metricsDir)) {
      mkdirSync(this.metricsDir, { recursive: true });
    }

    // Load existing metrics if available
    this.loadMetrics();
  }

  /**
   * Start performance monitoring
   */
  start(): void {
    if (this.isCollecting) {
      logger.warn('Performance monitoring is already running');
      return;
    }

    this.isCollecting = true;

    // Collect system metrics every minute
    const systemMetricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 60000);
    this.intervals.push(systemMetricsInterval);

    // Analyze metrics every 5 minutes
    const analysisInterval = setInterval(() => {
      this.analyzeMetrics();
    }, 300000);
    this.intervals.push(analysisInterval);

    // Clean up old metrics every hour
    const cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 3600000);
    this.intervals.push(cleanupInterval);

    // Save metrics every 10 minutes
    const saveInterval = setInterval(() => {
      this.saveMetrics();
    }, 600000);
    this.intervals.push(saveInterval);

    logger.info('Performance monitoring started');
    this.emit('started');
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (!this.isCollecting) {
      logger.warn('Performance monitoring is not running');
      return;
    }

    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    this.isCollecting = false;

    // Save final metrics
    this.saveMetrics();

    logger.info('Performance monitoring stopped');
    this.emit('stopped');
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    const fullMetric: PerformanceMetric = {
      timestamp: Date.now(),
      ...metric
    };

    this.metrics.push(fullMetric);

    // Check against thresholds
    this.checkThresholds(fullMetric);

    // Keep metrics array within bounds
    if (this.metrics.length > this.maxMetricsCount) {
      this.metrics = this.metrics.slice(-this.maxMetricsCount);
    }

    // Emit metric event
    this.emit('metric', fullMetric);
  }

  /**
   * Record a performance metric with duration measurement
   */
  recordDuration<T>(
    category: PerformanceMetric['category'],
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    return new Promise(async (resolve, reject) => {
      const startTime = Date.now();
      let success = true;
      let result: T;
      let error: Error | null = null;

      try {
        result = await fn();
      } catch (e) {
        success = false;
        error = e as Error;
        reject(e);
        return;
      } finally {
        const duration = Date.now() - startTime;
        
        this.recordMetric({
          category,
          operation,
          duration,
          success,
          metadata: {
            ...metadata,
            error: error ? error.message : undefined
          }
        });

        if (success) {
          resolve(result as T);
        }
      }
    });
  }

  /**
   * Get metrics for a specific time range
   */
  getMetrics(
    startTime?: number,
    endTime?: number,
    category?: PerformanceMetric['category'],
    operation?: string
  ): PerformanceMetric[] {
    let filteredMetrics = this.metrics;

    // Filter by time range
    if (startTime !== undefined) {
      filteredMetrics = filteredMetrics.filter(m => m.timestamp >= startTime);
    }
    if (endTime !== undefined) {
      filteredMetrics = filteredMetrics.filter(m => m.timestamp <= endTime);
    }

    // Filter by category
    if (category !== undefined) {
      filteredMetrics = filteredMetrics.filter(m => m.category === category);
    }

    // Filter by operation
    if (operation !== undefined) {
      filteredMetrics = filteredMetrics.filter(m => m.operation === operation);
    }

    return filteredMetrics;
  }

  /**
   * Get system metrics for a specific time range
   */
  getSystemMetrics(startTime?: number, endTime?: number): SystemMetrics[] {
    let filteredMetrics = this.systemMetrics;

    // Filter by time range
    if (startTime !== undefined) {
      filteredMetrics = filteredMetrics.filter(m => m.timestamp >= startTime);
    }
    if (endTime !== undefined) {
      filteredMetrics = filteredMetrics.filter(m => m.timestamp <= endTime);
    }

    return filteredMetrics;
  }

  /**
   * Get performance summary for a time range
   */
  getSummary(startTime?: number, endTime?: number): PerformanceSummary {
    const metrics = this.getMetrics(startTime, endTime);
    const systemMetrics = this.getSystemMetrics(startTime, endTime);
    const alerts = this.getAlerts(startTime, endTime);

    // Group metrics by category
    const categories: Record<string, PerformanceMetric[]> = {};
    metrics.forEach(metric => {
      const key = `${metric.category}.${metric.operation}`;
      if (!categories[key]) {
        categories[key] = [];
      }
      categories[key].push(metric);
    });

    // Calculate statistics for each category
    const categoryStats: PerformanceSummary['categories'] = {};
    Object.entries(categories).forEach(([key, categoryMetrics]) => {
      const durations = categoryMetrics.map(m => m.duration).sort((a, b) => a - b);
      const successCount = categoryMetrics.filter(m => m.success).length;
      const errorCount = categoryMetrics.length - successCount;
      const timeRange = (endTime || Date.now()) - (startTime || metrics[0]?.timestamp || Date.now());
      const errorsPerMinute = (errorCount / timeRange) * 60000;

      categoryStats[key] = {
        count: categoryMetrics.length,
        avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        minDuration: durations[0] || 0,
        maxDuration: durations[durations.length - 1] || 0,
        p95Duration: durations[Math.floor(durations.length * 0.95)] || 0,
        p99Duration: durations[Math.floor(durations.length * 0.99)] || 0,
        successRate: (successCount / categoryMetrics.length) * 100,
        errorsPerMinute
      };
    });

    // Calculate system metrics statistics
    const memoryUsages = systemMetrics.map(m => m.memory.percentage);
    const cpuUsages = systemMetrics.map(m => m.cpu.usage);

    const systemStats = {
      avgMemoryUsage: memoryUsages.length > 0 ? memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length : 0,
      maxMemoryUsage: memoryUsages.length > 0 ? Math.max(...memoryUsages) : 0,
      avgCpuUsage: cpuUsages.length > 0 ? cpuUsages.reduce((sum, c) => sum + c, 0) / cpuUsages.length : 0,
      maxCpuUsage: cpuUsages.length > 0 ? Math.max(...cpuUsages) : 0
    };

    return {
      timeRange: {
        start: startTime || (metrics[0]?.timestamp || Date.now()),
        end: endTime || Date.now()
      },
      categories: categoryStats,
      systemMetrics: systemStats,
      alerts
    };
  }

  /**
   * Get alerts for a specific time range
   */
  getAlerts(startTime?: number, endTime?: number, resolved?: boolean): PerformanceAlert[] {
    let filteredAlerts = this.alerts;

    // Filter by time range
    if (startTime !== undefined) {
      filteredAlerts = filteredAlerts.filter(a => a.timestamp >= startTime);
    }
    if (endTime !== undefined) {
      filteredAlerts = filteredAlerts.filter(a => a.timestamp <= endTime);
    }

    // Filter by resolved status
    if (resolved !== undefined) {
      filteredAlerts = filteredAlerts.filter(a => a.resolved === resolved);
    }

    return filteredAlerts;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      this.saveMetrics();
      this.emit('alertResolved', alert);
      return true;
    }
    return false;
  }

  /**
   * Update performance thresholds
   */
  updateThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    this.saveMetrics();
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const loadAvg = require('os').loadavg();

    // Calculate CPU usage percentage
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000;

    const systemMetric: SystemMetrics = {
      timestamp: Date.now(),
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        heapUsed: memUsage.heapUsed / 1024 / 1024, // MB
        heapTotal: memUsage.heapTotal / 1024 / 1024, // MB
        external: memUsage.external / 1024 / 1024 // MB
      },
      cpu: {
        usage: cpuPercent,
        loadAverage: loadAvg
      },
      eventLoop: {
        utilization: 0, // Would need additional monitoring
        delay: 0 // Would need additional monitoring
      },
      gc: {
        collections: 0, // Would need additional monitoring
        duration: 0 // Would need additional monitoring
      }
    };

    this.systemMetrics.push(systemMetric);

    // Keep system metrics array within bounds
    if (this.systemMetrics.length > this.maxSystemMetricsCount) {
      this.systemMetrics = this.systemMetrics.slice(-this.maxSystemMetricsCount);
    }

    // Check memory threshold
    this.checkThresholds({
      timestamp: Date.now(),
      category: 'memory',
      operation: 'usage',
      duration: systemMetric.memory.percentage,
      success: true
    });

    this.emit('systemMetrics', systemMetric);
  }

  /**
   * Analyze metrics and generate insights
   */
  private analyzeMetrics(): void {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const metrics = this.getMetrics(oneHourAgo, now);

    // Group metrics by category and operation
    const groups: Record<string, PerformanceMetric[]> = {};
    metrics.forEach(metric => {
      const key = `${metric.category}.${metric.operation}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(metric);
    });

    // Analyze each group
    Object.entries(groups).forEach(([key, groupMetrics]) => {
      const durations = groupMetrics.map(m => m.duration);
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const successCount = groupMetrics.filter(m => m.success).length;
      const errorRate = ((groupMetrics.length - successCount) / groupMetrics.length) * 100;

      // Generate insights
      if (errorRate > 5) {
        this.createAlert({
          severity: errorRate > 10 ? 'high' : 'medium',
          category: key.split('.')[0],
          message: `High error rate detected: ${errorRate.toFixed(2)}%`,
          metric: 'errorRate',
          value: errorRate,
          threshold: 5
        });
      }

      if (avgDuration > this.thresholds[key]?.warning) {
        this.createAlert({
          severity: avgDuration > this.thresholds[key]?.critical ? 'high' : 'medium',
          category: key.split('.')[0],
          message: `Slow operation detected: ${key}`,
          metric: 'avgDuration',
          value: avgDuration,
          threshold: this.thresholds[key]?.warning || 100
        });
      }
    });
  }

  /**
   * Check metric against thresholds
   */
  private checkThresholds(metric: PerformanceMetric): void {
    const key = `${metric.category}.${metric.operation}`;
    const threshold = this.thresholds[key];

    if (threshold) {
      if (metric.duration > threshold.critical) {
        this.createAlert({
          severity: 'critical',
          category: metric.category,
          message: `Critical threshold exceeded for ${key}: ${metric.duration}ms`,
          metric: 'duration',
          value: metric.duration,
          threshold: threshold.critical
        });
      } else if (metric.duration > threshold.warning) {
        this.createAlert({
          severity: 'medium',
          category: metric.category,
          message: `Warning threshold exceeded for ${key}: ${metric.duration}ms`,
          metric: 'duration',
          value: metric.duration,
          threshold: threshold.warning
        });
      }
    }
  }

  /**
   * Create a performance alert
   */
  private createAlert(alert: Omit<PerformanceAlert, 'id' | 'timestamp' | 'resolved'>): void {
    const fullAlert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      resolved: false,
      ...alert
    };

    this.alerts.push(fullAlert);

    // Keep alerts array within bounds (last 1000)
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    // Emit alert event
    this.emit('alert', fullAlert);
    
    logger.warn('Performance alert created', {
      id: fullAlert.id,
      severity: fullAlert.severity,
      category: fullAlert.category,
      message: fullAlert.message,
      value: fullAlert.value,
      threshold: fullAlert.threshold
    });
  }

  /**
   * Clean up old metrics
   */
  private cleanupOldMetrics(): void {
    const now = Date.now();
    const oneWeekAgo = now - 604800000; // 7 days ago

    // Remove old metrics
    const originalMetricsCount = this.metrics.length;
    this.metrics = this.metrics.filter(m => m.timestamp > oneWeekAgo);
    
    // Remove old system metrics (keep last 24 hours)
    const oneDayAgo = now - 86400000;
    const originalSystemMetricsCount = this.systemMetrics.length;
    this.systemMetrics = this.systemMetrics.filter(m => m.timestamp > oneDayAgo);

    // Remove old resolved alerts (keep last 24 hours)
    const originalAlertsCount = this.alerts.length;
    this.alerts = this.alerts.filter(a => 
      !a.resolved || a.timestamp > oneDayAgo || (a.resolvedAt && a.resolvedAt > oneDayAgo)
    );

    logger.info('Performance metrics cleanup completed', {
      metricsRemoved: originalMetricsCount - this.metrics.length,
      systemMetricsRemoved: originalSystemMetricsCount - this.systemMetrics.length,
      alertsRemoved: originalAlertsCount - this.alerts.length
    });
  }

  /**
   * Save metrics to disk
   */
  private saveMetrics(): void {
    try {
      const metricsFile = join(this.metricsDir, 'performance-metrics.json');
      const systemMetricsFile = join(this.metricsDir, 'system-metrics.json');
      const alertsFile = join(this.metricsDir, 'alerts.json');

      writeFileSync(metricsFile, JSON.stringify(this.metrics, null, 2));
      writeFileSync(systemMetricsFile, JSON.stringify(this.systemMetrics, null, 2));
      writeFileSync(alertsFile, JSON.stringify(this.alerts, null, 2));
      writeFileSync(join(this.metricsDir, 'thresholds.json'), JSON.stringify(this.thresholds, null, 2));

      logger.debug('Performance metrics saved to disk');
    } catch (error) {
      logger.error('Failed to save performance metrics', { error: (error as Error).message });
    }
  }

  /**
   * Load metrics from disk
   */
  private loadMetrics(): void {
    try {
      const metricsFile = join(this.metricsDir, 'performance-metrics.json');
      const systemMetricsFile = join(this.metricsDir, 'system-metrics.json');
      const alertsFile = join(this.metricsDir, 'alerts.json');
      const thresholdsFile = join(this.metricsDir, 'thresholds.json');

      if (existsSync(metricsFile)) {
        this.metrics = JSON.parse(readFileSync(metricsFile, 'utf8'));
      }

      if (existsSync(systemMetricsFile)) {
        this.systemMetrics = JSON.parse(readFileSync(systemMetricsFile, 'utf8'));
      }

      if (existsSync(alertsFile)) {
        this.alerts = JSON.parse(readFileSync(alertsFile, 'utf8'));
      }

      if (existsSync(thresholdsFile)) {
        this.thresholds = { ...this.thresholds, ...JSON.parse(readFileSync(thresholdsFile, 'utf8')) };
      }

      logger.info('Performance metrics loaded from disk', {
        metricsCount: this.metrics.length,
        systemMetricsCount: this.systemMetrics.length,
        alertsCount: this.alerts.length
      });
    } catch (error) {
      logger.error('Failed to load performance metrics', { error: (error as Error).message });
    }
  }
}

// Singleton instance
export const performanceMonitoringService = new PerformanceMonitoringService();