import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/authenticate';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

// GET /api/borrows
router.get('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
  logger.info('Get borrows request', {
    query: req.query,
    userId: (req as any).user?.id
  });

  try {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      sortBy = 'checkout_date',
      sortOrder = 'desc'
    } = req.query as any;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { student: { student_id: { contains: search, mode: 'insensitive' } } },
        { student: { first_name: { contains: search, mode: 'insensitive' } } },
        { student: { last_name: { contains: search, mode: 'insensitive' } } },
        { book: { title: { contains: search, mode: 'insensitive' } } },
        { book: { author: { contains: search, mode: 'insensitive' } } },
        { book: { accession_no: { contains: search, mode: 'insensitive' } } }
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
            grade_level: true
          }
        },
        book: {
          select: {
            id: true,
            title: true,
            author: true,
            accession_no: true,
            category: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: borrows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error retrieving borrows', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}));

// GET /api/borrows/:id
router.get('/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  logger.info('Get borrow by ID request', {
    borrowId: req.params['id'],
    userId: (req as any).user?.id
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
            email: true
          }
        },
        books: {
          select: {
            id: true,
            title: true,
            author: true,
            accession_no: true,
            category: true,
            isbn: true,
            publisher: true
          }
        }
      }
    });

    if (!borrow) {
      return res.status(404).json({
        success: false,
        message: 'Borrow record not found'
      });
    }

    res.json({
      success: true,
      data: borrow
    });
  } catch (error) {
    logger.error('Error retrieving borrow', { borrowId: req.params['id'], error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}));

// POST /api/borrows - Checkout a book
router.post('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
  logger.info('Create borrow request', {
    studentId: req.body.student_id,
    bookId: req.body.book_id,
    createdBy: (req as any).user?.id
  });

  try {
    const { student_id, book_id, due_date } = req.body;

    // Check if student exists
    const student = await prisma.students.findUnique({
      where: { id: student_id }
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if book exists and is available
    const book = await prisma.books.findUnique({
      where: { id: book_id }
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    if (book.available_copies <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Book is not available'
      });
    }

    // Check if student already has this book checked out
    const existingBorrow = await prisma.book_checkouts.findFirst({
      where: {
        student_id,
        book_id,
        status: 'ACTIVE'
      }
    });

    if (existingBorrow) {
      return res.status(400).json({
        success: false,
        message: 'Student already has this book checked out'
      });
    }

    // Calculate due date if not provided (default: 14 days)
    const checkoutDate = new Date();
    const defaultDueDate = new Date(checkoutDate);
    defaultDueDate.setDate(defaultDueDate.getDate() + 14);

    const borrow = await prisma.book_checkouts.create({
      data: {
        student_id,
        book_id,
        checkout_date: checkoutDate,
        due_date: due_date ? new Date(due_date) : defaultDueDate,
        status: 'ACTIVE'
      },
      include: {
        student: {
          select: {
            id: true,
            student_id: true,
            first_name: true,
            last_name: true,
            grade_level: true
          }
        },
        book: {
          select: {
            id: true,
            title: true,
            author: true,
            accession_no: true,
            category: true
          }
        }
      }
    });

    // Update book availability
    await prisma.books.update({
      where: { id: book_id },
      data: {
        available_copies: book.available_copies - 1
      }
    });

    // Log activity
    await prisma.student_activities.create({
      data: {
        student_id,
        activity_type: 'BOOK_CHECKOUT',
        description: `Checked out book: ${book.title}`
      }
    });

    res.status(201).json({
      success: true,
      data: borrow
    });
  } catch (error) {
    logger.error('Error creating borrow', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}));

// PUT /api/borrows/:id/return - Return a book
router.put('/:id/return', authenticate, asyncHandler(async (req: Request, res: Response) => {
  logger.info('Return book request', {
    borrowId: req.params['id'],
    returnedBy: (req as any).user?.id
  });

  try {
    const borrow = await prisma.book_checkouts.findUnique({
      where: { id: req.params['id'] },
      include: { book: true }
    });

    if (!borrow) {
      return res.status(404).json({
        success: false,
        message: 'Borrow record not found'
      });
    }

    if (borrow.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        message: 'Book is already returned'
      });
    }

    const returnDate = new Date();

    // Calculate fine if overdue
    let fineAmount = 0;
    if (returnDate > borrow.due_date) {
      const daysOverdue = Math.ceil((returnDate.getTime() - borrow.due_date.getTime()) / (1000 * 60 * 60 * 24));
      fineAmount = daysOverdue * 1.00; // $1 per day
    }

    const updatedBorrow = await prisma.book_checkouts.update({
      where: { id: req.params['id'] },
      data: {
        status: 'RETURNED',
        return_date: returnDate,
        fine_amount: fineAmount
      },
      include: {
        student: {
          select: {
            id: true,
            student_id: true,
            first_name: true,
            last_name: true,
            grade_level: true
          }
        },
        book: {
          select: {
            id: true,
            title: true,
            author: true,
            accession_no: true,
            category: true
          }
        }
      }
    });

    // Update book availability
    await prisma.books.update({
      where: { id: borrow.book_id },
      data: {
        available_copies: borrow.book.available_copies + 1
      }
    });

    // Log activity
    await prisma.student_activities.create({
      data: {
        student_id: borrow.student_id,
        activity_type: 'BOOK_RETURN',
        description: `Returned book: ${borrow.book.title}${fineAmount > 0 ? ` (Fine: $${fineAmount.toFixed(2)})` : ''}`
      }
    });

    res.json({
      success: true,
      data: updatedBorrow
    });
  } catch (error) {
    logger.error('Error returning book', { borrowId: req.params['id'], error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}));

// GET /api/borrows/overdue - List overdue books
router.get('/overdue', authenticate, asyncHandler(async (req: Request, res: Response) => {
  logger.info('Get overdue borrows request', {
    userId: (req as any).user?.id
  });

  try {
    const today = new Date();

    const overdueBorrows = await prisma.book_checkouts.findMany({
      where: {
        status: 'ACTIVE',
        due_date: {
          lt: today
        }
      },
      include: {
        student: {
          select: {
            id: true,
            student_id: true,
            first_name: true,
            last_name: true,
            grade_level: true,
            email: true
          }
        },
        books: {
          select: {
            id: true,
            title: true,
            author: true,
            accession_no: true,
            category: true
          }
        }
      },
      orderBy: {
        due_date: 'asc'
      }
    });

    // Calculate days overdue for each borrow
    const overdueWithDays = overdueBorrows.map(borrow => {
      const daysOverdue = Math.ceil((today.getTime() - borrow.due_date.getTime()) / (1000 * 60 * 60 * 24));
      const fineAmount = daysOverdue * 1.00;
      return {
        ...borrow,
        days_overdue: daysOverdue,
        fine_amount: fineAmount
      };
    });

    res.json({
      success: true,
      data: overdueWithDays,
      count: overdueWithDays.length
    });
  } catch (error) {
    logger.error('Error retrieving overdue borrows', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}));

// PUT /api/borrows/:id/fine - Add or update fine
router.put('/:id/fine', authenticate, asyncHandler(async (req: Request, res: Response) => {
  logger.info('Update fine request', {
    borrowId: req.params['id'],
    fineAmount: req.body.fine_amount,
    updatedBy: (req as any).user?.id
  });

  try {
    const { fine_amount } = req.body;

    const borrow = await prisma.book_checkouts.findUnique({
      where: { id: req.params['id'] }
    });

    if (!borrow) {
      return res.status(404).json({
        success: false,
        message: 'Borrow record not found'
      });
    }

    const updatedBorrow = await prisma.book_checkouts.update({
      where: { id: req.params['id'] },
      data: {
        fine_amount: parseFloat(fine_amount)
      },
      include: {
        student: {
          select: {
            id: true,
            student_id: true,
            first_name: true,
            last_name: true,
            grade_level: true
          }
        },
        book: {
          select: {
            id: true,
            title: true,
            author: true,
            accession_no: true,
            category: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: updatedBorrow
    });
  } catch (error) {
    logger.error('Error updating fine', { borrowId: req.params['id'], error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}));

// GET /api/borrows/student/:studentId - Get student's borrow history
router.get('/student/:studentId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  logger.info('Get student borrows request', {
    studentId: req.params['studentId'],
    userId: (req as any).user?.id
  });

  try {
    const {
      page = 1,
      limit = 10,
      status
    } = req.query as any;

    const where: any = {
      student_id: req.params['studentId']
    };

    if (status) {
      where.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await prisma.book_checkouts.count({ where });

    const borrows = await prisma.book_checkouts.findMany({
      where,
      orderBy: {
        checkout_date: 'desc'
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
            isbn: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: borrows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error retrieving student borrows', { studentId: req.params['studentId'], error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}));

export default router;
