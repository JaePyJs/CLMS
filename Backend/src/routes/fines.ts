/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, requireRole } from '../middleware/authenticate';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';
import { FineCalculationService } from '../services/fineCalculationService';

const prisma = new PrismaClient();
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
    const gradeLevel = parseInt(req.params['gradeLevel'] as string, 10);
    if (Number.isNaN(gradeLevel)) {
      res.status(400).json({ success: false, message: 'gradeLevel must be a number' });
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
    const result = await FineCalculationService.calculateFineForCheckout(checkoutId);
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

export default router;