import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';
import { performanceMonitoringService } from './performanceMonitoringService';
import { performanceAlertingService } from './performanceAlertingService';
import { CacheManager } from '@/cache/cacheManager';
import { initializeQueryOptimizationService, queryOptimizationService } from './queryOptimizationService';
import { initializeAdvancedCachingService, advancedCachingService } from './advancedCachingService';
import { initializeMemoryOptimizationService, memoryOptimizationService } from './memoryOptimizationService';

/**
 * Performance Services Initializer
 * 
 * This service initializes all performance-related services in the correct order
 * and sets up the necessary integrations between them.
 */
export class PerformanceServicesInitializer {
  private prisma: PrismaClient;
  private cacheManager: CacheManager;
  private isInitialized: boolean = false;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.cacheManager = new CacheManager({
      redisInstanceName: 'performance',
      redisEnvironment: process.env.NODE_ENV || 'development',
      memoryCacheConfig: {
        maxSize: 5000,
        evictionPolicy: 'LRU' as any,
        defaultTTL: 3600000,
        cleanupInterval: 30000,
        enableMetrics: true,
        persistCriticalData: false
      },
      healthCheckInterval: 30000,
      failoverTimeout: 5000,
      enableDataSync: true,
      syncBatchSize: 100
    });
  }

  /**
   * Initialize all performance services
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Performance services are already initialized');
      return;
    }

    try {
      logger.info('Initializing performance services...');

      // Step 1: Initialize cache manager
      await this.cacheManager.initialize();
      logger.info('Cache manager initialized');

      // Step 2: Initialize query optimization service
      initializeQueryOptimizationService(this.prisma);
      logger.info('Query optimization service initialized');

      // Step 3: Initialize advanced caching service
      initializeAdvancedCachingService(this.cacheManager);
      logger.info('Advanced caching service initialized');

      // Step 4: Initialize memory optimization service
      initializeMemoryOptimizationService({
        enableAutoGC: process.env.NODE_ENV === 'production',
        gcThreshold: 500, // 500MB
        enableLeakDetection: true,
        leakDetectionInterval: 10, // 10 minutes
        enableMemoryMonitoring: true,
        memoryMonitoringInterval: 30, // 30 seconds
        maxMemoryUsage: 1024, // 1GB
        enableMemoryProfiling: process.env.NODE_ENV === 'development'
      });
      logger.info('Memory optimization service initialized');

      // Step 5: Start performance monitoring service
      performanceMonitoringService.start();
      logger.info('Performance monitoring service started');

      // Step 6: Start performance alerting service
      performanceAlertingService.start();
      logger.info('Performance alerting service started');

      // Step 7: Set up service integrations
      this.setupServiceIntegrations();
      logger.info('Service integrations set up');

      // Step 8: Create recommended database indexes
      if (queryOptimizationService) {
        await queryOptimizationService.createRecommendedIndexes();
        logger.info('Recommended database indexes created');
      }

      // Step 9: Configure cache strategies
      this.configureCacheStrategies();
      logger.info('Cache strategies configured');

      // Step 10: Set up performance alert rules
      this.setupPerformanceAlerts();
      logger.info('Performance alerts configured');

      this.isInitialized = true;
      logger.info('All performance services initialized successfully');

      // Emit initialization event
      this.emitInitializationEvent();
    } catch (error) {
      logger.error('Failed to initialize performance services', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Stop all performance services
   */
  async stop(): Promise<void> {
    if (!this.isInitialized) {
      logger.warn('Performance services are not initialized');
      return;
    }

    try {
      logger.info('Stopping performance services...');

      // Stop services in reverse order
      performanceAlertingService.stop();
      logger.info('Performance alerting service stopped');

      performanceMonitoringService.stop();
      logger.info('Performance monitoring service stopped');

      if (memoryOptimizationService) {
        memoryOptimizationService.stop();
        logger.info('Memory optimization service stopped');
      }

      if (this.cacheManager) {
        await this.cacheManager.disconnect();
        logger.info('Cache manager disconnected');
      }

      this.isInitialized = false;
      logger.info('All performance services stopped successfully');
    } catch (error) {
      logger.error('Failed to stop performance services', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Set up integrations between services
   */
  private setupServiceIntegrations(): void {
    // Set up performance monitoring for cache operations
    this.cacheManager.on('get', (key, hit, responseTime) => {
      performanceMonitoringService.recordMetric({
        category: 'cache',
        operation: 'get',
        duration: responseTime,
        success: true,
        metadata: { key, hit }
      });
    });

    this.cacheManager.on('set', (key, responseTime) => {
      performanceMonitoringService.recordMetric({
        category: 'cache',
        operation: 'set',
        duration: responseTime,
        success: true,
        metadata: { key }
      });
    });

    // Set up performance monitoring for memory operations
    if (memoryOptimizationService) {
      memoryOptimizationService.on('highMemoryUsage', (data) => {
        performanceMonitoringService.recordMetric({
          category: 'memory',
          operation: 'highUsage',
          duration: data.current,
          success: false,
          metadata: { threshold: data.threshold }
        });
      });

      memoryOptimizationService.on('memoryLeakDetected', (data) => {
        performanceMonitoringService.recordMetric({
          category: 'memory',
          operation: 'leakDetected',
          duration: data.growthRate,
          success: false,
          metadata: { detected: data.detected }
        });
      });
    }

    // Set up performance alerts for critical metrics
    performanceMonitoringService.on('alert', (alert) => {
      if (alert.severity === 'critical') {
        logger.error('Critical performance alert', {
          category: alert.category,
          message: alert.message,
          value: alert.value,
          threshold: alert.threshold
        });
      }
    });

    logger.debug('Service integrations set up successfully');
  }

  /**
   * Configure cache strategies for different data types
   */
  private configureCacheStrategies(): void {
    if (!advancedCachingService) return;

    // Configure student cache
    advancedCachingService.configureCache('student:*', {
      strategy: 'cache-aside' as any,
      invalidationStrategy: 'tag-based' as any,
      ttl: 1800, // 30 minutes
      refreshThreshold: 0.8,
      enableMetrics: true
    });

    // Configure book cache
    advancedCachingService.configureCache('book:*', {
      strategy: 'cache-aside' as any,
      invalidationStrategy: 'tag-based' as any,
      ttl: 3600, // 1 hour
      refreshThreshold: 0.8,
      enableMetrics: true
    });

    // Configure equipment cache
    advancedCachingService.configureCache('equipment:*', {
      strategy: 'cache-aside' as any,
      invalidationStrategy: 'tag-based' as any,
      ttl: 900, // 15 minutes
      refreshThreshold: 0.8,
      enableMetrics: true
    });

    // Configure analytics cache
    advancedCachingService.configureCache('analytics:*', {
      strategy: 'refresh-ahead' as any,
      invalidationStrategy: 'time-based' as any,
      ttl: 1800, // 30 minutes
      refreshThreshold: 0.7,
      enableMetrics: true
    });

    // Configure search cache
    advancedCachingService.configureCache('search:*', {
      strategy: 'cache-aside' as any,
      invalidationStrategy: 'time-based' as any,
      ttl: 300, // 5 minutes
      enableMetrics: true
    });

    logger.debug('Cache strategies configured successfully');
  }

  /**
   * Set up performance alerts
   */
  private setupPerformanceAlerts(): void {
    // Database performance alerts
    performanceAlertingService.addRule({
      id: 'db-slow-query',
      name: 'Slow Database Query',
      description: 'Alert when database queries are slow',
      category: 'database',
      metric: 'complexQuery',
      condition: 'gt',
      threshold: 500,
      severity: 'medium',
      enabled: true,
      duration: 60,
      cooldown: 300,
      notifications: {
        log: true
      }
    });

    // API performance alerts
    performanceAlertingService.addRule({
      id: 'api-slow-response',
      name: 'Slow API Response',
      description: 'Alert when API responses are slow',
      category: 'api',
      metric: 'studentList',
      condition: 'gt',
      threshold: 200,
      severity: 'medium',
      enabled: true,
      duration: 60,
      cooldown: 300,
      notifications: {
        log: true
      }
    });

    // Memory usage alerts
    performanceAlertingService.addRule({
      id: 'memory-high-usage',
      name: 'High Memory Usage',
      description: 'Alert when memory usage is high',
      category: 'memory',
      metric: 'usage',
      condition: 'gt',
      threshold: 85,
      severity: 'high',
      enabled: true,
      duration: 120,
      cooldown: 600,
      notifications: {
        log: true
      }
    });

    // Cache performance alerts
    performanceAlertingService.addRule({
      id: 'cache-low-hit-rate',
      name: 'Low Cache Hit Rate',
      description: 'Alert when cache hit rate is low',
      category: 'cache',
      metric: 'hitRate',
      condition: 'lt',
      threshold: 80,
      severity: 'medium',
      enabled: true,
      duration: 300,
      cooldown: 600,
      notifications: {
        log: true
      }
    });

    logger.debug('Performance alerts configured successfully');
  }

  /**
   * Emit initialization event
   */
  private emitInitializationEvent(): void {
    // Emit event to notify other parts of the application
    if (typeof process !== 'undefined' && process.emit) {
      process.emit('performance-services:initialized', {
        timestamp: new Date().toISOString(),
        services: {
          monitoring: performanceMonitoringService,
          alerting: performanceAlertingService,
          cacheManager: this.cacheManager,
          queryOptimization: queryOptimizationService,
          advancedCaching: advancedCachingService,
          memoryOptimization: memoryOptimizationService
        }
      });
    }
  }

  /**
   * Get performance services status
   */
  getStatus(): {
    initialized: boolean;
    services: {
      monitoring: boolean;
      alerting: boolean;
      cacheManager: boolean;
      queryOptimization: boolean;
      advancedCaching: boolean;
      memoryOptimization: boolean;
    };
  } {
    return {
      initialized: this.isInitialized,
      services: {
        monitoring: performanceMonitoringService ? true : false,
        alerting: performanceAlertingService ? true : false,
        cacheManager: this.cacheManager ? true : false,
        queryOptimization: queryOptimizationService ? true : false,
        advancedCaching: advancedCachingService ? true : false,
        memoryOptimization: memoryOptimizationService ? true : false
      }
    };
  }

  /**
   * Get performance services instance
   */
  getServices() {
    return {
      monitoring: performanceMonitoringService,
      alerting: performanceAlertingService,
      cacheManager: this.cacheManager,
      queryOptimization: queryOptimizationService,
      advancedCaching: advancedCachingService,
      memoryOptimization: memoryOptimizationService
    };
  }
}

// Singleton instance
export let performanceServicesInitializer: PerformanceServicesInitializer;

export function initializePerformanceServices(prisma: PrismaClient): PerformanceServicesInitializer {
  performanceServicesInitializer = new PerformanceServicesInitializer(prisma);
  return performanceServicesInitializer;
}

// Export individual services for direct access
export {
  performanceMonitoringService,
  performanceAlertingService,
  queryOptimizationService,
  advancedCachingService,
  memoryOptimizationService
};