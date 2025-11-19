/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import { CacheService } from './cacheService';
import { withQueryTracking } from '../middleware/performanceMonitor';

const prisma = new PrismaClient();

/**
 * Optimized query patterns for better performance
 * Provides helper functions to prevent N+1 queries and optimize data fetching
 */
export class OptimizedQueryService {
  /**
   * Get students with their checkout counts (avoids N+1)
   * Optimized: Single query with aggregation instead of multiple queries
   */
  public static async getStudentsWithCheckoutCounts() {
    return withQueryTracking(async () => {
      const cacheKey = 'students_with_counts';

      // Try cache first
      const cached = await CacheService.get('students', cacheKey);
      if (cached) {
        return cached;
      }

      // Optimized query: Get all students with their active checkout counts in one query
      const students = await prisma.students.findMany({
        select: {
          id: true,
          student_id: true,
          first_name: true,
          last_name: true,
          grade_level: true,
          barcode: true,
          is_active: true,
          _count: {
            select: {
              checkouts: {
                where: { status: 'ACTIVE' },
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      const result = students.map(student => ({
        ...student,
        active_checkouts: student._count.checkouts,
      }));

      // Cache for 2 minutes
      await CacheService.set('students', cacheKey, result, { ttl: 120 });

      return result;
    }, 'getStudentsWithCheckoutCounts')();
  }

  /**
   * Get books with availability status (avoids N+1)
   * Optimized: Single query with calculated fields
   */
  public static async getBooksWithAvailability() {
    return withQueryTracking(async () => {
      const cacheKey = 'books_with_availability';

      const cached = await CacheService.get('books', cacheKey);
      if (cached) {
        return cached;
      }

      // Optimized query: Get all books with active checkout counts
      const books = await prisma.books.findMany({
        select: {
          id: true,
          isbn: true,
          title: true,
          author: true,
          category: true,
          total_copies: true,
          available_copies: true,
          accession_no: true,
          _count: {
            select: {
              checkouts: {
                where: { status: 'ACTIVE' },
              },
            },
          },
        },
        where: { is_active: true },
        orderBy: { created_at: 'desc' },
      });

      const result = books.map(book => {
        const borrowed = book._count.checkouts;
        const available = book.total_copies - borrowed;

        return {
          ...book,
          borrowed_copies: borrowed,
          available_copies: available,
          availability_status: available > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK',
        };
      });

      await CacheService.set('books', cacheKey, result, { ttl: 120 });

      return result;
    }, 'getBooksWithAvailability')();
  }

  /**
   * Get popular books (most checked out)
   * Optimized: Aggregation query with proper indexing
   */
  public static async getPopularBooks(limit: number = 10) {
    return withQueryTracking(async () => {
      const cacheKey = `popular_books_${limit}`;

      const cached = await CacheService.get('analytics', cacheKey);
      if (cached) {
        return cached;
      }

      // Optimized aggregation query
      const popularBooks = await prisma.book_checkouts.groupBy({
        by: ['book_id'],
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: limit,
      });

      // Get book details for the popular books
      const bookIds = popularBooks.map(b => b.book_id);
      const books = await prisma.books.findMany({
        where: {
          id: { in: bookIds },
        },
        select: {
          id: true,
          title: true,
          author: true,
          category: true,
          accession_no: true,
        },
      });

      // Combine results
      const result = popularBooks
        .map(item => {
          const book = books.find(b => b.id === item.book_id);
          return {
            ...book,
            checkout_count: item._count.id,
          };
        })
        .filter(Boolean);

      // Cache for 5 minutes (popular books change less frequently)
      await CacheService.set('analytics', cacheKey, result, { ttl: 300 });

      return result;
    }, 'getPopularBooks')();
  }

  /**
   * Get overdue items with student information
   * Optimized: Single query with joins using indexes
   */
  public static async getOverdueItems() {
    return withQueryTracking(async () => {
      const cacheKey = 'overdue_items';

      const cached = await CacheService.get('borrows', cacheKey);
      if (cached) {
        return cached;
      }

      // Optimized query using indexes on status and due_date
      const overdue = await prisma.book_checkouts.findMany({
        where: {
          status: 'ACTIVE',
          due_date: {
            lt: new Date(),
          },
        },
        select: {
          id: true,
          checkout_date: true,
          due_date: true,
          fine_amount: true,
          book: {
            select: {
              id: true,
              title: true,
              author: true,
              accession_no: true,
            },
          },
          student: {
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
              grade_level: true,
            },
          },
        },
        orderBy: {
          due_date: 'asc',
        },
      });

      await CacheService.set('borrows', cacheKey, overdue, { ttl: 180 });

      return overdue;
    }, 'getOverdueItems')();
  }

  /**
   * Get equipment utilization stats
   * Optimized: Aggregation with indexes
   */
  public static async getEquipmentStats() {
    return withQueryTracking(async () => {
      const cacheKey = 'equipment_stats';

      const cached = await CacheService.get('equipment', cacheKey);
      if (cached) {
        return cached;
      }

      // Optimized aggregation query using indexes on status
      const [total, available, inUse, maintenance] = await Promise.all([
        prisma.equipment.count(),
        prisma.equipment.count({
          where: { status: 'AVAILABLE' },
        }),
        prisma.equipment.count({
          where: { status: 'IN_USE' },
        }),
        prisma.equipment.count({
          where: { status: 'MAINTENANCE' },
        }),
      ]);

      const result = {
        total,
        available,
        inUse,
        maintenance,
        utilization_rate: total > 0 ? ((inUse / total) * 100).toFixed(2) : '0',
      };

      await CacheService.set('equipment', cacheKey, result, { ttl: 300 });

      return result;
    }, 'getEquipmentStats')();
  }

  /**
   * Search students with optimized pagination
   * Optimized: Uses indexes on grade_level and created_at
   */
  public static async searchStudentsOptimized(
    query: string,
    gradeLevel?: number,
    page: number = 1,
    limit: number = 50,
  ) {
    const offset = (page - 1) * limit;

    // Build where clause with proper indexing
    const where: any = {
      is_active: true,
    };

    if (gradeLevel) {
      where.grade_level = gradeLevel;
    }

    if (query) {
      where.OR = [
        { first_name: { contains: query } },
        { last_name: { contains: query } },
        { student_id: { contains: query } },
        { barcode: { contains: query } },
      ];
    }

    // Optimized query with select
    const [students, total] = await Promise.all([
      prisma.students.findMany({
        where,
        select: {
          id: true,
          student_id: true,
          first_name: true,
          last_name: true,
          grade_level: true,
          section: true,
          barcode: true,
        },
        skip: offset,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.students.count({ where }),
    ]);

    return {
      students,
      total,
      page,
      limit,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Invalidate related caches when data changes
   */
  public static async invalidateRelatedCaches(
    entityType: 'student' | 'book' | 'equipment' | 'checkout',
  ) {
    const patterns: Array<{ namespace: string; pattern: string }> = [];

    switch (entityType) {
      case 'student':
        patterns.push(
          { namespace: 'students', pattern: '*' },
          { namespace: 'analytics', pattern: 'dashboard_*' },
          { namespace: 'borrows', pattern: 'overdue_items' },
        );
        break;
      case 'book':
        patterns.push(
          { namespace: 'books', pattern: '*' },
          { namespace: 'analytics', pattern: 'dashboard_*' },
          { namespace: 'analytics', pattern: 'popular_*' },
        );
        break;
      case 'equipment':
        patterns.push(
          { namespace: 'equipment', pattern: '*' },
          { namespace: 'analytics', pattern: 'dashboard_*' },
        );
        break;
      case 'checkout':
        patterns.push(
          { namespace: 'borrows', pattern: '*' },
          { namespace: 'analytics', pattern: 'dashboard_*' },
          { namespace: 'analytics', pattern: 'popular_*' },
        );
        break;
    }

    await CacheService.invalidate(patterns);
  }
}
