import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, requireRole } from '../middleware/authenticate';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { FineCalculationService } from '../services/fineCalculationService';
const router = Router();

// GET /api/fines/overdue
router.get(
  '/overdue',
  authenticate,
  requireRole(['LIBRARIAN']),
  asyncHandler(async (_req: Request, res: Response) => {
    const now = new Date();
    const overdue = await prisma.book_checkouts.findMany({
      where: { status: 'ACTIVE', due_date: { lt: now } },
      include: { student: true, book: true },
      orderBy: { due_date: 'asc' },
    });
    res.json({ success: true, data: overdue });
  }),
);

// GET /api/fines/rate/:gradeLevel
router.get(
  '/rate/:gradeLevel',
  authenticate,
  requireRole(['LIBRARIAN']),
  asyncHandler(async (req: Request, res: Response) => {
    const gradeLevel = parseInt(req.params['gradeLevel'], 10);
    if (Number.isNaN(gradeLevel)) {
      res
        .status(400)
        .json({ success: false, message: 'gradeLevel must be a number' });
      return;
    }
    const rate = await FineCalculationService.getRateForGrade(gradeLevel);
    res.json({ success: true, data: { rate } });
  }),
);

// POST /api/fines/calculate/:checkoutId
router.post(
  '/calculate/:checkoutId',
  authenticate,
  requireRole(['LIBRARIAN']),
  asyncHandler(async (req: Request, res: Response) => {
    const { checkoutId } = req.params;
    logger.info('Calculate fine request', { checkoutId });
    const result =
      await FineCalculationService.calculateFineForCheckout(checkoutId);
    res.json({ success: true, data: result });
  }),
);

// POST /api/fines/mark-paid/:checkoutId
router.post(
  '/mark-paid/:checkoutId',
  authenticate,
  requireRole(['LIBRARIAN']),
  asyncHandler(async (req: Request, res: Response) => {
    const { checkoutId } = req.params;
    logger.info('Mark fine paid request', { checkoutId });
    const updated = await FineCalculationService.markFinePaid(checkoutId);
    res.json({ success: true, data: updated });
  }),
);

// GET /api/fines - Get all fines with optional filters
router.get(
  '/',
  authenticate,
  requireRole(['LIBRARIAN']),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, studentId } = req.query as {
      status?: string;
      studentId?: string;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: Record<string, any> = {};

    // Filter by status
    if (status === 'outstanding') {
      whereClause.fine_status = { in: ['PENDING', 'UNPAID'] };
    } else if (status === 'paid') {
      whereClause.fine_status = 'PAID';
    }

    // Filter by student
    if (studentId) {
      whereClause.student_id = studentId;
    }

    // Only get checkouts that have fines
    whereClause.fine_amount = { gt: 0 };

    const fines = await prisma.book_checkouts.findMany({
      where: whereClause,
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
      orderBy: { checkout_date: 'desc' },
    });

    res.json({ success: true, data: fines });
  }),
);

// GET /api/fines/student/:studentId - Get fines for a specific student
router.get(
  '/student/:studentId',
  authenticate,
  requireRole(['LIBRARIAN']),
  asyncHandler(async (req: Request, res: Response) => {
    const { studentId } = req.params;

    const fines = await prisma.book_checkouts.findMany({
      where: {
        student_id: studentId,
        fine_amount: { gt: 0 },
      },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            author: true,
            accession_no: true,
          },
        },
      },
      orderBy: { checkout_date: 'desc' },
    });

    res.json({ success: true, data: fines });
  }),
);

// POST /api/fines/:checkoutId/payment - Record payment for a fine
router.post(
  '/:checkoutId/payment',
  authenticate,
  requireRole(['LIBRARIAN']),
  asyncHandler(async (req: Request, res: Response) => {
    const { checkoutId } = req.params;
    const {
      amountPaid,
      paymentMethod,
      notes: paymentNotes,
    } = req.body as {
      amountPaid: number;
      paymentMethod?: string;
      notes?: string;
    };

    logger.info('Record fine payment', {
      checkoutId,
      amountPaid,
      paymentMethod,
    });

    const checkout = await prisma.book_checkouts.findUnique({
      where: { id: checkoutId },
    });

    if (!checkout) {
      res.status(404).json({ success: false, message: 'Checkout not found' });
      return;
    }

    // Mark fine as paid if full amount is paid
    const isPaid = amountPaid >= (checkout.fine_amount || 0);

    const updated = await prisma.book_checkouts.update({
      where: { id: checkoutId },
      data: {
        fine_paid: isPaid,
        fine_paid_at: isPaid ? new Date() : undefined,
        notes: paymentNotes
          ? `${checkout.notes || ''}\nPayment: ${amountPaid} via ${paymentMethod || 'cash'} on ${new Date().toISOString()}. ${paymentNotes}`.trim()
          : `${checkout.notes || ''}\nPayment: ${amountPaid} via ${paymentMethod || 'cash'} on ${new Date().toISOString()}`.trim(),
      },
      include: {
        student: true,
        book: true,
      },
    });

    res.json({ success: true, data: updated });
  }),
);

// POST /api/fines/:checkoutId/waive - Waive a fine
router.post(
  '/:checkoutId/waive',
  authenticate,
  requireRole(['LIBRARIAN']),
  asyncHandler(async (req: Request, res: Response) => {
    const { checkoutId } = req.params;
    const { reason } = req.body as { reason: string };

    logger.info('Waive fine', { checkoutId, reason });

    const checkout = await prisma.book_checkouts.findUnique({
      where: { id: checkoutId },
    });

    if (!checkout) {
      res.status(404).json({ success: false, message: 'Checkout not found' });
      return;
    }

    const updated = await prisma.book_checkouts.update({
      where: { id: checkoutId },
      data: {
        fine_amount: 0, // Set to 0 when waived
        fine_paid: true, // Mark as paid (waived counts as resolved)
        fine_paid_at: new Date(),
        notes:
          `${checkout.notes || ''}\nFine WAIVED on ${new Date().toISOString()}. Reason: ${reason}`.trim(),
      },
      include: {
        student: true,
        book: true,
      },
    });

    res.json({ success: true, data: updated });
  }),
);

// PUT /api/fines/:checkoutId/amount - Update fine amount
router.put(
  '/:checkoutId/amount',
  authenticate,
  requireRole(['LIBRARIAN']),
  asyncHandler(async (req: Request, res: Response) => {
    const { checkoutId } = req.params;
    const { amount } = req.body as { amount: number };

    logger.info('Update fine amount', { checkoutId, amount });

    const updated = await prisma.book_checkouts.update({
      where: { id: checkoutId },
      data: {
        fine_amount: amount,
      },
      include: {
        student: true,
        book: true,
      },
    });

    res.json({ success: true, data: updated });
  }),
);

export default router;
