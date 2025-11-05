/* eslint-disable @typescript-eslint/no-explicit-any */
import * as express from 'express';
const router = express.Router();
type Request = express.Request;
type Response = express.Response;
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/authenticate';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/analytics/dashboard - Main dashboard statistics
router.get(
  '/dashboard',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Get dashboard analytics request', {
      userId: (req as any).user?.id,
    });

    try {
      // Get basic counts
      const [
        totalStudents,
        totalBooks,
        totalEquipment,
        totalUsers,
        activeBorrows,
        overdueBorrows,
        returnedBorrows,
      ] = await Promise.all([
        prisma.students.count({ where: { is_active: true } }),
        prisma.books.count({ where: { is_active: true } }),
        prisma.equipment.count({ where: { is_active: true } }),
        prisma.users.count({ where: { is_active: true } }),
        prisma.book_checkouts.count({ where: { status: 'ACTIVE' } }),
        prisma.book_checkouts.count({
          where: {
            status: 'ACTIVE',
            due_date: { lt: new Date() },
          },
        }),
        prisma.book_checkouts.count({ where: { status: 'RETURNED' } }),
      ]);

      // Get recent activities (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentActivities = await prisma.student_activities.findMany({
        where: {
          created_at: { gte: sevenDaysAgo },
        },
        orderBy: { created_at: 'desc' },
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

      res.json({
        success: true,
        data: {
          overview: {
            total_students: totalStudents,
            total_books: totalBooks,
            total_equipment: totalEquipment,
            total_users: totalUsers,
            active_borrows: activeBorrows,
            overdue_borrows: overdueBorrows,
            returned_borrows: returnedBorrows,
            available_book_copies: availableBooks._sum.available_copies || 0,
            total_book_copies: totalBookCopies._sum.total_copies || 0,
          },
          popular_books: popularBooksDetails,
          recent_activities: recentActivities,
          recent_borrows: recentBorrows,
          statistics: {
            overdue_rate:
              activeBorrows > 0
                ? ((overdueBorrows / activeBorrows) * 100).toFixed(2)
                : 0,
            return_rate:
              (
                (returnedBorrows / (activeBorrows + returnedBorrows)) *
                100
              ).toFixed(2) || 0,
          },
        },
      });
    } catch (error) {
      logger.error('Error retrieving dashboard analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
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

export default router;
