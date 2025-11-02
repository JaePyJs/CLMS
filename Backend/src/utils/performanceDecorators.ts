import { performanceMonitoringService } from '@/services/performanceMonitoringService';
import { logger } from './logger';

/**
 * Performance monitoring decorator that measures execution time
 * and records metrics for functions and methods.
 */
export function PerformanceMonitor(category: string, operation?: string, metadata?: Record<string, any>) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const opName = operation || `${target.constructor.name}.${propertyName}`;

    descriptor.value = async function (...args: any[]) {
      // Record the metric with duration measurement
      return performanceMonitoringService.recordDuration(
        category as any,
        opName,
        () => method.apply(this, args),
        {
          ...metadata,
          args: args.length,
          className: target.constructor.name,
          methodName: propertyName
        }
      );
    };

    return descriptor;
  };
}

/**
 * Database operation performance decorator
 */
export function DatabaseMonitor(operation?: string) {
  return PerformanceMonitor('database', operation);
}

/**
 * API endpoint performance decorator
 */
export function ApiMonitor(operation?: string) {
  return PerformanceMonitor('api', operation);
}

/**
 * Cache operation performance decorator
 */
export function CacheMonitor(operation?: string) {
  return PerformanceMonitor('cache', operation);
}

/**
 * Import operation performance decorator
 */
export function ImportMonitor(operation?: string) {
  return PerformanceMonitor('import', operation);
}

/**
 * Memory usage monitoring decorator
 */
export function MemoryMonitor(operation?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const opName = operation || `${target.constructor.name}.${propertyName}`;

    descriptor.value = async function (...args: any[]) {
      // Measure memory before operation
      const beforeMemory = process.memoryUsage();
      
      try {
        // Execute the method
        const result = await method.apply(this, args);
        
        // Measure memory after operation
        const afterMemory = process.memoryUsage();
        const memoryIncrease = (afterMemory.heapUsed - beforeMemory.heapUsed) / 1024 / 1024; // MB
        
        // Record memory metric
        performanceMonitoringService.recordMetric({
          category: 'memory',
          operation: opName,
          duration: memoryIncrease,
          success: true,
          metadata: {
            beforeMemory: beforeMemory.heapUsed / 1024 / 1024, // MB
            afterMemory: afterMemory.heapUsed / 1024 / 1024, // MB
            memoryIncrease, // MB
            args: args.length,
            className: target.constructor.name,
            methodName: propertyName
          }
        });
        
        return result;
      } catch (error) {
        // Measure memory after failed operation
        const afterMemory = process.memoryUsage();
        const memoryIncrease = (afterMemory.heapUsed - beforeMemory.heapUsed) / 1024 / 1024; // MB
        
        // Record memory metric
        performanceMonitoringService.recordMetric({
          category: 'memory',
          operation: opName,
          duration: memoryIncrease,
          success: false,
          metadata: {
            beforeMemory: beforeMemory.heapUsed / 1024 / 1024, // MB
            afterMemory: afterMemory.heapUsed / 1024 / 1024, // MB
            memoryIncrease, // MB
            error: (error as Error).message,
            args: args.length,
            className: target.constructor.name,
            methodName: propertyName
          }
        });
        
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Performance monitoring utility functions
 */
export class PerformanceUtils {
  /**
   * Measure execution time of a function
   */
  static async measureTime<T>(
    category: string,
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<{ result: T; duration: number }> {
    const startTime = Date.now();
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      // Record the metric
      performanceMonitoringService.recordMetric({
        category: category as any,
        operation,
        duration,
        success: true,
        ...(metadata && { metadata })
      });
      
      return { result, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record the failed metric
      performanceMonitoringService.recordMetric({
        category: category as any,
        operation,
        duration,
        success: false,
        metadata: {
          ...metadata,
          error: (error as Error).message
        }
      });
      
      throw error;
    }
  }

  /**
   * Measure memory usage of a function
   */
  static async measureMemory<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<{ result: T; memoryIncrease: number }> {
    const beforeMemory = process.memoryUsage();
    
    try {
      const result = await fn();
      const afterMemory = process.memoryUsage();
      const memoryIncrease = (afterMemory.heapUsed - beforeMemory.heapUsed) / 1024 / 1024; // MB
      
      // Record the memory metric
      performanceMonitoringService.recordMetric({
        category: 'memory',
        operation,
        duration: memoryIncrease,
        success: true,
        metadata: {
          ...metadata,
          beforeMemory: beforeMemory.heapUsed / 1024 / 1024, // MB
          afterMemory: afterMemory.heapUsed / 1024 / 1024, // MB
          memoryIncrease // MB
        }
      });
      
      return { result, memoryIncrease };
    } catch (error) {
      const afterMemory = process.memoryUsage();
      const memoryIncrease = (afterMemory.heapUsed - beforeMemory.heapUsed) / 1024 / 1024; // MB
      
      // Record the failed memory metric
      performanceMonitoringService.recordMetric({
        category: 'memory',
        operation,
        duration: memoryIncrease,
        success: false,
        metadata: {
          ...metadata,
          error: (error as Error).message,
          beforeMemory: beforeMemory.heapUsed / 1024 / 1024, // MB
          afterMemory: afterMemory.heapUsed / 1024 / 1024, // MB
          memoryIncrease // MB
        }
      });
      
      throw error;
    }
  }

  /**
   * Create a performance monitoring middleware for Express
   */
  static createPerformanceMiddleware() {
    return (req: any, res: any, next: any) => {
      const startTime = Date.now();
      const originalSend = res.send;
      
      res.send = function (data: any) {
        const duration = Date.now() - startTime;
        const route = req.route ? req.route.path : req.path;
        const method = req.method;
        
        // Record API performance metric
        performanceMonitoringService.recordMetric({
          category: 'api',
          operation: `${method} ${route}`,
          duration,
          success: res.statusCode < 400,
          metadata: {
            method,
            route,
            statusCode: res.statusCode,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            responseSize: data ? Buffer.byteLength(JSON.stringify(data)) : 0
          }
        });
        
        return originalSend.call(this, data);
      };
      
      next();
    };
  }

  /**
   * Wrap a repository method with performance monitoring
   */
  static wrapRepositoryMethod<T extends any[], R>(
    repo: any,
    methodName: string,
    originalMethod: (...args: T) => Promise<R>
  ) {
    repo[methodName] = async function (...args: T): Promise<R> {
      return performanceMonitoringService.recordDuration(
        'database',
        `${repo.constructor.name}.${methodName}`,
        () => originalMethod.apply(this, args),
        {
          repository: repo.constructor.name,
          method: methodName,
          args: args.length
        }
      );
    };
  }

  /**
   * Wrap a cache method with performance monitoring
   */
  static wrapCacheMethod<T extends any[], R>(
    cache: any,
    methodName: string,
    originalMethod: (...args: T) => Promise<R>
  ) {
    cache[methodName] = async function (...args: T): Promise<R> {
      return performanceMonitoringService.recordDuration(
        'cache',
        `cache.${methodName}`,
        () => originalMethod.apply(this, args),
        {
          method: methodName,
          args: args.length
        }
      );
    };
  }

  /**
   * Monitor async function execution
   */
  static monitorAsync<T>(
    category: string,
    operation: string,
    fn: (...args: any[]) => Promise<T>,
    metadata?: Record<string, any>
  ) {
    return async function (...args: any[]): Promise<T> {
      return performanceMonitoringService.recordDuration(
        category as any,
        operation,
        () => fn(...args),
        {
          ...metadata,
          args: args.length
        }
      );
    };
  }

  /**
   * Monitor sync function execution
   */
  static monitorSync<T>(
    category: string,
    operation: string,
    fn: (...args: any[]) => T,
    metadata?: Record<string, any>
  ) {
    return function (...args: any[]): T {
      const startTime = Date.now();
      let success = true;
      let result: T;
      let error: Error | null = null;

      try {
        result = fn(...args);
      } catch (e) {
        success = false;
        error = e as Error;
        throw e;
      } finally {
        const duration = Date.now() - startTime;
        
        // Record the metric
        performanceMonitoringService.recordMetric({
          category: category as any,
          operation,
          duration,
          success,
          metadata: {
            ...metadata,
            error: error ? error.message : undefined,
            args: args.length
          }
        });
      }

      return result as T;
    };
  }

  /**
   * Create a performance monitoring context
   */
  static createContext(category: string, defaultMetadata?: Record<string, any>) {
    return {
      measure: <T>(operation: string, fn: () => Promise<T>, metadata?: Record<string, any>) => {
        return performanceMonitoringService.recordDuration(
          category as any,
          operation,
          fn,
          { ...defaultMetadata, ...metadata }
        );
      },
      
      record: (operation: string, duration: number, success: boolean, metadata?: Record<string, any>) => {
        performanceMonitoringService.recordMetric({
          category: category as any,
          operation,
          duration,
          success,
          metadata: { ...defaultMetadata, ...metadata }
        });
      }
    };
  }
}

/**
 * Performance monitoring hook for React components (if needed in the future)
 */
export function usePerformanceMonitor(category: string) {
  return {
    measure: async <T>(operation: string, fn: () => Promise<T>, metadata?: Record<string, any>) => {
      return PerformanceUtils.measureTime(category, operation, fn, metadata);
    },
    
    record: (operation: string, duration: number, success: boolean, metadata?: Record<string, any>) => {
      performanceMonitoringService.recordMetric({
        category: category as any,
        operation,
        duration,
        success,
        ...(metadata && { metadata })
      });
    }
  };
}

// Export default for convenience
export default {
  PerformanceMonitor,
  DatabaseMonitor,
  ApiMonitor,
  CacheMonitor,
  ImportMonitor,
  MemoryMonitor,
  PerformanceUtils,
  usePerformanceMonitor
};