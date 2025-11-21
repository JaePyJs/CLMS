/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '../utils/logger';
import { CacheService } from './cacheService';
import { prisma } from '../utils/prisma';

export interface DashboardStats {
  students: {
    total: number;
    active: number;
    newThisMonth: number;
  };
  books: {
    total: number;
    available: number;
    checkedOut: number;
  };
  equipment: {
    total: number;
    available: number;
    inUse: number;
  };
  activity: {
    totalCheckouts: number;
    totalReturns: number;
    overdueItems: number;
  };
}

export interface CheckoutTrends {
  date: string;
  checkouts: number;
  returns: number;
  netChange: number;
}

export interface CategoryDistribution {
  category: string;
  count: number;
  percentage: number;
}

export interface MonthlyReport {
  month: string;
  year: number;
  totalCheckouts: number;
  totalReturns: number;
  newStudents: number;
  newBooks: number;
  overdueBooks: number;
  finesCollected: number;
}

export interface PopularItems {
  books: Array<{
    id: string;
    title: string;
    author: string;
    checkouts: number;
  }>;
  equipment: Array<{
    id: string;
    name: string;
    category: string;
    usage: number;
  }>;
}

export class AnalyticsService {
  /**
   * Get dashboard statistics overview
   * Cached for 60 seconds to improve performance
   */
  public static async getDashboardStats(): Promise<DashboardStats> {
    const cacheKey = `dashboard_${new Date().toISOString().substring(0, 10)}`;

    // Try to get from cache first
    const cached = await CacheService.get<DashboardStats>(
      'analytics',
      cacheKey,
    );
    if (cached) {
      logger.debug('Dashboard stats retrieved from cache');
      return cached;
    }

    // Cache miss - fetch from database
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Use Promise.all for parallel execution
      const [
        totalStudents,
        activeStudents,
        newStudentsThisMonth,
        totalBooks,
        availableBooksResult,
        checkedOutBooks,
        totalEquipment,
        availableEquipment,
        inUseEquipment,
        totalCheckouts,
        totalReturns,
        overdueItems,
      ] = await Promise.all([
        prisma.students.count(),
        prisma.students.count({
          where: { is_active: true },
        }),
        prisma.students.count({
          where: { created_at: { gte: startOfMonth } },
        }),
        prisma.books.count(),
        prisma.books.aggregate({
          _sum: { available_copies: true },
        }),
        prisma.book_checkouts.count({
          where: { status: 'ACTIVE' },
        }),
        prisma.equipment.count(),
        prisma.equipment.count({
          where: { status: 'AVAILABLE' },
        }),
        prisma.equipment.count({
          where: { status: 'IN_USE' },
        }),
        prisma.book_checkouts.count(),
        prisma.book_checkouts.count({
          where: { status: 'RETURNED' },
        }),
        prisma.book_checkouts.count({
          where: {
            status: 'ACTIVE',
            due_date: { lt: new Date() },
          },
        }),
      ]);

      const stats: DashboardStats = {
        students: {
          total: totalStudents,
          active: activeStudents,
          newThisMonth: newStudentsThisMonth,
        },
        books: {
          total: totalBooks,
          available: availableBooksResult._sum.available_copies || 0,
          checkedOut: checkedOutBooks,
        },
        equipment: {
          total: totalEquipment,
          available: availableEquipment,
          inUse: inUseEquipment,
        },
        activity: {
          totalCheckouts,
          totalReturns,
          overdueItems,
        },
      };

      // Store in cache for 60 seconds
      await CacheService.set('analytics', cacheKey, stats, { ttl: 60 });

      logger.info('Dashboard stats retrieved and cached', { cacheKey });

      return stats;
    } catch (error) {
      logger.error('Failed to get dashboard stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get checkout trends for a date range
   */
  public static async getCheckoutTrends(
    days: number = 30,
  ): Promise<CheckoutTrends[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get daily checkout and return counts
      const checkouts = await prisma.book_checkouts.findMany({
        where: {
          checkout_date: { gte: startDate },
        },
        select: {
          checkout_date: true,
          status: true,
        },
      });

      // Group by date
      const trendsMap = new Map<
        string,
        { checkouts: number; returns: number }
      >();

      for (let i = 0; i <= days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        trendsMap.set(dateStr, { checkouts: 0, returns: 0 });
      }

      checkouts.forEach(checkout => {
        const dateStr = checkout.checkout_date.toISOString().split('T')[0];
        const trend = trendsMap.get(dateStr);
        if (trend) {
          if (checkout.status === 'ACTIVE') {
            trend.checkouts++;
          } else if (checkout.status === 'RETURNED') {
            trend.returns++;
          }
        }
      });

      const trends: CheckoutTrends[] = Array.from(trendsMap.entries()).map(
        ([date, data]) => ({
          date,
          checkouts: data.checkouts,
          returns: data.returns,
          netChange: data.checkouts - data.returns,
        }),
      );

      return trends;
    } catch (error) {
      logger.error('Failed to get checkout trends', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get category distribution for books
   */
  public static async getCategoryDistribution(): Promise<
    CategoryDistribution[]
  > {
    try {
      const categories = await prisma.books.groupBy({
        by: ['category'],
        _count: {
          id: true,
        },
      });

      const totalBooks = categories.reduce(
        (sum, cat) => sum + cat._count.id,
        0,
      );

      const distribution: CategoryDistribution[] = categories.map(cat => ({
        category: cat.category || 'Uncategorized',
        count: cat._count.id,
        percentage:
          totalBooks > 0 ? Math.round((cat._count.id / totalBooks) * 100) : 0,
      }));

      return distribution.sort((a, b) => b.count - a.count);
    } catch (error) {
      logger.error('Failed to get category distribution', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get monthly report
   */
  public static async getMonthlyReport(
    month: number,
    year: number,
  ): Promise<MonthlyReport> {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const [
        totalCheckouts,
        totalReturns,
        newStudents,
        newBooks,
        overdueBooks,
        finesCollected,
      ] = await Promise.all([
        prisma.book_checkouts.count({
          where: {
            checkout_date: { gte: startDate, lte: endDate },
          },
        }),
        prisma.book_checkouts.count({
          where: {
            return_date: { gte: startDate, lte: endDate },
          },
        }),
        prisma.students.count({
          where: {
            created_at: { gte: startDate, lte: endDate },
          },
        }),
        prisma.books.count({
          where: {
            created_at: { gte: startDate, lte: endDate },
          },
        }),
        prisma.book_checkouts.count({
          where: {
            status: 'ACTIVE',
            due_date: { gte: startDate, lte: endDate },
          },
        }),
        prisma.book_checkouts.aggregate({
          where: {
            return_date: { gte: startDate, lte: endDate },
            fine_amount: { gt: 0 },
          },
          _sum: { fine_amount: true },
        }),
      ]);

      const report: MonthlyReport = {
        month: startDate.toLocaleString('default', { month: 'long' }),
        year,
        totalCheckouts,
        totalReturns,
        newStudents,
        newBooks,
        overdueBooks,
        finesCollected: finesCollected._sum.fine_amount || 0,
      };

      logger.info('Monthly report generated', { month, year });

      return report;
    } catch (error) {
      logger.error('Failed to generate monthly report', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get popular items
   */
  public static async getPopularItems(
    limit: number = 10,
  ): Promise<PopularItems> {
    try {
      // Get popular books
      const popularBooks = await prisma.book_checkouts.groupBy({
        by: ['book_id'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: limit,
      });

      const bookDetails = await prisma.books.findMany({
        where: {
          id: { in: popularBooks.map(pb => pb.book_id) },
        },
        select: { id: true, title: true, author: true },
      });

      const books = popularBooks.map(pb => {
        const details = bookDetails.find(b => b.id === pb.book_id);
        return {
          id: pb.book_id,
          title: details?.title || 'Unknown',
          author: details?.author || 'Unknown',
          checkouts: pb._count.id,
        };
      });

      // Get popular equipment (simplified)
      const equipment = await prisma.equipment.findMany({
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          name: true,
          category: true,
        },
      });

      const equipmentWithUsage = equipment.map(eq => ({
        id: eq.id,
        name: eq.name,
        category: eq.category || 'Uncategorized',
        usage: Math.floor(Math.random() * 50), // Placeholder - would track actual usage
      }));

      return { books, equipment: equipmentWithUsage };
    } catch (error) {
      logger.error('Failed to get popular items', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get student activity report
   */
  public static async getStudentActivity(studentId: string): Promise<any> {
    try {
      const student = await prisma.students.findUnique({
        where: { id: studentId },
        select: {
          id: true,
          student_id: true,
          first_name: true,
          last_name: true,
          grade_level: true,
          checkouts: {
            orderBy: { checkout_date: 'desc' },
            take: 50,
            include: {
              book: {
                select: {
                  title: true,
                  author: true,
                },
              },
            },
          },
        },
      });

      if (!student) {
        throw new Error('Student not found');
      }

      const totalCheckouts = student.checkouts.length;
      const activeCheckouts = student.checkouts.filter(
        c => c.status === 'ACTIVE',
      ).length;
      const returnedCheckouts = student.checkouts.filter(
        c => c.status === 'RETURNED',
      ).length;
      const overdueCheckouts = student.checkouts.filter(
        c => c.status === 'ACTIVE' && c.due_date < new Date(),
      ).length;

      return {
        student: {
          id: student.id,
          studentId: student.student_id,
          name: `${student.first_name} ${student.last_name}`,
          gradeLevel: student.grade_level,
        },
        statistics: {
          totalCheckouts,
          activeCheckouts,
          returnedCheckouts,
          overdueCheckouts,
        },
        recentActivity: student.checkouts.slice(0, 10).map(checkout => ({
          bookTitle: checkout.book.title,
          author: checkout.book.author,
          checkoutDate: checkout.checkout_date,
          dueDate: checkout.due_date,
          returnDate: checkout.return_date,
          status: checkout.status,
          fineAmount: checkout.fine_amount,
        })),
      };
    } catch (error) {
      logger.error('Failed to get student activity', {
        studentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Generate export data
   */
  public static async generateExportData(
    type: 'students' | 'books' | 'checkouts',
    filters: any = {},
  ): Promise<any[]> {
    try {
      let data: any[] = [];

      switch (type) {
        case 'students':
          data = await prisma.students.findMany({
            where: filters,
            orderBy: { created_at: 'desc' },
          });
          break;

        case 'books':
          data = await prisma.books.findMany({
            where: filters,
            orderBy: { created_at: 'desc' },
          });
          break;

        case 'checkouts':
          data = await prisma.book_checkouts.findMany({
            where: filters,
            include: {
              student: {
                select: { student_id: true, first_name: true, last_name: true },
              },
              book: {
                select: { title: true, author: true, isbn: true },
              },
            },
            orderBy: { checkout_date: 'desc' },
          });
          break;
      }

      logger.info('Export data generated', { type, count: data.length });

      return data;
    } catch (error) {
      logger.error('Failed to generate export data', {
        type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
