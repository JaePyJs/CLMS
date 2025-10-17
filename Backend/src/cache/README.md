# Cache Fallback System

This directory contains the implementation of a comprehensive cache fallback system that automatically switches between Redis and in-memory cache when Redis becomes unavailable.

## Overview

The cache fallback system consists of three main components:

1. **InMemoryCache** (`memoryCache.ts`) - A Redis-like in-memory cache implementation
2. **CacheManager** (`cacheManager.ts`) - Manages switching between Redis and in-memory cache
3. **Integration Layer** - Updated `redis.ts` utilities to use the new cache manager

## Features

### InMemoryCache Features

- **Redis-like API**: Implements all common Redis operations (get, set, del, exists, etc.)
- **TTL Support**: Full time-to-live support with automatic expiration
- **Eviction Policies**: LRU, LFU, FIFO, and NONE eviction strategies
- **Memory Management**: Configurable size limits and automatic cleanup
- **Performance Metrics**: Comprehensive metrics tracking (hits, misses, memory usage)
- **Hash Operations**: Support for Redis-like hash operations (hget, hset, hdel, etc.)
- **Batch Operations**: Support for mget and mset operations
- **Increment/Decrement**: Numeric operations (incr, incrby, decr, decrby)
- **Critical Data Persistence**: Optional persistence for critical cache data

### CacheManager Features

- **Automatic Failover**: Seamless switching between Redis and in-memory cache
- **Health Monitoring**: Continuous Redis health checks with configurable intervals
- **Data Synchronization**: Automatic sync of critical data when Redis recovers
- **Recovery Logic**: Intelligent Redis recovery with backoff strategies
- **Transparent API**: Single interface that works regardless of underlying provider
- **Configuration Flexibility**: Extensive configuration options for different environments
- **Logging & Monitoring**: Comprehensive logging of failover events and performance metrics

## Usage

### Basic Usage

```typescript
import { CacheManager } from './cache/cacheManager';

// Create and initialize cache manager
const cacheManager = new CacheManager({
  redisInstanceName: 'default',
  healthCheckInterval: 30000,
  enableDataSync: true,
  criticalKeys: ['session:123', 'config:app']
});

await cacheManager.initialize();

// Use cache operations - they work regardless of provider
await cacheManager.set('key', 'value', 60000);
const value = await cacheManager.get('key');

// Check current provider
console.log('Current provider:', cacheManager.getCurrentProvider());

// Get health status
const health = cacheManager.getHealthStatus();
console.log('Health status:', health);
```

### Using with Existing Redis Utilities

```typescript
import { getCacheManager, cacheOperation } from './utils/redis';

// Get the cache manager
const manager = await getCacheManager();

// Use enhanced cache operations
await cacheOperation(async (cache) => {
  await cache.set('key', 'value');
  return await cache.get('key');
});
```

### Configuration Options

```typescript
const config = {
  // Redis configuration
  redisInstanceName: 'default',
  redisEnvironment: 'production',
  
  // Memory cache configuration
  memoryCacheConfig: {
    maxSize: 2000,              // Maximum number of items
    evictionPolicy: 'lru',      // LRU, LFU, FIFO, or NONE
    defaultTTL: 3600000,        // 1 hour in milliseconds
    cleanupInterval: 60000,     // 1 minute cleanup interval
    enableMetrics: true,        // Enable performance metrics
    persistCriticalData: true,  // Persist critical data
    persistKeyPrefix: 'critical:' // Prefix for critical keys
  },
  
  // Health monitoring
  healthCheckInterval: 30000,   // 30 seconds
  failoverTimeout: 5000,        // 5 seconds
  
  // Data synchronization
  enableDataSync: true,         // Enable sync on recovery
  syncBatchSize: 100,          // Batch size for sync operations
  syncRetryAttempts: 3,        // Retry attempts for sync
  
  // Critical keys to always sync
  criticalKeys: ['session:*', 'auth:*', 'config:*']
};
```

## API Reference

### CacheManager Methods

#### Basic Operations
- `get(key: string): Promise<string | null>`
- `set(key: string, value: string | any, ttl?: number): Promise<'OK'>`
- `del(key: string): Promise<number>`
- `exists(key: string): Promise<number>`
- `expire(key: string, ttl: number): Promise<number>`
- `ttl(key: string): Promise<number>`

#### Hash Operations
- `hget(key: string, field: string): Promise<string | null>`
- `hset(key: string, field: string, value: string): Promise<number>`
- `hdel(key: string, field: string): Promise<number>`
- `hexists(key: string, field: string): Promise<number>`

#### Batch Operations
- `mget(...keys: string[]): Promise<(string | null)[]>`
- `mset(keyValues: [string, string][]): Promise<'OK'>`

#### Numeric Operations
- `incr(key: string): Promise<number>`
- `incrby(key: string, increment: number): Promise<number>`
- `decr(key: string): Promise<number>`
- `decrby(key: string, decrement: number): Promise<number>`

#### Management Operations
- `flushall(): Promise<'OK'>`
- `getCurrentProvider(): CacheProvider`
- `getHealthStatus(): HealthStatus`
- `getMemoryCacheMetrics(): CacheMetrics`
- `getSyncStats(): SyncStats`
- `switchToRedis(): Promise<boolean>`
- `switchToMemoryCache(): void`
- `disconnect(): Promise<void>`

### InMemoryCache Methods

The InMemoryCache implements the same basic operations as CacheManager but operates entirely in memory.

## Eviction Policies

### LRU (Least Recently Used)
- Evicts items that haven't been accessed for the longest time
- Good for general-purpose caching with access patterns

### LFU (Least Frequently Used)
- Evicts items with the lowest access count
- Good for caching with stable access patterns

### FIFO (First In First Out)
- Evicts items in the order they were added
- Simple and predictable, good for time-based data

### NONE
- No automatic eviction
- Cache grows until manually cleared or process restarts

## Monitoring and Metrics

### Cache Metrics
```typescript
const metrics = cacheManager.getMemoryCacheMetrics();
console.log(metrics);
// {
//   hits: 1500,
//   misses: 300,
//   sets: 800,
//   deletes: 50,
//   evictions: 20,
//   totalOperations: 2650,
//   averageAccessTime: 0.5,
//   memoryUsage: 2048576,
//   itemCount: 750,
//   lastCleanupTime: 1640995200000
// }
```

### Health Status
```typescript
const health = cacheManager.getHealthStatus();
console.log(health);
// {
//   provider: 'redis',
//   isHealthy: true,
//   lastCheck: 1640995200000,
//   consecutiveFailures: 0,
//   responseTime: 15
// }
```

## Failover Behavior

### Automatic Failover
1. **Detection**: Health checks detect Redis unavailability
2. **Switching**: Automatically switches to in-memory cache
3. **Logging**: Comprehensive logging of failover events
4. **Continuity**: Application continues functioning without interruption

### Recovery Process
1. **Monitoring**: Continues monitoring Redis health
2. **Detection**: Detects Redis recovery
3. **Synchronization**: Syncs critical data back to Redis
4. **Switching**: Switches back to Redis provider

### Data Synchronization
- Only critical data is synchronized to avoid performance issues
- Configurable batch sizes for efficient sync
- Retry logic for failed sync operations
- Preserves TTL information during sync

## Testing

Run the test suite:

```bash
npm test -- Backend/src/cache/__tests__/cacheManager.test.ts
```

Run the demonstration script:

```bash
npx ts-node Backend/src/examples/cacheFallbackDemo.ts
```

## Best Practices

1. **Critical Keys**: Identify and configure critical keys that should always be synced
2. **TTL Configuration**: Set appropriate TTL values to balance performance and data freshness
3. **Memory Limits**: Configure appropriate memory limits based on available resources
4. **Eviction Policy**: Choose eviction policy based on your access patterns
5. **Monitoring**: Regularly monitor cache metrics and health status
6. **Logging**: Enable comprehensive logging for troubleshooting failover events

## Migration Guide

### From Direct Redis Usage

**Before:**
```typescript
import { getRedisClient } from './utils/redis';

const redis = await getRedisClient();
await redis.set('key', 'value');
const value = await redis.get('key');
```

**After:**
```typescript
import { getCacheManager } from './utils/redis';

const cache = await getCacheManager();
await cache.set('key', 'value');
const value = await cache.get('key');
```

### From Basic Cache

The new system is backward compatible. Existing code using the `redis.ts` utilities will automatically benefit from the fallback functionality.

## Performance Considerations

- **Memory Usage**: In-memory cache uses process memory, monitor usage carefully
- **Sync Overhead**: Data synchronization can impact performance during recovery
- **Health Checks**: Frequent health checks add minimal overhead
- **Eviction**: Choose appropriate eviction policies to balance memory and performance

## Troubleshooting

### Common Issues

1. **High Memory Usage**: Reduce cache size or adjust eviction policy
2. **Frequent Failovers**: Check Redis configuration and network connectivity
3. **Sync Failures**: Verify critical key configurations and Redis permissions
4. **Performance Issues**: Monitor metrics and adjust TTL and batch sizes

### Debug Logging

Enable debug logging to troubleshoot issues:

```typescript
import { logger } from './utils/logger';
logger.level = 'debug';
```

## Future Enhancements

- Distributed in-memory cache for multi-instance deployments
- Persistent storage backend for critical data
- Advanced cache warming strategies
- More sophisticated eviction algorithms
- Cache partitioning and sharding support