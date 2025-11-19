/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/authenticate';
import { PrintingService } from '../services/printingService';
import { isDevelopment } from '../config/env';
type PaperSize = 'SHORT' | 'LONG';
type ColorLevel = 'BW' | 'HALF_COLOR' | 'FULL_COLOR';

const router = Router();

// GET /api/printing/pricing
router.get(
  '/pricing',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    try {
      const pricing = await PrintingService.listPricing(true);
      res.json({ success: true, data: pricing });
    } catch (_e) {
      if (isDevelopment()) {
        const devPricing = [
          { paper_size: 'SHORT', color_level: 'BW', price: 2, currency: 'PHP' },
          { paper_size: 'SHORT', color_level: 'HALF_COLOR', price: 5, currency: 'PHP' },
          { paper_size: 'SHORT', color_level: 'FULL_COLOR', price: 10, currency: 'PHP' },
          { paper_size: 'LONG', color_level: 'BW', price: 3, currency: 'PHP' },
          { paper_size: 'LONG', color_level: 'HALF_COLOR', price: 6, currency: 'PHP' },
          { paper_size: 'LONG', color_level: 'FULL_COLOR', price: 11, currency: 'PHP' },
        ];
        res.json({ success: true, data: devPricing });
        return;
      }
      res.status(500).json({ success: false, message: 'Failed to load pricing' });
    }
  }),
);

// POST /api/printing/pricing
router.post(
  '/pricing',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { paper_size, color_level, price, currency, is_active } = req.body;
    if (!paper_size || !color_level || price === undefined) {
      res.status(400).json({ success: false, message: 'paper_size, color_level, and price are required' });
      return;
    }
    const created = await PrintingService.createPricing({
      paper_size: paper_size as PaperSize,
      color_level: color_level as ColorLevel,
      price,
      currency,
      is_active,
    });
    res.status(201).json({ success: true, data: created });
  }),
);

// POST /api/printing/jobs
router.post(
  '/jobs',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { student_id, paper_size, color_level, pages } = req.body;
    if (!student_id || !paper_size || !color_level || pages === undefined) {
      res.status(400).json({ success: false, message: 'student_id, paper_size, color_level, pages are required' });
      return;
    }
    try {
      const job = await PrintingService.createJob({
        student_id,
        paper_size: paper_size as PaperSize,
        color_level: color_level as ColorLevel,
        pages: parseInt(String(pages), 10),
      });
      res.status(201).json({ success: true, data: job });
    } catch (_e) {
      if (isDevelopment()) {
        const priceMap: Record<string, number> = {
          'SHORT|BW': 2,
          'SHORT|HALF_COLOR': 5,
          'SHORT|FULL_COLOR': 10,
          'LONG|BW': 3,
          'LONG|HALF_COLOR': 6,
          'LONG|FULL_COLOR': 11,
        };
        const key = `${String(paper_size).toUpperCase()}|${String(color_level).toUpperCase()}`;
        const unit = priceMap[key] || 0;
        const total = unit * parseInt(String(pages), 10);
        const devJob = {
          id: 'DEV-PRINT-1',
          student_id,
          paper_size,
          color_level,
          pages: parseInt(String(pages), 10),
          total_cost: total,
          currency: 'PHP',
          paid: false,
          created_at: new Date(),
        };
        res.status(201).json({ success: true, data: devJob });
        return;
      }
      res.status(500).json({ success: false, message: 'Failed to create print job' });
    }
  }),
);

// GET /api/printing/jobs
router.get(
  '/jobs',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const filters: any = {};
    if (req.query['student_id']) {
      filters.student_id = req.query['student_id'];
    }
    if (req.query['paid'] !== undefined) {
      filters.paid = req.query['paid'] === 'true';
    }
    try {
      const jobs = await PrintingService.listJobs(filters);
      res.json({ success: true, data: jobs });
    } catch (_e) {
      if (isDevelopment()) {
        const devJobs = [
          { id: 'DEV-PRINT-1', student_id: 'LIBRARIAN', paper_size: 'SHORT', color_level: 'BW', pages: 5, total_cost: 10, currency: 'PHP', paid: false, created_at: new Date() },
        ];
        res.json({ success: true, data: devJobs });
        return;
      }
      res.status(500).json({ success: false, message: 'Failed to list print jobs' });
    }
  }),
);

// POST /api/printing/jobs/:id/pay
router.post(
  '/jobs/:id/pay',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { receipt_no } = req.body;
    try {
      const updated = await PrintingService.markJobPaid(id, receipt_no);
      res.json({ success: true, data: updated });
    } catch (_e) {
      if (isDevelopment()) {
        const receipt = receipt_no || `DEV-REC-${Date.now()}`;
        const devPaid = { id, receipt_no: receipt, paid: true, paid_at: new Date() };
        res.json({ success: true, data: devPaid });
        return;
      }
      res.status(500).json({ success: false, message: 'Failed to mark job paid' });
    }
  }),
);

export default router;