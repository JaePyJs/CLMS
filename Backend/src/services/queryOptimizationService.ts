import { PrismaClient, Prisma } from '@prisma/client';
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
  private queryStats: Map<string, { count: number; totalTime: number; avgTime: number; slowQueries: number }> = new Map();
  private indexRecommendations: Map<string, Array<{ table: string; columns: string[]; type: string; reason: string }>> = new Map();

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
    }
  ): Promise<T> {
    // Check cache first
    if (options?.useCache && options.cacheKey) {
      const cached = await cacheManager.get(options.cacheKey);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    }

    // Execute query with monitoring
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
        operation: queryName,
        duration,
        success,
        metadata: {
          error: error ? error.message : undefined,
          cached: false
        }
      });

      // Update query statistics
      this.updateQueryStats(queryName, duration);

      // Cache result if needed
      if (success && options?.useCache && options.cacheKey) {
        await cacheManager.set(options.cacheKey, JSON.stringify(result), {
          ttl: options.cacheTTL || 300,
          tags: options.cacheTags
        });
      }
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
    }
  ): Promise<T[]> {
    const concurrency = options?.concurrency || 5;
    const useTransaction = options?.useTransaction || false;

    if (useTransaction) {
      return this.prisma.$transaction(async (tx) => {
        const results = [];
        
        // Process queries in batches
        for (let i = 0; i < queries.length; i += concurrency) {
          const batch = queries.slice(i, i + concurrency);
          const batchResults = await Promise.all(
            batch.map(query => this.executeQueryInTransaction(queryName, query, tx))
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
          batch.map(query => this.executeQuery(queryName, query))
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
    tx: Prisma.TransactionClient
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
          transaction: true
        }
      });

      // Update query statistics
      this.updateQueryStats(queryName, duration);
    }

    return result;
  }

  /**
   * Get students with optimized queries
   */
  async getStudents(options: {
    page?: number;
    limit?: number;
    gradeLevel?: string;
    section?: string;
    search?: string;
    includeActivities?: boolean;
    includeEquipmentSessions?: boolean;
  } = {}) {
    const {
      page = 1,
      limit = 20,
      gradeLevel,
      section,
      search,
      includeActivities = false,
      includeEquipmentSessions = false
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
        const where: Prisma.StudentWhereInput = {};
        
        if (gradeLevel) where.gradeLevel = gradeLevel;
        if (section) where.section = section;
        
        if (search) {
          where.OR = [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { studentId: { contains: search, mode: 'insensitive' } }
          ];
        }

        // Build include clause
        const include: Prisma.StudentInclude = {};
        
        if (includeActivities) {
          include.activities = {
            where: { status: 'ACTIVE' },
            orderBy: { checkInTime: 'desc' },
            take: 5
          };
        }
        
        if (includeEquipmentSessions) {
          include.equipmentSessions = {
            where: { status: 'ACTIVE' },
            orderBy: { startTime: 'desc' },
            take: 5
          };
        }

        // Execute queries in parallel
        const [students, totalCount] = await Promise.all([
          this.prisma.student.findMany({
            where,
            include,
            skip,
            take: limit,
            orderBy: { studentId: 'asc' }
          }),
          this.prisma.student.count({ where })
        ]);

        return {
          data: students,
          pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          }
        };
      },
      {
        useCache: true,
        cacheKey,
        cacheTTL: 300, // 5 minutes
        cacheTags
      }
    );
  }

  /**
   * Get student with optimized query
   */
  async getStudentById(id: string, options: {
    includeActivities?: boolean;
    includeEquipmentSessions?: boolean;
  } = {}) {
    const { includeActivities = false, includeEquipmentSessions = false } = options;
    const cacheKey = `student:${id}:${JSON.stringify(options)}`;
    const cacheTags = ['student', `student:${id}`];

    return this.executeQuery(
      'getStudentById',
      async () => {
        const include: Prisma.StudentInclude = {};
        
        if (includeActivities) {
          include.activities = {
            orderBy: { checkInTime: 'desc' },
            take: 10
          };
        }
        
        if (includeEquipmentSessions) {
          include.equipmentSessions = {
            orderBy: { startTime: 'desc' },
            take: 10
          };
        }

        return this.prisma.student.findUnique({
          where: { id },
          include
        });
      },
      {
        useCache: true,
        cacheKey,
        cacheTTL: 600, // 10 minutes
        cacheTags
      }
    );
  }

  /**
   * Search students with optimized query
   */
  async searchStudents(query: string, options: {
    page?: number;
    limit?: number;
    gradeLevel?: string;
    section?: string;
  } = {}) {
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
        const where: Prisma.StudentWhereInput = {
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { studentId: { contains: query, mode: 'insensitive' } }
          ]
        };
        
        if (gradeLevel) where.gradeLevel = gradeLevel;
        if (section) where.section = section;

        // Execute queries in parallel
        const [students, totalCount] = await Promise.all([
          this.prisma.student.findMany({
            where,
            skip,
            take: limit,
            orderBy: { studentId: 'asc' }
          }),
          this.prisma.student.count({ where })
        ]);

        return {
          data: students,
          pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          },
          query
        };
      },
      {
        useCache: true,
        cacheKey,
        cacheTTL: 300, // 5 minutes
        cacheTags
      }
    );
  }

  /**
   * Get books with optimized query
   */
  async getBooks(options: {
    page?: number;
    limit?: number;
    category?: string;
    status?: string;
    search?: string;
  } = {}) {
    const {
      page = 1,
      limit = 20,
      category,
      status,
      search
    } = options;

    const skip = (page - 1) * limit;
    const cacheKey = `books:${JSON.stringify(options)}`;
    const cacheTags = ['books'];

    if (category) cacheTags.push(`category:${category}`);
    if (status) cacheTags.push(`status:${status}`);

    return this.executeQuery(
      'getBooks',
      async () => {
        // Build where clause
        const where: Prisma.BookWhereInput = {};
        
        if (category) where.category = category;
        if (status) where.status = status;
        
        if (search) {
          where.OR = [
            { title: { contains: search, mode: 'insensitive' } },
            { author: { contains: search, mode: 'insensitive' } },
            { isbn: { contains: search, mode: 'insensitive' } },
            { accessionNumber: { contains: search, mode: 'insensitive' } }
          ];
        }

        // Execute queries in parallel
        const [books, totalCount] = await Promise.all([
          this.prisma.book.findMany({
            where,
            skip,
            take: limit,
            orderBy: { title: 'asc' }
          }),
          this.prisma.book.count({ where })
        ]);

        return {
          data: books,
          pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          }
        };
      },
      {
        useCache: true,
        cacheKey,
        cacheTTL: 600, // 10 minutes
        cacheTags
      }
    );
  }

  /**
   * Get equipment with optimized query
   */
  async getEquipment(options: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    location?: string;
    available?: boolean;
  } = {}) {
    const {
      page = 1,
      limit = 20,
      type,
      status,
      location,
      available
    } = options;

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
        const where: Prisma.EquipmentWhereInput = {};
        
        if (type) where.type = type;
        if (status) where.status = status;
        if (location) where.location = location;
        
        if (available !== undefined) {
          where.sessions = {
            some: {
              status: 'ACTIVE',
              endTime: null
            }
          };
        }

        // Execute queries in parallel
        const [equipment, totalCount] = await Promise.all([
          this.prisma.equipment.findMany({
            where,
            skip,
            take: limit,
            orderBy: { name: 'asc' }
          }),
          this.prisma.equipment.count({ where })
        ]);

        return {
          data: equipment,
          pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          }
        };
      },
      {
        useCache: true,
        cacheKey,
        cacheTTL: 300, // 5 minutes
        cacheTags
      }
    );
  }

  /**
   * Get analytics data with optimized queries
   */
  async getAnalyticsData(options: {
    startDate?: Date;
    endDate?: Date;
    type?: 'summary' | 'students' | 'books' | 'equipment';
  } = {}) {
    const { startDate, endDate, type = 'summary' } = options;
    const cacheKey = `analytics:${JSON.stringify(options)}`;
    const cacheTags = ['analytics', `analytics:${type}`];

    return this.executeQuery(
      'getAnalyticsData',
      async () => {
        const dateFilter: Prisma.StudentActivityWhereInput['checkInTime'] = {};
        
        if (startDate) dateFilter.gte = startDate;
        if (endDate) dateFilter.lte = endDate;

        switch (type) {
          case 'summary':
            return this.getSummaryAnalytics(dateFilter);
          case 'students':
            return this.getStudentAnalytics(dateFilter);
          case 'books':
            return this.getBookAnalytics(dateFilter);
          case 'equipment':
            return this.getEquipmentAnalytics(dateFilter);
          default:
            return this.getSummaryAnalytics(dateFilter);
        }
      },
      {
        useCache: true,
        cacheKey,
        cacheTTL: 1800, // 30 minutes
        cacheTags
      }
    );
  }

  /**
   * Get summary analytics data
   */
  private async getSummaryAnalytics(dateFilter: Prisma.StudentActivityWhereInput['checkInTime']) {
    const [
      totalStudents,
      activeStudents,
      totalBooks,
      availableBooks,
      totalEquipment,
      availableEquipment,
      todayActivities
    ] = await Promise.all([
      this.prisma.student.count(),
      this.prisma.student.count({
        where: {
          activities: {
            some: {
              checkInTime: dateFilter
            }
          }
        }
      }),
      this.prisma.book.count(),
      this.prisma.book.count({
        where: { status: 'AVAILABLE' }
      }),
      this.prisma.equipment.count(),
      this.prisma.equipment.count({
        where: { status: 'AVAILABLE' }
      }),
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
        active: activeStudents
      },
      books: {
        total: totalBooks,
        available: availableBooks
      },
      equipment: {
        total: totalEquipment,
        available: availableEquipment
      },
      activities: {
        today: todayActivities
      }
    };
  }

  /**
   * Get student analytics data
   */
  private async getStudentAnalytics(dateFilter: Prisma.StudentActivityWhereInput['checkInTime']) {
    const [
      gradeLevelStats,
      sectionStats,
      activityStats
    ] = await Promise.all([
      this.prisma.student.groupBy({
        by: ['gradeLevel'],
        _count: true
      }),
      this.prisma.student.groupBy({
        by: ['section'],
        _count: true
      }),
      this.prisma.studentActivity.groupBy({
        by: ['activityType'],
        where: { checkInTime: dateFilter },
        _count: true
      })
    ]);

    return {
      gradeLevels: gradeLevelStats,
      sections: sectionStats,
      activities: activityStats
    };
  }

  /**
   * Get book analytics data
   */
  private async getBookAnalytics(dateFilter: Prisma.StudentActivityWhereInput['checkInTime']) {
    const [
      categoryStats,
      statusStats,
      checkoutStats
    ] = await Promise.all([
      this.prisma.book.groupBy({
        by: ['category'],
        _count: true
      }),
      this.prisma.book.groupBy({
        by: ['status'],
        _count: true
      }),
      this.prisma.studentActivity.groupBy({
        by: ['activityType'],
        where: { 
          checkInTime: dateFilter,
          activityType: 'BOOK_CHECKOUT'
        },
        _count: true
      })
    ]);

    return {
      categories: categoryStats,
      statuses: statusStats,
      checkouts: checkoutStats
    };
  }

  /**
   * Get equipment analytics data
   */
  private async getEquipmentAnalytics(dateFilter: Prisma.StudentActivityWhereInput['checkInTime']) {
    const [
      typeStats,
      statusStats,
      usageStats
    ] = await Promise.all([
      this.prisma.equipment.groupBy({
        by: ['type'],
        _count: true
      }),
      this.prisma.equipment.groupBy({
        by: ['status'],
        _count: true
      }),
      this.prisma.equipmentSession.groupBy({
        by: ['equipmentId'],
        where: { startTime: dateFilter },
        _count: true
      })
    ]);

    return {
      types: typeStats,
      statuses: statusStats,
      usage: usageStats
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
      slowQueries: 0
    };

    existing.count++;
    existing.totalTime += duration;
    existing.avgTime = existing.totalTime / existing.count;
    
    if (duration > 1000) { // Consider queries over 1s as slow
      existing.slowQueries++;
    }

    this.queryStats.set(queryName, existing);
  }

  /**
   * Get query statistics
   */
  getQueryStats(): Array<{ query: string; count: number; totalTime: number; avgTime: number; slowQueries: number }> {
    return Array.from(this.queryStats.entries()).map(([query, stats]) => ({
      query,
      ...stats
    }));
  }

  /**
   * Get slow queries
   */
  getSlowQueries(): Array<{ query: string; count: number; avgTime: number; slowQueries: number }> {
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
    slowQueries: Array<{ query: string; count: number; avgTime: number; slowQueries: number }>;
    recommendations: string[];
  } {
    const stats = this.getQueryStats();
    const slowQueries = this.getSlowQueries();
    
    const totalQueries = stats.reduce((sum, stat) => sum + stat.count, 0);
    const totalSlowQueries = stats.reduce((sum, stat) => sum + stat.slowQueries, 0);
    const avgQueryTime = stats.reduce((sum, stat) => sum + stat.totalTime, 0) / totalQueries;

    const recommendations: string[] = [];

    // Add recommendations based on analysis
    if (totalSlowQueries > 0) {
      recommendations.push(`${totalSlowQueries} slow queries detected. Consider optimizing these queries.`);
    }

    if (avgQueryTime > 100) {
      recommendations.push(`Average query time is ${avgQueryTime.toFixed(2)}ms. Consider query optimization.`);
    }

    const verySlowQueries = slowQueries.filter(q => q.avgTime > 2000);
    if (verySlowQueries.length > 0) {
      recommendations.push(`${verySlowQueries.length} queries are very slow (>2s). These require immediate attention.`);
    }

    // Add specific recommendations for slow queries
    slowQueries.forEach(query => {
      if (query.query.includes('search') && query.avgTime > 500) {
        recommendations.push(`Consider adding full-text search indexes for ${query.query}.`);
      }
      
      if (query.query.includes('activities') && query.avgTime > 1000) {
        recommendations.push(`Consider optimizing the ${query.query} with better joins or pagination.`);
      }
    });

    return {
      summary: {
        totalQueries,
        totalSlowQueries,
        avgQueryTime
      },
      slowQueries,
      recommendations
    };
  }

  /**
   * Create recommended database indexes
   */
  async createRecommendedIndexes(): Promise<void> {
    const recommendations = [
      'CREATE INDEX IF NOT EXISTS "idx_student_grade_level" ON "Student"("gradeLevel");',
      'CREATE INDEX IF NOT EXISTS "idx_student_section" ON "Student"("section");',
      'CREATE INDEX IF NOT EXISTS "idx_student_grade_section" ON "Student"("gradeLevel", "section");',
      'CREATE INDEX IF NOT EXISTS "idx_student_name_search" ON "Student"("firstName", "lastName");',
      'CREATE INDEX IF NOT EXISTS "idx_student_student_id" ON "Student"("studentId");',
      'CREATE INDEX IF NOT EXISTS "idx_book_category" ON "Book"("category");',
      'CREATE INDEX IF NOT EXISTS "idx_book_status" ON "Book"("status");',
      'CREATE INDEX IF NOT EXISTS "idx_book_title_search" ON "Book"("title", "author");',
      'CREATE INDEX IF NOT EXISTS "idx_equipment_type" ON "Equipment"("type");',
      'CREATE INDEX IF NOT EXISTS "idx_equipment_status" ON "Equipment"("status");',
      'CREATE INDEX IF NOT EXISTS "idx_equipment_location" ON "Equipment"("location");',
      'CREATE INDEX IF NOT EXISTS "idx_activity_check_in_time" ON "StudentActivity"("checkInTime");',
      'CREATE INDEX IF NOT EXISTS "idx_activity_student_id" ON "StudentActivity"("studentId");',
      'CREATE INDEX IF NOT EXISTS "idx_activity_type" ON "StudentActivity"("activityType");',
      'CREATE INDEX IF NOT EXISTS "idx_session_start_time" ON "EquipmentSession"("startTime");',
      'CREATE INDEX IF NOT EXISTS "idx_session_equipment_id" ON "EquipmentSession"("equipmentId");'
    ];

    for (const recommendation of recommendations) {
      try {
        await this.prisma.$executeRawUnsafe(recommendation);
        logger.info(`Created index: ${recommendation}`);
      } catch (error) {
        logger.warn(`Failed to create index: ${recommendation}`, { error: (error as Error).message });
      }
    }
  }
}

// Singleton instance
export let queryOptimizationService: QueryOptimizationService;

export function initializeQueryOptimizationService(prisma: PrismaClient): void {
  queryOptimizationService = new QueryOptimizationService(prisma);
}