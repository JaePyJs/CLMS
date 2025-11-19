/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface PerformanceMetrics {
  endpoint: string;
  method: string;
  responseTime: number; // in milliseconds
  statusCode: number;
  timestamp: Date;
  userId?: string;
  queryCount?: number;
  memoryUsage?: NodeJS.MemoryUsage;
}

/**
 * Middleware to monitor API performance
 * Tracks response times, memory usage, and logs slow requests
 */
export function performanceMonitor(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage();

  // Override res.json to capture response time when response is sent
  const originalJson = res.json;
  res.json = function (body: any) {
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();

    // Calculate metrics
    const responseTime = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
    const memoryDelta = {
      rss: endMemory.rss - startMemory.rss,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal,
    };

    const metrics: PerformanceMetrics = {
      endpoint: req.route?.path || req.path,
      method: req.method,
      responseTime,
      statusCode: res.statusCode,
      timestamp: new Date(),
      userId: (req as any).user?.userId,
      memoryUsage: {
        rss: endMemory.rss,
        heapUsed: endMemory.heapUsed,
        heapTotal: endMemory.heapTotal,
        external: endMemory.external,
        arrayBuffers: (endMemory as any).arrayBuffers,
      },
    };

    // Log slow requests (>500ms)
    if (responseTime > 500) {
      logger.warn('Slow API request detected', {
        ...metrics,
        memoryDelta,
      });
    }

    // Log very slow requests (>1000ms)
    if (responseTime > 1000) {
      logger.error('Very slow API request', {
        ...metrics,
        memoryDelta,
        suggestion: 'Consider adding database indexes or implementing caching',
      });
    }

    // Debug log for analytics endpoints
    if (req.path.includes('/analytics/') && responseTime > 100) {
      logger.debug('Analytics endpoint performance', {
        ...metrics,
        cacheStatus: 'check', // Indicates cache might help
      });
    }

    return originalJson.call(this, body);
  };

  next();
}

/**
 * Helper function to track query counts in services
 */
export function withQueryTracking<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  endpoint: string,
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const startTime = process.hrtime.bigint();

    try {
      const result = await fn(...args);

      const endTime = process.hrtime.bigint();
      const responseTime = Number(endTime - startTime) / 1_000_000;

      // Log if query is slow
      if (responseTime > 100) {
        logger.debug('Slow database operation', {
          endpoint,
          responseTime: `${responseTime.toFixed(2)}ms`,
        });
      }

      return result;
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const responseTime = Number(endTime - startTime) / 1_000_000;

      logger.error('Database operation error', {
        endpoint,
        responseTime: `${responseTime.toFixed(2)}ms`,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  };
}

/**
 * Performance summary for monitoring endpoints
 */
export function getPerformanceSummary() {
  const memory = process.memoryUsage();
  const uptime = process.uptime();

  return {
    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
    memory: {
      rss: `${(memory.rss / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      external: `${(memory.external / 1024 / 1024).toFixed(2)} MB`,
    },
    nodeVersion: process.version,
    platform: process.platform,
    cpuUsage: process.cpuUsage(),
  };
}
