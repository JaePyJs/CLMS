import {
  Prisma,
  PrismaClient,
  student_activities_activity_type,
  student_activities_status,
  students,
} from '@prisma/client';
import Redis from 'ioredis';
import { logger } from '@/utils/logger';
import { performance } from 'perf_hooks';

type Timeframe = 'day' | 'week' | 'month';

interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  rowCount?: number;
  indexUsage?: string;
}

interface CacheConfig {
  ttl: number;
  key: string;
  tags?: string[];
}

interface SlowQueryThreshold {
  warning: number; // ms
  critical: number; // ms
}

interface HourlyActivity {
  hour: number;
  count: number;
}

type CountAggregate = { id: number };

type DurationAggregate = { duration_minutes: number | null };

type EquipmentUsageGroup = {
  equipment_id: string | null;
  activity_type: student_activities_activity_type;
  _count: CountAggregate;
  _avg: DurationAggregate;
  _sum: DurationAggregate;
};

type ActivityBreakdown = {
  activity_type: student_activities_activity_type;
  _count: CountAggregate;
};

type CacheInfoSection = Record<string, number | string>;

interface CacheOverview {
  memory: CacheInfoSection;
  keyspace: CacheInfoSection;
  stats: CacheInfoSection;
}

type CacheStatistics = CacheOverview | null;

interface ConnectionStats {
  activeConnections: string | number;
  maxConnections: string;
  recommendation: string;
}

type StudentWithRecentActivity = Prisma.studentsGetPayload<{
  include: {
    student_activities: {
      select: {
        id: true;
        activity_type: true;
        start_time: true;
        end_time: true;
        status: true;
      };
    };
  };
}>;

type StudentBatchOperation =
  | { type: 'create'; data: Prisma.studentsCreateManyInput }
  | {
      type: 'update';
      data: { id: string; data: Prisma.studentsUpdateInput };
    }
  | { type: 'delete'; data: { id: string } };

type BatchOperationResult = Array<Prisma.BatchPayload | students>;

interface UsageAnalytics {
  timeframe: Timeframe;
  period: { start: Date; end: Date };
  metrics: {
    totalActivities: number;
    uniqueStudents: number;
    equipmentUsage: EquipmentUsageGroup[];
    peakHours: HourlyActivity[];
    activityBreakdown: ActivityBreakdown[];
  };
  generatedAt: Date;
}

interface EquipmentUsageStats {
  equipmentId?: string;
  timeframe: Timeframe;
  period: { start: Date; end: Date };
  usage: EquipmentUsageGroup[];
  summary: { totalSessions: number; averageDuration: number };
  generatedAt: Date;
}

export class PerformanceOptimizationService {
  private prisma: PrismaClient<Prisma.PrismaClientOptions, 'query'>;
  private redis: Redis;
  private queryMetrics: QueryMetrics[] = [];
  private slowQueryThresholds: SlowQueryThreshold = {
    warning: 1000, // 1 second
    critical: 5000, // 5 seconds
  };

  constructor() {
    this.prisma = new PrismaClient({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
      errorFormat: 'minimal',
    });

    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.setupQueryLogging();
    this.setupConnectionPooling();
  }

  /**
   * Setup enhanced connection pooling for optimal performance
   */
  private setupConnectionPooling(): void {
    // Configure Prisma connection pool for MySQL
    const connectionLimit = parseInt(process.env.DB_CONNECTION_LIMIT || '20');
    const connectionTimeout = parseInt(
      process.env.DB_CONNECTION_TIMEOUT || '10000',
    );

    // This would typically be configured in the DATABASE_URL
    // But we'll document the optimal settings here
    logger.info('Database connection pool configured', {
      connectionLimit,
      connectionTimeout,
      recommendation:
        'Add ?connection_limit=20&pool_timeout=10000 to DATABASE_URL',
    });
  }

  /**
   * Setup query logging and performance monitoring
   */
  private setupQueryLogging(): void {
    this.prisma.$on('query', (e: Prisma.QueryEvent) => {
      const duration = e.duration;
      const query = e.query;

      // Log slow queries
      if (duration > this.slowQueryThresholds.warning) {
        logger.warn('Slow query detected', {
          query: `${query.substring(0, 200)}...`,
          duration: `${duration}ms`,
          params: e.params,
          target: e.target ?? 'unknown',
        });

        // Store metrics for analysis
        const metric: QueryMetrics = {
          query,
          duration,
          timestamp: new Date(),
        };

        const rowCount = this.extractRowCount(e);
        if (rowCount !== undefined) {
          metric.rowCount = rowCount;
        }

        this.queryMetrics.push(metric);

        // Critical performance alert
        if (duration > this.slowQueryThresholds.critical) {
          logger.error('Critical slow query', {
            query: `${query.substring(0, 200)}...`,
            duration: `${duration}ms`,
            recommendation: 'This query needs immediate optimization',
          });
        }
      }
    });
  }

  /**
   * Execute database query with performance monitoring and caching
   */
  async executeQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>,
    cacheConfig?: CacheConfig,
  ): Promise<T> {
    const startTime = performance.now();

    try {
      // Check cache first
      if (cacheConfig) {
        const cached = await this.getFromCache<T>(cacheConfig.key);
        if (cached !== null) {
          logger.debug('Cache hit', { queryName, key: cacheConfig.key });
          return cached;
        }
      }

      // Execute query
      const result = await queryFn();
      const duration = performance.now() - startTime;

      // Cache result if configured
      if (cacheConfig && result !== null) {
        await this.setCache(
          cacheConfig.key,
          result,
          cacheConfig.ttl,
          cacheConfig.tags,
        );
      }

      // Log performance
      logger.debug('Query executed', {
        queryName,
        duration: `${Math.round(duration)}ms`,
        cached: false,
      });

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error('Query failed', {
        queryName,
        duration: `${Math.round(duration)}ms`,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Optimized student lookup with caching
   */
  async getStudentByBarcode(
    barcode: string,
  ): Promise<StudentWithRecentActivity | null> {
    return this.executeQuery(
      'student_by_barcode',
      async () => {
        return await this.prisma.students.findUnique({
          where: { student_id: barcode },
          include: {
            student_activities: {
              where: { status: student_activities_status.ACTIVE },
              orderBy: { start_time: 'desc' },
              take: 1,
            },
          },
        });
      },
      {
        key: `student:barcode:${barcode}`,
        ttl: 300, // 5 minutes
        tags: ['student', 'barcode'],
      },
    );
  }

  /**
   * Optimized analytics with aggressive caching
   */
  async getUsageAnalytics(timeframe: Timeframe): Promise<UsageAnalytics> {
    return this.executeQuery(
      `usage_analytics_${timeframe}`,
      async () => {
        const endDate = new Date();
        const startDate = this.getStartDate(timeframe);

        // Parallel execution of analytics queries
        const [
          totalActivities,
          uniqueStudents,
          equipmentUsage,
          peakHours,
          activityBreakdown,
        ] = await Promise.all([
          this.getTotalActivities(startDate, endDate),
          this.getUniqueStudents(startDate, endDate),
          this.getEquipmentUsage(startDate, endDate),
          this.getPeakHours(startDate, endDate),
          this.getActivityBreakdown(startDate, endDate),
        ]);

        return {
          timeframe,
          period: { start: startDate, end: endDate },
          metrics: {
            totalActivities,
            uniqueStudents,
            equipmentUsage,
            peakHours,
            activityBreakdown,
          },
          generatedAt: new Date(),
        };
      },
      {
        key: `analytics:usage:${timeframe}`,
        ttl: this.getAnalyticsTTL(timeframe),
        tags: ['analytics', 'usage', timeframe],
      },
    );
  }

  /**
   * Batch student operations for improved performance
   */
  async batchStudentOperations(
    operations: StudentBatchOperation[],
  ): Promise<BatchOperationResult> {
    const startTime = performance.now();

    try {
      // Group operations by type for efficient batching
      const createOps = operations.filter(
        (op): op is Extract<StudentBatchOperation, { type: 'create' }> =>
          op.type === 'create',
      );
      const updateOps = operations.filter(
        (op): op is Extract<StudentBatchOperation, { type: 'update' }> =>
          op.type === 'update',
      );
      const deleteOps = operations.filter(
        (op): op is Extract<StudentBatchOperation, { type: 'delete' }> =>
          op.type === 'delete',
      );

      const creates = createOps.map(op => op.data);
      const updates = updateOps.map(op => op.data);
      const deletes = deleteOps.map(op => op.data);

      const tasks: Array<Promise<Prisma.BatchPayload | students>> = [
        creates.length > 0
          ? this.prisma.students.createMany({
              data: creates,
              skipDuplicates: true,
            })
          : Promise.resolve<Prisma.BatchPayload>({ count: 0 }),
        ...updates.map(update =>
          this.prisma.students.update({
            where: { id: update.id },
            data: update.data,
          }),
        ),
        deletes.length > 0
          ? this.prisma.students.deleteMany({
              where: { id: { in: deletes.map(d => d.id) } },
            })
          : Promise.resolve<Prisma.BatchPayload>({ count: 0 }),
      ];

      const results = await Promise.all(tasks);

      // Invalidate relevant caches
      await this.invalidateCacheByTags(['student']);

      const duration = performance.now() - startTime;
      logger.info('Batch student operations completed', {
        totalOperations: operations.length,
        creates: creates.length,
        updates: updates.length,
        deletes: deletes.length,
        duration: `${Math.round(duration)}ms`,
      });

      return results;
    } catch (error) {
      logger.error('Batch student operations failed', {
        totalOperations: operations.length,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Optimized equipment usage statistics
   */
  async getEquipmentUsageStats(
    equipmentId?: string,
    timeframe: Timeframe = 'week',
  ): Promise<EquipmentUsageStats> {
    return this.executeQuery(
      `equipment_usage_stats_${equipmentId || 'all'}_${timeframe}`,
      async () => {
        const endDate = new Date();
        const startDate = this.getStartDate(timeframe);

        const where = equipmentId
          ? {
              equipment_id: equipmentId,
              start_time: { gte: startDate, lte: endDate },
            }
          : { start_time: { gte: startDate, lte: endDate } };

        // Use aggregation for better performance
        const [usageStats, totalSessions, averageDuration] = await Promise.all([
          this.prisma.student_activities.groupBy({
            by: ['equipment_id', 'activity_type'],
            where,
            _count: { id: true },
            _avg: { duration_minutes: true },
            _sum: { duration_minutes: true },
          }),
          this.prisma.student_activities.count({ where }),
          this.prisma.student_activities.aggregate({
            where,
            _avg: { duration_minutes: true },
          }),
        ]);

        const response: EquipmentUsageStats = {
          timeframe,
          period: { start: startDate, end: endDate },
          usage: usageStats as EquipmentUsageGroup[],
          summary: {
            totalSessions,
            averageDuration: averageDuration._avg.duration_minutes || 0,
          },
          generatedAt: new Date(),
        };

        if (equipmentId) {
          response.equipmentId = equipmentId;
        }

        return response;
      },
      {
        key: `equipment:stats:${equipmentId || 'all'}:${timeframe}`,
        ttl: this.getAnalyticsTTL(timeframe),
        tags: ['equipment', 'stats', timeframe],
      },
    );
  }

  /**
   * Get database performance metrics
   */
  async getPerformanceMetrics(): Promise<{
    slowQueries: QueryMetrics[];
    cacheStats: CacheStatistics;
    connectionStats: ConnectionStats;
    recommendations: string[];
  }> {
    const recentMetrics = this.queryMetrics.filter(
      m => m.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    );

    const slowQueries = recentMetrics
      .filter(m => m.duration > this.slowQueryThresholds.warning)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10); // Top 10 slow queries

    const recommendations =
      this.generateOptimizationRecommendations(slowQueries);

    return {
      slowQueries,
      cacheStats: await this.getCacheStats(),
      connectionStats: await this.getConnectionStats(),
      recommendations,
    };
  }

  /**
   * Cache management helpers
   */
  private async getFromCache<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.warn('Cache get failed', { key, error: (error as Error).message });
      return null;
    }
  }

  private async setCache<T>(
    key: string,
    value: T,
    ttl: number,
    tags?: string[],
  ): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));

      // Add tags for cache invalidation
      if (tags) {
        for (const tag of tags) {
          await this.redis.sadd(`cache:tags:${tag}`, key);
          await this.redis.expire(`cache:tags:${tag}`, ttl);
        }
      }
    } catch (error) {
      logger.warn('Cache set failed', { key, error: (error as Error).message });
    }
  }

  private async invalidateCacheByTags(tags: string[]): Promise<void> {
    try {
      for (const tag of tags) {
        const keys = await this.redis.smembers(`cache:tags:${tag}`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
          await this.redis.del(`cache:tags:${tag}`);
        }
      }
    } catch (error) {
      logger.warn('Cache invalidation failed', {
        tags,
        error: (error as Error).message,
      });
    }
  }

  private async getCacheStats(): Promise<CacheStatistics> {
    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      const stats = await this.redis.info('stats');

      return {
        memory: this.parseRedisInfo(info),
        keyspace: this.parseRedisInfo(keyspace),
        stats: this.parseRedisInfo(stats),
      };
    } catch (error) {
      logger.warn('Failed to get cache stats', {
        error: (error as Error).message,
      });
      return null;
    }
  }

  private async getConnectionStats(): Promise<ConnectionStats> {
    // This would typically query the database for connection stats
    // For now, return basic info
    return {
      activeConnections: 'unknown', // Would need to query DB
      maxConnections: process.env.DB_CONNECTION_LIMIT || '20',
      recommendation: 'Monitor connection pool via database metrics',
    };
  }

  /**
   * Helper methods
   */
  private extractRowCount(_event: Prisma.QueryEvent): number | undefined {
    // Extract row count from Prisma query event if available
    return undefined;
  }

  private getStartDate(timeframe: Timeframe): Date {
    const now = new Date();
    switch (timeframe) {
      case 'day':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      default:
        return now;
    }
  }

  private getAnalyticsTTL(timeframe: Timeframe): number {
    switch (timeframe) {
      case 'day':
        return 300; // 5 minutes
      case 'week':
        return 1800; // 30 minutes
      case 'month':
        return 3600; // 1 hour
      default:
        return 300;
    }
  }

  private async getTotalActivities(
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    return this.prisma.student_activities.count({
      where: { start_time: { gte: startDate, lte: endDate } },
    });
  }

  private async getUniqueStudents(
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const result = await this.prisma.student_activities.groupBy({
      by: ['student_id'],
      where: { start_time: { gte: startDate, lte: endDate } },
    });
    return result.length;
  }

  private async getEquipmentUsage(
    startDate: Date,
    endDate: Date,
  ): Promise<EquipmentUsageGroup[]> {
    const result = await this.prisma.student_activities.groupBy({
      by: ['equipment_id', 'activity_type'],
      where: {
        start_time: { gte: startDate, lte: endDate },
        equipment_id: { not: null },
      },
      _count: { id: true },
      _avg: { duration_minutes: true },
      _sum: { duration_minutes: true },
    });

    return result as EquipmentUsageGroup[];
  }

  private async getPeakHours(
    startDate: Date,
    endDate: Date,
  ): Promise<HourlyActivity[]> {
    return this.prisma.$queryRaw<HourlyActivity[]>`
      SELECT EXTRACT(HOUR FROM start_time) as hour, COUNT(*) as count
      FROM student_activities
      WHERE start_time >= ${startDate} AND start_time <= ${endDate}
      GROUP BY EXTRACT(HOUR FROM start_time)
      ORDER BY count DESC
      LIMIT 5
    `;
  }

  private async getActivityBreakdown(
    startDate: Date,
    endDate: Date,
  ): Promise<ActivityBreakdown[]> {
    const result = await this.prisma.student_activities.groupBy({
      by: ['activity_type'],
      where: { start_time: { gte: startDate, lte: endDate } },
      _count: { id: true },
    });

    return result as ActivityBreakdown[];
  }

  private parseRedisInfo(info: string): CacheInfoSection {
    const lines = info.split('\r\n');
    const result: CacheInfoSection = {};

    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          result[key] = isNaN(Number(value)) ? value : Number(value);
        }
      }
    }

    return result;
  }

  private generateOptimizationRecommendations(
    slowQueries: QueryMetrics[],
  ): string[] {
    const recommendations: string[] = [];

    if (slowQueries.length > 0) {
      recommendations.push(
        `${slowQueries.length} slow queries detected - consider adding indexes`,
      );

      // Analyze query patterns
      const hasGroupBy = slowQueries.some(q => q.query.includes('GROUP BY'));
      const hasJoin = slowQueries.some(q => q.query.includes('JOIN'));
      const hasOrderBy = slowQueries.some(q => q.query.includes('ORDER BY'));

      if (hasGroupBy) {
        recommendations.push(
          'Consider adding composite indexes for GROUP BY queries',
        );
      }
      if (hasJoin) {
        recommendations.push(
          'Ensure foreign key columns are indexed for JOIN performance',
        );
      }
      if (hasOrderBy) {
        recommendations.push(
          'Add indexes for ORDER BY columns to avoid sorting',
        );
      }
    }

    // Check for general performance patterns
    if (this.queryMetrics.length > 100) {
      recommendations.push(
        'High query volume detected - consider implementing read replicas',
      );
    }

    return recommendations;
  }

  /**
   * Cleanup method
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    await this.redis.disconnect();
  }
}

export const performanceOptimizationService =
  new PerformanceOptimizationService();
