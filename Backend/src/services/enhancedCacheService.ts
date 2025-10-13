/**
 * Enhanced Cache Service with Advanced Caching Strategies
 *
 * This service provides multi-layer caching with intelligent invalidation,
 * cache warming, and performance optimization strategies.
 */

import { enhancedRedis } from '@/config/redis';
import { optimizedDatabase } from '@/config/database';
import { logger } from '@/utils/logger';

interface CacheConfig {
  // TTL settings (in seconds)
  defaultTTL: number;
  shortTTL: number;    // 5 minutes
  mediumTTL: number;   // 30 minutes
  longTTL: number;     // 2 hours
  extendedTTL: number; // 24 hours

  // Cache warming settings
  enableWarmup: boolean;
  warmupBatchSize: number;
  warmupDelay: number;

  // Invalidations settings
  enableAutoInvalidation: boolean;
  invalidationDelay: number;
  maxInvalidationBatch: number;

  // Performance settings
  enableCompression: boolean;
  compressionThreshold: number;
  enableBackgroundRefresh: boolean;
  refreshThreshold: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  version: number;
  etag?: string;
  compressed?: boolean;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  invalidations: number;
  warmups: number;
  refreshes: number;
  totalSize: number;
  averageResponseTime: number;
}

class EnhancedCacheService {
  private config: CacheConfig;
  private stats: CacheStats;
  private warmupQueue: Set<string> = new Set();
  private refreshQueue: Map<string, number> = new Map();
  private versionMap: Map<string, number> = new Map();

  constructor() {
    this.config = this.loadConfig();
    this.stats = this.initializeStats();
    this.setupBackgroundTasks();
    this.setupEventListeners();
  }

  private loadConfig(): CacheConfig {
    return {
      defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '3600'), // 1 hour
      shortTTL: parseInt(process.env.CACHE_SHORT_TTL || '300'),      // 5 minutes
      mediumTTL: parseInt(process.env.CACHE_MEDIUM_TTL || '1800'),   // 30 minutes
      longTTL: parseInt(process.env.CACHE_LONG_TTL || '7200'),       // 2 hours
      extendedTTL: parseInt(process.env.CACHE_EXTENDED_TTL || '86400'), // 24 hours

      enableWarmup: process.env.CACHE_ENABLE_WARMUP !== 'false',
      warmupBatchSize: parseInt(process.env.CACHE_WARMUP_BATCH_SIZE || '10'),
      warmupDelay: parseInt(process.env.CACHE_WARMUP_DELAY || '100'),

      enableAutoInvalidation: process.env.CACHE_ENABLE_AUTO_INVALIDATION !== 'false',
      invalidationDelay: parseInt(process.env.CACHE_INVALIDATION_DELAY || '1000'),
      maxInvalidationBatch: parseInt(process.env.CACHE_MAX_INVALIDATION_BATCH || '50'),

      enableCompression: process.env.CACHE_ENABLE_COMPRESSION === 'true',
      compressionThreshold: parseInt(process.env.CACHE_COMPRESSION_THRESHOLD || '1024'),
      enableBackgroundRefresh: process.env.CACHE_ENABLE_BACKGROUND_REFRESH !== 'false',
      refreshThreshold: parseFloat(process.env.CACHE_REFRESH_THRESHOLD || '0.8'), // 80% of TTL
    };
  }

  private initializeStats(): CacheStats {
    return {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      invalidations: 0,
      warmups: 0,
      refreshes: 0,
      totalSize: 0,
      averageResponseTime: 0,
    };
  }

  private setupBackgroundTasks(): void {
    // Process warmup queue
    setInterval(() => {
      this.processWarmupQueue();
    }, this.config.warmupDelay);

    // Process refresh queue
    setInterval(() => {
      this.processRefreshQueue();
    }, 5000); // Every 5 seconds

    // Log cache statistics
    setInterval(() => {
      this.logCacheStats();
    }, 60000); // Every minute
  }

  private setupEventListeners(): void {
    if (this.config.enableAutoInvalidation) {
      enhancedRedis.subscribe('cache:invalidate', (data) => {
        this.handleInvalidationMessage(data);
      });

      enhancedRedis.subscribe('cache:clear', (data) => {
        this.handleClearMessage(data);
      });
    }
  }

  // Core caching methods
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();

    try {
      const cached = await enhancedRedis.get<CacheEntry<T>>(key);

      if (cached) {
        // Check if cache is still valid
        const age = Date.now() - cached.timestamp;
        if (age < cached.ttl * 1000) {
          // Check if background refresh is needed
          if (this.config.enableBackgroundRefresh && age > cached.ttl * 1000 * this.config.refreshThreshold) {
            this.scheduleRefresh(key);
          }

          this.stats.hits++;
          this.updateResponseTime(startTime);
          return cached.data;
        } else {
          // Cache expired, remove it
          await enhancedRedis.del(key);
        }
      }

      this.stats.misses++;
      this.updateResponseTime(startTime);
      return null;
    } catch (error) {
      logger.error('Cache get error', {
        key,
        error: (error as Error).message,
      });
      this.stats.misses++;
      this.updateResponseTime(startTime);
      return null;
    }
  }

  async set<T>(
    key: string,
    data: T,
    options: {
      ttl?: number;
      compress?: boolean;
      version?: number;
      etag?: string;
    } = {}
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const ttl = options.ttl || this.config.defaultTTL;
      const version = options.version || this.getNextVersion(key);

      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
        version,
        etag: options.etag,
        compressed: false,
      };

      // Apply compression if enabled and data is large enough
      if (this.config.enableCompression && this.shouldCompress(data)) {
        entry.compressed = true;
        // Note: In a real implementation, you would compress the data here
      }

      await enhancedRedis.set(key, entry, ttl);
      this.stats.sets++;
      this.updateResponseTime(startTime);

      logger.debug('Cache entry set', {
        key,
        ttl,
        version,
        compressed: entry.compressed,
      });
    } catch (error) {
      logger.error('Cache set error', {
        key,
        error: (error as Error).message,
      });
    }
  }

  async getWithFallback<T>(
    key: string,
    fallback: () => Promise<T>,
    options: {
      ttl?: number;
      compress?: boolean;
      version?: number;
    } = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute fallback function
    const result = await fallback();

    // Cache the result
    await this.set(key, result, options);

    return result;
  }

  async invalidate(pattern: string): Promise<void> {
    try {
      const keys = await enhancedRedis.getClient().keys(pattern);
      if (keys.length > 0) {
        await enhancedRedis.getClient().del(...keys);
        this.stats.invalidations += keys.length;

        logger.info('Cache invalidated', {
          pattern,
          keysDeleted: keys.length,
        });
      }
    } catch (error) {
      logger.error('Cache invalidation error', {
        pattern,
        error: (error as Error).message,
      });
    }
  }

  async invalidateMultiple(patterns: string[]): Promise<void> {
    const startTime = Date.now();

    try {
      for (const pattern of patterns) {
        await this.invalidate(pattern);
      }

      logger.info('Multiple cache patterns invalidated', {
        patterns,
        duration: Date.now() - start_time,
      });
    } catch (error) {
      logger.error('Multiple cache invalidation error', {
        patterns,
        error: (error as Error).message,
      });
    }
  }

  // Advanced caching patterns
  async getMultiple<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();
    const cacheKeys = keys.map(key => `cache:${key}`);

    try {
      const cachedEntries = await enhancedRedis.getMultiple<CacheEntry<T>>(cacheKeys);

      cacheKeys.forEach((cacheKey, index) => {
        const originalKey = keys[index];
        const entry = cachedEntries.get(cacheKey);

        if (entry) {
          const age = Date.now() - entry.timestamp;
          if (age < entry.ttl * 1000) {
            results.set(originalKey, entry.data);
            this.stats.hits++;
          } else {
            results.set(originalKey, null);
            this.stats.misses++;
            // Schedule removal of expired entry
            enhancedRedis.del(cacheKey);
          }
        } else {
          results.set(originalKey, null);
          this.stats.misses++;
        }
      });

      return results;
    } catch (error) {
      logger.error('Cache get multiple error', {
        keys,
        error: (error as Error).message,
      });

      // Return empty results on error
      return new Map(keys.map(key => [key, null]));
    }
  }

  async setMultiple<T>(
    entries: Map<string, T>,
    options: {
      ttl?: number;
      compress?: boolean;
    } = {}
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const ttl = options.ttl || this.config.defaultTTL;
      const cacheEntries = new Map<string, CacheEntry<T>>();

      entries.forEach((data, key) => {
        const version = this.getNextVersion(key);
        const entry: CacheEntry<T> = {
          data,
          timestamp: Date.now(),
          ttl,
          version,
          compressed: false,
        };

        if (this.config.enableCompression && this.shouldCompress(data)) {
          entry.compressed = true;
        }

        cacheEntries.set(`cache:${key}`, entry);
      });

      await enhancedRedis.setMultiple(cacheEntries, ttl);
      this.stats.sets += entries.size;

      logger.debug('Multiple cache entries set', {
        count: entries.size,
        ttl,
        duration: Date.now() - start_time,
      });
    } catch (error) {
      logger.error('Cache set multiple error', {
        entries: entries.size,
        error: (error as Error).message,
      });
    }
  }

  // Cache warming strategies
  async warmupCache(patterns: string[]): Promise<void> {
    if (!this.config.enableWarmup) return;

    try {
      for (const pattern of patterns) {
        this.warmupQueue.add(pattern);
      }

      logger.info('Cache warmup scheduled', {
        patterns,
        queueSize: this.warmupQueue.size,
      });
    } catch (error) {
      logger.error('Cache warmup error', {
        patterns,
        error: (error as Error).message,
      });
    }
  }

  private async processWarmupQueue(): Promise<void> {
    if (this.warmupQueue.size === 0) return;

    const patterns = Array.from(this.warmupQueue).slice(0, this.config.warmupBatchSize);
    this.warmupQueue.clear();

    try {
      for (const pattern of patterns) {
        await this.warmupPattern(pattern);
        this.stats.warmups++;
      }

      logger.debug('Cache warmup processed', {
        patterns,
        remainingQueue: this.warmupQueue.size,
      });
    } catch (error) {
      logger.error('Cache warmup processing error', {
        patterns,
        error: (error as Error).message,
      });
    }
  }

  private async warmupPattern(pattern: string): Promise<void> {
    try {
      // This would be implemented based on specific data patterns
      // For example, warming up frequently accessed student data
      if (pattern.startsWith('students:')) {
        await this.warmupStudentData(pattern);
      } else if (pattern.startsWith('books:')) {
        await this.warmupBookData(pattern);
      }

      // Add delay between warmups to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, this.config.warmupDelay));
    } catch (error) {
      logger.error('Pattern warmup error', {
        pattern,
        error: (error as Error).message,
      });
    }
  }

  private async warmupStudentData(pattern: string): Promise<void> {
    try {
      const prisma = optimizedDatabase.getClient();

      // Get recent student activities
      const recentStudents = await prisma.students.findMany({
        take: 50,
        orderBy: { updated_at: 'desc' },
        select: {
          id: true,
          lrn: true,
          name: true,
          grade: true,
          section: true,
        },
      });

      // Cache each student
      for (const student of recentStudents) {
        const key = `student:${student.id}`;
        await this.set(key, student, { ttl: this.config.mediumTTL });
      }

      logger.debug('Student data warmed up', {
        count: recentStudents.length,
        pattern,
      });
    } catch (error) {
      logger.error('Student data warmup error', {
        pattern,
        error: (error as Error).message,
      });
    }
  }

  private async warmupBookData(pattern: string): Promise<void> {
    try {
      const prisma = optimizedDatabase.getClient();

      // Get recently accessed books
      const recentBooks = await prisma.books.findMany({
        take: 100,
        orderBy: { lastAccessedAt: 'desc' },
        select: {
          id: true,
          accession_no: true,
          title: true,
          author: true,
          status: true,
        },
      });

      // Cache each book
      for (const book of recentBooks) {
        const key = `book:${book.id}`;
        await this.set(key, book, { ttl: this.config.mediumTTL });
      }

      logger.debug('Book data warmed up', {
        count: recentBooks.length,
        pattern,
      });
    } catch (error) {
      logger.error('Book data warmup error', {
        pattern,
        error: (error as Error).message,
      });
    }
  }

  // Background refresh
  private scheduleRefresh(key: string): void {
    this.refreshQueue.set(key, Date.now());
  }

  private async processRefreshQueue(): Promise<void> {
    if (this.refreshQueue.size === 0) return;

    const entries = Array.from(this.refreshQueue.entries());
    this.refreshQueue.clear();

    try {
      for (const [key, scheduledTime] of entries) {
        // Only refresh if enough time has passed
        if (Date.now() - scheduledTime > 5000) {
          await this.refreshCacheEntry(key);
          this.stats.refreshes++;
        }
      }
    } catch (error) {
      logger.error('Cache refresh processing error', {
        entries: entries.length,
        error: (error as Error).message,
      });
    }
  }

  private async refreshCacheEntry(key: string): Promise<void> {
    try {
      // This would fetch fresh data from the database
      // Implementation depends on the specific key pattern
      if (key.startsWith('student:')) {
        const student_id = key.replace('student:', '');
        await this.refreshStudentCache(student_id);
      } else if (key.startsWith('book:')) {
        const book_id = key.replace('book:', '');
        await this.refreshBookCache(book_id);
      }

      logger.debug('Cache entry refreshed', { key });
    } catch (error) {
      logger.error('Cache entry refresh error', {
        key,
        error: (error as Error).message,
      });
    }
  }

  private async refreshStudentCache(student_id: string): Promise<void> {
    try {
      const prisma = optimizedDatabase.getClient();
      const student = await prisma.students.findUnique({
        where: { id: student_id },
        select: {
          id: true,
          lrn: true,
          name: true,
          grade: true,
          section: true,
        },
      });

      if (student) {
        await this.set(`student:${student_id}`, student, { ttl: this.config.mediumTTL });
      }
    } catch (error) {
      logger.error('Student cache refresh error', {
        student_id,
        error: (error as Error).message,
      });
    }
  }

  private async refreshBookCache(book_id: string): Promise<void> {
    try {
      const prisma = optimizedDatabase.getClient();
      const book = await prisma.books.findUnique({
        where: { id: book_id },
        select: {
          id: true,
          accession_no: true,
          title: true,
          author: true,
          status: true,
        },
      });

      if (book) {
        await this.set(`book:${book_id}`, book, { ttl: this.config.mediumTTL });
      }
    } catch (error) {
      logger.error('Book cache refresh error', {
        book_id,
        error: (error as Error).message,
      });
    }
  }

  // Utility methods
  private shouldCompress(data: any): boolean {
    if (!this.config.enableCompression) return false;

    try {
      const serialized = JSON.stringify(data);
      return serialized.length > this.config.compressionThreshold;
    } catch {
      return false;
    }
  }

  private getNextVersion(key: string): number {
    const currentVersion = this.versionMap.get(key) || 0;
    const nextVersion = currentVersion + 1;
    this.versionMap.set(key, nextVersion);
    return nextVersion;
  }

  private updateResponseTime(start_time: number): void {
    const responseTime = Date.now() - startTime;
    const totalOps = this.stats.hits + this.stats.misses + this.stats.sets;

    if (totalOps === 1) {
      this.stats.averageResponseTime = responseTime;
    } else {
      this.stats.averageResponseTime =
        (this.stats.averageResponseTime * (totalOps - 1) + responseTime) / totalOps;
    }
  }

  private handleInvalidationMessage(data: any): Promise<void> {
    return this.invalidate(data.pattern);
  }

  private handleClearMessage(data: any): Promise<void> {
    return enhancedRedis.clearCache(data.scope);
  }

  private logCacheStats(): void {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(2)
      : '0';

    logger.info('Cache statistics', {
      ...this.stats,
      hitRate: `${hitRate}%`,
      queueSizes: {
        warmup: this.warmupQueue.size,
        refresh: this.refreshQueue.size,
      },
    });
  }

  // Public API for monitoring
  getStats(): CacheStats {
    return { ...this.stats };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    stats: CacheStats;
    redis: any;
  }> {
    try {
      const redisHealth = await enhancedRedis.healthCheck();

      return {
        healthy: redisHealth.connected,
        stats: this.getStats(),
        redis: redisHealth,
      };
    } catch (error) {
      return {
        healthy: false,
        stats: this.getStats(),
        redis: { error: (error as Error).message },
      };
    }
  }

  async clearAllCache(): Promise<void> {
    try {
      await enhancedRedis.clearCache('cache:*');
      this.versionMap.clear();
      this.warmupQueue.clear();
      this.refreshQueue.clear();

      logger.info('All cache cleared');
    } catch (error) {
      logger.error('Clear all cache error', {
        error: (error as Error).message,
      });
    }
  }
}

// Create and export singleton instance
export const enhancedCacheService = new EnhancedCacheService();
export default enhancedCacheService;