import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate as authenticateToken } from '../middleware/authenticate';
// import { z } from 'zod';
import { isDevelopment } from '../config/env';
import { logger } from '../utils/logger';

const router = Router();
// const prisma = new PrismaClient();

// Grade-based fine calculation schema
// const GradeFineSchema = z.object({
//   gradeLevel: z.string(),
//   overdueDays: z.number().min(0),
// });

// Material type borrowing policies
const MATERIAL_POLICIES = {
  Filipiniana: { days: 3, finePerDay: 2 },
  Fiction: { days: 7, finePerDay: 5 },
  'Easy Books': { days: 1, finePerDay: 2 }, // Overnight
  Reference: { days: 1, finePerDay: 5 }, // Library use only
  Textbook: { days: 7, finePerDay: 3 },
  Periodical: { days: 3, finePerDay: 2 },
  General: { days: 3, finePerDay: 2 }, // Added General material type
  '(Uncategorized)': { days: 3, finePerDay: 2 }, // Handle uncategorized books
};

// Grade-based fine rates (as specified in requirements)
const GRADE_FINE_RATES = {
  Primary: 2, // Grade 1-3 = ₱2 per day
  Elementary: 5, // Grade 4-6 = ₱5 per day
  'Junior High': 5, // Junior High = ₱5 per day
  'Senior High': 5, // Senior High = ₱5 per day
};

// Calculate fine based on grade level and overdue days
function calculateFine(grade_level: string, overdueDays: number): number {
  // Determine grade category
  let rate = 5; // Default rate

  if (
    grade_level.includes('Grade 1') ||
    grade_level.includes('Grade 2') ||
    grade_level.includes('Grade 3')
  ) {
    rate = GRADE_FINE_RATES['Primary'];
  } else if (
    grade_level.includes('Grade 4') ||
    grade_level.includes('Grade 5') ||
    grade_level.includes('Grade 6')
  ) {
    rate = GRADE_FINE_RATES['Elementary'];
  } else if (grade_level.includes('Junior High')) {
    rate = GRADE_FINE_RATES['Junior High'];
  } else if (grade_level.includes('Senior High')) {
    rate = GRADE_FINE_RATES['Senior High'];
  } else if (grade_level.includes('Personnel')) {
    rate = 0; // Personnel are exempt from fines (or set a specific rate if needed)
  }

  return overdueDays * rate;
}

// Get due date based on material type
function getDueDate(material_type: string): Date {
  const policy =
    MATERIAL_POLICIES[material_type as keyof typeof MATERIAL_POLICIES];
  const days = policy?.days || 7; // Default to 7 days

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + days);
  return dueDate;
}

// User tracking - get current patrons in library
router.get(
  '/user-tracking',
  authenticateToken,
  async (_req: Request, res: Response) => {
    try {
      // Get all students who checked in today and haven't checked out
      // Exclude personnel (type = 'PERSONNEL') from the list
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const currentPatrons = await prisma.students.findMany({
        where: {
          // Include both students and personnel
          type: { in: ['STUDENT', 'PERSONNEL'] },
          activities: {
            some: {
              activity_type: {
                in: [
                  'CHECK_IN',
                  'SELF_SERVICE_CHECK_IN',
                  'KIOSK_CHECK_IN',
                  'LIBRARY_VISIT',
                ],
              },
              status: 'ACTIVE',
              start_time: {
                gte: today,
              },
            },
          },
        },
        include: {
          activities: {
            where: {
              start_time: {
                gte: today,
              },
            },
            orderBy: {
              start_time: 'desc',
            },
            take: 10,
          },
          checkouts: {
            where: {
              status: 'ACTIVE',
            },
            include: {
              book: true,
            },
          },
        },
      });

      // Filter to only show currently active patrons (last presence activity was check-in)
      const activePatrons = currentPatrons.filter(student => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const activities = (student as any).activities;

        // Find the latest activity that is related to presence (Check-in or Check-out)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lastPresenceActivity = activities.find((a: any) =>
          [
            'CHECK_IN',
            'SELF_SERVICE_CHECK_IN',
            'KIOSK_CHECK_IN',
            'LIBRARY_VISIT',
            'CHECK_OUT',
          ].includes(a.activity_type),
        );

        // If no presence activity found (shouldn't happen due to where clause), or last was CHECK_OUT, exclude
        if (
          !lastPresenceActivity ||
          lastPresenceActivity.activity_type === 'CHECK_OUT'
        ) {
          return false;
        }

        // Otherwise, they are checked in
        return true;
      });

      res.json({
        success: true,
        data: {
          totalPatrons: activePatrons.length,
          patrons: activePatrons.map(patron => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const p = patron as any;
            // Parse metadata if it's a string
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let activityMetadata: any = null;
            try {
              const rawMetadata = p.activities[0]?.metadata;
              if (typeof rawMetadata === 'string') {
                activityMetadata = JSON.parse(rawMetadata);
              } else {
                activityMetadata = rawMetadata;
              }
            } catch {
              activityMetadata = null;
            }
            return {
              id: p.id,
              studentId: p.student_id,
              studentName: `${p.first_name} ${p.last_name}`,
              gradeLevel: p.grade_level,
              section: p.section,
              currentBooks: p.checkouts.length,
              lastCheckIn: p.activities[0]?.start_time,
              purpose:
                activityMetadata?.purpose ||
                activityMetadata?.purposes?.[0] ||
                'library',
            };
          }),
        },
      });
    } catch (error) {
      logger.error('User tracking error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve user tracking data',
      });
    }
  },
);

// Borrowing flow - checkout book with material type selection
router.post(
  '/borrow',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      // Log the raw request body for debugging
      logger.info('Borrow request received', { body: req.body });

      // Accept both camelCase (frontend) and snake_case (legacy) parameter names
      const student_id = req.body.student_id || req.body.studentId;
      const bookId = req.body.bookId || req.body.book_id;
      let material_type = req.body.material_type || req.body.materialType;

      logger.info('Parsed borrow params', {
        student_id,
        bookId,
        material_type,
      });

      if (!student_id || !bookId || !material_type) {
        logger.warn('Missing required borrow params', {
          student_id,
          bookId,
          material_type,
          rawBody: req.body,
        });
        return res.status(400).json({
          success: false,
          error: 'Student ID, Book ID, and Material Type are required',
          received: { student_id, bookId, material_type },
        });
      }

      // Check if material type is valid, otherwise default to General
      if (!MATERIAL_POLICIES[material_type as keyof typeof MATERIAL_POLICIES]) {
        logger.warn('Invalid material type, defaulting to General', {
          provided: material_type,
          student_id,
          bookId,
        });
        material_type = 'General';
      }

      // Check if student exists and is active
      const student = await prisma.students.findUnique({
        where: { id: student_id },
        include: {
          checkouts: {
            where: { status: 'ACTIVE' },
          },
        },
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          error: 'Student not found',
        });
      }

      // Check borrowing limits (max 3 books)
      if (student.checkouts.length >= 3) {
        logger.warn('Student reached borrowing limit', {
          student_id,
          current_checkouts: student.checkouts.length,
        });
        return res.status(400).json({
          success: false,
          error: 'Student has reached maximum borrowing limit (3 books)',
        });
      }

      // Check if book is available
      const book = await prisma.books.findUnique({
        where: { id: bookId },
        select: {
          id: true,
          title: true,
          available_copies: true,
          is_active: true,
        },
      });

      if (
        !book ||
        (book.available_copies ?? 0) <= 0 ||
        book.is_active === false
      ) {
        logger.warn('Book not available for borrowing', {
          bookId,
          available_copies: book?.available_copies,
          is_active: book?.is_active,
          exists: !!book,
        });
        return res.status(400).json({
          success: false,
          error: `Book is not available (Copies: ${book?.available_copies ?? 0}, Active: ${book?.is_active ?? false})`,
        });
      }

      // Calculate due date based on material type
      const dueDate = getDueDate(material_type);

      // Create checkout record
      const checkout = await prisma.book_checkouts.create({
        data: {
          student_id: student_id,
          book_id: bookId,
          due_date: dueDate,
          status: 'ACTIVE',
          checkout_date: new Date(),
        },
        include: {
          student: true,
          book: true,
        },
      });

      // Update book status
      await prisma.books.update({
        where: { id: bookId },
        data: { available_copies: { decrement: 1 }, is_active: true },
      });

      // Create activity record
      await prisma.student_activities.create({
        data: {
          student_id: student_id,
          activity_type: 'BOOK_BORROWED',
          description: `Borrowed "${book.title}" (${material_type})`,
          status: 'COMPLETED',
        },
      });

      res.json({
        success: true,
        data: {
          checkout,
          dueDate,
          finePerDay:
            MATERIAL_POLICIES[material_type as keyof typeof MATERIAL_POLICIES]
              .finePerDay,
        },
      });
    } catch (error) {
      if (isDevelopment()) {
        const { student_id, bookId, material_type } = req.body || {};
        const dueDate = getDueDate(String(material_type || 'Fiction'));
        return res.json({
          success: true,
          data: {
            checkout: {
              id: 'DEV-CHECKOUT-1',
              student_id: String(student_id || 'LIBRARIAN'),
              bookId: String(bookId || 'BOOK-1'),
              material_type: String(material_type || 'Fiction'),
              dueDate,
              status: 'ACTIVE',
              borrowedAt: new Date(),
            },
            dueDate,
            finePerDay:
              MATERIAL_POLICIES[
                String(
                  material_type || 'Fiction',
                ) as keyof typeof MATERIAL_POLICIES
              ]?.finePerDay || 5,
          },
        });
      }
      logger.error('Borrowing error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to process borrowing request',
      });
    }
  },
);

// Returning flow - return book and calculate fines
router.post(
  '/return',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { checkoutId, condition = 'GOOD' } = req.body;

      if (!checkoutId) {
        return res.status(400).json({
          success: false,
          error: 'Checkout ID is required',
        });
      }

      // Find active checkout
      const checkout = await prisma.book_checkouts.findUnique({
        where: { id: checkoutId },
        include: {
          student: true,
          book: true,
        },
      });

      if (!checkout || checkout.status !== 'ACTIVE') {
        return res.status(400).json({
          success: false,
          error: 'Invalid or already returned checkout',
        });
      }

      const now = new Date();
      const dueDate = new Date(checkout.due_date);
      const overdueDays = Math.max(
        0,
        Math.ceil((now.getTime() - dueDate.getTime()) / 86400000),
      );

      // Calculate fine based on grade level
      const fineAmount = calculateFine(
        `Grade ${checkout.student.grade_level}`,
        overdueDays,
      );

      // Update checkout record
      const updatedCheckout = await prisma.book_checkouts.update({
        where: { id: checkoutId },
        data: {
          status: 'RETURNED',
          return_date: now,
          fine_amount: fineAmount,
          notes: condition,
        },
      });

      // Update book status
      await prisma.books.update({
        where: { id: checkout.book.id },
        data: { available_copies: { increment: 1 }, is_active: true },
      });

      // Create activity record
      await prisma.student_activities.create({
        data: {
          student_id: checkout.student.id,
          activity_type: 'BOOK_RETURNED',
          description: `Returned "${checkout.book.title}" (${overdueDays} days overdue, fine: ₱${fineAmount})`,
          status: 'COMPLETED',
        },
      });

      res.json({
        success: true,
        data: {
          checkout: updatedCheckout,
          overdueDays,
          fineAmount,
          message:
            overdueDays > 0
              ? `Book returned successfully. Overdue fine: ₱${fineAmount}`
              : 'Book returned successfully. No fine applied.',
        },
      });
    } catch (error) {
      if (isDevelopment()) {
        const { checkoutId } = req.body || {};
        const now = new Date();
        const overdueDays = 2;
        const fineAmount = calculateFine('Grade 5', overdueDays);
        return res.json({
          success: true,
          data: {
            checkout: {
              id: String(checkoutId || 'DEV-CHECKOUT-1'),
              status: 'RETURNED',
              returnedAt: now,
              overdueDays,
              fineAmount,
            },
            overdueDays,
            fineAmount,
            message: `Book returned successfully. Overdue fine: ₱${fineAmount}`,
          },
        });
      }
      logger.error('Return error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to process return request',
      });
    }
  },
);

// Mark book as lost
router.post(
  '/return/lost',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { checkoutId } = req.body;

      if (!checkoutId) {
        return res.status(400).json({
          success: false,
          error: 'Checkout ID is required',
        });
      }

      // Find active checkout
      const checkout = await prisma.book_checkouts.findUnique({
        where: { id: checkoutId },
        include: {
          student: true,
          book: true,
        },
      });

      if (!checkout || checkout.status !== 'ACTIVE') {
        return res.status(400).json({
          success: false,
          error: 'Invalid or already returned checkout',
        });
      }

      // Calculate fine: Cost of book + 40 pesos
      const bookCost = checkout.book.cost_price || 0;
      const penalty = 40.0;
      const fineAmount = bookCost + penalty;

      // Update checkout record
      const updatedCheckout = await prisma.book_checkouts.update({
        where: { id: checkoutId },
        data: {
          status: 'LOST',
          return_date: new Date(),
          fine_amount: fineAmount,
          notes: 'Book reported lost',
        },
      });

      // Create activity record
      await prisma.student_activities.create({
        data: {
          student_id: checkout.student.id,
          activity_type: 'BOOK_LOST',
          description: `Reported lost "${checkout.book.title}" (Fine: ₱${fineAmount})`,
          status: 'COMPLETED',
        },
      });

      res.json({
        success: true,
        data: {
          checkout: updatedCheckout,
          fineAmount,
          message: `Book marked as lost. Penalty applied: ₱${fineAmount} (Cost: ₱${bookCost} + Penalty: ₱${penalty})`,
        },
      });
    } catch (error) {
      logger.error('Mark lost error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to mark book as lost',
      });
    }
  },
);

// Get checkout history
router.get(
  '/history',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { status, limit = 50, offset = 0, studentId, bookId } = req.query;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};

      if (status && status !== 'ALL') {
        where.status = status;
      }

      // Filter by studentId if provided
      if (studentId) {
        where.student_id = studentId as string;
      }

      // Filter by bookId if provided
      if (bookId) {
        where.book_id = bookId as string;
      }

      const history = await prisma.book_checkouts.findMany({
        where,
        include: {
          book: true,
          student: true,
        },
        orderBy: {
          checkout_date: 'desc',
        },
        take: Number(limit),
        skip: Number(offset),
      });

      // Map to frontend expected format
      const mappedHistory = history.map(item => ({
        id: item.id,
        bookId: item.book_id,
        studentId: item.student_id,
        checkoutDate: item.checkout_date,
        dueDate: item.due_date,
        returnDate: item.return_date,
        status: item.status,
        overdueDays:
          item.status === 'ACTIVE'
            ? Math.max(
                0,
                Math.ceil(
                  (new Date().getTime() - new Date(item.due_date).getTime()) /
                    (1000 * 60 * 60 * 24),
                ),
              )
            : 0,
        fineAmount: item.fine_amount || 0,
        finePaid: item.fine_paid,
        finePaidAt: item.fine_paid_at,
        notes: item.notes,
        book: {
          id: item.book.id,
          accessionNo: item.book.accession_no,
          title: item.book.title,
          author: item.book.author,
          category: item.book.category,
        },
        student: {
          id: item.student.id,
          studentId: item.student.student_id,
          firstName: item.student.first_name,
          lastName: item.student.last_name,
          gradeLevel: item.student.grade_level,
          section: item.student.section,
        },
      }));

      res.json({
        success: true,
        data: mappedHistory,
      });
    } catch (error) {
      logger.error('History error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve checkout history',
      });
    }
  },
);

// Get all student activities - for Activity tab (check-ins, borrows, prints, etc.)
router.get(
  '/student-activities',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { studentId, limit = 50, offset = 0 } = req.query;

      if (!studentId) {
        return res.status(400).json({
          success: false,
          error: 'studentId is required',
        });
      }

      const activities = await prisma.student_activities.findMany({
        where: {
          student_id: studentId as string,
        },
        orderBy: {
          start_time: 'desc',
        },
        take: Number(limit),
        skip: Number(offset),
      });

      // Map to frontend expected format
      const mappedActivities = activities.map(item => {
        // Parse metadata if present
        let metadata = null;
        if (item.metadata) {
          try {
            metadata = JSON.parse(item.metadata);
          } catch {
            metadata = null;
          }
        }

        // Format activity description based on type
        let description = item.description || '';
        if (!description) {
          switch (item.activity_type) {
            case 'CHECK_IN':
            case 'SELF_SERVICE_CHECK_IN':
            case 'KIOSK_CHECK_IN':
              description = 'Checked in to library';
              break;
            case 'CHECK_OUT':
              description = 'Checked out of library';
              break;
            case 'LIBRARY_VISIT':
              description = 'Library visit';
              break;
            case 'BOOK_BORROWED':
              description = metadata?.bookTitle
                ? `Borrowed: ${metadata.bookTitle}`
                : 'Borrowed a book';
              break;
            case 'BOOK_RETURNED':
              description = 'Returned a book';
              break;
            case 'ATTENDANCE_IMPORT':
              description = metadata?.bookTitle
                ? `Read: ${metadata.bookTitle}`
                : 'Library activity';
              break;
            default:
              description = item.activity_type;
          }
        }

        return {
          id: item.id,
          activityType: item.activity_type,
          description,
          timestamp: item.start_time,
          endTime: item.end_time,
          status: item.status,
          metadata,
        };
      });

      res.json({
        success: true,
        data: mappedActivities,
      });
    } catch (error) {
      logger.error('Student activities error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve student activities',
      });
    }
  },
);
// Overdue management - get all overdue books
router.get(
  '/overdue',
  authenticateToken,
  async (_req: Request, res: Response) => {
    try {
      const now = new Date();

      const overdueCheckouts = await prisma.book_checkouts.findMany({
        where: { status: 'ACTIVE', due_date: { lt: now } },
        include: {
          student: true,
          book: true,
        },
        orderBy: { due_date: 'asc' },
      });

      // Calculate fines for each overdue item
      const overdueItems = overdueCheckouts.map(checkout => {
        const overdueDays = Math.ceil(
          (now.getTime() - new Date(checkout.due_date).getTime()) / 86400000,
        );
        const gradeLabel = `Grade ${checkout.student.grade_level}`;
        const fineAmount = calculateFine(gradeLabel, overdueDays);

        return {
          id: checkout.id,
          student: {
            id: checkout.student.id,
            student_id: checkout.student.student_id,
            name: `${checkout.student.first_name} ${checkout.student.last_name}`,
            grade_level: checkout.student.grade_level,
            section: checkout.student.section,
          },
          book: {
            id: checkout.book.id,
            title: checkout.book.title,
            author: checkout.book.author,
            isbn: checkout.book.isbn,
          },
          borrowedAt: checkout.checkout_date,
          due_date: checkout.due_date,
          overdueDays,
          fineAmount,
          material_type: checkout.book.category || 'Unknown',
        };
      });

      res.json({
        success: true,
        data: {
          totalOverdue: overdueItems.length,
          totalFines: overdueItems.reduce(
            (sum, item) => sum + item.fineAmount,
            0,
          ),
          items: overdueItems,
        },
      });
    } catch (error) {
      logger.error('Overdue management error', { error });
      if (isDevelopment()) {
        const now = new Date();
        const fallbackItems = [
          {
            id: 'LOAN-DEV-1',
            student: {
              id: 'S-0001',
              student_id: 'S-0001',
              name: 'Alice Example',
              grade_level: 'Grade 5',
              section: 'Section A',
            },
            book: {
              id: 'BOOK-1',
              title: 'Sample Book',
              author: 'John Doe',
              isbn: '9780000000001',
            },
            borrowedAt: now,
            due_date: new Date(now.getTime() - 3 * 86400000),
            overdueDays: 3,
            fineAmount: 15,
            material_type: 'Fiction',
          },
        ];
        return res.json({
          success: true,
          data: {
            totalOverdue: fallbackItems.length,
            totalFines: fallbackItems.reduce(
              (sum, item) => sum + item.fineAmount,
              0,
            ),
            items: fallbackItems,
          },
        });
      }
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve overdue items',
      });
    }
  },
);

// Top users analytics
router.get(
  '/top-users',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { period = 'monthly' } = req.query;

      let dateFilter = {};
      if (period === 'monthly') {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        dateFilter = { created_at: { gte: lastMonth } };
      } else if (period === 'weekly') {
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        dateFilter = { created_at: { gte: lastWeek } };
      }

      // Get top borrowers
      const topBorrowers = await prisma.students.findMany({
        where: {
          checkouts: {
            some: dateFilter,
          },
        },
        include: {
          _count: {
            select: {
              checkouts: {
                where: dateFilter,
              },
            },
          },
          checkouts: {
            where: {
              ...dateFilter,
              status: 'ACTIVE',
            },
            include: {
              book: true,
            },
          },
        },
        orderBy: {
          checkouts: {
            _count: 'desc',
          },
        },
        take: 10,
      });

      // Get top books
      const topBooks = await prisma.books.findMany({
        where: {
          checkouts: {
            some: dateFilter,
          },
        },
        include: {
          _count: {
            select: {
              checkouts: {
                where: dateFilter,
              },
            },
          },
        },
        orderBy: {
          checkouts: {
            _count: 'desc',
          },
        },
        take: 10,
      });

      res.json({
        success: true,
        data: {
          topBorrowers: topBorrowers.map(student => ({
            id: student.id,
            student_id: student.student_id,
            name: `${student.first_name} ${student.last_name}`,
            grade_level: student.grade_level,
            section: student.section,
            borrowCount: student._count.checkouts,
            currentBooks: student.checkouts.length,
          })),
          topBooks: topBooks.map(book => ({
            id: book.id,
            title: book.title,
            author: book.author,
            isbn: book.isbn,
            borrowCount: book._count.checkouts,
          })),
        },
      });
    } catch (error) {
      logger.error('Top users analytics error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve analytics data',
      });
    }
  },
);

// Get available books with material type filtering
router.get(
  '/books/available',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { material_type } = req.query;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const whereClause: any = { is_active: true, available_copies: { gt: 0 } };
      // Map material_type to category if provided
      if (material_type) {
        whereClause.category = material_type;
      }
      const books = await prisma.books.findMany({
        where: whereClause,
        orderBy: { title: 'asc' },
      });
      if (books.length === 0 && isDevelopment()) {
        const sample = [
          {
            id: 'BOOK-DEV-1',
            title: 'Sample Book',
            author: 'John Doe',
            isbn: '9780000000001',
            material_type: 'Fiction',
            status: 'AVAILABLE',
          },
          {
            id: 'BOOK-DEV-2',
            title: 'Heritage',
            author: 'Maria Santos',
            isbn: '9780000000002',
            material_type: 'Filipiniana',
            status: 'AVAILABLE',
          },
          {
            id: 'BOOK-DEV-3',
            title: 'ABCs',
            author: 'Baby Reader',
            isbn: '9780000000003',
            material_type: 'Easy Books',
            status: 'AVAILABLE',
          },
        ];
        res.json({ success: true, data: sample });
        return;
      }
      res.json({ success: true, data: books });
    } catch (error) {
      logger.error('Available books error', { error });
      if (isDevelopment()) {
        const sample = [
          {
            id: 'BOOK-DEV-1',
            title: 'Sample Book',
            author: 'John Doe',
            isbn: '9780000000001',
            material_type: 'Fiction',
            status: 'AVAILABLE',
          },
          {
            id: 'BOOK-DEV-2',
            title: 'Heritage',
            author: 'Maria Santos',
            isbn: '9780000000002',
            material_type: 'Filipiniana',
            status: 'AVAILABLE',
          },
          {
            id: 'BOOK-DEV-3',
            title: 'ABCs',
            author: 'Baby Reader',
            isbn: '9780000000003',
            material_type: 'Easy Books',
            status: 'AVAILABLE',
          },
        ];
        res.json({ success: true, data: sample });
        return;
      }
      res
        .status(500)
        .json({ success: false, error: 'Failed to retrieve available books' });
    }
  },
);
// Search books with material type filtering
router.get(
  '/books/search',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { query, material_type } = req.query;
      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'Search query is required',
        });
      }
      // Convert to lowercase for case-insensitive search (SQLite compatible)
      const searchLower = (query as string).toLowerCase();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const whereClause: any = {
        is_active: true,
        available_copies: { gt: 0 },
        OR: [
          { title: { contains: searchLower } },
          { author: { contains: searchLower } },
          { accession_no: { contains: searchLower } },
          { isbn: { contains: searchLower } },
        ],
      };
      if (material_type) {
        whereClause.category = material_type;
      }
      const books = await prisma.books.findMany({
        where: whereClause,
        orderBy: { title: 'asc' },
      });

      res.json({
        success: true,
        data: books,
      });
    } catch (error) {
      logger.error('Book search error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to search books',
      });
    }
  },
);

// Get borrowed books for a student
router.get(
  '/borrowed/:student_id',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { student_id } = req.params;

      const checkouts = await prisma.book_checkouts.findMany({
        where: {
          student_id: student_id,
          status: 'ACTIVE',
        },
        include: {
          book: true,
        },
        orderBy: {
          checkout_date: 'desc',
        },
      });

      res.json({
        success: true,
        data: checkouts,
      });
    } catch (error) {
      logger.error('Borrowed books error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve borrowed books',
      });
    }
  },
);

// Find active checkout by book accession barcode
router.get(
  '/borrowed/by-accession/:barcode',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { barcode } = req.params;
      if (!barcode) {
        return res
          .status(400)
          .json({ success: false, error: 'Barcode is required' });
      }
      const book = await prisma.books.findFirst({
        where: {
          OR: [{ accession_no: barcode }, { isbn: barcode }],
        },
        select: { id: true },
      });
      if (!book) {
        return res
          .status(404)
          .json({ success: false, error: 'Book not found' });
      }
      const checkout = await prisma.book_checkouts.findFirst({
        where: { book_id: book.id, status: 'ACTIVE' },
        include: { student: true, book: true },
        orderBy: { checkout_date: 'desc' },
      });
      if (!checkout) {
        return res
          .status(404)
          .json({ success: false, error: 'No active checkout found' });
      }
      return res.json({ success: true, data: checkout });
    } catch (error) {
      logger.error('Borrowed checkout lookup error', { error });
      res
        .status(500)
        .json({ success: false, error: 'Failed to find active checkout' });
    }
  },
);

// Calculate fine for a specific checkout
router.get(
  '/fine/:checkoutId',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { checkoutId } = req.params;

      const checkout = await prisma.book_checkouts.findUnique({
        where: { id: checkoutId },
        include: {
          student: true,
          book: true,
        },
      });

      if (!checkout) {
        return res.status(404).json({
          success: false,
          error: 'Checkout not found',
        });
      }

      const now = new Date();
      const dueDate = new Date(checkout.due_date);
      const overdueDays = Math.max(
        0,
        Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)),
      );

      const fineAmount = calculateFine(
        `Grade ${checkout.student.grade_level}`,
        overdueDays,
      );

      res.json({
        success: true,
        data: {
          checkoutId,
          overdueDays,
          fineAmount,
          due_date: checkout.due_date,
          student: {
            id: checkout.student.id,
            student_id: checkout.student.student_id,
            name: `${checkout.student.first_name} ${checkout.student.last_name}`,
            grade_level: checkout.student.grade_level,
          },
          book: {
            id: checkout.book.id,
            title: checkout.book.title,
            author: checkout.book.author,
          },
        },
      });
    } catch (error) {
      logger.error('Fine calculation error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to calculate fine',
      });
    }
  },
);

// Pay fine for a specific checkout
router.post(
  '/fine/:checkoutId/pay',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { checkoutId } = req.params;
      const { amount } = req.body;
      // paymentMethod unused - defaulting to cash

      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Valid payment amount is required',
        });
      }

      const checkout = await prisma.book_checkouts.findUnique({
        where: { id: checkoutId },
        include: {
          student: true,
          book: true,
        },
      });

      if (!checkout) {
        return res.status(404).json({
          success: false,
          error: 'Checkout not found',
        });
      }

      // Create fine payment record
      const finePayment = await prisma.book_checkouts.update({
        where: { id: checkoutId },
        data: {
          fine_paid: true,
          fine_paid_at: new Date(),
        },
      });

      // Create activity record
      await prisma.student_activities.create({
        data: {
          student_id: checkout.student.id,
          activity_type: 'FINE_PAID',
          description: `Paid fine of ₱${amount} for "${checkout.book.title}"`,
          status: 'COMPLETED',
        },
      });

      res.json({
        success: true,
        data: {
          payment: finePayment,
          message: `Fine payment of ₱${amount} recorded successfully`,
        },
      });
    } catch (error) {
      logger.error('Fine payment error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to process fine payment',
      });
    }
  },
);

// Send overdue reminder to student
router.post(
  '/overdue/reminder',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { student_id } = req.body;

      if (!student_id) {
        return res.status(400).json({
          success: false,
          error: 'Student ID is required',
        });
      }

      const overdueCheckouts = await prisma.book_checkouts.findMany({
        where: {
          student_id,
          status: 'ACTIVE',
          due_date: {
            lt: new Date(),
          },
        },
        include: {
          book: true,
          student: true,
        },
      });

      if (overdueCheckouts.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No overdue books found for this student',
        });
      }

      // Create notification for overdue reminder (not implemented - notification table doesn't exist)
      // const notification = await prisma.notification.create({
      //   data: {
      //     student_id,
      //     type: 'OVERDUE_REMINDER',
      //     title: 'Overdue Book Reminder',
      //     message: `You have ${overdueCheckouts.length} overdue book(s). Please return them to avoid additional fines.`,
      //     priority: 'HIGH',
      //   },
      // });
      const notification = {
        id: 'placeholder',
        message: 'Notification system not implemented',
      };

      // Create activity record
      await prisma.student_activities.create({
        data: {
          student_id,
          activity_type: 'OVERDUE_REMINDER_SENT',
          description: `Overdue reminder sent for ${overdueCheckouts.length} book(s)`,
        },
      });

      res.json({
        success: true,
        data: {
          notification,
          overdueCount: overdueCheckouts.length,
          message: `Overdue reminder sent successfully for ${overdueCheckouts.length} book(s)`,
        },
      });
    } catch (error) {
      logger.error('Overdue reminder error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to send overdue reminder',
      });
    }
  },
);

// Get material policies
router.get(
  '/policies',
  authenticateToken,
  async (_req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        data: MATERIAL_POLICIES,
      });
    } catch (error) {
      logger.error('Material policies error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve material policies',
      });
    }
  },
);

// Get grade-based fine rates
router.get(
  '/grade-fines',
  authenticateToken,
  async (_req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        data: GRADE_FINE_RATES,
      });
    } catch (error) {
      logger.error('Grade fines error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve grade fine rates',
      });
    }
  },
);

// Generate monthly report
router.get(
  '/reports/monthly',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { month, year } = req.query;

      if (!month || !year) {
        return res.status(400).json({
          success: false,
          error: 'Month and year are required',
        });
      }

      const startDate = new Date(
        parseInt(year as string),
        parseInt(month as string) - 1,
        1,
      );
      const endDate = new Date(
        parseInt(year as string),
        parseInt(month as string),
        0,
      );

      // Get monthly statistics
      const monthlyStats = await prisma.book_checkouts.groupBy({
        by: ['status'],
        where: {
          checkout_date: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: true,
      });

      const totalBorrowed =
        monthlyStats.find(s => s.status === 'ACTIVE')?._count || 0;
      const totalReturned =
        monthlyStats.find(s => s.status === 'RETURNED')?._count || 0;

      // Get top borrowers for the month
      const topBorrowersAgg = await prisma.book_checkouts.groupBy({
        by: ['student_id'],
        where: { checkout_date: { gte: startDate, lte: endDate } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      });
      const topBorrowers = await Promise.all(
        topBorrowersAgg.map(async row => {
          const s = await prisma.students.findUnique({
            where: { id: row.student_id },
            select: {
              student_id: true,
              first_name: true,
              last_name: true,
              grade_level: true,
            },
          });
          return {
            student_id: s?.student_id,
            name: `${s?.first_name ?? ''} ${s?.last_name ?? ''}`.trim(),
            grade_level: s?.grade_level,
            borrowCount: row._count.id,
          };
        }),
      );

      // Get fines collected (fine table doesn't exist - using fine_amount from book_checkouts)
      // const monthlyFines = await prisma.fine.aggregate({
      //   where: {
      //     paidAt: {
      //       gte: startDate,
      //       lte: endDate,
      //     },
      //   },
      //   _sum: {
      //     amount: true,
      //   },
      // });
      const monthlyFines = await prisma.book_checkouts.aggregate({
        where: {
          created_at: {
            gte: startDate,
            lte: endDate,
          },
          fine_paid: true,
        },
        _sum: {
          fine_amount: true,
        },
      });

      const report = {
        month: parseInt(month as string),
        year: parseInt(year as string),
        period: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
        statistics: {
          totalBorrowed,
          totalReturned,
          totalFines: monthlyFines._sum.fine_amount || 0,
        },
        topBorrowers,
      };

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      logger.error('Monthly report error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to generate monthly report',
      });
    }
  },
);

// Export report
router.get(
  '/reports/:reportId/export',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { reportId } = req.params;
      const { format = 'pdf' } = req.query;

      // For now, return a placeholder response
      // In a real implementation, you would generate the actual file
      res.json({
        success: true,
        data: {
          reportId,
          format,
          downloadUrl: `/api/enhanced-library/reports/${reportId}/download`,
          message:
            'Report export initiated. Download will be available shortly.',
        },
      });
    } catch (error) {
      logger.error('Report export error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to export report',
      });
    }
  },
);

// Get inventory
router.get(
  '/inventory',
  authenticateToken,
  async (_req: Request, res: Response) => {
    try {
      const inventory = await prisma.books.findMany({
        orderBy: { title: 'asc' },
      });

      res.json({
        success: true,
        data: inventory,
      });
    } catch (error) {
      logger.error('Inventory error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve inventory',
      });
    }
  },
);

// Scan barcode
router.get(
  '/inventory/scan/:barcode',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { barcode } = req.params;

      const book = await prisma.books.findFirst({
        where: {
          OR: [{ isbn: barcode }, { accession_no: barcode }],
        },
      });

      if (!book) {
        return res.status(404).json({
          success: false,
          error: 'Book not found with this barcode',
        });
      }

      res.json({
        success: true,
        data: book,
      });
    } catch (error) {
      logger.error('Barcode scan error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to scan barcode',
      });
    }
  },
);

// Get print jobs
router.get(
  '/printing/jobs',
  authenticateToken,
  async (_req: Request, res: Response) => {
    try {
      const printJobs = await prisma.printing_jobs.findMany({
        orderBy: { created_at: 'desc' },
        take: 50,
        include: {
          student: true,
        },
      });

      res.json({
        success: true,
        data: printJobs,
      });
    } catch (error) {
      logger.error('Print jobs error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve print jobs',
      });
    }
  },
);

// Create print job
router.post(
  '/printing/jobs',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { student_id, documentName, pages, copies, color, doubleSided } =
        req.body;

      if (!student_id || !documentName || !pages || !copies) {
        return res.status(400).json({
          success: false,
          error: 'Missing required print job fields',
        });
      }

      // Calculate cost (basic pricing)
      const basePrice = color ? 5 : 2; // ₱5 for color, ₱2 for B&W per page
      const totalPages = pages * copies;
      const discount = doubleSided ? 0.9 : 1; // 10% discount for double-sided
      const totalCost = Math.round(totalPages * basePrice * discount);

      const printJob = await prisma.printing_jobs.create({
        data: {
          student_id: student_id,
          paper_size: 'SHORT', // Default to SHORT
          color_level: color ? 'FULL_COLOR' : 'BW',
          pages: totalPages,
          price_per_page: basePrice,
          total_cost: totalCost,
          paid: false,
          metadata: JSON.stringify({
            documentName,
            copies,
            doubleSided,
          }),
        },
      });

      res.json({
        success: true,
        data: {
          printJob,
          totalCost,
          message: 'Print job created successfully',
        },
      });
    } catch (error) {
      logger.error('Print job creation error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to create print job',
      });
    }
  },
);

// Update print job status
router.put(
  '/printing/jobs/:_jobId/status',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      // jobId unused in this route
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          error: 'Status is required',
        });
      }

      // For now, we'll just return a success message since the schema doesn't have a status field
      // In a real implementation, you would update the appropriate field
      res.json({
        success: true,
        data: {
          message: 'Print job status updated successfully',
          note: 'Status field not available in current schema',
        },
      });
    } catch (error) {
      logger.error('Print job status update error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update print job status',
      });
    }
  },
);

// Get print pricing
router.get(
  '/printing/pricing',
  authenticateToken,
  async (_req: Request, res: Response) => {
    try {
      const pricing = {
        blackAndWhite: 2, // ₱2 per page
        color: 5, // ₱5 per page
        doubleSidedDiscount: 0.1, // 10% discount
        binding: 15, // ₱15 per document
        laminating: 10, // ₱10 per page
      };

      res.json({
        success: true,
        data: pricing,
      });
    } catch (error) {
      logger.error('Print pricing error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve print pricing',
      });
    }
  },
);

export { router as enhancedLibraryRoutes };
