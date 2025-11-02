import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from './logger';
import { cacheManager } from './caching';
import { getCurrentTimestamp, generateUUID } from './common';

interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  cached: boolean;
  resultCount?: number;
  error?: string;
}

interface QueryOptimizationConfig {
  enableCache?: boolean;
  cacheTTL?: number;
  enableQueryLogging?: boolean;
  slowQueryThreshold?: number;
  enableQueryMetrics?: boolean;
  maxQueryLogSize?: number;
}

interface BatchQueryOptions {
  batchSize?: number;
  transaction?: boolean;
  skipDuplicates?: boolean;
}

interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

interface SortOptions {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Advanced Database Query Optimizer
 * Provides caching, batch operations, query metrics, and performance optimization
 */
export class DatabaseQueryOptimizer {
  private prisma: PrismaClient;
  private config: Required<QueryOptimizationConfig>;
  private queryMetrics: QueryMetrics[] = [];
  private cacheHitCount = 0;
  private cacheMissCount = 0;

  constructor(prisma: PrismaClient, config: QueryOptimizationConfig = {}) {
    this.prisma = prisma;
    this.config = {
      enableCache: config.enableCache ?? true,
      cacheTTL: config.cacheTTL ?? 300, // 5 minutes
      enableQueryLogging: config.enableQueryLogging ?? process.env.NODE_ENV === 'development',
      slowQueryThreshold: config.slowQueryThreshold ?? 1000, // 1 second
      enableQueryMetrics: config.enableQueryMetrics ?? true,
      maxQueryLogSize: config.maxQueryLogSize ?? 1000,
    };

    this.setupQueryLogging();
  }

  private setupQueryLogging(): void {
    if (!this.config.enableQueryLogging) return;

    // @ts-ignore - Prisma middleware
    this.prisma.$use(async (params, next) => {
      const startTime = Date.now();
      
      try {
        const result = await next(params);
        const duration = Date.now() - startTime;
        
        this.recordQueryMetrics({
          query: `${params.model}.${params.action}`,
          duration,
          timestamp: new Date(),
          cached: false,
          resultCount: Array.isArray(result) ? result.length : (result ? 1 : 0),
        });

        // Log slow queries
        if (duration > this.config.slowQueryThreshold) {
          logger.warn('Slow query detected', {
            model: params.model,
            action: params.action,
            duration: `${duration}ms`,
            args: this.sanitizeQueryArgs(params.args),
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        this.recordQueryMetrics({
          query: `${params.model}.${params.action}`,
          duration,
          timestamp: new Date(),
          cached: false,
          error: (error as Error).message,
        });

        logger.error('Query error', {
          model: params.model,
          action: params.action,
          duration: `${duration}ms`,
          error: (error as Error).message,
        });

        throw error;
      }
    });
  }

  private recordQueryMetrics(metrics: QueryMetrics): void {
    if (!this.config.enableQueryMetrics) return;

    this.queryMetrics.push(metrics);
    
    // Keep only the most recent metrics
    if (this.queryMetrics.length > this.config.maxQueryLogSize) {
      this.queryMetrics.shift();
    }
  }

  private sanitizeQueryArgs(args: any): any {
    if (!args || typeof args !== 'object') return args;
    
    const sanitized = { ...args };
    
    // Remove sensitive data from logs
    if (sanitized.data) {
      if (Array.isArray(sanitized.data)) {
        sanitized.data = sanitized.data.map((item: any) => 
          this.sanitizeSensitiveFields(item)
        );
      } else {
        sanitized.data = this.sanitizeSensitiveFields(sanitized.data);
      }
    }
    
    return sanitized;
  }

  private sanitizeSensitiveFields(obj: any): any {
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    const sanitized = { ...obj };
    
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  /**
   * Execute a query with caching support
   */
  async cachedQuery<T>(
    cacheKey: string,
    query: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    if (!this.config.enableCache) {
      return query();
    }

    const startTime = Date.now();
    
    try {
      const result = await cacheManager.getOrSet(cacheKey, query, {
        ttl: ttl || this.config.cacheTTL,
      });
      
      const duration = Date.now() - startTime;
      const wasCached = duration < 10; // Heuristic: very fast responses are likely cached
      
      if (wasCached) {
        this.cacheHitCount++;
      } else {
        this.cacheMissCount++;
      }

      this.recordQueryMetrics({
        query: cacheKey,
        duration,
        timestamp: new Date(),
        cached: wasCached,
        resultCount: Array.isArray(result) ? result.length : (result ? 1 : 0),
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.recordQueryMetrics({
        query: cacheKey,
        duration,
        timestamp: new Date(),
        cached: false,
        error: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Execute multiple queries in parallel
   */
  async parallelQueries<T = any>(queries: Array<() => Promise<any>>): Promise<any[]> {
    const startTime = Date.now();
    
    try {
      const results = await Promise.all(queries.map(query => query()));
      
      const duration = Date.now() - startTime;
      this.recordQueryMetrics({
        query: `parallel_queries_${queries.length}`,
        duration,
        timestamp: new Date(),
        cached: false,
        resultCount: results.length,
      });

      return results;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.recordQueryMetrics({
        query: `parallel_queries_${queries.length}`,
        duration,
        timestamp: new Date(),
        cached: false,
        error: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Execute batch operations with optional transaction support
   */
  async batchOperation<T>(
    operations: Array<() => Promise<T>>,
    options: BatchQueryOptions = {}
  ): Promise<T[]> {
    const { batchSize = 10, transaction = false, skipDuplicates = true } = options;
    
    if (transaction) {
      // For transactions, we need to execute the operations within a transaction callback
      return this.prisma.$transaction(async (tx) => {
        const results: T[] = [];
        for (const operation of operations) {
          results.push(await operation());
        }
        return results;
      });
    }

    // Process in batches to avoid overwhelming the database
    const results: T[] = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(batch.map(op => op()));
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else if (!skipDuplicates) {
          throw result.reason;
        }
      }
    }

    return results;
  }

  /**
   * Optimized student queries
   */
  async getStudentById(studentId: string): Promise<any> {
    return this.cachedQuery(
      `student:id:${studentId}`,
      async () => {
        return this.prisma.students.findUnique({
          where: { id: studentId },
          include: {
            student_activities: {
              where: { status: 'ACTIVE' },
              take: 1,
              orderBy: { start_time: 'desc' },
            },
          },
        });
      },
      300 // 5 minutes
    );
  }

  async getStudentByBarcode(barcode: string): Promise<any> {
    return this.cachedQuery(
      `student:barcode:${barcode}`,
      async () => {
        return this.prisma.students.findUnique({
          where: { student_id: barcode },
          include: {
            student_activities: {
              where: { status: 'ACTIVE' },
              take: 1,
              orderBy: { start_time: 'desc' },
            },
          },
        });
      },
      300 // 5 minutes
    );
  }

  async getActiveStudents(options: PaginationOptions & SortOptions = {}): Promise<any> {
    const { page = 1, limit = 50, sortBy = 'last_name', sortOrder = 'asc' } = options;
    const skip = (page - 1) * limit;
    
    return this.cachedQuery(
      `students:active:${page}:${limit}:${sortBy}:${sortOrder}`,
      async () => {
        const [students, total] = await this.parallelQueries([
          () => this.prisma.students.findMany({
            where: { is_active: true },
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
              grade_level: true,
              grade_category: true,
              section: true,
              created_at: true,
            },
            orderBy: { [sortBy]: sortOrder },
            skip,
            take: limit,
          }),
          () => this.prisma.students.count({ where: { is_active: true } }),
        ]) as [any[], number];

        return {
          students,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        };
      },
      600 // 10 minutes
    );
  }

  /**
   * Optimized book queries
   */
  async getBookById(bookId: string): Promise<any> {
    return this.cachedQuery(
      `book:id:${bookId}`,
      async () => {
        return this.prisma.books.findUnique({
          where: { id: bookId },
          include: {
            book_checkouts: {
              where: { status: 'ACTIVE' },
              orderBy: { checkout_date: 'desc' },
              take: 1,
            },
          },
        });
      },
      300 // 5 minutes
    );
  }

  async searchBooks(query: string, options: PaginationOptions & SortOptions = {}): Promise<any> {
    const { page = 1, limit = 20, sortBy = 'title', sortOrder = 'asc' } = options;
    const skip = (page - 1) * limit;
    const cacheKey = `books:search:${query}:${page}:${limit}:${sortBy}:${sortOrder}`;
    
    return this.cachedQuery(
      cacheKey,
      async () => {
        const [books, total] = await this.parallelQueries([
          () => this.prisma.books.findMany({
            where: {
              OR: [
                { title: { contains: query } },
                { author: { contains: query } },
                { isbn: { contains: query } },
                { accession_no: { contains: query } },
              ],
            },
            select: {
              id: true,
              title: true,
              author: true,
              isbn: true,
              accession_no: true,
              category: true,
              subcategory: true,
              available_copies: true,
              total_copies: true,
            },
            orderBy: { [sortBy]: sortOrder },
            skip,
            take: limit,
          }),
          () => this.prisma.books.count({
            where: {
              OR: [
                { title: { contains: query } },
                { author: { contains: query } },
                { isbn: { contains: query } },
                { accession_no: { contains: query } },
              ],
            },
          }),
        ]) as [any[], number];

        return {
          books,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        };
      },
      180 // 3 minutes for search results
    );
  }

  /**
   * Optimized equipment queries
   */
  async getEquipmentById(equipmentId: string): Promise<any> {
    return this.cachedQuery(
      `equipment:id:${equipmentId}`,
      async () => {
        return this.prisma.equipment.findUnique({
          where: { id: equipmentId },
          include: {
            equipment_sessions: {
              where: { status: 'ACTIVE' },
              orderBy: { session_start: 'desc' },
              take: 1,
            },
          },
        });
      },
      300 // 5 minutes
    );
  }

  async getAvailableEquipment(options: PaginationOptions & SortOptions = {}): Promise<any> {
    const { page = 1, limit = 50, sortBy = 'name', sortOrder = 'asc' } = options;
    const skip = (page - 1) * limit;
    
    return this.cachedQuery(
      `equipment:available:${page}:${limit}:${sortBy}:${sortOrder}`,
      async () => {
        const [equipment, total] = await this.parallelQueries([
          () => this.prisma.equipment.findMany({
            where: { status: 'AVAILABLE' },
            select: {
              id: true,
              equipment_id: true,
              name: true,
              type: true,
              location: true,
              status: true,
              max_time_minutes: true,
            },
            orderBy: { [sortBy]: sortOrder },
            skip,
            take: limit,
          }),
          () => this.prisma.equipment.count({ where: { status: 'AVAILABLE' } }),
        ]) as [any[], number];

        return {
          equipment,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        };
      },
      300 // 5 minutes
    );
  }

  /**
   * Dashboard statistics with optimized queries
   */
  async getDashboardStats(): Promise<any> {
    return this.cachedQuery(
      'dashboard:stats',
      async () => {
        const [
          totalStudents,
          activeStudents,
          totalBooks,
          availableBooks,
          totalEquipment,
          availableEquipment,
          activeSessions,
          todayActivities,
        ] = await this.parallelQueries([
          () => this.prisma.students.count(),
          () => this.prisma.students.count({ where: { is_active: true } }),
          () => this.prisma.books.count(),
          () => this.prisma.books.count({ where: { available_copies: { gt: 0 } } }),
          () => this.prisma.equipment.count(),
          () => this.prisma.equipment.count({ where: { status: 'AVAILABLE' } }),
          () => this.prisma.equipment_sessions.count({ where: { status: 'ACTIVE' } }),
          () => this.prisma.student_activities.count({
            where: {
              start_time: {
                gte: new Date(new Date().setHours(0, 0, 0, 0)),
              },
            },
          }),
        ]) as [number, number, number, number, number, number, number, number];

        return {
          students: {
            total: totalStudents,
            active: activeStudents,
            inactive: totalStudents - activeStudents,
          },
          books: {
            total: totalBooks,
            available: availableBooks,
            checkedOut: totalBooks - availableBooks,
          },
          equipment: {
            total: totalEquipment,
            available: availableEquipment,
            inUse: totalEquipment - availableEquipment,
          },
          sessions: {
            active: activeSessions,
          },
          activities: {
            today: todayActivities,
          },
        };
      },
      60 // 1 minute for dashboard stats
    );
  }

  /**
   * Cache invalidation helpers
   */
  async invalidateStudentCache(studentId?: string): Promise<void> {
    if (studentId) {
      await cacheManager.invalidateByPattern(`student:id:${studentId}*`);
      await cacheManager.invalidateByPattern(`student:barcode:${studentId}*`);
    }
    await cacheManager.invalidateByPattern('students:*');
    await cacheManager.invalidateByPattern('dashboard:*');
  }

  async invalidateBookCache(bookId?: string): Promise<void> {
    if (bookId) {
      await cacheManager.invalidateByPattern(`book:id:${bookId}*`);
    }
    await cacheManager.invalidateByPattern('books:*');
    await cacheManager.invalidateByPattern('dashboard:*');
  }

  async invalidateEquipmentCache(equipmentId?: string): Promise<void> {
    if (equipmentId) {
      await cacheManager.invalidateByPattern(`equipment:id:${equipmentId}*`);
    }
    await cacheManager.invalidateByPattern('equipment:*');
    await cacheManager.invalidateByPattern('dashboard:*');
  }

  /**
   * Query performance metrics
   */
  getQueryMetrics(): {
    totalQueries: number;
    slowQueries: number;
    cacheHitRate: number;
    averageQueryTime: number;
    recentSlowQueries: QueryMetrics[];
  } {
    const slowQueries = this.queryMetrics.filter(q => q.duration > this.config.slowQueryThreshold);
    const totalQueries = this.queryMetrics.length;
    const cacheRequests = this.cacheHitCount + this.cacheMissCount;
    
    const averageQueryTime = totalQueries > 0
      ? this.queryMetrics.reduce((sum, q) => sum + q.duration, 0) / totalQueries
      : 0;

    return {
      totalQueries,
      slowQueries: slowQueries.length,
      cacheHitRate: cacheRequests > 0 ? Math.round((this.cacheHitCount / cacheRequests) * 100) : 0,
      averageQueryTime: Math.round(averageQueryTime * 100) / 100,
      recentSlowQueries: slowQueries.slice(-10),
    };
  }

  clearQueryMetrics(): void {
    this.queryMetrics = [];
    this.cacheHitCount = 0;
    this.cacheMissCount = 0;
  }

  /**
   * Health check for database performance
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: any;
    recommendations: string[];
  }> {
    const metrics = this.getQueryMetrics();
    const recommendations: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check slow query rate
    const slowQueryRate = metrics.totalQueries > 0 ? (metrics.slowQueries / metrics.totalQueries) * 100 : 0;
    if (slowQueryRate > 10) {
      status = 'unhealthy';
      recommendations.push('High slow query rate detected. Consider optimizing queries or adding indexes.');
    } else if (slowQueryRate > 5) {
      status = 'degraded';
      recommendations.push('Moderate slow query rate. Monitor and consider optimization.');
    }

    // Check cache hit rate
    if (metrics.cacheHitRate < 50 && this.config.enableCache) {
      recommendations.push('Low cache hit rate. Consider adjusting cache TTL or cache keys.');
    }

    // Check average query time
    if (metrics.averageQueryTime > 2000) {
      status = 'unhealthy';
      recommendations.push('High average query time. Database performance needs attention.');
    } else if (metrics.averageQueryTime > 1000) {
      status = 'degraded';
      recommendations.push('Elevated average query time. Monitor performance.');
    }

    return {
      status,
      metrics,
      recommendations,
    };
  }
}

// Singleton instance
let queryOptimizer: DatabaseQueryOptimizer | null = null;

export function getQueryOptimizer(prisma?: PrismaClient): DatabaseQueryOptimizer {
  if (!queryOptimizer) {
    if (!prisma) {
      throw new Error('Prisma client required for first initialization');
    }
    queryOptimizer = new DatabaseQueryOptimizer(prisma);
  }
  return queryOptimizer;
}

export default DatabaseQueryOptimizer;