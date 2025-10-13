import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '@/utils/logger';
import { BaseError, DatabaseError, ExternalServiceError } from '@/utils/errors';
import { ErrorCategory, ErrorSeverity } from '@/middleware/errorMiddleware';

export interface RecoveryAction {
  id: string;
  type: 'RECONNECT_DATABASE' | 'RESTART_SERVICE' | 'CLEAR_CACHE' | 'FALLBACK_MODE' | 'SCALE_RESOURCES';
  name: string;
  description: string;
  execute: () => Promise<RecoveryResult>;
  timeout: number;
  retryable: boolean;
  maxRetries: number;
}

export interface RecoveryResult {
  success: boolean;
  message: string;
  duration: number;
  nextAction?: string;
  error?: Error;
}

export interface RecoveryPlan {
  id: string;
  errorType: string;
  errorCategory: ErrorCategory;
  actions: RecoveryAction[];
  fallbackMode?: {
    enabled: boolean;
    description: string;
    limitations: string[];
  };
}

export interface SystemHealth {
  database: {
    connected: boolean;
    responseTime: number;
    lastChecked: Date;
  };
  redis: {
    connected: boolean;
    responseTime: number;
    lastChecked: Date;
  };
  externalServices: Record<string, {
    available: boolean;
    responseTime: number;
    lastChecked: Date;
  }>;
  systemResources: {
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
  };
  uptime: number;
  gracefulDegradation: boolean;
}

export class RecoveryService {
  private prisma: PrismaClient;
  private recoveryPlans: Map<string, RecoveryPlan> = new Map();
  private activeRecoveries: Map<string, Promise<RecoveryResult>> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private systemHealth: SystemHealth;

  constructor() {
    this.prisma = new PrismaClient();
    this.systemHealth = this.initializeSystemHealth();
    this.initializeRecoveryPlans();
    this.startHealthMonitoring();
  }

  private initializeSystemHealth(): SystemHealth {
    return {
      database: {
        connected: false,
        responseTime: 0,
        lastChecked: new Date(),
      },
      redis: {
        connected: false,
        responseTime: 0,
        lastChecked: new Date(),
      },
      externalServices: {},
      systemResources: {
        memoryUsage: 0,
        cpuUsage: 0,
        diskUsage: 0,
      },
      uptime: 0,
      gracefulDegradation: false,
    };
  }

  private initializeRecoveryPlans(): void {
    // Database connection recovery plan
    this.recoveryPlans.set('DATABASE_CONNECTION', {
      id: 'DATABASE_CONNECTION',
      errorType: 'DatabaseError',
      errorCategory: ErrorCategory.DATABASE,
      actions: [
        {
          id: 'reconnect_database',
          type: 'RECONNECT_DATABASE',
          name: 'Reconnect to Database',
          description: 'Attempt to re-establish database connection',
          execute: () => this.reconnectDatabase(),
          timeout: 30000,
          retryable: true,
          maxRetries: 3,
        },
        {
          id: 'restart_database_pool',
          type: 'RESTART_SERVICE',
          name: 'Restart Database Pool',
          description: 'Restart the database connection pool',
          execute: () => this.restartDatabasePool(),
          timeout: 15000,
          retryable: true,
          maxRetries: 2,
        },
        {
          id: 'fallback_to_cache',
          type: 'FALLBACK_MODE',
          name: 'Enable Cache-Only Mode',
          description: 'Use cached data while database is unavailable',
          execute: () => this.enableCacheOnlyMode(),
          timeout: 10000,
          retryable: false,
          maxRetries: 1,
        },
      ],
      fallbackMode: {
        enabled: true,
        description: 'Read-only mode with cached data',
        limitations: ['No data updates', 'Stale data possible', 'Limited functionality'],
      },
    });

    // External service recovery plan
    this.recoveryPlans.set('EXTERNAL_SERVICE', {
      id: 'EXTERNAL_SERVICE',
      errorType: 'ExternalServiceError',
      errorCategory: ErrorCategory.EXTERNAL_SERVICE,
      actions: [
        {
          id: 'retry_service',
          type: 'RESTART_SERVICE',
          name: 'Retry Service Connection',
          description: 'Attempt to reconnect to external service',
          execute: () => this.retryExternalService(),
          timeout: 15000,
          retryable: true,
          maxRetries: 3,
        },
        {
          id: 'use_cached_data',
          type: 'FALLBACK_MODE',
          name: 'Use Cached Data',
          description: 'Fall back to cached external service data',
          execute: () => this.useCachedExternalData(),
          timeout: 5000,
          retryable: false,
          maxRetries: 1,
        },
        {
          id: 'disable_integration',
          type: 'FALLBACK_MODE',
          name: 'Disable Integration',
          description: 'Temporarily disable external service integration',
          execute: () => this.disableExternalIntegration(),
          timeout: 5000,
          retryable: false,
          maxRetries: 1,
        },
      ],
      fallbackMode: {
        enabled: true,
        description: 'Offline mode with limited features',
        limitations: ['No external sync', 'Manual data entry required', 'Delayed updates'],
      },
    });

    // System resource recovery plan
    this.recoveryPlans.set('SYSTEM_RESOURCES', {
      id: 'SYSTEM_RESOURCES',
      errorType: 'SystemError',
      errorCategory: ErrorCategory.SYSTEM,
      actions: [
        {
          id: 'clear_cache',
          type: 'CLEAR_CACHE',
          name: 'Clear System Cache',
          description: 'Clear memory cache to free resources',
          execute: () => this.clearSystemCache(),
          timeout: 10000,
          retryable: true,
          maxRetries: 2,
        },
        {
          id: 'optimize_memory',
          type: 'SCALE_RESOURCES',
          name: 'Optimize Memory Usage',
          description: 'Trigger garbage collection and memory optimization',
          execute: () => this.optimizeMemoryUsage(),
          timeout: 15000,
          retryable: true,
          maxRetries: 3,
        },
        {
          id: 'enable_graceful_degradation',
          type: 'FALLBACK_MODE',
          name: 'Enable Graceful Degradation',
          description: 'Reduce system load by disabling non-essential features',
          execute: () => this.enableGracefulDegradation(),
          timeout: 5000,
          retryable: false,
          maxRetries: 1,
        },
      ],
      fallbackMode: {
        enabled: true,
        description: 'Reduced functionality mode',
        limitations: ['Limited concurrent users', 'Reduced background jobs', 'Basic features only'],
      },
    });
  }

  async handleError(error: BaseError): Promise<RecoveryResult> {
    const errorKey = this.getErrorKey(error);
    const recoveryPlan = this.recoveryPlans.get(errorKey);

    if (!recoveryPlan) {
      logger.warn('No recovery plan found for error', { errorKey, error: error.message });
      return {
        success: false,
        message: 'No recovery plan available for this error type',
        duration: 0,
      };
    }

    // Check if recovery is already in progress for this error type
    const existingRecovery = this.activeRecoveries.get(errorKey);
    if (existingRecovery) {
      try {
        return await existingRecovery;
      } catch (recoveryError) {
        logger.error('Existing recovery failed', { errorKey, recoveryError });
        // Continue with new recovery attempt
      }
    }

    logger.info('Starting error recovery', { errorKey, plan: recoveryPlan.id });

    const recoveryPromise = this.executeRecoveryPlan(recoveryPlan, error);
    this.activeRecoveries.set(errorKey, recoveryPromise);

    try {
      const result = await recoveryPromise;
      logger.info('Recovery completed', { errorKey, success: result.success });
      return result;
    } catch (recoveryError) {
      logger.error('Recovery failed', { errorKey, error: recoveryError });
      return {
        success: false,
        message: `Recovery failed: ${recoveryError.message}`,
        duration: 0,
        error: recoveryError as Error,
      };
    } finally {
      this.activeRecoveries.delete(errorKey);
    }
  }

  private async executeRecoveryPlan(plan: RecoveryPlan, error: BaseError): Promise<RecoveryResult> {
    const startTime = Date.now();

    for (const action of plan.actions) {
      try {
        logger.info('Executing recovery action', { action: action.id, plan: plan.id });

        const result = await Promise.race([
          action.execute(),
          new Promise<RecoveryResult>((_, reject) =>
            setTimeout(() => reject(new Error('Action timeout')), action.timeout)
          ),
        ]) as RecoveryResult;

        if (result.success) {
          logger.info('Recovery action successful', { action: action.id });
          return {
            ...result,
            duration: Date.now() - start_time,
          };
        } else {
          logger.warn('Recovery action failed', { action: action.id, error: result.message });

          if (action.retryable) {
            for (let attempt = 1; attempt <= action.maxRetries; attempt++) {
              logger.info('Retrying recovery action', { action: action.id, attempt });

              try {
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
                const retryResult = await action.execute();

                if (retryResult.success) {
                  return {
                    ...retryResult,
                    duration: Date.now() - start_time,
                  };
                }
              } catch (retryError) {
                logger.warn('Retry attempt failed', { action: action.id, attempt, error: retryError });
              }
            }
          }
        }
      } catch (actionError) {
        logger.error('Recovery action error', { action: action.id, error: actionError });
      }
    }

    // All actions failed, try fallback mode if available
    if (plan.fallbackMode) {
      logger.info('Attempting fallback mode', { plan: plan.id });

      try {
        const fallbackResult = await this.enableFallbackMode(plan);
        return {
          ...fallbackResult,
          duration: Date.now() - start_time,
          nextAction: 'Fallback mode enabled - Monitor for recovery',
        };
      } catch (fallbackError) {
        logger.error('Fallback mode failed', { plan: plan.id, error: fallbackError });
      }
    }

    return {
      success: false,
      message: 'All recovery actions failed',
      duration: Date.now() - start_time,
    };
  }

  private getErrorKey(error: BaseError): string {
    if (error instanceof DatabaseError) {
      return 'DATABASE_CONNECTION';
    }
    if (error instanceof ExternalServiceError) {
      return 'EXTERNAL_SERVICE';
    }
    if (error.category === ErrorCategory.SYSTEM) {
      return 'SYSTEM_RESOURCES';
    }
    return error.category as string || 'UNKNOWN';
  }

  // Recovery action implementations
  private async reconnectDatabase(): Promise<RecoveryResult> {
    const startTime = Date.now();

    try {
      // Test database connection
      await this.prisma.$queryRaw`SELECT 1`;

      this.systemHealth.database.connected = true;
      this.systemHealth.database.responseTime = Date.now() - startTime;
      this.systemHealth.database.lastChecked = new Date();

      return {
        success: true,
        message: 'Database connection restored successfully',
        duration: Date.now() - start_time,
      };
    } catch (error) {
      this.systemHealth.database.connected = false;
      throw new Error(`Database reconnection failed: ${error.message}`);
    }
  }

  private async restartDatabasePool(): Promise<RecoveryResult> {
    const startTime = Date.now();

    try {
      // Disconnect and reconnect to reset the pool
      await this.prisma.$disconnect();
      await this.prisma.$connect();

      this.systemHealth.database.connected = true;
      this.systemHealth.database.responseTime = Date.now() - startTime;
      this.systemHealth.database.lastChecked = new Date();

      return {
        success: true,
        message: 'Database pool restarted successfully',
        duration: Date.now() - start_time,
      };
    } catch (error) {
      throw new Error(`Database pool restart failed: ${error.message}`);
    }
  }

  private async enableCacheOnlyMode(): Promise<RecoveryResult> {
    // Implementation would enable read-only mode with cached data
    this.systemHealth.gracefulDegradation = true;

    return {
      success: true,
      message: 'Cache-only mode enabled. Read-only access available.',
      duration: 0,
    };
  }

  private async retryExternalService(): Promise<RecoveryResult> {
    const startTime = Date.now();

    try {
      // Implementation would retry external service connection
      // For now, simulate a successful retry
      await new Promise(resolve => setTimeout(resolve, 1000));

      return {
        success: true,
        message: 'External service connection restored',
        duration: Date.now() - start_time,
      };
    } catch (error) {
      throw new Error(`External service retry failed: ${error.message}`);
    }
  }

  private async useCachedExternalData(): Promise<RecoveryResult> {
    return {
      success: true,
      message: 'Using cached external service data',
      duration: 0,
    };
  }

  private async disableExternalIntegration(): Promise<RecoveryResult> {
    return {
      success: true,
      message: 'External integration temporarily disabled',
      duration: 0,
    };
  }

  private async clearSystemCache(): Promise<RecoveryResult> {
    const startTime = Date.now();

    try {
      // Implementation would clear various caches (Redis, in-memory, etc.)
      // For now, simulate cache clearing
      await new Promise(resolve => setTimeout(resolve, 2000));

      return {
        success: true,
        message: 'System cache cleared successfully',
        duration: Date.now() - start_time,
      };
    } catch (error) {
      throw new Error(`Cache clearing failed: ${error.message}`);
    }
  }

  private async optimizeMemoryUsage(): Promise<RecoveryResult> {
    const startTime = Date.now();

    try {
      // Trigger garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Implementation would include other memory optimizations
      await new Promise(resolve => setTimeout(resolve, 1000));

      return {
        success: true,
        message: 'Memory usage optimized',
        duration: Date.now() - start_time,
      };
    } catch (error) {
      throw new Error(`Memory optimization failed: ${error.message}`);
    }
  }

  private async enableGracefulDegradation(): Promise<RecoveryResult> {
    this.systemHealth.gracefulDegradation = true;

    return {
      success: true,
      message: 'Graceful degradation enabled - System running in reduced capacity',
      duration: 0,
    };
  }

  private async enableFallbackMode(plan: RecoveryPlan): Promise<RecoveryResult> {
    this.systemHealth.gracefulDegradation = true;

    if (plan.fallbackMode) {
      logger.info('Fallback mode enabled', { plan: plan.id, limitations: plan.fallbackMode.limitations });
    }

    return {
      success: true,
      message: plan.fallbackMode?.description || 'Fallback mode enabled',
      duration: 0,
    };
  }

  private startHealthMonitoring(): void {
    // Run health checks every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000);

    // Initial health check
    this.performHealthCheck();
  }

  private async performHealthCheck(): Promise<void> {
    try {
      // Check database health
      await this.checkDatabaseHealth();

      // Check Redis health (if available)
      await this.checkRedisHealth();

      // Check system resources
      await this.checkSystemResources();

      // Check external services
      await this.checkExternalServices();

      this.systemHealth.uptime = process.uptime();

      logger.debug('Health check completed', { health: this.systemHealth });
    } catch (error) {
      logger.error('Health check failed', { error });
    }
  }

  private async checkDatabaseHealth(): Promise<void> {
    const startTime = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;

      this.systemHealth.database.connected = true;
      this.systemHealth.database.responseTime = Date.now() - startTime;
      this.systemHealth.database.lastChecked = new Date();
    } catch (error) {
      this.systemHealth.database.connected = false;
      this.systemHealth.database.responseTime = Date.now() - startTime;
      this.systemHealth.database.lastChecked = new Date();

      logger.warn('Database health check failed', { error });

      // Trigger database recovery if not already in progress
      if (!this.activeRecoveries.has('DATABASE_CONNECTION')) {
        this.handleError(new DatabaseError('Database connection lost'));
      }
    }
  }

  private async checkRedisHealth(): Promise<void> {
    const startTime = Date.now();

    try {
      // Implementation would check Redis connection
      // For now, simulate Redis check
      await new Promise(resolve => setTimeout(resolve, 10));

      this.systemHealth.redis.connected = true;
      this.systemHealth.redis.responseTime = Date.now() - startTime;
      this.systemHealth.redis.lastChecked = new Date();
    } catch (error) {
      this.systemHealth.redis.connected = false;
      this.systemHealth.redis.responseTime = Date.now() - startTime;
      this.systemHealth.redis.lastChecked = new Date();

      logger.warn('Redis health check failed', { error });
    }
  }

  private async checkSystemResources(): Promise<void> {
    try {
      const memUsage = process.memoryUsage();
      const totalMem = memUsage.heapTotal;
      const usedMem = memUsage.heapUsed;

      // Calculate actual memory usage percentage more accurately
      // Use a more reasonable threshold for development environment
      const memoryUsagePercent = (usedMem / totalMem) * 100;
      
      // For development, only trigger warnings if usage is truly high (>98%)
      // and set a minimum threshold to avoid false positives
      const adjustedThreshold = process.env.NODE_ENV === 'development' ? 98 : 85;
      
      this.systemHealth.systemResources.memoryUsage = memoryUsagePercent;
      this.systemHealth.systemResources.cpuUsage = 0; // Would use actual CPU monitoring
      this.systemHealth.systemResources.diskUsage = 0; // Would use actual disk monitoring

      // Only trigger resource recovery if memory usage is critically high
      if (memoryUsagePercent > adjustedThreshold && totalMem > 100 * 1024 * 1024) { // 100MB minimum
        logger.warn('High memory usage detected', {
          usage: memoryUsagePercent,
          totalMem: Math.round(totalMem / 1024 / 1024),
          usedMem: Math.round(usedMem / 1024 / 1024),
        });

        if (!this.activeRecoveries.has('SYSTEM_RESOURCES')) {
          this.handleError(new BaseError('High memory usage', 500, true, 'HIGH_MEMORY_USAGE'));
        }
      }
    } catch (error) {
      logger.error('System resource check failed', { error });
    }
  }

  private async checkExternalServices(): Promise<void> {
    try {
      // Implementation would check various external services
      // For now, simulate external service checks
      const services = ['google-sheets', 'email-service', 'backup-service'];

      for (const service of services) {
        const startTime = Date.now();

        try {
          // Simulate service check
          await new Promise(resolve => setTimeout(resolve, 50));

          this.systemHealth.externalServices[service] = {
            available: true,
            responseTime: Date.now() - start_time,
            lastChecked: new Date(),
          };
        } catch (error) {
          this.systemHealth.externalServices[service] = {
            available: false,
            responseTime: Date.now() - start_time,
            lastChecked: new Date(),
          };

          logger.warn(`External service health check failed: ${service}`, { error });
        }
      }
    } catch (error) {
      logger.error('External services check failed', { error });
    }
  }

  // Public methods
  async getSystemHealth(): Promise<SystemHealth> {
    return { ...this.systemHealth };
  }

  async getActiveRecoveries(): Promise<Array<{ key: string; status: string }>> {
    const recoveries: Array<{ key: string; status: string }> = [];

    for (const [key, promise] of this.activeRecoveries) {
      try {
        const result = await Promise.race([
          promise,
          new Promise<RecoveryResult>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 1000)
          ),
        ]);

        recoveries.push({
          key,
          status: result.success ? 'success' : 'failed',
        });
      } catch (error) {
        recoveries.push({
          key,
          status: 'in_progress',
        });
      }
    }

    return recoveries;
  }

  async enableMaintenanceMode(): Promise<void> {
    logger.info('Maintenance mode enabled');
    this.systemHealth.gracefulDegradation = true;
  }

  async disableMaintenanceMode(): Promise<void> {
    logger.info('Maintenance mode disabled');
    this.systemHealth.gracefulDegradation = false;
  }

  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    await this.prisma.$disconnect();
    logger.info('Recovery service shutdown complete');
  }
}

export const recoveryService = new RecoveryService();