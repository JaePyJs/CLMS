import {
  Prisma,
  PrismaClient,
  equipment_sessions_status,
  equipment_status,
  student_activities_status,
} from '@prisma/client';
import { logger } from './logger';
import { cacheManager } from './caching';
import {
  DatabaseQueryOptimizer,
  getQueryOptimizer,
} from './databaseQueryOptimizer';

interface QueryStats {
  query: string;
  duration: number;
  timestamp: Date;
  cached: boolean;
}

interface OptimizationConfig {
  enableCache?: boolean;
  cacheTTL?: number;
  enableQueryLogging?: boolean;
  slowQueryThreshold?: number;
}

/**
 * Legacy QueryOptimizer - Backward compatibility wrapper
 * @deprecated Use DatabaseQueryOptimizer instead
 */
class QueryOptimizer {
  private prisma: PrismaClient;
  private queryLog: QueryStats[] = [];
  private config: Required<OptimizationConfig>;
  private advancedOptimizer: DatabaseQueryOptimizer;

  constructor(prisma: PrismaClient, config: OptimizationConfig = {}) {
    this.prisma = prisma;
    this.config = {
      enableCache: config.enableCache ?? true,
      cacheTTL: config.cacheTTL ?? 300,
      enableQueryLogging:
        config.enableQueryLogging ?? process.env.NODE_ENV === 'development',
      slowQueryThreshold: config.slowQueryThreshold ?? 1000,
    };

    // Initialize the advanced optimizer
    this.advancedOptimizer = getQueryOptimizer(prisma);

    logger.warn(
      'QueryOptimizer is deprecated. Use DatabaseQueryOptimizer instead.',
    );
  }

  private setupQueryLogging() {
    if (!this.config.enableQueryLogging) return;

    this.prisma.$use(async (params, next) => {
      const start = Date.now();
      const result = await next(params);
      const duration = Date.now() - start;

      const queryInfo: QueryStats = {
        query: `${params.model}.${params.action}`,
        duration,
        timestamp: new Date(),
        cached: false,
      };

      this.queryLog.push(queryInfo);

      // Keep only last 1000 queries
      if (this.queryLog.length > 1000) {
        this.queryLog.shift();
      }

      // Log slow queries
      if (duration > this.config.slowQueryThreshold) {
        logger.warn('Slow query detected:', {
          model: params.model,
          action: params.action,
          duration: `${duration}ms`,
          args: params.args,
        });
      }

      return result;
    });
  }

  async cachedQuery<T>(
    cacheKey: string,
    query: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    if (!this.config.enableCache) {
      return query();
    }

    const start = Date.now();
    const result = await cacheManager.getOrSet(cacheKey, query, {
      ttl: ttl || this.config.cacheTTL,
    });
    const duration = Date.now() - start;

    if (this.config.enableQueryLogging) {
      this.queryLog.push({
        query: cacheKey,
        duration,
        timestamp: new Date(),
        cached: duration < 10, // If very fast, likely from cache
      });
    }

    return result;
  }

  // Optimized student queries
  async getStudentWithActivities(studentId: string) {
    return this.cachedQuery(
      `student:${studentId}:activities`,
      async () => {
        return this.prisma.students.findUnique({
          where: { id: studentId },
          include: {
            student_activities: {
              select: {
                id: true,
                activity_type: true,
                start_time: true,
                end_time: true,
                status: true,
              },
              where: { status: student_activities_status.ACTIVE },
              orderBy: { start_time: 'desc' },
              take: 10,
            },
          },
        });
      },
      300, // 5 minutes
    );
  }

  async getActiveStudents() {
    return this.cachedQuery(
      'students:active',
      async () => {
        return this.prisma.students.findMany({
          where: { is_active: true },
          select: {
            id: true,
            student_id: true,
            first_name: true,
            last_name: true,
            grade_level: true,
            grade_category: true,
          },
        });
      },
      600, // 10 minutes
    );
  }

  // Optimized equipment queries
  async getAvailableEquipment() {
    return this.cachedQuery(
      'equipment:available',
      async () => {
        return this.prisma.equipment.findMany({
          where: { status: equipment_status.AVAILABLE },
          select: {
            id: true,
            equipment_id: true,
            name: true,
            type: true,
            status: true,
          },
        });
      },
      60, // 1 minute
    );
  }

  async getEquipmentSessions(equipmentId: string, limit: number = 10) {
    return this.cachedQuery(
      `equipment:${equipmentId}:sessions:${limit}`,
      async () => {
        return this.prisma.equipment_sessions.findMany({
          where: { equipment_id: equipmentId },
          include: {
            students: true,
          },
          orderBy: { session_start: 'desc' },
          take: limit,
        });
      },
      300, // 5 minutes
    );
  }

  // Optimized analytics queries
  async getDashboardStats() {
    return this.cachedQuery(
      'dashboard:stats',
      async () => {
        const [
          totalStudents,
          activeStudents,
          totalEquipment,
          availableEquipment,
          activeSessions,
          todayActivities,
        ] = await Promise.all([
          this.prisma.students.count(),
          this.prisma.students.count({ where: { is_active: true } }),
          this.prisma.equipment.count(),
          this.prisma.equipment.count({
            where: { status: equipment_status.AVAILABLE },
          }),
          this.prisma.equipment_sessions.count({
            where: { status: equipment_sessions_status.ACTIVE },
          }),
          this.prisma.student_activities.count({
            where: {
              start_time: {
                gte: new Date(new Date().setHours(0, 0, 0, 0)),
              },
            },
          }),
        ]);

        return {
          students: {
            total: totalStudents,
            active: activeStudents,
            inactive: totalStudents - activeStudents,
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
      60, // 1 minute
    );
  }

  async getActivityStatsByDateRange(startDate: Date, endDate: Date) {
    const cacheKey = `activities:stats:${startDate.toISOString()}:${endDate.toISOString()}`;

    return this.cachedQuery(
      cacheKey,
      async () => {
        return this.prisma.student_activities.groupBy({
          by: ['activity_type'],
          where: {
            start_time: {
              gte: startDate,
              lte: endDate,
            },
          },
          _count: true,
        });
      },
      1800, // 30 minutes
    );
  }

  // Batch operations
  async batchCreateStudents(students: Prisma.studentsCreateManyInput[]) {
    // No caching for write operations
    return this.prisma.students.createMany({
      data: students,
      skipDuplicates: true,
    });
  }

  async batchUpdateStudents(
    updates: Array<{ id: string; data: Prisma.studentsUpdateInput }>,
  ) {
    const transaction = updates.map(({ id, data }) =>
      this.prisma.students.update({
        where: { id },
        data,
      }),
    );

    const result = await this.prisma.$transaction(transaction);

    // Invalidate student caches
    await cacheManager.invalidateByPattern('student:*');
    await cacheManager.invalidateByPattern('students:*');

    return result;
  }

  // Optimized search queries
  async searchStudents(query: string, limit: number = 20) {
    // Don't cache search results as they're dynamic
    return this.prisma.students.findMany({
      where: {
        OR: [
          { first_name: { contains: query } },
          { last_name: { contains: query } },
          { student_id: { contains: query } },
        ],
      },
      select: {
        id: true,
        student_id: true,
        first_name: true,
        last_name: true,
        grade_level: true,
        is_active: true,
      },
      take: limit,
    });
  }

  async searchBooks(query: string, limit: number = 20) {
    return this.prisma.books.findMany({
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
        is_active: true,
      },
      take: limit,
    });
  }

  // Cache invalidation helpers
  async invalidateStudentCache(studentId: string) {
    await cacheManager.invalidateByPattern(`student:${studentId}*`);
    await cacheManager.invalidateByPattern('students:*');
  }

  async invalidateEquipmentCache(equipmentId?: string) {
    if (equipmentId) {
      await cacheManager.invalidateByPattern(`equipment:${equipmentId}*`);
    }
    await cacheManager.invalidateByPattern('equipment:*');
  }

  async invalidateDashboardCache() {
    await cacheManager.invalidateByPattern('dashboard:*');
  }

  // Query statistics
  getQueryStats() {
    const slowQueries = this.queryLog.filter(
      q => q.duration > this.config.slowQueryThreshold,
    );
    const cachedQueries = this.queryLog.filter(q => q.cached);

    const avgDuration =
      this.queryLog.length > 0
        ? this.queryLog.reduce((sum, q) => sum + q.duration, 0) /
          this.queryLog.length
        : 0;

    return {
      totalQueries: this.queryLog.length,
      slowQueries: slowQueries.length,
      cachedQueries: cachedQueries.length,
      averageDuration: Math.round(avgDuration * 100) / 100,
      cacheHitRate:
        this.queryLog.length > 0
          ? Math.round((cachedQueries.length / this.queryLog.length) * 100)
          : 0,
      recentSlowQueries: slowQueries.slice(-10),
    };
  }

  clearQueryLog() {
    this.queryLog = [];
  }
}

export default QueryOptimizer;
