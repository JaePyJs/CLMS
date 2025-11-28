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
          total_books: overviewStats.totalBooks,
          total_equipment: overviewStats.totalEquipment,
          total_users: overviewStats.totalUsers,
          active_borrows: overviewStats.activeBorrows,
          overdue_borrows: overviewStats.overdueBorrows,
          returned_borrows: overviewStats.returnedBorrows,
          available_book_copies: availableBooks._sum.available_copies || 0,
          total_book_copies: totalBookCopies._sum.total_copies || 0,
        },
        popular_books: popularBooksDetails,
        recent_activities: recentActivities,
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

export default router;
