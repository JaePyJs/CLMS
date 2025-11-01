import {
  PrismaClient,
  Prisma,
  type equipment_status,
  type equipment_type,
} from '@prisma/client';
import { logger } from '@/utils/logger';
import { performanceMonitoringService } from '@/services/performanceMonitoringService';
import { cacheManager } from '@/utils/caching';

/**
 * Query Optimization Service
 *
 * Provides tools and utilities for optimizing database queries,
 * including query analysis, index recommendations, and performance monitoring.
 */
export class QueryOptimizationService {
  private prisma: PrismaClient;
  private queryStats: Map<
    string,
    { count: number; totalTime: number; avgTime: number; slowQueries: number }
  > = new Map();
  private indexRecommendations: Map<
    string,
    Array<{ table: string; columns: string[]; type: string; reason: string }>
  > = new Map();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Execute a query with performance monitoring
   */
  async executeQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>,
    options?: {
      useCache?: boolean;
      cacheKey?: string;
      cacheTTL?: number;
      cacheTags?: string[];
    },
  ): Promise<T> {
    // Check cache first
    if (options?.useCache && options.cacheKey) {
      const cached = await cacheManager.get<T>(options.cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    // Execute query with monitoring
    const startTime = Date.now();
    let result: T | null = null;
    let success = true;
    let error: Error | null = null;

    try {
      result = await queryFn();
    } catch (e) {
      success = false;
      error = e as Error;
      throw e;
    } finally {
      const duration = Date.now() - startTime;

      // Record performance metric
      performanceMonitoringService.recordMetric({
        category: 'database',
        operation: queryName,
        duration,
        success,
        metadata: {
          error: error ? error.message : undefined,
          cached: false,
        },
      });

      // Update query statistics
      this.updateQueryStats(queryName, duration);

      // Cache result if needed
      if (success && options?.useCache && options.cacheKey) {
        if (result !== null) {
          await cacheManager.set(options.cacheKey, result, {
            ttl: options.cacheTTL ?? 300,
            tags: options.cacheTags ?? [],
          });
        }
      }
    }

    if (result === null) {
      throw new Error('Query execution failed without a result');
    }

    return result;
  }

  /**
   * Execute a batch of queries efficiently
   */
  async executeBatch<T>(
    queryName: string,
    queries: Array<() => Promise<T>>,
    options?: {
      concurrency?: number;
      useTransaction?: boolean;
    },
  ): Promise<T[]> {
    const concurrency = options?.concurrency || 5;
    const useTransaction = options?.useTransaction || false;

    if (useTransaction) {
      return this.prisma.$transaction(async tx => {
        const results = [];

        // Process queries in batches
        for (let i = 0; i < queries.length; i += concurrency) {
          const batch = queries.slice(i, i + concurrency);
          const batchResults = await Promise.all(
            batch.map(query =>
              this.executeQueryInTransaction(queryName, query, tx),
            ),
          );
          results.push(...batchResults);
        }

        return results;
      });
    } else {
      const results = [];

      // Process queries in batches
      for (let i = 0; i < queries.length; i += concurrency) {
        const batch = queries.slice(i, i + concurrency);
        const batchResults = await Promise.all(
          batch.map(query => this.executeQuery(queryName, query)),
        );
        results.push(...batchResults);
      }

      return results;
    }
  }

  /**
   * Execute a query within a transaction
   */
  private async executeQueryInTransaction<T>(
    queryName: string,
    queryFn: () => Promise<T>,
    _tx: Prisma.TransactionClient,
  ): Promise<T> {
    const startTime = Date.now();
    let result: T;
    let success = true;
    let error: Error | null = null;

    try {
      result = await queryFn();
    } catch (e) {
      success = false;
      error = e as Error;
      throw e;
    } finally {
      const duration = Date.now() - startTime;

      // Record performance metric
      performanceMonitoringService.recordMetric({
        category: 'database',
        operation: `${queryName} (transaction)`,
        duration,
        success,
        metadata: {
          error: error ? error.message : undefined,
          transaction: true,
        },
      });

      // Update query statistics
      this.updateQueryStats(queryName, duration);
    }

    return result;
  }

  /**
   * Get students with optimized queries
   */
  async getStudents(
    options: {
      page?: number;
      limit?: number;
      gradeLevel?: string;
      section?: string;
      search?: string;
      includeActivities?: boolean;
      includeEquipmentSessions?: boolean;
    } = {},
  ) {
    const {
      page = 1,
      limit = 20,
      gradeLevel,
      section,
      search,
      includeActivities = false,
      includeEquipmentSessions = false,
    } = options;

    const skip = (page - 1) * limit;
    const cacheKey = `students:${JSON.stringify(options)}`;
    const cacheTags = ['students'];

    if (gradeLevel) cacheTags.push(`grade:${gradeLevel}`);
    if (section) cacheTags.push(`section:${section}`);

    return this.executeQuery(
      'getStudents',
      async () => {
        // Build where clause
        const where: Prisma.studentsWhereInput = {};

        if (gradeLevel) where.grade_level = gradeLevel;
        if (section) where.section = section;

        if (search) {
          where.OR = [
            { first_name: { contains: search } },
            { last_name: { contains: search } },
            { student_id: { contains: search } },
          ];
        }

        // Build include clause
        const include: Prisma.studentsInclude = {};

        if (includeActivities) {
          include.student_activities = {
            where: { status: 'ACTIVE' },
            orderBy: { start_time: 'desc' },
            take: 5,
          };
        }

        if (includeEquipmentSessions) {
          include.equipment_sessions = {
            where: { status: 'ACTIVE' },
            orderBy: { session_start: 'desc' },
            take: 5,
          };
        }

        // Execute queries in parallel
        const [students, totalCount] = await Promise.all([
          this.prisma.students.findMany({
            where,
            include,
            skip,
            take: limit,
            orderBy: { student_id: 'asc' },
          }),
          this.prisma.students.count({ where }),
        ]);

        return {
          data: students,
          pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit),
          },
        };
      },
      {
        useCache: true,
        cacheKey,
        cacheTTL: 300, // 5 minutes
        cacheTags,
      },
    );
  }

  /**
   * Get student with optimized query
   */
  async getStudentById(
    id: string,
    options: {
      includeActivities?: boolean;
      includeEquipmentSessions?: boolean;
    } = {},
  ) {
    const { includeActivities = false, includeEquipmentSessions = false } =
      options;
    const cacheKey = `student:${id}:${JSON.stringify(options)}`;
    const cacheTags = ['student', `student:${id}`];

    return this.executeQuery(
      'getStudentById',
      async () => {
        const include: Prisma.studentsInclude = {};

        if (includeActivities) {
          include.student_activities = {
            orderBy: { start_time: 'desc' },
            take: 10,
          };
        }

        if (includeEquipmentSessions) {
          include.equipment_sessions = {
            orderBy: { session_start: 'desc' },
            take: 10,
          };
        }

        return this.prisma.students.findUnique({
          where: { id },
          include,
        });
      },
      {
        useCache: true,
        cacheKey,
        cacheTTL: 600, // 10 minutes
        cacheTags,
      },
    );
  }

  /**
   * Search students with optimized query
   */
  async searchStudents(
    query: string,
    options: {
      page?: number;
      limit?: number;
      gradeLevel?: string;
      section?: string;
    } = {},
  ) {
    const { page = 1, limit = 20, gradeLevel, section } = options;
    const skip = (page - 1) * limit;
    const cacheKey = `search:${query}:${JSON.stringify(options)}`;
    const cacheTags = ['search', 'students'];

    if (gradeLevel) cacheTags.push(`grade:${gradeLevel}`);
    if (section) cacheTags.push(`section:${section}`);

    return this.executeQuery(
      'searchStudents',
      async () => {
        // Build where clause with search conditions
        const where: Prisma.studentsWhereInput = {
          OR: [
            { first_name: { contains: query } },
            { last_name: { contains: query } },
            { student_id: { contains: query } },
          ],
        };

        if (gradeLevel) where.grade_level = gradeLevel;
        if (section) where.section = section;

        // Execute queries in parallel
        const [students, totalCount] = await Promise.all([
          this.prisma.students.findMany({
            where,
            skip,
            take: limit,
            orderBy: { student_id: 'asc' },
          }),
          this.prisma.students.count({ where }),
        ]);

        return {
          data: students,
          pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit),
          },
          query,
        };
      },
      {
        useCache: true,
        cacheKey,
        cacheTTL: 300, // 5 minutes
        cacheTags,
      },
    );
  }

  /**
   * Get books with optimized query
   */
  async getBooks(
    options: {
      page?: number;
      limit?: number;
      category?: string;
      status?: string;
      search?: string;
    } = {},
  ) {
    const { page = 1, limit = 20, category, status, search } = options;

    const skip = (page - 1) * limit;
    const cacheKey = `books:${JSON.stringify(options)}`;
    const cacheTags = ['books'];

    if (category) cacheTags.push(`category:${category}`);
    if (status) cacheTags.push(`status:${status}`);

    return this.executeQuery(
      'getBooks',
      async () => {
        // Build where clause
        const where: Prisma.booksWhereInput = {};

        if (category) where.category = category;
        if (status) where.is_active = status === 'ACTIVE';

        if (search) {
          where.OR = [
            { title: { contains: search } },
            { author: { contains: search } },
            { isbn: { contains: search } },
            { accession_no: { contains: search } },
          ];
        }

        // Execute queries in parallel
        const [books, totalCount] = await Promise.all([
          this.prisma.books.findMany({
            where,
            skip,
            take: limit,
            orderBy: { title: 'asc' },
          }),
          this.prisma.books.count({ where }),
        ]);

        return {
          data: books,
          pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit),
          },
        };
      },
      {
        useCache: true,
        cacheKey,
        cacheTTL: 600, // 10 minutes
        cacheTags,
      },
    );
  }

  /**
   * Get equipment with optimized query
   */
  async getEquipment(
    options: {
      page?: number;
      limit?: number;
      type?: equipment_type;
      status?: equipment_status;
      location?: string;
      available?: boolean;
    } = {},
  ) {
    const { page = 1, limit = 20, type, status, location, available } = options;

    const skip = (page - 1) * limit;
    const cacheKey = `equipment:${JSON.stringify(options)}`;
    const cacheTags = ['equipment'];

    if (type) cacheTags.push(`type:${type}`);
    if (status) cacheTags.push(`status:${status}`);
    if (location) cacheTags.push(`location:${location}`);

    return this.executeQuery(
      'getEquipment',
      async () => {
        // Build where clause
        const where: Prisma.equipmentWhereInput = {};

        if (type) where.type = type;
        if (status) where.status = status;
        if (location) where.location = location;

        if (available !== undefined) {
          where.equipment_sessions = available
            ? { none: { status: 'ACTIVE', session_end: null } }
            : { some: { status: 'ACTIVE', session_end: null } };
        }

        // Execute queries in parallel
        const [equipment, totalCount] = await Promise.all([
          this.prisma.equipment.findMany({
            where,
            skip,
            take: limit,
            orderBy: { name: 'asc' },
          }),
          this.prisma.equipment.count({ where }),
        ]);

        return {
          data: equipment,
          pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit),
          },
        };
      },
      {
        useCache: true,
        cacheKey,
        cacheTTL: 300, // 5 minutes
        cacheTags,
      },
    );
  }

  /**
   * Get analytics data with optimized queries
   */
  async getAnalyticsData(
    options: {
      startDate?: Date;
      endDate?: Date;
      type?: 'summary' | 'students' | 'books' | 'equipment';
    } = {},
  ) {
    const { startDate, endDate, type = 'summary' } = options;
    const cacheKey = `analytics:${JSON.stringify(options)}`;
    const cacheTags = ['analytics', `analytics:${type}`];
    const dateRange = this.buildDateRangeFilter(startDate, endDate);

    return this.executeQuery(
      'getAnalyticsData',
      async () => {
        switch (type) {
          case 'summary':
            return this.getSummaryAnalytics(dateRange);
          case 'students':
            return this.getStudentAnalytics(dateRange);
          case 'books':
            return this.getBookAnalytics(dateRange);
          case 'equipment':
            return this.getEquipmentAnalytics(dateRange);
          default:
            return this.getSummaryAnalytics(dateRange);
        }
      },
      {
        useCache: true,
        cacheKey,
        cacheTTL: 1800, // 30 minutes
        cacheTags,
      },
    );
  }

  private buildDateRangeFilter(
    startDate?: Date,
    endDate?: Date,
  ): Prisma.DateTimeFilter | undefined {
    const range: Prisma.DateTimeFilter = {};

    if (startDate) {
      range.gte = startDate;
    }

    if (endDate) {
      range.lte = endDate;
    }

    return Object.keys(range).length > 0 ? range : undefined;
  }

  private buildActivityWhere(
    dateRange?: Prisma.DateTimeFilter,
  ): Prisma.student_activitiesWhereInput {
    return dateRange ? { start_time: dateRange } : {};
  }

  /**
   * Get summary analytics data
   */
  private async getSummaryAnalytics(dateRange?: Prisma.DateTimeFilter) {
    const activityWhere = this.buildActivityWhere(dateRange);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayActivityWhere: Prisma.student_activitiesWhereInput = {
      start_time: {
        gte: startOfToday,
      },
    };

    const [
      totalStudents,
      activeStudents,
      totalBooks,
      availableBooks,
      totalEquipment,
      availableEquipment,
      todayActivities,
    ] = await Promise.all([
      this.prisma.students.count(),
      this.prisma.students.count({
        where: {
          student_activities: {
            some: activityWhere,
          },
        },
      }),
      this.prisma.books.count(),
      this.prisma.books.count({
        where: {
          is_active: true,
          available_copies: {
            gt: 0,
          },
        },
      }),
      this.prisma.equipment.count(),
      this.prisma.equipment.count({
        where: { status: 'AVAILABLE' },
      }),
      this.prisma.student_activities.count({
        where: todayActivityWhere,
      }),
    ]);

    return {
      students: {
        total: totalStudents,
        active: activeStudents,
      },
      books: {
        total: totalBooks,
        available: availableBooks,
      },
      equipment: {
        total: totalEquipment,
        available: availableEquipment,
      },
      activities: {
        today: todayActivities,
      },
    };
  }

  /**
   * Get student analytics data
   */
  private async getStudentAnalytics(dateRange?: Prisma.DateTimeFilter) {
    const activityWhere = this.buildActivityWhere(dateRange);

    const [gradeLevelStats, sectionStats, activityStats] = await Promise.all([
      this.prisma.students.groupBy({
        by: ['grade_level'],
        _count: { _all: true },
      }),
      this.prisma.students.groupBy({
        by: ['section'],
        _count: { _all: true },
      }),
      this.prisma.student_activities.groupBy({
        by: ['activity_type'],
        where: activityWhere,
        _count: { _all: true },
      }),
    ]);

    return {
      gradeLevels: gradeLevelStats,
      sections: sectionStats,
      activities: activityStats,
    };
  }

  /**
   * Get book analytics data
   */
  private async getBookAnalytics(dateRange?: Prisma.DateTimeFilter) {
    const activityWhere = this.buildActivityWhere(dateRange);
    const checkoutWhere: Prisma.student_activitiesWhereInput = {
      ...activityWhere,
      activity_type: 'BOOK_CHECKOUT',
    };

    const [categoryStats, activationStats, checkoutStats] = await Promise.all([
      this.prisma.books.groupBy({
        by: ['category'],
        _count: { _all: true },
      }),
      this.prisma.books.groupBy({
        by: ['is_active'],
        _count: { _all: true },
      }),
      this.prisma.student_activities.groupBy({
        by: ['activity_type'],
        where: checkoutWhere,
        _count: { _all: true },
      }),
    ]);

    return {
      categories: categoryStats,
      statuses: activationStats,
      checkouts: checkoutStats,
    };
  }

  /**
   * Get equipment analytics data
   */
  private async getEquipmentAnalytics(dateRange?: Prisma.DateTimeFilter) {
    const sessionWhere: Prisma.equipment_sessionsWhereInput = dateRange
      ? { session_start: dateRange }
      : {};

    const [typeStats, statusStats, usageStats] = await Promise.all([
      this.prisma.equipment.groupBy({
        by: ['type'],
        _count: { _all: true },
      }),
      this.prisma.equipment.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.equipment_sessions.groupBy({
        by: ['equipment_id'],
        where: sessionWhere,
        _count: { _all: true },
      }),
    ]);

    return {
      types: typeStats,
      statuses: statusStats,
      usage: usageStats,
    };
  }

  /**
   * Update query statistics
   */
  private updateQueryStats(queryName: string, duration: number): void {
    const existing = this.queryStats.get(queryName) || {
      count: 0,
      totalTime: 0,
      avgTime: 0,
      slowQueries: 0,
    };

    existing.count++;
    existing.totalTime += duration;
    existing.avgTime = existing.totalTime / existing.count;

    if (duration > 1000) {
      // Consider queries over 1s as slow
      existing.slowQueries++;
    }

    this.queryStats.set(queryName, existing);
  }

  /**
   * Get query statistics
   */
  getQueryStats(): Array<{
    query: string;
    count: number;
    totalTime: number;
    avgTime: number;
    slowQueries: number;
  }> {
    return Array.from(this.queryStats.entries()).map(([query, stats]) => ({
      query,
      ...stats,
    }));
  }

  /**
   * Get slow queries
   */
  getSlowQueries(): Array<{
    query: string;
    count: number;
    avgTime: number;
    slowQueries: number;
  }> {
    return this.getQueryStats().filter(stat => stat.slowQueries > 0);
  }

  /**
   * Analyze query performance and provide recommendations
   */
  analyzeQueryPerformance(): {
    summary: {
      totalQueries: number;
      totalSlowQueries: number;
      avgQueryTime: number;
    };
    slowQueries: Array<{
      query: string;
      count: number;
      avgTime: number;
      slowQueries: number;
    }>;
    recommendations: string[];
  } {
    const stats = this.getQueryStats();
    const slowQueries = this.getSlowQueries();

    const totalQueries = stats.reduce((sum, stat) => sum + stat.count, 0);
    const totalSlowQueries = stats.reduce(
      (sum, stat) => sum + stat.slowQueries,
      0,
    );
    const avgQueryTime =
      stats.reduce((sum, stat) => sum + stat.totalTime, 0) / totalQueries;

    const recommendations: string[] = [];

    // Add recommendations based on analysis
    if (totalSlowQueries > 0) {
      recommendations.push(
        `${totalSlowQueries} slow queries detected. Consider optimizing these queries.`,
      );
    }

    if (avgQueryTime > 100) {
      recommendations.push(
        `Average query time is ${avgQueryTime.toFixed(2)}ms. Consider query optimization.`,
      );
    }

    const verySlowQueries = slowQueries.filter(q => q.avgTime > 2000);
    if (verySlowQueries.length > 0) {
      recommendations.push(
        `${verySlowQueries.length} queries are very slow (>2s). These require immediate attention.`,
      );
    }

    // Add specific recommendations for slow queries
    slowQueries.forEach(query => {
      if (query.query.includes('search') && query.avgTime > 500) {
        recommendations.push(
          `Consider adding full-text search indexes for ${query.query}.`,
        );
      }

      if (query.query.includes('activities') && query.avgTime > 1000) {
        recommendations.push(
          `Consider optimizing the ${query.query} with better joins or pagination.`,
        );
      }
    });

    return {
      summary: {
        totalQueries,
        totalSlowQueries,
        avgQueryTime,
      },
      slowQueries,
      recommendations,
    };
  }

  /**
   * Create recommended database indexes
   */
  async createRecommendedIndexes(): Promise<void> {
    const recommendations = [
      'CREATE INDEX IF NOT EXISTS "idx_students_grade_level" ON "students"("grade_level");',
      'CREATE INDEX IF NOT EXISTS "idx_students_section" ON "students"("section");',
      'CREATE INDEX IF NOT EXISTS "idx_students_grade_section" ON "students"("grade_level", "section");',
      'CREATE INDEX IF NOT EXISTS "idx_students_name_search" ON "students"("first_name", "last_name");',
      'CREATE INDEX IF NOT EXISTS "idx_students_student_id" ON "students"("student_id");',
      'CREATE INDEX IF NOT EXISTS "idx_books_category" ON "books"("category");',
      'CREATE INDEX IF NOT EXISTS "idx_books_is_active" ON "books"("is_active");',
      'CREATE INDEX IF NOT EXISTS "idx_books_title_author" ON "books"("title", "author");',
      'CREATE INDEX IF NOT EXISTS "idx_equipment_type" ON "equipment"("type");',
      'CREATE INDEX IF NOT EXISTS "idx_equipment_status" ON "equipment"("status");',
      'CREATE INDEX IF NOT EXISTS "idx_equipment_location" ON "equipment"("location");',
      'CREATE INDEX IF NOT EXISTS "idx_student_activities_start_time" ON "student_activities"("start_time");',
      'CREATE INDEX IF NOT EXISTS "idx_student_activities_student_id" ON "student_activities"("student_id");',
      'CREATE INDEX IF NOT EXISTS "idx_student_activities_activity_type" ON "student_activities"("activity_type");',
      'CREATE INDEX IF NOT EXISTS "idx_equipment_sessions_session_start" ON "equipment_sessions"("session_start");',
      'CREATE INDEX IF NOT EXISTS "idx_equipment_sessions_equipment_id" ON "equipment_sessions"("equipment_id");',
    ];

    for (const recommendation of recommendations) {
      try {
        await this.prisma.$executeRawUnsafe(recommendation);
        logger.info(`Created index: ${recommendation}`);
      } catch (error) {
        logger.warn(`Failed to create index: ${recommendation}`, {
          error: (error as Error).message,
        });
      }
    }
  }
}

// Singleton instance
export let queryOptimizationService: QueryOptimizationService;

export function initializeQueryOptimizationService(prisma: PrismaClient): void {
  queryOptimizationService = new QueryOptimizationService(prisma);
}
