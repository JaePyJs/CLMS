import { logger } from '../utils/logger';

// Cache item interface with TTL support
interface CacheItem<T = any> {
  value: T;
  expiry: number | null; // null for no expiry
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
}

// Hash item interface for Redis-like hash operations
interface HashItem {
  [field: string]: string;
}

// Eviction policies
export enum EvictionPolicy {
  LRU = 'lru', // Least Recently Used
  LFU = 'lfu', // Least Frequently Used
  FIFO = 'fifo', // First In First Out
  NONE = 'none' // No eviction
}

// Memory cache configuration
export interface MemoryCacheConfig {
  maxSize?: number; // Maximum number of items in cache
  evictionPolicy?: EvictionPolicy;
  defaultTTL?: number; // Default TTL in milliseconds
  cleanupInterval?: number; // Cleanup interval for expired items
  enableMetrics?: boolean; // Enable performance metrics
  persistCriticalData?: boolean; // Enable persistence for critical data
  persistKeyPrefix?: string; // Prefix for keys to persist
}

// Cache metrics
export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  totalOperations: number;
  averageAccessTime: number;
  memoryUsage: number;
  itemCount: number;
  lastCleanupTime: number;
}

/**
 * In-memory cache implementation that mimics Redis API
 * Supports TTL, eviction policies, and performance metrics
 */
export class InMemoryCache {
  private cache: Map<string, CacheItem> = new Map();
  private hashCache: Map<string, HashItem> = new Map();
  private config: Required<MemoryCacheConfig>;
  private metrics: CacheMetrics;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private accessOrder: string[] = []; // For LRU tracking
  private insertionOrder: string[] = []; // For FIFO tracking

  constructor(config: MemoryCacheConfig = {}) {
    this.config = {
      maxSize: config.maxSize || 1000,
      evictionPolicy: config.evictionPolicy || EvictionPolicy.LRU,
      defaultTTL: config.defaultTTL || 3600000, // 1 hour
      cleanupInterval: config.cleanupInterval || 60000, // 1 minute
      enableMetrics: config.enableMetrics !== false,
      persistCriticalData: config.persistCriticalData || false,
      persistKeyPrefix: config.persistKeyPrefix || 'critical:'
    };

    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      totalOperations: 0,
      averageAccessTime: 0,
      memoryUsage: 0,
      itemCount: 0,
      lastCleanupTime: Date.now()
    };

    // Start cleanup timer
    this.startCleanupTimer();

    logger.info('InMemoryCache initialized', {
      maxSize: this.config.maxSize,
      evictionPolicy: this.config.evictionPolicy,
      defaultTTL: this.config.defaultTTL,
      cleanupInterval: this.config.cleanupInterval
    });
  }

  /**
   * Get value from cache
   */
  async get(key: string): Promise<string | null> {
    const startTime = Date.now();
    
    try {
      const item = this.cache.get(key);
      
      if (!item) {
        this.metrics.misses++;
        this.metrics.totalOperations++;
        return null;
      }

      // Check if item has expired
      if (item.expiry && Date.now() > item.expiry) {
        this.cache.delete(key);
        this.removeFromTrackingArrays(key);
        this.metrics.misses++;
        this.metrics.totalOperations++;
        return null;
      }

      // Update access information
      item.lastAccessed = Date.now();
      item.accessCount++;
      this.updateAccessOrder(key);

      this.metrics.hits++;
      this.metrics.totalOperations++;
      this.updateAccessTimeMetrics(Date.now() - startTime);

      logger.debug('Cache hit', { key });
      return typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
    } catch (error) {
      logger.error('Error getting value from cache', { key, error: error instanceof Error ? error.message : String(error) });
      this.metrics.misses++;
      this.metrics.totalOperations++;
      return null;
    }
  }

  /**
   * Set value in cache with optional TTL
   */
  async set(key: string, value: string | any, ttl?: number): Promise<'OK'> {
    const startTime = Date.now();
    
    try {
      const expiry = ttl ? Date.now() + ttl : (this.config.defaultTTL ? Date.now() + this.config.defaultTTL : null);
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

      // Check if we need to evict items
      if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
        this.evictItems();
      }

      const item: CacheItem = {
        value: stringValue,
        expiry,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 1
      };

      this.cache.set(key, item);
      
      // Update tracking arrays
      if (!this.cache.has(key)) {
        this.accessOrder.push(key);
        this.insertionOrder.push(key);
      } else {
        this.updateAccessOrder(key);
      }

      // Persist critical data if enabled
      if (this.config.persistCriticalData && this.isCriticalKey(key)) {
        await this.persistKey(key, stringValue);
      }

      this.metrics.sets++;
      this.metrics.totalOperations++;
      this.updateAccessTimeMetrics(Date.now() - startTime);
      this.updateMemoryUsage();

      logger.debug('Cache set', { key, ttl });
      return 'OK';
    } catch (error) {
      logger.error('Error setting value in cache', { key, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Delete key from cache
   */
  async del(key: string): Promise<number> {
    const startTime = Date.now();
    
    try {
      const existed = this.cache.has(key) || this.hashCache.has(key);
      
      this.cache.delete(key);
      this.hashCache.delete(key);
      this.removeFromTrackingArrays(key);

      this.metrics.deletes++;
      this.metrics.totalOperations++;
      this.updateAccessTimeMetrics(Date.now() - startTime);
      this.updateMemoryUsage();

      logger.debug('Cache delete', { key, existed });
      return existed ? 1 : 0;
    } catch (error) {
      logger.error('Error deleting value from cache', { key, error: error instanceof Error ? error.message : String(error) });
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<number> {
    try {
      const item = this.cache.get(key);
      
      if (!item) {
        return this.hashCache.has(key) ? 1 : 0;
      }

      // Check if item has expired
      if (item.expiry && Date.now() > item.expiry) {
        this.cache.delete(key);
        this.removeFromTrackingArrays(key);
        return 0;
      }

      return 1;
    } catch (error) {
      logger.error('Error checking key existence', { key, error: error instanceof Error ? error.message : String(error) });
      return 0;
    }
  }

  /**
   * Set TTL for existing key
   */
  async expire(key: string, ttl: number): Promise<number> {
    try {
      const item = this.cache.get(key);
      
      if (!item) {
        return 0;
      }

      item.expiry = Date.now() + ttl;
      logger.debug('Cache TTL set', { key, ttl });
      return 1;
    } catch (error) {
      logger.error('Error setting TTL', { key, ttl, error: error instanceof Error ? error.message : String(error) });
      return 0;
    }
  }

  /**
   * Get TTL for key
   */
  async ttl(key: string): Promise<number> {
    try {
      const item = this.cache.get(key);
      
      if (!item) {
        return -2; // Key does not exist
      }

      if (!item.expiry) {
        return -1; // No expiry set
      }

      const remaining = Math.ceil((item.expiry - Date.now()) / 1000);
      return remaining > 0 ? remaining : -2; // Expired
    } catch (error) {
      logger.error('Error getting TTL', { key, error: error instanceof Error ? error.message : String(error) });
      return -2;
    }
  }

  /**
   * Hash operations - get field from hash
   */
  async hget(key: string, field: string): Promise<string | null> {
    try {
      const hash = this.hashCache.get(key);
      return hash && hash[field] ? hash[field] : null;
    } catch (error) {
      logger.error('Error getting hash field', { key, field, error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  /**
   * Hash operations - set field in hash
   */
  async hset(key: string, field: string, value: string): Promise<number> {
    try {
      let hash = this.hashCache.get(key);
      if (!hash) {
        hash = {};
        this.hashCache.set(key, hash);
      }

      const isNew = !hash[field];
      hash[field] = value;

      // Persist critical data if enabled
      if (this.config.persistCriticalData && this.isCriticalKey(key)) {
        await this.persistHash(key, hash);
      }

      logger.debug('Hash field set', { key, field, isNew });
      return isNew ? 1 : 0;
    } catch (error) {
      logger.error('Error setting hash field', { key, field, error: error instanceof Error ? error.message : String(error) });
      return 0;
    }
  }

  /**
   * Hash operations - delete field from hash
   */
  async hdel(key: string, field: string): Promise<number> {
    try {
      const hash = this.hashCache.get(key);
      if (!hash || !hash[field]) {
        return 0;
      }

      delete hash[field];
      
      // Clean up empty hash
      if (Object.keys(hash).length === 0) {
        this.hashCache.delete(key);
      }

      logger.debug('Hash field deleted', { key, field });
      return 1;
    } catch (error) {
      logger.error('Error deleting hash field', { key, field, error: error instanceof Error ? error.message : String(error) });
      return 0;
    }
  }

  /**
   * Hash operations - check if field exists
   */
  async hexists(key: string, field: string): Promise<number> {
    try {
      const hash = this.hashCache.get(key);
      return (hash && hash[field]) ? 1 : 0;
    } catch (error) {
      logger.error('Error checking hash field existence', { key, field, error: error instanceof Error ? error.message : String(error) });
      return 0;
    }
  }

  /**
   * Get multiple values
   */
  async mget(...keys: string[]): Promise<(string | null)[]> {
    const results: (string | null)[] = [];
    
    for (const key of keys) {
      const value = await this.get(key);
      results.push(value);
    }

    return results;
  }

  /**
   * Set multiple values
   */
  async mset(keyValues: [string, string][]): Promise<'OK'> {
    for (const [key, value] of keyValues) {
      await this.set(key, value);
    }
    
    return 'OK';
  }

  /**
   * Increment numeric value
   */
  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const value = current ? parseInt(current, 10) : 0;
    const newValue = value + 1;
    await this.set(key, newValue.toString());
    return newValue;
  }

  /**
   * Increment numeric value by amount
   */
  async incrby(key: string, increment: number): Promise<number> {
    const current = await this.get(key);
    const value = current ? parseInt(current, 10) : 0;
    const newValue = value + increment;
    await this.set(key, newValue.toString());
    return newValue;
  }

  /**
   * Decrement numeric value
   */
  async decr(key: string): Promise<number> {
    const current = await this.get(key);
    const value = current ? parseInt(current, 10) : 0;
    const newValue = value - 1;
    await this.set(key, newValue.toString());
    return newValue;
  }

  /**
   * Decrement numeric value by amount
   */
  async decrby(key: string, decrement: number): Promise<number> {
    const current = await this.get(key);
    const value = current ? parseInt(current, 10) : 0;
    const newValue = value - decrement;
    await this.set(key, newValue.toString());
    return newValue;
  }

  /**
   * Clear all cache data
   */
  async flushall(): Promise<'OK'> {
    this.cache.clear();
    this.hashCache.clear();
    this.accessOrder = [];
    this.insertionOrder = [];
    
    this.updateMemoryUsage();
    logger.info('Cache flushed');
    return 'OK';
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    this.updateMemoryUsage();
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      totalOperations: 0,
      averageAccessTime: 0,
      memoryUsage: 0,
      itemCount: this.cache.size,
      lastCleanupTime: Date.now()
    };
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size + this.hashCache.size;
  }

  /**
   * Get all keys (for debugging)
   */
  keys(): string[] {
    return [...this.cache.keys(), ...this.hashCache.keys()];
  }

  /**
   * Disconnect/cleanup
   */
  async disconnect(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    await this.flushall();
    logger.info('InMemoryCache disconnected');
  }

  // Private methods

  private startCleanupTimer(): void {
    if (this.config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanupExpiredItems();
      }, this.config.cleanupInterval);
    }
  }

  private cleanupExpiredItems(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (item.expiry && now > item.expiry) {
        this.cache.delete(key);
        this.removeFromTrackingArrays(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.metrics.lastCleanupTime = now;
      this.updateMemoryUsage();
      logger.debug('Cleaned up expired items', { count: cleanedCount });
    }
  }

  private evictItems(): void {
    if (this.config.evictionPolicy === EvictionPolicy.NONE) {
      return;
    }

    const itemsToEvict = Math.ceil(this.config.maxSize * 0.1); // Evict 10% of items
    let evictedCount = 0;

    switch (this.config.evictionPolicy) {
      case EvictionPolicy.LRU:
        // Sort by last accessed time
        const sortedByLRU = [...this.cache.entries()]
          .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
        
        for (let i = 0; i < Math.min(itemsToEvict, sortedByLRU.length); i++) {
          const [key] = sortedByLRU[i]!;
          this.cache.delete(key);
          this.removeFromTrackingArrays(key);
          evictedCount++;
        }
        break;

      case EvictionPolicy.LFU:
        // Sort by access count
        const sortedByLFU = [...this.cache.entries()]
          .sort((a, b) => a[1].accessCount - b[1].accessCount);
        
        for (let i = 0; i < Math.min(itemsToEvict, sortedByLFU.length); i++) {
          const [key] = sortedByLFU[i]!;
          this.cache.delete(key);
          this.removeFromTrackingArrays(key);
          evictedCount++;
        }
        break;

      case EvictionPolicy.FIFO:
        // Remove oldest items by insertion time
        const sortedByFIFO = [...this.cache.entries()]
          .sort((a, b) => a[1].createdAt - b[1].createdAt);
        
        for (let i = 0; i < Math.min(itemsToEvict, sortedByFIFO.length); i++) {
          const [key] = sortedByFIFO[i]!;
          this.cache.delete(key);
          this.removeFromTrackingArrays(key);
          evictedCount++;
        }
        break;
    }

    if (evictedCount > 0) {
      this.metrics.evictions += evictedCount;
      this.updateMemoryUsage();
      logger.debug('Evicted items', { count: evictedCount, policy: this.config.evictionPolicy });
    }
  }

  private updateAccessOrder(key: string): void {
    // Remove from current position
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    // Add to end (most recently accessed)
    this.accessOrder.push(key);
  }

  private removeFromTrackingArrays(key: string): void {
    const accessIndex = this.accessOrder.indexOf(key);
    if (accessIndex > -1) {
      this.accessOrder.splice(accessIndex, 1);
    }

    const insertionIndex = this.insertionOrder.indexOf(key);
    if (insertionIndex > -1) {
      this.insertionOrder.splice(insertionIndex, 1);
    }
  }

  private updateAccessTimeMetrics(accessTime: number): void {
    if (!this.config.enableMetrics) return;

    const totalOps = this.metrics.totalOperations;
    const currentAvg = this.metrics.averageAccessTime;
    this.metrics.averageAccessTime = (currentAvg * (totalOps - 1) + accessTime) / totalOps;
  }

  private updateMemoryUsage(): void {
    if (!this.config.enableMetrics) return;

    // Estimate memory usage (rough calculation)
    let memoryUsage = 0;
    
    for (const [key, item] of this.cache.entries()) {
      memoryUsage += key.length * 2; // String key
      memoryUsage += JSON.stringify(item.value).length * 2; // Value
      memoryUsage += 64; // Object overhead
    }

    for (const [key, hash] of this.hashCache.entries()) {
      memoryUsage += key.length * 2;
      for (const [field, value] of Object.entries(hash)) {
        memoryUsage += field.length * 2;
        memoryUsage += value.length * 2;
        memoryUsage += 64; // Object overhead
      }
    }

    this.metrics.memoryUsage = memoryUsage;
    this.metrics.itemCount = this.cache.size + this.hashCache.size;
  }

  private isCriticalKey(key: string): boolean {
    return key.startsWith(this.config.persistKeyPrefix);
  }

  private async persistKey(key: string, value: string): Promise<void> {
    // In a real implementation, this would persist to disk or database
    // For now, we'll just log it
    logger.info('Persisting critical key', { key, valueLength: value.length });
  }

  private async persistHash(key: string, hash: HashItem): Promise<void> {
    // In a real implementation, this would persist to disk or database
    // For now, we'll just log it
    logger.info('Persisting critical hash', { key, fieldCount: Object.keys(hash).length });
  }
}

export default InMemoryCache;