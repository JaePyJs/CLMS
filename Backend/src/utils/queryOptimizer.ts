import { PrismaClient } from '@prisma/client';
import { logger } from './logger';
import { cacheManager } from './caching';

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

class QueryOptimizer {
  private prisma: PrismaClient;
  private queryLog: QueryStats[] = [];
  private config: Required<OptimizationConfig>;

  constructor(prisma: PrismaClient, config: OptimizationConfig = {}) {
    this.prisma = prisma;
    this.config = {
      enableCache: config.enableCache ?? true,
      cacheTTL: config.cacheTTL ?? 300,
      enableQueryLogging: config.enableQueryLogging ?? process.env.NODE_ENV === 'development',
      slowQueryThreshold: config.slowQueryThreshold ?? 1000
    };

    this.setupQueryLogging();
  }

  private setupQueryLogging() {
    if (!this.config.enableQueryLogging) return;

    // @ts-ignore - Prisma middleware
    this.prisma.$use(async (params, next) => {
      const start = Date.now();
      const result = await next(params);
      const duration = Date.now() - start;

      const queryInfo: QueryStats = {
        query: `${params.model}.${params.action}`,
        duration,
        timestamp: new Date(),
        cached: false
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
          args: params.args
        });
      }

      return result;
    });
  }

  async cachedQuery<T>(
    cacheKey: string,
    query: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    if (!this.config.enableCache) {
      return query();
    }

    const start = Date.now();
    const result = await cacheManager.getOrSet(cacheKey, query, {
      ttl: ttl || this.config.cacheTTL
    });
    const duration = Date.now() - start;

    if (this.config.enableQueryLogging) {
      this.queryLog.push({
        query: cacheKey,
        duration,
        timestamp: new Date(),
        cached: duration < 10 // If very fast, likely from cache
      });
    }

    return result;
  }

  // Optimized student queries
  async getStudentWithActivities(studentId: string) {
    return this.cachedQuery(
      `student:${studentId}:activities`,
      async () => {
        return this.prisma.student.findUnique({
          where: { id: studentId },
          include: {
            activities: {
              orderBy: { checkInTime: 'desc' },
              take: 10
            }
          }
        });
      },
      300 // 5 minutes
    );
  }

  async getActiveStudents() {
    return this.cachedQuery(
      'students:active',
      async () => {
        return this.prisma.student.findMany({
          where: { isActive: true },
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
            gradeLevel: true,
            gradeCategory: true
          }
        });
      },
      600 // 10 minutes
    );
  }

  // Optimized equipment queries
  async getAvailableEquipment() {
    return this.cachedQuery(
      'equipment:available',
      async () => {
        return this.prisma.equipment.findMany({
          where: { status: 'AVAILABLE' },
          select: {
            id: true,
            equipmentId: true,
            name: true,
            type: true,
            status: true
          }
        });
      },
      60 // 1 minute
    );
  }

  async getEquipmentSessions(equipmentId: string, limit: number = 10) {
    return this.cachedQuery(
      `equipment:${equipmentId}:sessions:${limit}`,
      async () => {
        return this.prisma.equipmentSession.findMany({
          where: { equipmentId },
          include: {
            student: {
              select: {
                studentId: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { startTime: 'desc' },
          take: limit
        });
      },
      300 // 5 minutes
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
          todayActivities
        ] = await Promise.all([
          this.prisma.student.count(),
          this.prisma.student.count({ where: { isActive: true } }),
          this.prisma.equipment.count(),
          this.prisma.equipment.count({ where: { status: 'AVAILABLE' } }),
          this.prisma.equipmentSession.count({ where: { status: 'ACTIVE' } }),
          this.prisma.studentActivity.count({
            where: {
              checkInTime: {
                gte: new Date(new Date().setHours(0, 0, 0, 0))
              }
            }
          })
        ]);

        return {
          students: {
            total: totalStudents,
            active: activeStudents,
            inactive: totalStudents - activeStudents
          },
          equipment: {
            total: totalEquipment,
            available: availableEquipment,
            inUse: totalEquipment - availableEquipment
          },
          sessions: {
            active: activeSessions
          },
          activities: {
            today: todayActivities
          }
        };
      },
      60 // 1 minute
    );
  }

  async getActivityStatsByDateRange(startDate: Date, endDate: Date) {
    const cacheKey = `activities:stats:${startDate.toISOString()}:${endDate.toISOString()}`;
    
    return this.cachedQuery(
      cacheKey,
      async () => {
        return this.prisma.studentActivity.groupBy({
          by: ['activityType'],
          where: {
            checkInTime: {
              gte: startDate,
              lte: endDate
            }
          },
          _count: true
        });
      },
      1800 // 30 minutes
    );
  }

  // Batch operations
  async batchCreateStudents(students: any[]) {
    // No caching for write operations
    return this.prisma.student.createMany({
      data: students,
      skipDuplicates: true
    });
  }

  async batchUpdateStudents(updates: Array<{ id: string; data: any }>) {
    const transaction = updates.map(({ id, data }) =>
      this.prisma.student.update({
        where: { id },
        data
      })
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
    return this.prisma.student.findMany({
      where: {
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { studentId: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        gradeLevel: true,
        email: true,
        isActive: true
      },
      take: limit
    });
  }

  async searchBooks(query: string, limit: number = 20) {
    return this.prisma.book.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { author: { contains: query, mode: 'insensitive' } },
          { isbn: { contains: query, mode: 'insensitive' } },
          { accessionNumber: { contains: query, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        title: true,
        author: true,
        isbn: true,
        accessionNumber: true,
        status: true
      },
      take: limit
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
    const slowQueries = this.queryLog.filter(q => q.duration > this.config.slowQueryThreshold);
    const cachedQueries = this.queryLog.filter(q => q.cached);
    
    const avgDuration = this.queryLog.length > 0
      ? this.queryLog.reduce((sum, q) => sum + q.duration, 0) / this.queryLog.length
      : 0;

    return {
      totalQueries: this.queryLog.length,
      slowQueries: slowQueries.length,
      cachedQueries: cachedQueries.length,
      averageDuration: Math.round(avgDuration * 100) / 100,
      cacheHitRate: this.queryLog.length > 0
        ? Math.round((cachedQueries.length / this.queryLog.length) * 100)
        : 0,
      recentSlowQueries: slowQueries.slice(-10)
    };
  }

  clearQueryLog() {
    this.queryLog = [];
  }
}

export default QueryOptimizer;
