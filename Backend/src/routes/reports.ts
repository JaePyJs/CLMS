import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate as authenticateToken } from '../middleware/authenticate';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

// Helper function to get start and end of day
function getDayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// Helper function to get start and end of week (Monday-Sunday)
function getWeekBounds(date: Date): { start: Date; end: Date } {
  const current = new Date(date);
  const dayOfWeek = current.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const start = new Date(current);
  start.setDate(current.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

// Helper function to get start and end of month
function getMonthBounds(
  month: number,
  year: number,
): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

// Helper function to get top borrowers for a period
async function getTopBorrowers(
  startDate: Date,
  endDate: Date,
  limit: number = 5,
) {
  const topBorrowersAgg = await prisma.book_checkouts.groupBy({
    by: ['student_id'],
    where: {
      checkout_date: {
        gte: startDate,
        lte: endDate,
      },
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: limit,
  });

  return Promise.all(
    topBorrowersAgg.map(async row => {
      const student = await prisma.students.findUnique({
        where: { id: row.student_id },
        select: {
          student_id: true,
          first_name: true,
          last_name: true,
          grade_level: true,
        },
      });
      return {
        studentId: student?.student_id,
        name: `${student?.first_name ?? ''} ${student?.last_name ?? ''}`.trim(),
        gradeLevel: student?.grade_level,
        borrowCount: row._count.id,
      };
    }),
  );
}

// Helper function to get popular books for a period
async function getPopularBooks(
  startDate: Date,
  endDate: Date,
  limit: number = 5,
) {
  const popularBooksAgg = await prisma.book_checkouts.groupBy({
    by: ['book_id'],
    where: {
      checkout_date: {
        gte: startDate,
        lte: endDate,
      },
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: limit,
  });

  return Promise.all(
    popularBooksAgg.map(async row => {
      const book = await prisma.books.findUnique({
        where: { id: row.book_id },
        select: {
          title: true,
          author: true,
          accession_no: true,
          category: true,
        },
      });
      return {
        title: book?.title ?? 'Unknown',
        author: book?.author ?? 'Unknown',
        accessionNo: book?.accession_no,
        category: book?.category,
        checkoutCount: row._count.id,
      };
    }),
  );
}

// Helper function to get attendance statistics
async function getAttendanceStats(startDate: Date, endDate: Date) {
  const [totalVisits, uniqueVisitors, byGrade] = await Promise.all([
    prisma.student_activities.count({
      where: {
        start_time: { gte: startDate, lte: endDate },
        activity_type: { in: ['check_in', 'CHECKIN'] },
      },
    }),
    prisma.student_activities.groupBy({
      by: ['student_id'],
      where: {
        start_time: { gte: startDate, lte: endDate },
        activity_type: { in: ['check_in', 'CHECKIN'] },
      },
    }),
    prisma.$queryRaw`
      SELECT s.grade_level, COUNT(DISTINCT sa.student_id) as visitor_count
      FROM student_activities sa
      JOIN students s ON sa.student_id = s.id
      WHERE sa.start_time >= ${startDate} AND sa.start_time <= ${endDate}
      AND sa.activity_type IN ('check_in', 'CHECKIN')
      GROUP BY s.grade_level
      ORDER BY visitor_count DESC
    ` as Promise<Array<{ grade_level: string; visitor_count: bigint }>>,
  ]);

  return {
    totalVisits,
    uniqueVisitors: uniqueVisitors.length,
    byGrade: byGrade.map(g => ({
      gradeLevel: g.grade_level,
      visitorCount: Number(g.visitor_count),
    })),
  };
}

// GET /api/reports/daily - Daily report
router.get(
  '/daily',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const dateParam = req.query.date as string;
    const targetDate = dateParam ? new Date(dateParam) : new Date();

    if (isNaN(targetDate.getTime())) {
      res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD',
      });
      return;
    }

    const { start, end } = getDayBounds(targetDate);

    try {
      // Get checkout/return stats
      const [borrowStats, attendance, topBorrowers, popularBooks] =
        await Promise.all([
          prisma.book_checkouts.groupBy({
            by: ['status'],
            where: { checkout_date: { gte: start, lte: end } },
            _count: true,
          }),
          getAttendanceStats(start, end),
          getTopBorrowers(start, end, 5),
          getPopularBooks(start, end, 5),
        ]);

      const totalBorrowed =
        borrowStats.find(s => s.status === 'ACTIVE')?._count || 0;
      const totalReturned =
        borrowStats.find(s => s.status === 'RETURNED')?._count || 0;

      // Get fines collected today
      const finesCollected = await prisma.book_checkouts.aggregate({
        where: {
          updated_at: { gte: start, lte: end },
          fine_paid: true,
        },
        _sum: { fine_amount: true },
      });

      res.json({
        success: true,
        data: {
          date: targetDate.toISOString().split('T')[0],
          period: targetDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          statistics: {
            totalBorrowed,
            totalReturned,
            totalFines: finesCollected._sum.fine_amount || 0,
          },
          attendance,
          topBorrowers,
          popularBooks,
        },
      });
    } catch (error) {
      logger.error('Daily report error', { error, date: targetDate });
      res.status(500).json({
        success: false,
        error: 'Failed to generate daily report',
      });
    }
  }),
);

// GET /api/reports/weekly - Weekly report
router.get(
  '/weekly',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const dateParam = req.query.date as string;
    const targetDate = dateParam ? new Date(dateParam) : new Date();

    if (isNaN(targetDate.getTime())) {
      res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD',
      });
      return;
    }

    const { start, end } = getWeekBounds(targetDate);

    try {
      // Get daily breakdown for the week
      const dailyStats: Array<{
        date: string;
        borrowed: number;
        returned: number;
        visits: number;
      }> = [];

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayBounds = getDayBounds(new Date(d));

        const [borrowStats, visitCount] = await Promise.all([
          prisma.book_checkouts.groupBy({
            by: ['status'],
            where: {
              checkout_date: { gte: dayBounds.start, lte: dayBounds.end },
            },
            _count: true,
          }),
          prisma.student_activities.count({
            where: {
              start_time: { gte: dayBounds.start, lte: dayBounds.end },
              activity_type: { in: ['check_in', 'CHECKIN'] },
            },
          }),
        ]);

        dailyStats.push({
          date: new Date(d).toISOString().split('T')[0],
          borrowed: borrowStats.find(s => s.status === 'ACTIVE')?._count || 0,
          returned: borrowStats.find(s => s.status === 'RETURNED')?._count || 0,
          visits: visitCount,
        });
      }

      // Get weekly totals
      const [attendance, topBorrowers, popularBooks] = await Promise.all([
        getAttendanceStats(start, end),
        getTopBorrowers(start, end, 10),
        getPopularBooks(start, end, 10),
      ]);

      const totalBorrowed = dailyStats.reduce((sum, d) => sum + d.borrowed, 0);
      const totalReturned = dailyStats.reduce((sum, d) => sum + d.returned, 0);
      const totalVisits = dailyStats.reduce((sum, d) => sum + d.visits, 0);

      // Get fines collected this week
      const finesCollected = await prisma.book_checkouts.aggregate({
        where: {
          updated_at: { gte: start, lte: end },
          fine_paid: true,
        },
        _sum: { fine_amount: true },
      });

      res.json({
        success: true,
        data: {
          weekOf: start.toISOString().split('T')[0],
          period: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
          statistics: {
            totalBorrowed,
            totalReturned,
            totalVisits,
            totalFines: finesCollected._sum.fine_amount || 0,
          },
          dailyBreakdown: dailyStats,
          attendance,
          topBorrowers,
          popularBooks,
        },
      });
    } catch (error) {
      logger.error('Weekly report error', { error, date: targetDate });
      res.status(500).json({
        success: false,
        error: 'Failed to generate weekly report',
      });
    }
  }),
);

// GET /api/reports/monthly - Monthly report
router.get(
  '/monthly',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const month =
      parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    if (month < 1 || month > 12) {
      res.status(400).json({
        success: false,
        error: 'Month must be between 1 and 12',
      });
      return;
    }

    const { start, end } = getMonthBounds(month, year);

    try {
      // Get weekly breakdown for the month
      const weeklyStats: Array<{
        weekNumber: number;
        startDate: string;
        endDate: string;
        borrowed: number;
        returned: number;
        visits: number;
      }> = [];

      let weekNum = 1;
      const currentWeekStart = new Date(start);

      while (currentWeekStart <= end) {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        if (weekEnd > end) {
          weekEnd.setTime(end.getTime());
        }

        const [borrowStats, visitCount] = await Promise.all([
          prisma.book_checkouts.groupBy({
            by: ['status'],
            where: {
              checkout_date: {
                gte: currentWeekStart,
                lte: weekEnd,
              },
            },
            _count: true,
          }),
          prisma.student_activities.count({
            where: {
              start_time: { gte: currentWeekStart, lte: weekEnd },
              activity_type: { in: ['check_in', 'CHECKIN'] },
            },
          }),
        ]);

        weeklyStats.push({
          weekNumber: weekNum,
          startDate: currentWeekStart.toISOString().split('T')[0],
          endDate: weekEnd.toISOString().split('T')[0],
          borrowed: borrowStats.find(s => s.status === 'ACTIVE')?._count || 0,
          returned: borrowStats.find(s => s.status === 'RETURNED')?._count || 0,
          visits: visitCount,
        });

        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        weekNum++;
      }

      // Get monthly totals
      const [attendance, topBorrowers, popularBooks] = await Promise.all([
        getAttendanceStats(start, end),
        getTopBorrowers(start, end, 10),
        getPopularBooks(start, end, 10),
      ]);

      const totalBorrowed = weeklyStats.reduce((sum, w) => sum + w.borrowed, 0);
      const totalReturned = weeklyStats.reduce((sum, w) => sum + w.returned, 0);
      const totalVisits = weeklyStats.reduce((sum, w) => sum + w.visits, 0);

      // Get fines collected this month
      const finesCollected = await prisma.book_checkouts.aggregate({
        where: {
          updated_at: { gte: start, lte: end },
          fine_paid: true,
        },
        _sum: { fine_amount: true },
      });

      res.json({
        success: true,
        data: {
          month,
          year,
          monthName: start.toLocaleDateString('en-US', { month: 'long' }),
          period: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
          statistics: {
            totalBorrowed,
            totalReturned,
            totalVisits,
            totalFines: finesCollected._sum.fine_amount || 0,
          },
          weeklyBreakdown: weeklyStats,
          attendance,
          topBorrowers,
          popularBooks,
        },
      });
    } catch (error) {
      logger.error('Monthly report error', { error, month, year });
      res.status(500).json({
        success: false,
        error: 'Failed to generate monthly report',
      });
    }
  }),
);

// GET /api/reports/custom - Custom date range report
router.get(
  '/custom',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const startParam = req.query.start as string;
    const endParam = req.query.end as string;

    if (!startParam || !endParam) {
      res.status(400).json({
        success: false,
        error: 'Start and end dates are required',
      });
      return;
    }

    const startDate = new Date(startParam);
    const endDate = new Date(endParam);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD',
      });
      return;
    }

    if (startDate > endDate) {
      res.status(400).json({
        success: false,
        error: 'Start date must be before end date',
      });
      return;
    }

    // Set time bounds
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    // Limit range to 1 year
    const maxRange = 365 * 24 * 60 * 60 * 1000;
    if (endDate.getTime() - startDate.getTime() > maxRange) {
      res.status(400).json({
        success: false,
        error: 'Date range cannot exceed 1 year',
      });
      return;
    }

    try {
      // Get daily stats for the range (if small enough)
      const dayCount = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
      );

      const breakdown: Array<{
        date: string;
        borrowed: number;
        returned: number;
        visits: number;
      }> = [];

      // Only get daily breakdown if range is 31 days or less
      if (dayCount <= 31) {
        for (
          let d = new Date(startDate);
          d <= endDate;
          d.setDate(d.getDate() + 1)
        ) {
          const dayBounds = getDayBounds(new Date(d));

          const [borrowStats, visitCount] = await Promise.all([
            prisma.book_checkouts.groupBy({
              by: ['status'],
              where: {
                checkout_date: { gte: dayBounds.start, lte: dayBounds.end },
              },
              _count: true,
            }),
            prisma.student_activities.count({
              where: {
                start_time: { gte: dayBounds.start, lte: dayBounds.end },
                activity_type: { in: ['check_in', 'CHECKIN'] },
              },
            }),
          ]);

          breakdown.push({
            date: new Date(d).toISOString().split('T')[0],
            borrowed: borrowStats.find(s => s.status === 'ACTIVE')?._count || 0,
            returned:
              borrowStats.find(s => s.status === 'RETURNED')?._count || 0,
            visits: visitCount,
          });
        }
      }

      // Get totals
      const [borrowStats, attendance, topBorrowers, popularBooks] =
        await Promise.all([
          prisma.book_checkouts.groupBy({
            by: ['status'],
            where: { checkout_date: { gte: startDate, lte: endDate } },
            _count: true,
          }),
          getAttendanceStats(startDate, endDate),
          getTopBorrowers(startDate, endDate, 10),
          getPopularBooks(startDate, endDate, 10),
        ]);

      const totalBorrowed =
        borrowStats.find(s => s.status === 'ACTIVE')?._count || 0;
      const totalReturned =
        borrowStats.find(s => s.status === 'RETURNED')?._count || 0;

      // Get fines collected
      const finesCollected = await prisma.book_checkouts.aggregate({
        where: {
          updated_at: { gte: startDate, lte: endDate },
          fine_paid: true,
        },
        _sum: { fine_amount: true },
      });

      res.json({
        success: true,
        data: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          period: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
          dayCount,
          statistics: {
            totalBorrowed,
            totalReturned,
            totalVisits: attendance.totalVisits,
            totalFines: finesCollected._sum.fine_amount || 0,
          },
          dailyBreakdown: breakdown.length > 0 ? breakdown : undefined,
          attendance,
          topBorrowers,
          popularBooks,
        },
      });
    } catch (error) {
      logger.error('Custom report error', { error, startDate, endDate });
      res.status(500).json({
        success: false,
        error: 'Failed to generate custom report',
      });
    }
  }),
);

export default router;
