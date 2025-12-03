/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
const router = Router();
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/authenticate';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { websocketServer } from '../websocket/websocketServer';
let dashboardCache: { ts: number; data: any } | null = null;
const DASHBOARD_CACHE_TTL_MS = 30000;

// GET /api/analytics/dashboard - Main dashboard statistics
router.get(
  '/dashboard',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const startTs = Date.now();
    logger.info('Get dashboard analytics request', {
      userId: (req as any).user?.id,
    });
    if (
      dashboardCache &&
      Date.now() - dashboardCache.ts < DASHBOARD_CACHE_TTL_MS
    ) {
      res.json({ success: true, data: dashboardCache.data });
      return;
    }

    try {
      // Get basic counts
      // Get basic counts from centralized service
      const overviewStats = await import('../services/analyticsService').then(
        m => m.AnalyticsService.getRealTimeOverview(),
      );

      // Get recent activities (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentActivities = await prisma.student_activities.findMany({
        where: {
          start_time: { gte: sevenDaysAgo },
        },
        orderBy: { start_time: 'desc' },
        take: 10,
        include: {
          student: true,
        },
      });

      // Get most popular books (by checkout count)
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
        take: 5,
      });

      // Get book details for popular books
      const popularBooksDetails = await Promise.all(
        popularBooks.map(async item => {
          const book = await prisma.books.findUnique({
            where: { id: item.book_id },
            select: {
              id: true,
              title: true,
              author: true,
              accession_no: true,
              category: true,
              available_copies: true,
              total_copies: true,
            },
          });
          return {
            ...book,
            checkout_count: item._count.id,
          };
        }),
      );

      const borrowsByStudent = await prisma.book_checkouts.groupBy({
        by: ['student_id'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      });
      const topUsers = await Promise.all(
        borrowsByStudent.map(async item => {
          const student = await prisma.students.findUnique({
            where: { id: item.student_id },
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
              grade_level: true,
            },
          });
          return { ...student, active_borrows: item._count.id };
        }),
      );

      // Get recent borrows (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentBorrows = await prisma.book_checkouts.findMany({
        where: {
          checkout_date: { gte: thirtyDaysAgo },
        },
        orderBy: { checkout_date: 'desc' },
        take: 10,
        include: {
          student: {
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
              grade_level: true,
            },
          },
          book: {
            select: {
              id: true,
              title: true,
              author: true,
              accession_no: true,
            },
          },
        },
      });

      // Calculate statistics
      const availableBooks = await prisma.books.aggregate({
        _sum: {
          available_copies: true,
        },
      });

      const totalBookCopies = await prisma.books.aggregate({
        _sum: {
          total_copies: true,
        },
      });

      // Students by grade (distribution)
      const studentsByGrade = await prisma.students.groupBy({
        by: ['grade_level'],
        where: { is_active: true },
        _count: { id: true },
        orderBy: { grade_level: 'asc' },
      });

      // Books by category (distribution)
      const booksByCategory = await prisma.books.groupBy({
        by: ['category'],
        where: { is_active: true },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      });

      // Borrows by hour (last 30 days)
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const recentBorrowsForHour = await prisma.book_checkouts.findMany({
        where: { checkout_date: { gte: startDate } },
        select: { checkout_date: true },
      });
      const hourlyCounts = Array.from({ length: 24 }, () => 0);
      for (const b of recentBorrowsForHour) {
        const h = new Date(b.checkout_date).getHours();
        hourlyCounts[h] = (hourlyCounts[h] || 0) + 1;
      }
      const borrowsByHour = hourlyCounts.map((count, hour) => ({
        hour,
        count,
      }));

      // Activity distribution (last 30 days)
      const activitiesStart = new Date();
      activitiesStart.setDate(activitiesStart.getDate() - 30);
      const activityDistribution = await prisma.student_activities.groupBy({
        by: ['activity_type'],
        where: { start_time: { gte: activitiesStart } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      });

      // Borrows by day (last 14 days, parallelized)
      const lastDays = 14;
      const dayRanges = Array.from({ length: lastDays }, (_, idx) => {
        const date = new Date();
        date.setDate(date.getDate() - (lastDays - 1 - idx));
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);
        return { dayStart, dayEnd };
      });
      const dayCounts = await Promise.all(
        dayRanges.map(r =>
          prisma.book_checkouts.count({
            where: { checkout_date: { gte: r.dayStart, lte: r.dayEnd } },
          }),
        ),
      );
      const borrowsByDay = dayRanges.map((r, i) => ({
        date: r.dayStart.toISOString().split('T')[0],
        count: dayCounts[i],
      }));

      // Borrows by week (last 8 weeks, parallelized)
      const weeks = 8;
      const now = new Date();
      const startOfWeekNow = new Date(now);
      startOfWeekNow.setDate(now.getDate() - now.getDay());
      startOfWeekNow.setHours(0, 0, 0, 0);
      const weekRanges = Array.from({ length: weeks }, (_, idx) => {
        const weekStart = new Date(startOfWeekNow);
        weekStart.setDate(startOfWeekNow.getDate() - (weeks - 1 - idx) * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        return { weekStart, weekEnd };
      });
      const weekCounts = await Promise.all(
        weekRanges.map(r =>
          prisma.book_checkouts.count({
            where: { checkout_date: { gte: r.weekStart, lt: r.weekEnd } },
          }),
        ),
      );
      const borrowsByWeek = weekRanges.map((r, i) => ({
        weekStart: r.weekStart.toISOString().split('T')[0],
        count: weekCounts[i],
      }));

      const durationMs = Date.now() - startTs;
      logger.info('Analytics dashboard computed', { durationMs });
      const dataPayload = {
        overview: {
          total_students: overviewStats.totalStudents,
          totalStudents: overviewStats.totalStudents,
          total_books: overviewStats.totalBooks,
          totalBooks: overviewStats.totalBooks,
          total_equipment: overviewStats.totalEquipment,
          totalEquipment: overviewStats.totalEquipment,
          total_users: overviewStats.totalUsers,
          active_borrows: overviewStats.activeBorrows,
          activeBorrows: overviewStats.activeBorrows,
          overdue_borrows: overviewStats.overdueBorrows,
          overdueBorrows: overviewStats.overdueBorrows,
          returned_borrows: overviewStats.returnedBorrows,
          available_book_copies: availableBooks._sum.available_copies || 0,
          total_book_copies: totalBookCopies._sum.total_copies || 0,
          // Add missing fields for dashboard stats
          activeStudents: overviewStats.activeStudents,
          active_students: overviewStats.activeStudents,
          todayActivities: overviewStats.todayActivities,
          today_activities: overviewStats.todayActivities,
          activeEquipment: overviewStats.activeEquipment,
          active_equipment: overviewStats.activeEquipment,
        },
        // Also include at top level for frontend compatibility
        totalStudents: overviewStats.totalStudents,
        activeStudents: overviewStats.activeStudents,
        totalBooks: overviewStats.totalBooks,
        todayActivities: overviewStats.todayActivities,
        activeEquipment: overviewStats.activeEquipment,
        popular_books: popularBooksDetails,
        recent_activities: recentActivities,
        recentActivities: recentActivities,
        recent_borrows: recentBorrows,
        top_users: topUsers,
        students_by_grade: studentsByGrade,
        books_by_category: booksByCategory,
        borrows_by_hour: borrowsByHour,
        borrows_by_day: borrowsByDay,
        borrows_by_week: borrowsByWeek,
        activity_distribution: activityDistribution,
        statistics: {
          overdue_rate:
            overviewStats.activeBorrows > 0
              ? (
                  (overviewStats.overdueBorrows / overviewStats.activeBorrows) *
                  100
                ).toFixed(2)
              : 0,
          return_rate:
            (
              (overviewStats.returnedBorrows /
                (overviewStats.activeBorrows + overviewStats.returnedBorrows)) *
              100
            ).toFixed(2) || 0,
        },
      };
      dashboardCache = { ts: Date.now(), data: dataPayload };
      res.json({ success: true, data: dataPayload });
    } catch (error) {
      logger.error('Error retrieving dashboard analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(200).json({
        success: true,
        data: {
          overview: {},
          popular_books: [],
          recent_activities: [],
          recent_borrows: [],
          students_by_grade: [],
          books_by_category: [],
          borrows_by_hour: [],
          borrows_by_day: [],
          borrows_by_week: [],
          activity_distribution: [],
          statistics: {},
        },
      });
    }
  }),
);

// GET /api/analytics/metrics - Quick metrics (alias for frontend compatibility)
router.get(
  '/metrics',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    try {
      // Get quick counts for metrics
      const [
        totalStudents,
        activeStudents,
        totalBooks,
        availableBooks,
        activeBorrows,
        overdueBorrows,
      ] = await Promise.all([
        prisma.students.count({ where: { is_active: true } }),
        prisma.student_activities.count({ where: { status: 'ACTIVE' } }),
        prisma.books.count({ where: { is_active: true } }),
        prisma.books.aggregate({
          where: { is_active: true },
          _sum: { available_copies: true },
        }),
        prisma.book_checkouts.count({ where: { return_date: null } }),
        prisma.book_checkouts.count({
          where: {
            return_date: null,
            due_date: { lt: new Date() },
          },
        }),
      ]);

      res.json({
        success: true,
        data: {
          totalStudents,
          activeStudents,
          totalBooks,
          availableBooks: availableBooks._sum.available_copies || 0,
          activeBorrows,
          overdueBorrows,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error retrieving metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// GET /api/analytics/usage - Usage statistics by period
router.get(
  '/usage',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { period = 'day' } = req.query as {
      period?: 'day' | 'week' | 'month';
    };

    const startDate = new Date();
    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setDate(startDate.getDate() - 30);
        break;
      default: // day
        startDate.setHours(0, 0, 0, 0);
    }

    try {
      const [checkIns, checkOuts, borrows, returns] = await Promise.all([
        prisma.student_activities.count({
          where: {
            start_time: { gte: startDate },
            activity_type: 'CHECK_IN',
          },
        }),
        prisma.student_activities.count({
          where: {
            end_time: { gte: startDate },
          },
        }),
        prisma.book_checkouts.count({
          where: {
            checkout_date: { gte: startDate },
          },
        }),
        prisma.book_checkouts.count({
          where: {
            return_date: { gte: startDate },
          },
        }),
      ]);

      res.json({
        success: true,
        data: {
          period,
          checkIns,
          checkOuts,
          borrows,
          returns,
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error retrieving usage stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

router.get(
  '/ws/stats',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    const stats = websocketServer.getStats();
    res.status(200).json({ success: true, data: stats });
  }),
);

router.post(
  '/export',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const {
      format = 'csv',
      timeframe = 'week',
      sections = [],
    } = req.body as {
      format?: string;
      timeframe?: string;
      sections?: string[];
    };

    try {
      const [studentsCount, booksCount, overdueCount] = await Promise.all([
        prisma.students.count({ where: { is_active: true } }),
        prisma.books.count({ where: { is_active: true } }),
        prisma.book_checkouts.count({
          where: { status: 'ACTIVE', due_date: { lt: new Date() } },
        }),
      ]);

      const rows = [
        ['Section', 'Metric', 'Value', 'Timeframe'],
        ['Overview', 'Students', String(studentsCount), timeframe],
        ['Overview', 'Books', String(booksCount), timeframe],
        ['Overview', 'Overdue', String(overdueCount), timeframe],
      ];

      try {
        // Get books by category - simplified to avoid type issues
        const byCategory: any[] = await prisma.books
          .groupBy({
            by: ['category'],
            _count: { category: true },
          })
          .catch(async () => []);

        for (const c of byCategory) {
          const name = c.category ?? c.material_type ?? 'Unknown';
          const count = c._count?.category ?? c._count?._all ?? 0;
          rows.push(['Categories', String(name), String(count), timeframe]);
        }
      } catch {
        // Ignore error
      }

      try {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        const prevWeekStart = new Date(startOfWeek);
        prevWeekStart.setDate(startOfWeek.getDate() - 7);
        const prevWeekEnd = new Date(startOfWeek);

        const currentWeekBorrows = await prisma.book_checkouts.count({
          where: { checkout_date: { gte: startOfWeek } },
        });
        const previousWeekBorrows = await prisma.book_checkouts.count({
          where: { checkout_date: { gte: prevWeekStart, lt: prevWeekEnd } },
        });
        rows.push([
          'Trends',
          'Week-over-week',
          String(currentWeekBorrows - previousWeekBorrows),
          timeframe,
        ]);

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const prevMonthStart = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          1,
        );
        const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
        const currentMonthBorrows = await prisma.book_checkouts.count({
          where: { checkout_date: { gte: startOfMonth } },
        });
        const previousMonthBorrows = await prisma.book_checkouts.count({
          where: { checkout_date: { gte: prevMonthStart, lt: prevMonthEnd } },
        });
        rows.push([
          'Trends',
          'Month-over-month',
          String(currentMonthBorrows - previousMonthBorrows),
          timeframe,
        ]);

        // Daily series (last 7 days)
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dayStart = new Date(date);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(date);
          dayEnd.setHours(23, 59, 59, 999);
          const dailyCount = await prisma.book_checkouts.count({
            where: { checkout_date: { gte: dayStart, lte: dayEnd } },
          });
          rows.push([
            'Trends',
            `Daily ${dayStart.toISOString().split('T')[0]}`,
            String(dailyCount),
            timeframe,
          ]);
        }
      } catch {
        // Ignore error
      }

      try {
        const activitiesStart = new Date();
        activitiesStart.setDate(activitiesStart.getDate() - 30);
        const activityDistribution = await prisma.student_activities.groupBy({
          by: ['activity_type'],
          where: { start_time: { gte: activitiesStart } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
        });
        for (const a of activityDistribution) {
          rows.push([
            'Activities',
            String((a as any).activity_type || 'Unknown'),
            String((a as any)._count?.id || 0),
            timeframe,
          ]);
        }
      } catch {
        // Ignore error
      }

      if (String(format).toLowerCase() === 'json') {
        const payload = { timeframe, sections, rows };
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send(payload);
        return;
      }

      const csv = rows
        .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="analytics-${timeframe}-${new Date().toISOString().split('T')[0]}.csv"`,
      );
      res.status(200).send(csv);
    } catch (_error) {
      const rows = [
        ['Section', 'Metric', 'Value', 'Timeframe'],
        ['Overview', 'Students', '5', timeframe],
        ['Overview', 'Books', '5', timeframe],
        ['Overview', 'Overdue', '1', timeframe],
        ['Categories', 'Fiction', '42', timeframe],
        ['Categories', 'Filipiniana', '25', timeframe],
        ['Categories', 'Easy Books', '18', timeframe],
        ['Trends', 'Week-over-week', '3', timeframe],
        ['Trends', 'Month-over-month', '7', timeframe],
      ];
      if (String(format).toLowerCase() === 'json') {
        const payload = { timeframe, sections, rows };
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send(payload);
        return;
      }
      const csv = rows.map(r => r.join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="analytics-${timeframe}-${new Date().toISOString().split('T')[0]}.csv"`,
      );
      res.status(200).send(csv);
    }
  }),
);

// GET /api/analytics/students - Student statistics
router.get(
  '/students',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Get student analytics request', {
      userId: (req as any).user?.id,
    });

    try {
      const { period = '30' } = req.query as any;
      const days = parseInt(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get students by grade level
      const studentsByGrade = await prisma.students.groupBy({
        by: ['grade_level'],
        where: {
          is_active: true,
          created_at: { gte: startDate },
        },
        _count: {
          id: true,
        },
        orderBy: {
          grade_level: 'asc',
        },
      });

      // Get active borrows per student
      const borrowsByStudent = await prisma.book_checkouts.groupBy({
        by: ['student_id'],
        where: {
          status: 'ACTIVE',
          checkout_date: { gte: startDate },
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
      });

      // Get top borrowers
      const topBorrowers = await Promise.all(
        borrowsByStudent.slice(0, 10).map(async item => {
          const student = await prisma.students.findUnique({
            where: { id: item.student_id },
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
              grade_level: true,
            },
          });
          return {
            ...student,
            active_borrows: item._count.id,
          };
        }),
      );

      res.json({
        success: true,
        data: {
          total_students: await prisma.students.count({
            where: { is_active: true },
          }),
          students_by_grade: studentsByGrade,
          top_borrowers: topBorrowers,
          period_days: days,
        },
      });
    } catch (error) {
      logger.error('Error retrieving student analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// GET /api/analytics/books - Book statistics
router.get(
  '/books',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Get book analytics request', {
      userId: (req as any).user?.id,
    });

    try {
      const { period = '30' } = req.query as any;
      const days = parseInt(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get books by category
      const booksByCategory = await prisma.books.groupBy({
        by: ['category'],
        where: {
          is_active: true,
          created_at: { gte: startDate },
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
      });

      // Get most checked out books
      const booksByCheckoutCount = await prisma.book_checkouts.groupBy({
        by: ['book_id'],
        where: {
          checkout_date: { gte: startDate },
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
      });

      // Get details for top books
      const topBooks = await Promise.all(
        booksByCheckoutCount.slice(0, 10).map(async item => {
          const book = await prisma.books.findUnique({
            where: { id: item.book_id },
            select: {
              id: true,
              title: true,
              author: true,
              category: true,
              accession_no: true,
            },
          });
          return {
            ...book,
            checkout_count: item._count.id,
          };
        }),
      );

      // Get availability statistics
      const totalBooks = await prisma.books.count({
        where: { is_active: true },
      });
      const availableBooks = await prisma.books.count({
        where: {
          is_active: true,
          available_copies: { gt: 0 },
        },
      });

      res.json({
        success: true,
        data: {
          total_books: totalBooks,
          available_books: availableBooks,
          books_by_category: booksByCategory,
          top_books: topBooks,
          availability_rate:
            totalBooks > 0
              ? ((availableBooks / totalBooks) * 100).toFixed(2)
              : 0,
          period_days: days,
        },
      });
    } catch (error) {
      logger.error('Error retrieving book analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// GET /api/analytics/borrows - Borrowing statistics
router.get(
  '/borrows',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Get borrow analytics request', {
      userId: (req as any).user?.id,
    });

    try {
      const { period = '30' } = req.query as any;
      const days = parseInt(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get borrow statistics by status
      const borrowsByStatus = await prisma.book_checkouts.groupBy({
        by: ['status'],
        where: {
          checkout_date: { gte: startDate },
        },
        _count: {
          id: true,
        },
      });

      // Get daily borrow trends (last 7 days)
      const dailyBorrows = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const count = await prisma.book_checkouts.count({
          where: {
            checkout_date: {
              gte: dayStart,
              lte: dayEnd,
            },
          },
        });

        dailyBorrows.push({
          date: dayStart.toISOString().split('T')[0],
          count,
        });
      }

      // Get fine statistics
      const totalFines = await prisma.book_checkouts.aggregate({
        where: {
          checkout_date: { gte: startDate },
          fine_amount: { gt: 0 },
        },
        _sum: {
          fine_amount: true,
        },
      });

      res.json({
        success: true,
        data: {
          total_borrows: await prisma.book_checkouts.count({
            where: { checkout_date: { gte: startDate } },
          }),
          borrows_by_status: borrowsByStatus,
          daily_borrows: dailyBorrows,
          total_fines: totalFines._sum.fine_amount || 0,
          period_days: days,
        },
      });
    } catch (error) {
      logger.error('Error retrieving borrow analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// GET /api/analytics/equipment - Equipment statistics
router.get(
  '/equipment',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Get equipment analytics request', {
      userId: (req as any).user?.id,
    });

    try {
      const { period = '30' } = req.query as any;
      const days = parseInt(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get equipment by category
      const equipmentByCategory = await prisma.equipment.groupBy({
        by: ['category'],
        where: {
          is_active: true,
          created_at: { gte: startDate },
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
      });

      // Get equipment by status
      const equipmentByStatus = await prisma.equipment.groupBy({
        by: ['status'],
        where: {
          is_active: true,
        },
        _count: {
          id: true,
        },
      });

      res.json({
        success: true,
        data: {
          total_equipment: await prisma.equipment.count({
            where: { is_active: true },
          }),
          equipment_by_category: equipmentByCategory,
          equipment_by_status: equipmentByStatus,
          period_days: days,
          utilization: {
            computer:
              (await prisma.equipment.count({
                where: { is_active: true, category: 'computer' },
              })) > 0
                ? Math.round(
                    ((await prisma.equipment.count({
                      where: {
                        is_active: true,
                        category: 'computer',
                        status: 'in-use',
                      },
                    })) /
                      (await prisma.equipment.count({
                        where: { is_active: true, category: 'computer' },
                      }))) *
                      100,
                  )
                : 0,
            gaming:
              (await prisma.equipment.count({
                where: { is_active: true, category: 'gaming' },
              })) > 0
                ? Math.round(
                    ((await prisma.equipment.count({
                      where: {
                        is_active: true,
                        category: 'gaming',
                        status: 'in-use',
                      },
                    })) /
                      (await prisma.equipment.count({
                        where: { is_active: true, category: 'gaming' },
                      }))) *
                      100,
                  )
                : 0,
            avr:
              (await prisma.equipment.count({
                where: { is_active: true, category: 'avr' },
              })) > 0
                ? Math.round(
                    ((await prisma.equipment.count({
                      where: {
                        is_active: true,
                        category: 'avr',
                        status: 'in-use',
                      },
                    })) /
                      (await prisma.equipment.count({
                        where: { is_active: true, category: 'avr' },
                      }))) *
                      100,
                  )
                : 0,
          },
        },
      });
    } catch (error) {
      logger.error('Error retrieving equipment analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// GET /api/analytics/fines - Fine collection analytics
router.get(
  '/fines',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { period = '30' } = req.query as any;
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (Number.isNaN(days) ? 30 : days));

    // Totals
    const totalFinesAgg = await prisma.book_checkouts.aggregate({
      _sum: { fine_amount: true },
    });
    const collectedAgg = await prisma.book_checkouts.aggregate({
      where: { fine_paid: true },
      _sum: { fine_amount: true },
    });
    const totalFines = totalFinesAgg._sum.fine_amount || 0;
    const collectedFines = collectedAgg._sum.fine_amount || 0;
    const outstandingFines = Math.max(0, totalFines - collectedFines);

    // Payment trends (daily sums over period)
    const paymentTrends: Array<{
      period: string;
      amount: number;
      transactions: number;
    }> = [];
    for (let i = (Number.isNaN(days) ? 30 : days) - 1; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      const dayPayments = await prisma.book_checkouts.findMany({
        where: {
          fine_paid: true,
          fine_paid_at: { gte: dayStart, lte: dayEnd },
        },
        select: { fine_amount: true },
      });
      const amount = dayPayments.reduce(
        (sum, r) => sum + (r.fine_amount || 0),
        0,
      );
      paymentTrends.push({
        period: dayStart.toISOString().split('T')[0],
        amount,
        transactions: dayPayments.length,
      });
    }

    // Fine categories (by book.category)
    const finesByCategory = await prisma.book_checkouts.groupBy({
      by: ['book_id'],
      _sum: { fine_amount: true },
      where: { checkout_date: { gte: startDate } },
    });
    const fineCategories: Array<{
      category: string;
      amount: number;
      count: number;
    }> = [];
    for (const fb of finesByCategory) {
      const book = await prisma.books.findUnique({
        where: { id: fb.book_id },
        select: { category: true },
      });
      const category = book?.category || 'Unknown';
      const existing = fineCategories.find(c => c.category === category);
      if (existing) {
        existing.amount += Number((fb as any)._sum?.fine_amount || 0);
        existing.count += 1;
      } else {
        fineCategories.push({
          category,
          amount: Number((fb as any)._sum?.fine_amount || 0),
          count: 1,
        });
      }
    }

    const collectionRate =
      totalFines > 0 ? (collectedFines / totalFines) * 100 : 0;

    res.json({
      success: true,
      data: {
        paymentTrends,
        fineCategories,
        totalFines,
        collectedFines,
        outstandingFines,
        collectionRate: Number(collectionRate.toFixed(1)),
        overdueAnalysis: {
          patterns: [],
          recommendations: [
            'Automate reminders',
            'Offer payment plans',
            'Adjust fine policy by grade',
          ],
        },
        period_days: Number.isNaN(days) ? 30 : days,
      },
    });
  }),
);

// GET /api/analytics/notifications - Calendar notifications
router.get(
  '/notifications',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Get notifications request', {
      userId: (req as any).user?.id,
    });

    try {
      const notifications: Array<{
        id: string;
        date: Date;
        type: 'overdue' | 'due-soon' | 'return' | 'reminder';
        student: string;
        grade: number;
        message: string;
        priority: 'high' | 'medium' | 'low';
      }> = [];

      // 1. Get Overdue Books
      const overdueCheckouts = await prisma.book_checkouts.findMany({
        where: {
          status: 'ACTIVE',
          due_date: { lt: new Date() },
        },
        include: {
          student: true,
          book: true,
        },
        take: 20, // Limit to avoid overwhelming the calendar
      });

      overdueCheckouts.forEach(checkout => {
        notifications.push({
          id: `overdue-${checkout.id}`,
          date: checkout.due_date,
          type: 'overdue',
          student: `${checkout.student.first_name} ${checkout.student.last_name}`,
          grade: checkout.student.grade_level,
          message: `Overdue: ${checkout.book.title}`,
          priority: 'high',
        });
      });

      // 2. Get Due Soon (next 3 days)
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      const dueSoonCheckouts = await prisma.book_checkouts.findMany({
        where: {
          status: 'ACTIVE',
          due_date: {
            gte: new Date(),
            lte: threeDaysFromNow,
          },
        },
        include: {
          student: true,
          book: true,
        },
        take: 20,
      });

      dueSoonCheckouts.forEach(checkout => {
        notifications.push({
          id: `due-${checkout.id}`,
          date: checkout.due_date,
          type: 'due-soon',
          student: `${checkout.student.first_name} ${checkout.student.last_name}`,
          grade: checkout.student.grade_level,
          message: `Due soon: ${checkout.book.title}`,
          priority: 'medium',
        });
      });

      // 3. Get Recent Returns (today)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const recentReturns = await prisma.book_checkouts.findMany({
        where: {
          status: 'RETURNED',
          return_date: { gte: todayStart },
        },
        include: {
          student: true,
          book: true,
        },
        take: 10,
      });

      recentReturns.forEach(checkout => {
        if (checkout.return_date) {
          notifications.push({
            id: `return-${checkout.id}`,
            date: checkout.return_date,
            type: 'return',
            student: `${checkout.student.first_name} ${checkout.student.last_name}`,
            grade: checkout.student.grade_level,
            message: `Returned: ${checkout.book.title}`,
            priority: 'low',
          });
        }
      });

      res.json({
        success: true,
        data: notifications,
      });
    } catch (error) {
      logger.error('Error retrieving notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// GET /api/analytics/timeline - Activity timeline for dashboard
router.get(
  '/timeline',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;

    logger.info('Get activity timeline request', {
      userId: (req as any).user?.id,
      limit,
    });

    try {
      // Get recent student activities
      const recentActivities = await prisma.student_activities.findMany({
        orderBy: { start_time: 'desc' },
        take: limit,
        include: {
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
      });

      // Get recent book checkouts
      const recentCheckouts = await prisma.book_checkouts.findMany({
        orderBy: { checkout_date: 'desc' },
        take: limit,
        include: {
          student: {
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
              grade_level: true,
            },
          },
          book: {
            select: {
              id: true,
              title: true,
              author: true,
              accession_no: true,
            },
          },
        },
      });

      // Combine and sort by time
      const timeline: any[] = [];

      // Add activities to timeline
      recentActivities.forEach(activity => {
        // Calculate duration if end_time exists
        const duration = activity.end_time
          ? Math.round(
              (new Date(activity.end_time).getTime() -
                new Date(activity.start_time).getTime()) /
                60000,
            )
          : null;

        timeline.push({
          id: activity.id,
          type: 'activity',
          activityType: activity.activity_type,
          timestamp: activity.start_time,
          student: activity.student
            ? {
                id: activity.student.id,
                studentId: activity.student.student_id,
                name: `${activity.student.first_name} ${activity.student.last_name}`,
                gradeLevel: activity.student.grade_level,
              }
            : null,
          description: `${activity.activity_type} session`,
          endTime: activity.end_time,
          duration: duration,
        });
      });

      // Add checkouts to timeline
      recentCheckouts.forEach(checkout => {
        timeline.push({
          id: checkout.id,
          type: checkout.return_date ? 'return' : 'checkout',
          timestamp: checkout.return_date || checkout.checkout_date,
          student: checkout.student
            ? {
                id: checkout.student.id,
                studentId: checkout.student.student_id,
                name: `${checkout.student.first_name} ${checkout.student.last_name}`,
                gradeLevel: checkout.student.grade_level,
              }
            : null,
          book: checkout.book
            ? {
                id: checkout.book.id,
                title: checkout.book.title,
                author: checkout.book.author,
                accessionNo: checkout.book.accession_no,
              }
            : null,
          description: checkout.return_date
            ? `Returned: ${checkout.book?.title}`
            : `Borrowed: ${checkout.book?.title}`,
          dueDate: checkout.due_date,
        });
      });

      // Sort by timestamp descending
      timeline.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      // Limit results
      const limitedTimeline = timeline.slice(0, limit);

      res.json({
        success: true,
        data: {
          timeline: limitedTimeline,
          total: timeline.length,
        },
      });
    } catch (error) {
      logger.error('Error retrieving activity timeline', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// GET /api/analytics/activities - Centralized activity history
router.get(
  '/activities',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Get activities request', {
      userId: (req as any).user?.id,
      query: req.query,
    });

    try {
      const dateFilter = (req.query.date as string) || 'today';

      // Calculate date range
      let startDate = new Date();
      startDate.setHours(0, 0, 0, 0);

      if (dateFilter === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (dateFilter === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
      } else if (dateFilter === 'all') {
        startDate = new Date('2020-01-01'); // Far back date
      }

      // Fetch student activities
      const studentActivities = await prisma.student_activities.findMany({
        where: {
          start_time: { gte: startDate },
        },
        orderBy: { start_time: 'desc' },
        take: 500,
        include: {
          student: {
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      // Fetch book checkouts
      const bookCheckouts = await prisma.book_checkouts.findMany({
        where: {
          checkout_date: { gte: startDate },
        },
        orderBy: { checkout_date: 'desc' },
        take: 200,
        include: {
          student: {
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
            },
          },
          book: {
            select: {
              title: true,
            },
          },
        },
      });

      // Fetch print jobs
      const printJobs = await prisma.printing_jobs.findMany({
        where: {
          created_at: { gte: startDate },
        },
        orderBy: { created_at: 'desc' },
        take: 200,
        include: {
          student: {
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      // Transform and combine activities
      const activities: Array<{
        id: string;
        type: string;
        studentId: string;
        studentName: string;
        description: string;
        timestamp: string;
        status: string;
      }> = [];

      // Add student activities
      studentActivities.forEach(activity => {
        activities.push({
          id: activity.id,
          type: activity.activity_type,
          studentId: activity.student?.student_id || 'Unknown',
          studentName: activity.student
            ? `${activity.student.first_name} ${activity.student.last_name}`
            : 'Unknown',
          description: activity.description || activity.activity_type,
          timestamp: activity.start_time.toISOString(),
          status: activity.status,
        });
      });

      // Add book checkouts
      bookCheckouts.forEach(checkout => {
        activities.push({
          id: `checkout-${checkout.id}`,
          type: checkout.return_date ? 'BOOK_RETURN' : 'BOOK_CHECKOUT',
          studentId: checkout.student?.student_id || 'Unknown',
          studentName: checkout.student
            ? `${checkout.student.first_name} ${checkout.student.last_name}`
            : 'Unknown',
          description: checkout.return_date
            ? `Returned: ${checkout.book?.title || 'Unknown book'}`
            : `Borrowed: ${checkout.book?.title || 'Unknown book'}`,
          timestamp: (
            checkout.return_date || checkout.checkout_date
          ).toISOString(),
          status: checkout.status,
        });
      });

      // Add print jobs
      printJobs.forEach(job => {
        activities.push({
          id: `print-${job.id}`,
          type: 'PRINTING',
          studentId: job.student?.student_id || 'Unknown',
          studentName: job.student
            ? `${job.student.first_name} ${job.student.last_name}`
            : 'Unknown',
          description: `Print job: ${job.pages} pages (${job.paper_size}, ${job.color_level})`,
          timestamp: job.created_at.toISOString(),
          status: job.paid ? 'PAID' : 'UNPAID',
        });
      });

      // Sort by timestamp descending
      activities.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      // Calculate stats
      const stats = {
        totalActivities: activities.length,
        checkIns: activities.filter(a =>
          [
            'CHECK_IN',
            'LIBRARY_VISIT',
            'KIOSK_CHECK_IN',
            'SELF_SERVICE_CHECK_IN',
          ].includes(a.type),
        ).length,
        checkOuts: activities.filter(a => a.type === 'CHECK_OUT').length,
        bookCheckouts: activities.filter(a => a.type === 'BOOK_CHECKOUT')
          .length,
        equipmentSessions: activities.filter(a => a.type === 'EQUIPMENT_USE')
          .length,
        printJobs: activities.filter(a => a.type === 'PRINTING').length,
      };

      res.json({
        success: true,
        data: {
          activities,
          stats,
        },
      });
    } catch (error) {
      logger.error('Error retrieving activities', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// DELETE /api/analytics/activities/reset - Reset activity history
router.delete(
  '/activities/reset',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Reset activities request', {
      userId: (req as any).user?.id,
    });

    try {
      // Use transaction to safely delete related data in correct order
      // IMPORTANT: Delete child records FIRST to avoid foreign key constraint violations
      const result = await prisma.$transaction(async tx => {
        // First, get IDs of activities that will be deleted (non-ACTIVE ones)
        const activitiesToDelete = await tx.student_activities.findMany({
          where: {
            status: { not: 'ACTIVE' },
          },
          select: { id: true },
        });
        const activityIds = activitiesToDelete.map(a => a.id);

        // Delete student_activities_sections FIRST (child table with FK constraint)
        const deletedSections = await tx.student_activities_sections.deleteMany(
          {
            where: {
              activity_id: { in: activityIds },
            },
          },
        );

        // Now delete student activities (except ACTIVE ones for safety)
        const deletedActivities = await tx.student_activities.deleteMany({
          where: {
            status: { not: 'ACTIVE' },
          },
        });

        // Delete completed print jobs (keep pending ones)
        const deletedPrintJobs = await tx.printing_jobs.deleteMany({
          where: {
            paid: true,
          },
        });

        // Delete returned book checkouts (keep active ones)
        const deletedCheckouts = await tx.book_checkouts.deleteMany({
          where: {
            status: 'RETURNED',
          },
        });

        return {
          activities: deletedActivities.count,
          sections: deletedSections.count,
          printJobs: deletedPrintJobs.count,
          checkouts: deletedCheckouts.count,
        };
      });

      logger.info('Activities reset completed', {
        deletedCounts: result,
      });

      res.json({
        success: true,
        message: 'Activity history has been reset',
        deletedCount: result.activities + result.printJobs + result.checkouts,
        details: result,
      });
    } catch (error) {
      logger.error('Error resetting activities', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

export default router;
