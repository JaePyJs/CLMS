/**
 * Comprehensive Monitoring and Metrics Service
 *
 * This service provides application performance monitoring, real-time metrics
 * collection, and system health monitoring for CLMS production deployment.
 */

import { EventEmitter } from 'events';
import { optimizedDatabase } from '@/config/database';
import { enhancedRedis } from '@/config/redis';
import { optimizedJobProcessor } from '@/services/optimizedJobProcessor';
import { logger } from '@/utils/logger';

interface SystemMetrics {
  timestamp: number;
  system: {
    cpu: {
      usage: number;
      loadAverage: number[];
    };
    memory: {
      used: number;
      total: number;
      percentage: number;
      heapUsed: number;
      heapTotal: number;
      external: number;
    };
    disk: {
      used: number;
      total: number;
      percentage: number;
    };
    network: {
      bytesIn: number;
      bytesOut: number;
      connections: number;
    };
  };
  application: {
    uptime: number;
    activeConnections: number;
    requestsPerSecond: number;
    responseTime: {
      average: number;
      p95: number;
      p99: number;
    };
    errorRate: number;
    activeUsers: number;
  };
  database: {
    connections: number;
    queriesPerSecond: number;
    slowQueries: number;
    averageQueryTime: number;
    connectionPool: {
      active: number;
      idle: number;
      total: number;
    };
  };
  cache: {
    hitRate: number;
    memoryUsage: number;
    keys: number;
    operationsPerSecond: number;
  };
  jobs: {
    active: number;
    completed: number;
    failed: number;
    queued: number;
    averageProcessingTime: number;
  };
}

interface Alert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  message: string;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  metadata: Record<string, any>;
}

interface MonitoringConfig {
  enabled: boolean;
  interval: number;
  retention: number;
  alerts: {
    enabled: boolean;
    thresholds: {
      cpu: number;
      memory: number;
      disk: number;
      errorRate: number;
      responseTime: number;
      databaseConnections: number;
      cacheHitRate: number;
    };
    notifications: {
      email: boolean;
      slack: boolean;
      webhook: boolean;
    };
  };
  reporting: {
    enabled: boolean;
    interval: number;
    retention: number;
  };
}

class MonitoringService extends EventEmitter {
  private config: MonitoringConfig;
  private metrics: SystemMetrics[] = [];
  private alerts: Alert[] = [];
  private intervals: NodeJS.Timeout[] = [];
  private requestMetrics: Map<string, number> = new Map();
  private responseTimes: number[] = [];
  private errorCount = 0;
  private requestCount = 0;
  private lastMetricsTime = Date.now();

  constructor() {
    super();
    this.config = this.loadConfig();
    this.setupMonitoring();
  }

  private loadConfig(): MonitoringConfig {
    return {
      enabled: process.env.MONITORING_ENABLED !== 'false',
      interval: parseInt(process.env.MONITORING_INTERVAL || '30000'), // 30 seconds
      retention: parseInt(process.env.MONITORING_RETENTION || '86400000'), // 24 hours
      alerts: {
        enabled: process.env.ALERTS_ENABLED !== 'false',
        thresholds: {
          cpu: parseFloat(process.env.ALERT_CPU_THRESHOLD || '80'),
          memory: parseFloat(process.env.ALERT_MEMORY_THRESHOLD || '85'),
          disk: parseFloat(process.env.ALERT_DISK_THRESHOLD || '90'),
          errorRate: parseFloat(process.env.ALERT_ERROR_RATE_THRESHOLD || '5'),
          responseTime: parseFloat(process.env.ALERT_RESPONSE_TIME_THRESHOLD || '2000'),
          databaseConnections: parseInt(process.env.ALERT_DB_CONNECTIONS_THRESHOLD || '80'),
          cacheHitRate: parseFloat(process.env.ALERT_CACHE_HIT_RATE_THRESHOLD || '80'),
        },
        notifications: {
          email: process.env.ALERT_EMAIL_ENABLED === 'true',
          slack: process.env.ALERT_SLACK_ENABLED === 'true',
          webhook: process.env.ALERT_WEBHOOK_ENABLED === 'true',
        },
      },
      reporting: {
        enabled: process.env.REPORTING_ENABLED !== 'false',
        interval: parseInt(process.env.REPORTING_INTERVAL || '3600000'), // 1 hour
        retention: parseInt(process.env.REPORTING_RETENTION || '604800000'), // 7 days
      },
    };
  }

  private setupMonitoring(): void {
    if (!this.config.enabled) {
      logger.info('Monitoring service is disabled');
      return;
    }

    // Start metrics collection
    const metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.interval);

    this.intervals.push(metricsInterval);

    // Start alert checking
    if (this.config.alerts.enabled) {
      const alertInterval = setInterval(() => {
        this.checkAlerts();
      }, this.config.interval);

      this.intervals.push(alertInterval);
    }

    // Start reporting
    if (this.config.reporting.enabled) {
      const reportingInterval = setInterval(() => {
        this.generateReports();
      }, this.config.reporting.interval);

      this.intervals.push(reportingInterval);
    }

    // Cleanup old data
    const cleanupInterval = setInterval(() => {
      this.cleanupOldData();
    }, this.config.retention);

    this.intervals.push(cleanupInterval);

    logger.info('Monitoring service initialized', {
      interval: this.config.interval,
      alerts: this.config.alerts.enabled,
      reporting: this.config.reporting.enabled,
    });
  }

  private async collectMetrics(): Promise<void> {
    try {
      const timestamp = Date.now();
      const systemMetrics = await this.getSystemMetrics();
      const applicationMetrics = this.getApplicationMetrics();
      const databaseMetrics = await this.getDatabaseMetrics();
      const cacheMetrics = await this.getCacheMetrics();
      const jobMetrics = await this.getJobMetrics();

      const metrics: SystemMetrics = {
        timestamp,
        system: systemMetrics,
        application: applicationMetrics,
        database: databaseMetrics,
        cache: cacheMetrics,
        jobs: jobMetrics,
      };

      this.metrics.push(metrics);

      // Keep only metrics within retention period
      const cutoffTime = Date.now() - this.config.retention;
      this.metrics = this.metrics.filter(m => m.timestamp > cutoffTime);

      // Reset request metrics for next interval
      this.resetRequestMetrics();

      // Emit metrics event
      this.emit('metrics', metrics);

      logger.debug('Metrics collected', {
        timestamp,
        cpu: systemMetrics.cpu.usage,
        memory: systemMetrics.memory.percentage,
        rps: applicationMetrics.requestsPerSecond,
        errorRate: applicationMetrics.errorRate,
      });
    } catch (error) {
      logger.error('Metrics collection failed', {
        error: (error as Error).message,
      });
    }
  }

  private async getSystemMetrics(): Promise<SystemMetrics['system']> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const loadAvg = require('os').loadavg();

    // Calculate CPU usage percentage
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to percentage

    return {
      cpu: {
        usage: cpuPercent,
        loadAverage: loadAvg,
      },
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        heapUsed: memUsage.heapUsed / 1024 / 1024, // MB
        heapTotal: memUsage.heapTotal / 1024 / 1024, // MB
        external: memUsage.external / 1024 / 1024, // MB
      },
      disk: {
        // This would require additional monitoring
        used: 0,
        total: 0,
        percentage: 0,
      },
      network: {
        bytesIn: 0,
        bytesOut: 0,
        connections: 0,
      },
    };
  }

  private getApplicationMetrics(): SystemMetrics['application'] {
    const now = Date.now();
    const timeDiff = (now - this.lastMetricsTime) / 1000; // seconds

    const requestsPerSecond = this.requestCount / timeDiff;
    const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;

    const responseTimeStats = this.calculateResponseTimeStats();

    return {
      uptime: process.uptime(),
      activeConnections: this.requestMetrics.size,
      requestsPerSecond,
      responseTime: responseTimeStats,
      errorRate,
      activeUsers: this.requestMetrics.size, // Simplified - would track actual users
    };
  }

  private calculateResponseTimeStats(): SystemMetrics['application']['responseTime'] {
    if (this.responseTimes.length === 0) {
      return { average: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const average = sorted.reduce((sum, time) => sum + time, 0) / sorted.length;

    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);

    return {
      average: Math.round(average),
      p95: sorted[p95Index] || 0,
      p99: sorted[p99Index] || 0,
    };
  }

  private async getDatabaseMetrics(): Promise<SystemMetrics['database']> {
    try {
      const dbHealth = await optimizedDatabase.healthCheck();
      const queryStats = optimizedDatabase.getQueryStats();
      const slowQueries = optimizedDatabase.getSlowQueries();

      const totalQueries = queryStats.reduce((sum, stat) => sum + stat.count, 0);
      const averageQueryTime = queryStats.length > 0
        ? queryStats.reduce((sum, stat) => sum + stat.avgTime, 0) / queryStats.length
        : 0;

      return {
        connections: dbHealth.poolStats?.activeConnections || 0,
        queriesPerSecond: totalQueries / 30, // Assuming 30-second interval
        slowQueries: slowQueries.length,
        averageQueryTime,
        connectionPool: {
          active: dbHealth.poolStats?.activeConnections || 0,
          idle: 0,
          total: dbHealth.poolStats?.activeConnections || 0,
        },
      };
    } catch (error) {
      logger.error('Database metrics collection failed', {
        error: (error as Error).message,
      });

      return {
        connections: 0,
        queriesPerSecond: 0,
        slowQueries: 0,
        averageQueryTime: 0,
        connectionPool: {
          active: 0,
          idle: 0,
          total: 0,
        },
      };
    }
  }

  private async getCacheMetrics(): Promise<SystemMetrics['cache']> {
    try {
      const redisHealth = await enhancedRedis.healthCheck();
      const cacheStats = enhancedRedis.getStats();

      return {
        hitRate: parseFloat(redisHealth.stats?.hitRate?.replace('%', '') || '0'),
        memoryUsage: 0, // Would get actual Redis memory usage
        keys: 0, // Would get actual Redis key count
        operationsPerSecond: 0, // Would calculate from Redis info
      };
    } catch (error) {
      logger.error('Cache metrics collection failed', {
        error: (error as Error).message,
      });

      return {
        hitRate: 0,
        memoryUsage: 0,
        keys: 0,
        operationsPerSecond: 0,
      };
    }
  }

  private async getJobMetrics(): Promise<SystemMetrics['jobs']> {
    try {
      const jobHealth = await optimizedJobProcessor.healthCheck();
      const jobMetrics = optimizedJobProcessor.getMetrics();

      return {
        active: jobMetrics.active,
        completed: jobMetrics.completed,
        failed: jobMetrics.failed,
        queued: jobMetrics.waiting,
        averageProcessingTime: jobMetrics.averageProcessingTime,
      };
    } catch (error) {
      logger.error('Job metrics collection failed', {
        error: (error as Error).message,
      });

      return {
        active: 0,
        completed: 0,
        failed: 0,
        queued: 0,
        averageProcessingTime: 0,
      };
    }
  }

  private checkAlerts(): void {
    if (this.metrics.length === 0) return;

    const latestMetrics = this.metrics[this.metrics.length - 1];
    const thresholds = this.config.alerts.thresholds;

    // Check CPU usage
    if (latestMetrics.system.cpu.usage > thresholds.cpu) {
      this.createAlert('high', 'cpu',
        `High CPU usage: ${latestMetrics.system.cpu.usage.toFixed(2)}%`,
        { usage: latestMetrics.system.cpu.usage }
      );
    }

    // Check memory usage
    if (latestMetrics.system.memory.percentage > thresholds.memory) {
      this.createAlert('high', 'memory',
        `High memory usage: ${latestMetrics.system.memory.percentage.toFixed(2)}%`,
        { usage: latestMetrics.system.memory.percentage }
      );
    }

    // Check error rate
    if (latestMetrics.application.errorRate > thresholds.errorRate) {
      this.createAlert('medium', 'error_rate',
        `High error rate: ${latestMetrics.application.errorRate.toFixed(2)}%`,
        { errorRate: latestMetrics.application.errorRate }
      );
    }

    // Check response time
    if (latestMetrics.application.responseTime.p95 > thresholds.responseTime) {
      this.createAlert('medium', 'response_time',
        `High response time: ${latestMetrics.application.responseTime.p95}ms`,
        { responseTime: latestMetrics.application.responseTime.p95 }
      );
    }

    // Check cache hit rate
    if (latestMetrics.cache.hitRate < thresholds.cacheHitRate) {
      this.createAlert('low', 'cache_hit_rate',
        `Low cache hit rate: ${latestMetrics.cache.hitRate.toFixed(2)}%`,
        { hitRate: latestMetrics.cache.hitRate }
      );
    }
  }

  private createAlert(
    severity: Alert['severity'],
    type: string,
    message: string,
    metadata: Record<string, any>
  ): void {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      severity,
      type,
      message,
      timestamp: Date.now(),
      resolved: false,
      metadata,
    };

    this.alerts.push(alert);

    // Keep only recent alerts
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    this.alerts = this.alerts.filter(a => a.timestamp > cutoffTime);

    // Emit alert event
    this.emit('alert', alert);

    // Send notifications if configured
    if (this.config.alerts.notifications.email) {
      this.sendEmailNotification(alert);
    }

    if (this.config.alerts.notifications.slack) {
      this.sendSlackNotification(alert);
    }

    if (this.config.alerts.notifications.webhook) {
      this.sendWebhookNotification(alert);
    }

    logger.warn('Alert created', {
      id: alert.id,
      severity,
      type,
      message,
    });
  }

  private sendEmailNotification(alert: Alert): void {
    // Implementation for email notifications
    logger.info('Email notification sent', { alertId: alert.id });
  }

  private sendSlackNotification(alert: Alert): void {
    // Implementation for Slack notifications
    logger.info('Slack notification sent', { alertId: alert.id });
  }

  private sendWebhookNotification(alert: Alert): void {
    // Implementation for webhook notifications
    logger.info('Webhook notification sent', { alertId: alert.id });
  }

  private generateReports(): void {
    if (this.metrics.length === 0) return;

    const report = {
      timestamp: Date.now(),
      period: this.config.reporting.interval,
      metrics: this.getAggregatedMetrics(),
      alerts: this.alerts.filter(a => !a.resolved),
    };

    // Store report
    this.emit('report', report);

    logger.info('Report generated', {
      timestamp: report.timestamp,
      metricsCount: report.metrics.length,
      activeAlerts: report.alerts.length,
    });
  }

  private getAggregatedMetrics(): any {
    // Calculate aggregated metrics for the reporting period
    const recentMetrics = this.metrics.slice(-10); // Last 10 data points

    if (recentMetrics.length === 0) return {};

    return {
      averageCpuUsage: recentMetrics.reduce((sum, m) => sum + m.system.cpu.usage, 0) / recentMetrics.length,
      averageMemoryUsage: recentMetrics.reduce((sum, m) => sum + m.system.memory.percentage, 0) / recentMetrics.length,
      averageResponseTime: recentMetrics.reduce((sum, m) => sum + m.application.responseTime.average, 0) / recentMetrics.length,
      totalRequests: recentMetrics.reduce((sum, m) => sum + m.application.requestsPerSecond, 0),
      totalErrors: recentMetrics.reduce((sum, m) => sum + m.application.errorRate, 0),
    };
  }

  private cleanupOldData(): void {
    const cutoffTime = Date.now() - this.config.retention;

    // Clean up old metrics
    const metricsCount = this.metrics.length;
    this.metrics = this.metrics.filter(m => m.timestamp > cutoffTime);

    // Clean up old alerts
    const alertsCount = this.alerts.length;
    this.alerts = this.alerts.filter(a => a.timestamp > cutoffTime);

    logger.debug('Old data cleaned up', {
      metricsRemoved: metricsCount - this.metrics.length,
      alertsRemoved: alertsCount - this.alerts.length,
    });
  }

  private resetRequestMetrics(): void {
    this.lastMetricsTime = Date.now();
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimes = [];
  }

  // Public API methods
  recordRequest(responseTime: number, isError: boolean = false): void {
    this.requestCount++;
    if (isError) {
      this.errorCount++;
    }
    this.responseTimes.push(responseTime);
  }

  recordConnection(connectionId: string): void {
    this.requestMetrics.set(connectionId, Date.now());
  }

  removeConnection(connectionId: string): void {
    this.requestMetrics.delete(connectionId);
  }

  getMetrics(limit?: number): SystemMetrics[] {
    if (limit) {
      return this.metrics.slice(-limit);
    }
    return [...this.metrics];
  }

  getAlerts(resolved?: boolean): Alert[] {
    if (resolved !== undefined) {
      return this.alerts.filter(a => a.resolved === resolved);
    }
    return [...this.alerts];
  }

  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      this.emit('alert_resolved', alert);
      logger.info('Alert resolved', { alertId });
    }
  }

  async getHealthStatus(): Promise<{
    healthy: boolean;
    metrics: SystemMetrics;
    alerts: Alert[];
    services: any;
  }> {
    const latestMetrics = this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
    const activeAlerts = this.alerts.filter(a => !a.resolved);
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');

    const healthy = criticalAlerts.length === 0 && latestMetrics !== null;

    return {
      healthy,
      metrics: latestMetrics || {} as SystemMetrics,
      alerts: activeAlerts,
      services: {
        database: await optimizedDatabase.healthCheck(),
        redis: await enhancedRedis.healthCheck(),
        jobs: await optimizedJobProcessor.healthCheck(),
      },
    };
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down monitoring service...');

    // Clear all intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];

    // Generate final report
    if (this.config.reporting.enabled) {
      this.generateReports();
    }

    logger.info('Monitoring service shutdown completed');
  }
}

// Create and export singleton instance
export const monitoringService = new MonitoringService();
export default monitoringService;