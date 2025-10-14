import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { performanceOptimizationService } from '@/services/performanceOptimizationService';
import { redisCacheService } from '@/services/redisCacheService';
import { rateLimitService } from '@/services/rateLimitService';
import { monitoringService } from '@/services/monitoringService';
import { optimizedDatabase } from '@/config/database';

const router = Router();

// Apply rate limiting to performance endpoints
router.use(rateLimitService.createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many performance requests, please try again later.',
}));

/**
 * GET /api/performance/metrics
 * Get comprehensive performance metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const { timeframe = 'hour' } = req.query;

    // Get performance metrics from optimization service
    const perfMetrics = await performanceOptimizationService.getPerformanceMetrics(
      timeframe as 'hour' | 'day' | 'week'
    );

    // Get cache statistics
    const cacheStats = await redisCacheService.getStats();

    // Get database performance
    const dbMetrics = await optimizedDatabase.getQueryStats();

    // Get rate limiting statistics
    const rateLimitStats = await rateLimitService.getRateLimitStats();

    // Get system metrics from monitoring service
    const systemMetrics = await monitoringService.getMetrics(100);

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      timeframe,
      performance: perfMetrics,
      cache: {
        ...cacheStats,
        applicationMetrics: redisCacheService.getMetrics(),
      },
      database: {
        queryStats: dbMetrics,
        slowQueries: optimizedDatabase.getSlowQueries(),
        connectionStats: perfMetrics.connectionStats,
      },
      rateLimiting: rateLimitStats,
      system: systemMetrics.slice(-1)[0] || null,
      recommendations: generateRecommendations(perfMetrics, cacheStats, dbMetrics),
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get performance metrics', {
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance metrics',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

/**
 * GET /api/performance/health
 * Get detailed health status
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const [dbHealth, cacheHealth, redisHealth] = await Promise.all([
      optimizedDatabase.healthCheck(),
      redisCacheService.healthCheck(),
      redisCacheService.getStats(),
    ]);

    const systemMetrics = await monitoringService.getSystemMetrics();
    const recentAlerts = monitoringService.getAlerts(false).slice(0, 10);

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: {
          status: dbHealth.connected ? 'healthy' : 'unhealthy',
          responseTime: dbHealth.responseTime,
          error: dbHealth.error,
        },
        cache: {
          status: cacheHealth.status,
          responseTime: cacheHealth.responseTime,
          error: cacheHealth.error,
        },
        redis: {
          connected: redisHealth.connectedClients > 0,
          memoryUsage: redisHealth.memoryUsage,
          hitRate: redisHealth.hitRate,
          totalKeys: redisHealth.totalKeys,
        },
      },
      system: {
        memory: systemMetrics.memory,
        cpu: systemMetrics.cpu,
        uptime: systemMetrics.uptime,
      },
      alerts: {
        active: recentAlerts.filter(a => !a.resolved).length,
        critical: recentAlerts.filter(a => !a.resolved && a.severity === 'critical').length,
        recent: recentAlerts,
      },
    };

    // Determine overall health status
    const criticalIssues = [
      !dbHealth.connected,
      cacheHealth.status === 'unhealthy',
      systemMetrics.memory.percentage > 90,
      recentAlerts.some(a => !a.resolved && a.severity === 'critical'),
    ];

    if (criticalIssues.some(Boolean)) {
      health.status = 'unhealthy';
    } else if (
      !dbHealth.connected ||
      cacheHealth.status === 'unhealthy' ||
      systemMetrics.memory.percentage > 80 ||
      recentAlerts.some(a => !a.resolved && a.severity === 'high')
    ) {
      health.status = 'degraded';
    }

    const statusCode = health.status === 'healthy' ? 200 :
                     health.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check failed', {
      error: (error as Error).message,
    });

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

/**
 * POST /api/performance/optimize
 * Trigger performance optimization
 */
router.post('/optimize', async (req: Request, res: Response) => {
  try {
    const { optimizeDatabase = true, warmCache = false, clearCache = false } = req.body;

    const results = {
      database: { optimized: false, error: null },
      cache: { warmed: false, cleared: false, error: null },
    };

    // Optimize database
    if (optimizeDatabase) {
      try {
        await optimizedDatabase.optimizeDatabase();
        await optimizedDatabase.createPerformanceIndexes();
        results.database.optimized = true;
      } catch (error) {
        results.database.error = (error as Error).message;
        logger.warn('Database optimization failed', {
          error: (error as Error).message,
        });
      }
    }

    // Warm cache
    if (warmCache) {
      try {
        // Define cache warming entries
        const warmEntries = [
          {
            key: 'students:active',
            fetcher: async () => {
              // This would fetch active students
              return { count: 0, message: 'Cache warming placeholder' };
            },
            config: { ttl: 300, tags: ['students', 'active'] },
          },
          {
            key: 'equipment:available',
            fetcher: async () => {
              // This would fetch available equipment
              return { count: 0, message: 'Cache warming placeholder' };
            },
            config: { ttl: 600, tags: ['equipment', 'available'] },
          },
        ];

        await redisCacheService.warmCache(warmEntries);
        results.cache.warmed = true;
      } catch (error) {
        results.cache.error = (error as Error).message;
        logger.warn('Cache warming failed', {
          error: (error as Error).message,
        });
      }
    }

    // Clear cache
    if (clearCache) {
      try {
        const cleared = await redisCacheService.clear();
        results.cache.cleared = cleared;
      } catch (error) {
        results.cache.error = (error as Error).message;
        logger.warn('Cache clearing failed', {
          error: (error as Error).message,
        });
      }
    }

    res.json({
      success: true,
      message: 'Performance optimization completed',
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error) {
    logger.error('Performance optimization failed', {
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: 'Performance optimization failed',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

/**
 * GET /api/performance/alerts
 * Get performance alerts
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const { severity, resolved } = req.query;

    let alerts = monitoringService.getAlerts();

    if (severity) {
      alerts = alerts.filter(a => a.severity === severity);
    }

    if (resolved !== undefined) {
      const isResolved = resolved === 'true';
      alerts = alerts.filter(a => a.resolved === isResolved);
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      alerts,
      summary: {
        total: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
        low: alerts.filter(a => a.severity === 'low').length,
        active: alerts.filter(a => !a.resolved).length,
      },
    });
  } catch (error) {
    logger.error('Failed to get alerts', {
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alerts',
    });
  }
});

/**
 * POST /api/performance/alerts/:alertId/resolve
 * Resolve an alert
 */
router.post('/alerts/:alertId/resolve', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const resolved = monitoringService.resolveAlert(alertId);

    if (resolved) {
      res.json({
        success: true,
        message: 'Alert resolved successfully',
        alertId,
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Alert not found or already resolved',
        alertId,
      });
    }
  } catch (error) {
    logger.error('Failed to resolve alert', {
      error: (error as Error).message,
      alertId: req.params.alertId,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert',
    });
  }
});

/**
 * GET /api/performance/report
 * Generate performance report
 */
router.get('/report', async (req: Request, res: Response) => {
  try {
    const { timeframe = 'day', format = 'json' } = req.query;

    const report = await monitoringService.generatePerformanceReport(
      timeframe as 'hour' | 'day' | 'week'
    );

    if (format === 'csv') {
      // Convert to CSV format
      const csv = convertReportToCSV(report);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="performance-report-${Date.now()}.csv"`);
      res.send(csv);
    } else {
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        timeframe,
        report,
      });
    }
  } catch (error) {
    logger.error('Failed to generate performance report', {
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to generate performance report',
    });
  }
});

/**
 * GET /api/performance/database/stats
 * Get detailed database statistics
 */
router.get('/database/stats', async (req: Request, res: Response) => {
  try {
    const [queryStats, slowQueries, connectionStats] = await Promise.all([
      optimizedDatabase.getQueryStats(),
      optimizedDatabase.getSlowQueries(),
      optimizedDatabase.getConnectionPoolStats(),
    ]);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      queries: {
        total: queryStats.reduce((sum, stat) => sum + stat.count, 0),
        averageTime: queryStats.length > 0 ?
          Math.round(queryStats.reduce((sum, stat) => sum + stat.avgTime, 0) / queryStats.length) : 0,
        byQuery: queryStats,
      },
      slowQueries: slowQueries.slice(0, 20), // Top 20 slow queries
      connectionPool: connectionStats,
      recommendations: generateDatabaseRecommendations(queryStats, slowQueries),
    });
  } catch (error) {
    logger.error('Failed to get database stats', {
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve database statistics',
    });
  }
});

/**
 * Helper functions
 */
function generateRecommendations(
  perfMetrics: any,
  cacheStats: any,
  dbStats: any[]
): string[] {
  const recommendations: string[] = [];

  // Performance recommendations
  if (perfMetrics.slowQueries && perfMetrics.slowQueries.length > 0) {
    recommendations.push(`${perfMetrics.slowQueries.length} slow queries detected - consider adding indexes`);
  }

  // Cache recommendations
  if (cacheStats.hitRate < 70) {
    recommendations.push(`Low cache hit rate (${Math.round(cacheStats.hitRate)}%) - implement caching for frequently accessed data`);
  }

  // Database recommendations
  const avgQueryTime = dbStats.length > 0 ?
    dbStats.reduce((sum, stat) => sum + stat.avgTime, 0) / dbStats.length : 0;

  if (avgQueryTime > 100) {
    recommendations.push(`High average query time (${Math.round(avgQueryTime)}ms) - optimize database queries`);
  }

  if (recommendations.length === 0) {
    recommendations.push('System is performing well - no immediate optimizations needed');
  }

  return recommendations;
}

function generateDatabaseRecommendations(
  queryStats: any[],
  slowQueries: any[]
): string[] {
  const recommendations: string[] = [];

  if (slowQueries.length > 0) {
    recommendations.push(`Found ${slowQueries.length} slow queries - review and optimize them`);
  }

  const totalQueries = queryStats.reduce((sum, stat) => sum + stat.count, 0);
  if (totalQueries > 1000) {
    recommendations.push('High query volume - consider implementing query result caching');
  }

  const avgTime = queryStats.length > 0 ?
    queryStats.reduce((sum, stat) => sum + stat.avgTime, 0) / queryStats.length : 0;

  if (avgTime > 50) {
    recommendations.push('Consider database query optimization and indexing');
  }

  return recommendations;
}

function convertReportToCSV(report: any): string {
  // Convert performance report to CSV format
  const headers = [
    'Timestamp',
    'Average Response Time (ms)',
    'Error Rate (%)',
    'Cache Hit Rate (%)',
    'Memory Usage (%)',
    'Active Alerts',
  ];

  const rows = [
    headers.join(','),
    [
      new Date().toISOString(),
      report.metrics.averages.responseTime,
      report.metrics.averages.errorRate,
      report.systemMetrics.cache.hitRate,
      report.systemMetrics.memory.percentage,
      report.alerts.length,
    ].join(','),
  ];

  return rows.join('\n');
}

export default router;