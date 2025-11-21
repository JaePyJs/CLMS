/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, requireRole } from '../middleware/authenticate';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { BorrowingPolicyService } from '../services/borrowingPolicyService';
import { FineCalculationService } from '../services/fineCalculationService';
import websocketServer from '../websocket/websocketServer';
const router = Router();

// GET /api/borrows
router.get(
  '/',
  authenticate,
  requireRole(['LIBRARIAN', 'ADMIN']),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Get borrows request', {
      query: req.query,
      userId: (req as any).user?.id,
    });

    try {
      const {
        page = 1,
        limit = 10,
        status,
        search,
        sortBy = 'checkout_date',
        sortOrder = 'desc',
      } = req.query as any;

      const where: any = {};

      if (status) {
        where.status = status;
      }

      if (search) {
        where.OR = [
          {
            student: { student_id: { contains: search, mode: 'insensitive' } },
          },
          {
            student: { first_name: { contains: search, mode: 'insensitive' } },
          },
          { student: { last_name: { contains: search, mode: 'insensitive' } } },
          { book: { title: { contains: search, mode: 'insensitive' } } },
          { book: { author: { contains: search, mode: 'insensitive' } } },
          { book: { accession_no: { contains: search, mode: 'insensitive' } } },
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const total = await prisma.book_checkouts.count({ where });

      const orderBy: any = {};
      orderBy[sortBy] = sortOrder;

      const borrows = await prisma.book_checkouts.findMany({
        where,
        orderBy,
        skip,
        take: parseInt(limit),
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
              category: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: borrows,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      logger.error('Error retrieving borrows', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// GET /api/borrows/overdue - List overdue books (placed before /:id to avoid param capture)
router.get(
  '/list/overdue',
  authenticate,
  requireRole(['LIBRARIAN', 'ADMIN']),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Get overdue borrows request', {
      userId: (req as any).user?.id,
    });

    try {
      const today = new Date();

      const overdueBorrows = await prisma.book_checkouts.findMany({
        where: {
          status: 'ACTIVE',
          due_date: { lt: today },
        },
        include: {
          student: {
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
              grade_level: true,
              email: true,
            },
          },
          book: {
            select: {
              id: true,
              title: true,
              author: true,
              accession_no: true,
              category: true,
            },
          },
        },
        orderBy: { due_date: 'asc' },
      });

      const overdueWithDays = await Promise.all(
        overdueBorrows.map(async borrow => {
          const daysOverdue = Math.ceil(
            (today.getTime() - borrow.due_date.getTime()) /
              (1000 * 60 * 60 * 24),
          );
          let rate = 0;
          try {
            rate = await FineCalculationService.getRateForGrade(
              borrow.student.grade_level,
            );
          } catch {
            // Ignore error
          }
          const fineAmount = daysOverdue * rate;
          return {
            ...borrow,
            days_overdue: daysOverdue,
            fine_amount: fineAmount,
          };
        }),
      );

      res.json({
        success: true,
        data: overdueWithDays,
        count: overdueWithDays.length,
      });
    } catch (error) {
      logger.error('Error retrieving overdue borrows', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// POST /api/borrows/dev/seed/overdue - Seed a controlled overdue borrow (development only)
router.post(
  '/dev/seed/overdue',
  authenticate,
  requireRole(['LIBRARIAN', 'ADMIN']),
  asyncHandler(async (req: Request, res: Response) => {
    if (process.env.NODE_ENV !== 'development') {
      return res
        .status(403)
        .json({ success: false, message: 'Not allowed outside development' });
    }

    try {
      const { student_id, book_id, days_overdue = 3 } = req.body;

      let student = null as any;
      let book = null as any;

      if (student_id) {
        student = await prisma.students.findUnique({
          where: { id: String(student_id) },
        });
      }
      if (!student) {
        student = await prisma.students.findFirst();
      }
      if (!student) {
        student = await prisma.students.create({
          data: {
            student_id: `DEV-${Date.now()}`,
            first_name: 'Dev',
            last_name: 'Student',
            grade_level: 10,
          },
        });
      }

      if (book_id) {
        book = await prisma.books.findUnique({
          where: { id: String(book_id) },
        });
      }
      if (!book) {
        book = await prisma.books.findFirst({
          where: { available_copies: { gt: 0 } },
        });
      }
      if (!book) {
        book = await prisma.books.create({
          data: {
            title: 'Dev Overdue Sample',
            author: 'System',
            category: 'General',
            accession_no: `ACC-${Date.now()}`,
            total_copies: 1,
            available_copies: 1,
          },
        });
      }

      const checkoutDate = new Date();
      const dueDate = new Date(
        checkoutDate.getTime() -
          Math.max(1, Number(days_overdue)) * 24 * 60 * 60 * 1000,
      );

      const existingActive = await prisma.book_checkouts.findFirst({
        where: { student_id: student.id, book_id: book.id, status: 'ACTIVE' },
      });
      if (existingActive) {
        return res.status(200).json({ success: true, data: existingActive });
      }

      const borrow = await prisma.book_checkouts.create({
        data: {
          student_id: student.id,
          book_id: book.id,
          checkout_date: checkoutDate,
          due_date: dueDate,
          status: 'ACTIVE',
        },
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
              category: true,
            },
          },
        },
      });

      await prisma.books.update({
        where: { id: book.id },
        data: {
          available_copies: Math.max(0, (book.available_copies ?? 0) - 1),
        },
      });

      websocketServer.emitBorrowReturnUpdate({
        type: 'checkout',
        studentId: borrow.student_id,
        bookId: borrow.book_id,
        dueDate: borrow.due_date.toISOString(),
        fineAmount: 0,
        status: 'ACTIVE',
      });

      res.status(201).json({ success: true, data: borrow });
    } catch (error) {
      logger.error('Error seeding overdue borrow', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// GET /api/borrows/:id
router.get(
  '/:id',
  authenticate,
  requireRole(['LIBRARIAN', 'ADMIN']),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Get borrow by ID request', {
      borrowId: req.params['id'],
      userId: (req as any).user?.id,
    });

    try {
      const borrow = await prisma.book_checkouts.findUnique({
        where: { id: req.params['id'] },
        include: {
          student: {
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
              grade_level: true,
              email: true,
            },
          },
          book: {
            select: {
              id: true,
              title: true,
              author: true,
              accession_no: true,
              category: true,
              isbn: true,
              publisher: true,
            },
          },
        },
      });

      if (!borrow) {
        return res.status(404).json({
          success: false,
          message: 'Borrow record not found',
        });
      }

      res.json({
        success: true,
        data: borrow,
      });
    } catch (error) {
      logger.error('Error retrieving borrow', {
        borrowId: req.params['id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// POST /api/borrows - Checkout a book
router.post(
  '/',
  authenticate,
  requireRole(['LIBRARIAN', 'ADMIN']),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Create borrow request', {
      studentId: req.body.student_id,
      bookId: req.body.book_id,
      createdBy: (req as any).user?.id,
    });

    try {
      const {
        student_id,
        book_id,
        due_date,
        material_name,
        material_type,
        accession_no,
      } = req.body;

      // Check if student exists
      const student = await prisma.students.findUnique({
        where: { id: student_id },
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: 'Student not found',
        });
      }

      // Resolve book: either by provided book_id or manual material fields
      let book = book_id
        ? await prisma.books.findUnique({ where: { id: book_id } })
        : null;

      if (!book && !book_id && (material_name || accession_no)) {
        const categoryFromType = (material_type || 'General').trim();
        const existingByAccession = accession_no
          ? await prisma.books.findFirst({ where: { accession_no } })
          : null;
        if (existingByAccession) {
          book = existingByAccession;
        } else {
          book = await prisma.books.create({
            data: {
              title: material_name || 'Untitled Material',
              author: 'Unknown',
              category: categoryFromType,
              accession_no: accession_no || `ACC-${Date.now()}`,
              total_copies: 1,
              available_copies: 1,
            },
          });
        }
      }

      if (!book) {
        return res.status(404).json({
          success: false,
          message: 'Book not found',
        });
      }

      if (book.available_copies <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Book is not available',
        });
      }

      // Check if student already has this book checked out
      const existingBorrow = await prisma.book_checkouts.findFirst({
        where: {
          student_id,
          book_id,
          status: 'ACTIVE',
        },
      });

      if (existingBorrow) {
        return res.status(400).json({
          success: false,
          message: 'Student already has this book checked out',
        });
      }

      // Calculate due date if not provided using borrowing policy
      const checkoutDate = new Date();
      let computedDueDate = new Date(checkoutDate);
      if (!due_date) {
        let policy: any = null;
        if (book.default_policy_id) {
          const policies = await BorrowingPolicyService.listPolicies(false);
          policy = policies.find(p => p.id === book.default_policy_id);
        }
        if (!policy) {
          policy = await BorrowingPolicyService.getPolicyByCategory(
            book.category || 'General',
          );
        }
        if (policy) {
          computedDueDate = BorrowingPolicyService.computeDueDate(
            checkoutDate,
            { loan_days: policy.loan_days, overnight: policy.overnight },
          );
        }
      }

      const borrow = await prisma.book_checkouts.create({
        data: {
          student_id,
          book_id: book.id,
          checkout_date: checkoutDate,
          due_date: due_date ? new Date(due_date) : computedDueDate,
          status: 'ACTIVE',
        },
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
              category: true,
            },
          },
        },
      });

      // Update book availability
      await prisma.books.update({
        where: { id: book.id },
        data: {
          available_copies: Math.max(0, (book.available_copies ?? 0) - 1),
        },
      });

      // Log activity
      await prisma.student_activities.create({
        data: {
          student_id,
          activity_type: 'BOOK_CHECKOUT',
          description: `Checked out book: ${book.title}`,
        },
      });

      // Emit real-time update
      websocketServer.emitBorrowReturnUpdate({
        type: 'checkout',
        studentId: borrow.student_id,
        bookId: borrow.book_id,
        dueDate: borrow.due_date.toISOString(),
        fineAmount: 0,
        status: 'ACTIVE',
      });

      res.status(201).json({
        success: true,
        data: borrow,
      });
    } catch (error) {
      logger.error('Error creating borrow', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// PUT /api/borrows/:id/return - Return a book
router.put(
  '/:id/return',
  authenticate,
  requireRole(['LIBRARIAN', 'ADMIN']),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Return book request', {
      borrowId: req.params['id'],
      returnedBy: (req as any).user?.id,
    });

    try {
      const borrow = await prisma.book_checkouts.findUnique({
        where: { id: req.params['id'] },
        include: { book: true },
      });

      if (!borrow) {
        return res.status(404).json({
          success: false,
          message: 'Borrow record not found',
        });
      }

      if (borrow.status !== 'ACTIVE') {
        return res.status(400).json({
          success: false,
          message: 'Book is already returned',
        });
      }

      const returnDate = new Date();

      // Calculate fine via service (grade-based tiers)
      let fineAmount = 0;
      try {
        const calc = await FineCalculationService.calculateFineForCheckout(
          req.params['id'],
          returnDate,
        );
        fineAmount = calc.fine_amount ?? 0;
      } catch {
        fineAmount = 0;
      }

      const updatedBorrow = await prisma.book_checkouts.update({
        where: { id: req.params['id'] },
        data: {
          status: 'RETURNED',
          return_date: returnDate,
          fine_amount: fineAmount,
        },
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
              category: true,
            },
          },
        },
      });

      // Update book availability
      await prisma.books.update({
        where: { id: borrow.book_id },
        data: {
          available_copies: borrow.book.available_copies + 1,
        },
      });

      // Log activity
      await prisma.student_activities.create({
        data: {
          student_id: borrow.student_id,
          activity_type: 'BOOK_RETURN',
          description: `Returned book: ${borrow.book.title}${fineAmount > 0 ? ` (Fine: ₱${fineAmount.toFixed(2)})` : ''}`,
        },
      });

      // Emit real-time update
      websocketServer.emitBorrowReturnUpdate({
        type: 'return',
        studentId: updatedBorrow.student.id,
        bookId: updatedBorrow.book.id,
        dueDate: updatedBorrow.due_date.toISOString(),
        fineAmount,
        status: updatedBorrow.status as 'ACTIVE' | 'RETURNED',
      });

      res.json({
        success: true,
        data: updatedBorrow,
      });
    } catch (error) {
      logger.error('Error returning book', {
        borrowId: req.params['id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// GET /api/borrows/overdue - List overdue books
router.get(
  '/overdue',
  authenticate,
  requireRole(['LIBRARIAN', 'ADMIN']),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Get overdue borrows request', {
      userId: (req as any).user?.id,
    });

    try {
      const today = new Date();

      const overdueBorrows = await prisma.book_checkouts.findMany({
        where: {
          status: 'ACTIVE',
          due_date: {
            lt: today,
          },
        },
        include: {
          student: {
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
              grade_level: true,
              email: true,
            },
          },
          book: {
            select: {
              id: true,
              title: true,
              author: true,
              accession_no: true,
              category: true,
            },
          },
        },
        orderBy: {
          due_date: 'asc',
        },
      });

      // Calculate days overdue and fine per grade policy
      const overdueWithDays = await Promise.all(
        overdueBorrows.map(async borrow => {
          const daysOverdue = Math.ceil(
            (today.getTime() - borrow.due_date.getTime()) /
              (1000 * 60 * 60 * 24),
          );
          let rate = 0;
          try {
            rate = await FineCalculationService.getRateForGrade(
              borrow.student.grade_level,
            );
          } catch {
            // Ignore error
          }
          const fineAmount = daysOverdue * rate;
          return {
            ...borrow,
            days_overdue: daysOverdue,
            fine_amount: fineAmount,
          };
        }),
      );

      res.json({
        success: true,
        data: overdueWithDays,
        count: overdueWithDays.length,
      });
    } catch (error) {
      logger.error('Error retrieving overdue borrows', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// PUT /api/borrows/:id/fine - Add or update fine
router.put(
  '/:id/fine',
  authenticate,
  requireRole(['LIBRARIAN', 'ADMIN']),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Update fine request', {
      borrowId: req.params['id'],
      fineAmount: req.body.fine_amount,
      updatedBy: (req as any).user?.id,
    });

    try {
      const { fine_amount } = req.body;

      const borrow = await prisma.book_checkouts.findUnique({
        where: { id: req.params['id'] },
      });

      if (!borrow) {
        return res.status(404).json({
          success: false,
          message: 'Borrow record not found',
        });
      }

      const updatedBorrow = await prisma.book_checkouts.update({
        where: { id: req.params['id'] },
        data: {
          fine_amount: parseFloat(fine_amount),
        },
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
              category: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: updatedBorrow,
      });
    } catch (error) {
      logger.error('Error updating fine', {
        borrowId: req.params['id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// GET /api/borrows/student/:studentId - Get student's borrow history
router.get(
  '/student/:studentId',
  authenticate,
  requireRole(['LIBRARIAN', 'ADMIN']),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Get student borrows request', {
      studentId: req.params['studentId'],
      userId: (req as any).user?.id,
    });

    try {
      const { page = 1, limit = 10, status } = req.query as any;

      const where: any = {
        student_id: req.params['studentId'],
      };

      if (status) {
        where.status = status;
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const total = await prisma.book_checkouts.count({ where });

      const borrows = await prisma.book_checkouts.findMany({
        where,
        orderBy: {
          checkout_date: 'desc',
        },
        skip,
        take: parseInt(limit),
        include: {
          book: {
            select: {
              id: true,
              title: true,
              author: true,
              accession_no: true,
              category: true,
              isbn: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: borrows,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      logger.error('Error retrieving student borrows', {
        studentId: req.params['studentId'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

export default router;
