import Redis, { RedisOptions } from 'ioredis';
import { logger, healthLogger } from '../utils/logger';

// Environment types
type Environment = 'development' | 'testing' | 'staging' | 'production';

// Redis configuration interface
interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  connectTimeout?: number;
  commandTimeout?: number;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
  keepAlive?: number;
  family?: 4 | 6;
  tls?: {
    rejectUnauthorized?: boolean;
    cert?: string;
    key?: string;
    ca?: string;
  };
}

// Retry configuration interface
interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitter: boolean;
}

// Circuit breaker configuration
interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

// Health check configuration
interface HealthCheckConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  key: string;
}

// Connection pool configuration
interface ConnectionPoolConfig {
  min: number;
  max: number;
  acquireTimeoutMillis: number;
  createTimeoutMillis: number;
  destroyTimeoutMillis: number;
  idleTimeoutMillis: number;
  reapIntervalMillis: number;
  createRetryIntervalMillis: number;
}

// Full Redis configuration
interface FullRedisConfig {
  redis: RedisConfig;
  retry: RetryConfig;
  circuitBreaker: CircuitBreakerConfig;
  healthCheck: HealthCheckConfig;
  connectionPool: ConnectionPoolConfig;
}

// Circuit breaker state
enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

// Circuit breaker implementation
class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.successCount = 0;
        logger.info('Circuit breaker transitioning to HALF_OPEN');
      } else {
        throw new Error('Circuit breaker is OPEN - operation rejected');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 3) { // Success threshold for half-open state
        this.state = CircuitBreakerState.CLOSED;
        logger.info('Circuit breaker transitioning to CLOSED');
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.OPEN;
      logger.warn('Circuit breaker transitioning to OPEN from HALF_OPEN');
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
      logger.warn('Circuit breaker transitioning to OPEN', {
        failureCount: this.failureCount,
        threshold: this.config.failureThreshold
      });
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }
}

// Redis connection manager with retry logic
class RedisConnectionManager {
  private client: Redis | null = null;
  private circuitBreaker: CircuitBreaker;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private connectionInProgress = false;
  private connectionPromise: Promise<Redis> | null = null;

  constructor(private config: FullRedisConfig) {
    this.circuitBreaker = new CircuitBreaker(config.circuitBreaker);
  }

  async getConnection(): Promise<Redis> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    if (this.client && this.client.status === 'ready') {
      return this.client;
    }

    if (this.connectionInProgress) {
      throw new Error('Connection already in progress');
    }

    this.connectionPromise = this.createConnectionWithRetry();
    return this.connectionPromise;
  }

  private async createConnectionWithRetry(): Promise<Redis> {
    return this.circuitBreaker.execute(async () => {
      return this.createConnection();
    });
  }

  private async createConnection(): Promise<Redis> {
    this.connectionInProgress = true;

    try {
      const redisOptions: RedisOptions = {
        host: this.config.redis.host,
        port: this.config.redis.port,
        ...(this.config.redis.password && { password: this.config.redis.password }),
        db: this.config.redis.db,
        connectTimeout: this.config.redis.connectTimeout || 10000,
        commandTimeout: this.config.redis.commandTimeout || 5000,
        // retryDelayOnFailover is not a valid ioredis option, removed
        maxRetriesPerRequest: this.config.retry.maxRetries,
        lazyConnect: this.config.redis.lazyConnect !== false,
        keepAlive: this.config.redis.keepAlive || 30000,
        family: this.config.redis.family || 4,
        enableReadyCheck: true,
        enableOfflineQueue: false,
        // maxLoadingTimeout is not a valid ioredis option, removed
        // Retry strategy with exponential backoff
        retryStrategy: (times: number) => {
          if (times > this.config.retry.maxRetries) {
            logger.error('Redis max retries exceeded', { times, maxRetries: this.config.retry.maxRetries });
            return null; // Stop retrying
          }

          const delay = Math.min(
            this.config.retry.initialDelay * Math.pow(this.config.retry.backoffFactor, times - 1),
            this.config.retry.maxDelay
          );

          // Add jitter to prevent thundering herd
          const jitter = this.config.retry.jitter ? Math.random() * 0.3 * delay : 0;
          const finalDelay = Math.floor(delay + jitter);

          logger.warn('Redis retry attempt', {
            attempt: times,
            maxRetries: this.config.retry.maxRetries,
            delay: finalDelay,
            host: this.config.redis.host,
            port: this.config.redis.port
          });

          return finalDelay;
        },
        // Reconnect strategy
        reconnectOnError: (error: Error) => {
          const targetErrors = [
            'READONLY',
            'ECONNRESET',
            'ETIMEDOUT',
            'CONNECTION_BROKEN'
          ];
          
          const shouldReconnect = targetErrors.some(targetError => 
            error.message.includes(targetError)
          );

          if (shouldReconnect) {
            logger.warn('Redis reconnecting due to error', { error: error.message });
          }

          return shouldReconnect;
        },
        // TLS configuration for secure environments
        ...(this.config.redis.tls && { tls: this.config.redis.tls })
      };

      this.client = new Redis(redisOptions);

      // Set up event listeners
      this.setupEventListeners();

      // Connect to Redis
      await this.client.connect();

      // Start health checks if enabled
      if (this.config.healthCheck.enabled) {
        this.startHealthChecks();
      }

      logger.info('Redis connection established', {
        host: this.config.redis.host,
        port: this.config.redis.port,
        db: this.config.redis.db
      });

      return this.client;
    } catch (error) {
      logger.error('Failed to create Redis connection', {
        error: error instanceof Error ? error.message : String(error),
        host: this.config.redis.host,
        port: this.config.redis.port,
        db: this.config.redis.db
      });
      throw error;
    } finally {
      this.connectionInProgress = false;
      this.connectionPromise = null;
    }
  }

  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error', { 
        error: error.message,
        stack: error.stack,
        host: this.config.redis.host,
        port: this.config.redis.port
      });
    });

    this.client.on('close', () => {
      logger.warn('Redis client connection closed');
    });

    this.client.on('reconnecting', (ms: number) => {
      logger.info('Redis client reconnecting', { delay: ms });
    });

    this.client.on('end', () => {
      logger.warn('Redis client connection ended');
    });
  }

  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheck.interval);
  }

  private async performHealthCheck(): Promise<void> {
    if (!this.client || this.client.status !== 'ready') {
      healthLogger.check('redis', 'DOWN', undefined, {
        status: this.client?.status || 'no_client',
        host: this.config.redis.host,
        port: this.config.redis.port
      });
      return;
    }

    const startTime = Date.now();
    try {
      await this.client.ping();
      const responseTime = Date.now() - startTime;
      
      healthLogger.check('redis', 'UP', responseTime, {
        host: this.config.redis.host,
        port: this.config.redis.port,
        db: this.config.redis.db
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      healthLogger.check('redis', 'DOWN', responseTime, {
        error: error instanceof Error ? error.message : String(error),
        host: this.config.redis.host,
        port: this.config.redis.port
      });
    }
  }

  async disconnect(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.client) {
      try {
        await this.client.disconnect();
        logger.info('Redis client disconnected');
      } catch (error) {
        logger.error('Error disconnecting Redis client', {
          error: error instanceof Error ? error.message : String(error)
        });
      } finally {
        this.client = null;
      }
    }
  }

  getConnectionStatus(): string {
    return this.client?.status || 'not_connected';
  }

  getCircuitBreakerState(): CircuitBreakerState {
    return this.circuitBreaker.getState();
  }
}

// Redis Configuration Factory
export class RedisConfigurationFactory {
  private static instances: Map<string, RedisConnectionManager> = new Map();

  // Environment-specific configurations
  private static readonly ENVIRONMENT_CONFIGS: Record<Environment, Partial<FullRedisConfig>> = {
    development: {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
        db: parseInt(process.env.REDIS_DB || '0'),
        connectTimeout: 5000,
        commandTimeout: 3000,
        keepAlive: 30000,
        lazyConnect: true
      },
      retry: {
        maxRetries: 5,
        initialDelay: 100,
        maxDelay: 1000,
        backoffFactor: 2,
        jitter: true
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 30000,
        monitoringPeriod: 60000
      },
      healthCheck: {
        enabled: true,
        interval: 30000,
        timeout: 5000,
        key: 'health_check'
      },
      connectionPool: {
        min: 1,
        max: 5,
        acquireTimeoutMillis: 3000,
        createTimeoutMillis: 5000,
        destroyTimeoutMillis: 1000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200
      }
    },
    testing: {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
        db: parseInt(process.env.REDIS_DB || '1'), // Separate DB for testing
        connectTimeout: 3000,
        commandTimeout: 2000,
        keepAlive: 10000,
        lazyConnect: true
      },
      retry: {
        maxRetries: 3,
        initialDelay: 50,
        maxDelay: 500,
        backoffFactor: 2,
        jitter: false
      },
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 10000,
        monitoringPeriod: 30000
      },
      healthCheck: {
        enabled: false, // Disabled for testing
        interval: 60000,
        timeout: 2000,
        key: 'test_health_check'
      },
      connectionPool: {
        min: 1,
        max: 2,
        acquireTimeoutMillis: 2000,
        createTimeoutMillis: 3000,
        destroyTimeoutMillis: 500,
        idleTimeoutMillis: 10000,
        reapIntervalMillis: 500,
        createRetryIntervalMillis: 100
      }
    },
    staging: {
      redis: {
        host: process.env.REDIS_HOST || 'redis-staging',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
        db: parseInt(process.env.REDIS_DB || '0'),
        connectTimeout: 8000,
        commandTimeout: 5000,
        keepAlive: 30000,
        lazyConnect: true
      },
      retry: {
        maxRetries: 8,
        initialDelay: 200,
        maxDelay: 5000,
        backoffFactor: 2,
        jitter: true
      },
      circuitBreaker: {
        failureThreshold: 7,
        resetTimeout: 60000,
        monitoringPeriod: 120000
      },
      healthCheck: {
        enabled: true,
        interval: 45000,
        timeout: 8000,
        key: 'staging_health_check'
      },
      connectionPool: {
        min: 2,
        max: 10,
        acquireTimeoutMillis: 5000,
        createTimeoutMillis: 8000,
        destroyTimeoutMillis: 2000,
        idleTimeoutMillis: 60000,
        reapIntervalMillis: 2000,
        createRetryIntervalMillis: 500
      }
    },
    production: {
      redis: {
        host: process.env.REDIS_HOST || 'redis-production',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
        db: parseInt(process.env.REDIS_DB || '0'),
        connectTimeout: 10000,
        commandTimeout: 8000,
        keepAlive: 60000,
        lazyConnect: true,
        ...(process.env.NODE_ENV === 'production' && {
          tls: {
            rejectUnauthorized: true
          }
        })
      },
      retry: {
        maxRetries: 10,
        initialDelay: 500,
        maxDelay: 10000,
        backoffFactor: 2.5,
        jitter: true
      },
      circuitBreaker: {
        failureThreshold: 10,
        resetTimeout: 120000,
        monitoringPeriod: 300000
      },
      healthCheck: {
        enabled: true,
        interval: 30000,
        timeout: 10000,
        key: 'prod_health_check'
      },
      connectionPool: {
        min: 5,
        max: 20,
        acquireTimeoutMillis: 8000,
        createTimeoutMillis: 12000,
        destroyTimeoutMillis: 3000,
        idleTimeoutMillis: 120000,
        reapIntervalMillis: 5000,
        createRetryIntervalMillis: 1000
      }
    }
  };

  // Get current environment
  private static getCurrentEnvironment(): Environment {
    const env = process.env.NODE_ENV || 'development';
    return ['development', 'testing', 'staging', 'production'].includes(env) 
      ? env as Environment 
      : 'development';
  }

  // Create configuration for specific environment
  private static createConfiguration(environment?: Environment): FullRedisConfig {
    const env = environment || this.getCurrentEnvironment();
    const baseConfig = this.ENVIRONMENT_CONFIGS[env];
    
    if (!baseConfig) {
      throw new Error(`Unsupported environment: ${env}`);
    }

    // Merge with defaults to ensure all required properties are present
    const defaultConfig: FullRedisConfig = {
      redis: {
        host: 'localhost',
        port: 6379,
        db: 0,
        connectTimeout: 10000,
        commandTimeout: 5000,
        keepAlive: 30000,
        lazyConnect: true,
        family: 4
      },
      retry: {
        maxRetries: 5,
        initialDelay: 100,
        maxDelay: 5000,
        backoffFactor: 2,
        jitter: true
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 60000,
        monitoringPeriod: 120000
      },
      healthCheck: {
        enabled: true,
        interval: 30000,
        timeout: 5000,
        key: 'health_check'
      },
      connectionPool: {
        min: 1,
        max: 10,
        acquireTimeoutMillis: 5000,
        createTimeoutMillis: 10000,
        destroyTimeoutMillis: 2000,
        idleTimeoutMillis: 60000,
        reapIntervalMillis: 2000,
        createRetryIntervalMillis: 500
      }
    };

    return {
      redis: { ...defaultConfig.redis, ...baseConfig.redis },
      retry: { ...defaultConfig.retry, ...baseConfig.retry },
      circuitBreaker: { ...defaultConfig.circuitBreaker, ...baseConfig.circuitBreaker },
      healthCheck: { ...defaultConfig.healthCheck, ...baseConfig.healthCheck },
      connectionPool: { ...defaultConfig.connectionPool, ...baseConfig.connectionPool }
    };
  }

  // Get or create Redis connection manager
  public static getConnectionManager(instanceName: string = 'default', environment?: Environment): RedisConnectionManager {
    const key = `${instanceName}_${environment || this.getCurrentEnvironment()}`;
    
    if (!this.instances.has(key)) {
      const config = this.createConfiguration(environment);
      const manager = new RedisConnectionManager(config);
      this.instances.set(key, manager);
      
      logger.info('Created Redis connection manager', {
        instanceName,
        environment: environment || this.getCurrentEnvironment(),
        host: config.redis.host,
        port: config.redis.port,
        db: config.redis.db
      });
    }
    
    return this.instances.get(key)!;
  }

  // Get Redis client (for backward compatibility)
  public static async getRedisClient(instanceName: string = 'default', environment?: Environment): Promise<Redis> {
    const manager = this.getConnectionManager(instanceName, environment);
    return manager.getConnection();
  }

  // Disconnect all instances
  public static async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.instances.values()).map(manager => 
      manager.disconnect().catch(error => 
        logger.error('Error disconnecting Redis manager', { error: error.message })
      )
    );
    
    await Promise.all(disconnectPromises);
    this.instances.clear();
    
    logger.info('All Redis connection managers disconnected');
  }

  // Get connection status for all instances
  public static getConnectionStatuses(): Record<string, { status: string; circuitBreaker: string }> {
    const statuses: Record<string, { status: string; circuitBreaker: string }> = {};
    
    this.instances.forEach((manager, key) => {
      statuses[key] = {
        status: manager.getConnectionStatus(),
        circuitBreaker: manager.getCircuitBreakerState()
      };
    });
    
    return statuses;
  }

  // Health check for all instances
  public static async performHealthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [key, manager] of this.instances) {
      try {
        const client = await manager.getConnection();
        await client.ping();
        results[key] = true;
      } catch (error) {
        results[key] = false;
        logger.error('Health check failed for Redis instance', { 
          key, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
    
    return results;
  }
}

// Export utility functions for backward compatibility
export const getRedisClient = (instanceName: string = 'default'): Promise<Redis> => {
  return RedisConfigurationFactory.getRedisClient(instanceName);
};

export const disconnectRedis = async (instanceName: string = 'default'): Promise<void> => {
  const manager = RedisConfigurationFactory.getConnectionManager(instanceName);
  await manager.disconnect();
};

export const getRedisConnectionStatus = (instanceName: string = 'default'): string => {
  const manager = RedisConfigurationFactory.getConnectionManager(instanceName);
  return manager.getConnectionStatus();
};

export const performRedisHealthCheck = async (): Promise<Record<string, boolean>> => {
  return RedisConfigurationFactory.performHealthCheck();
};

// Export types for external use
export type {
  RedisConfig,
  RetryConfig,
  CircuitBreakerConfig,
  HealthCheckConfig,
  ConnectionPoolConfig,
  FullRedisConfig,
  Environment
};

export { CircuitBreakerState };