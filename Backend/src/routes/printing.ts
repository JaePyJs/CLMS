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
    const pricing = await PrintingService.listPricing(true);
    res.json({ success: true, data: pricing });
  }),
);

// POST /api/printing/pricing
router.post(
  '/pricing',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { paper_size, color_level, price, currency, is_active } = req.body;
    if (!paper_size || !color_level || price === undefined) {
      res.status(400).json({
        success: false,
        message: 'paper_size, color_level, and price are required',
      });
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
    const { student_id, guest_name, paper_size, color_level, pages } = req.body;
    if (
      (!student_id && !guest_name) ||
      !paper_size ||
      !color_level ||
      pages === undefined
    ) {
      res.status(400).json({
        success: false,
        message:
          'Either student_id or guest_name is required, along with paper_size, color_level, and pages',
      });
      return;
    }
    try {
      const job = await PrintingService.createJob({
        student_id,
        guest_name,
        paper_size: paper_size as PaperSize,
        color_level: color_level as ColorLevel,
        pages: parseInt(String(pages), 10),
      });
      res.status(201).json({ success: true, data: job });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to create print job',
      });
    }
  }),
);

// GET /api/printing/export
router.get(
  '/export',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;

    const jobs = await PrintingService.listJobs({ startDate, endDate });

    // Convert to CSV
    const headers = [
      'Date',
      'User',
      'Type',
      'Paper Size',
      'Color',
      'Pages',
      'Cost',
      'Paid',
      'Receipt',
    ];
    const rows = jobs.map((job: any) => {
      const user = job.student
        ? `${job.student.first_name} ${job.student.last_name} (${job.student.student_id})`
        : job.guest_name || 'Unknown Guest';
      const type = job.student ? 'Student' : 'Guest';

      return [
        `"${new Date(job.created_at).toLocaleString()}"`,
        `"${user}"`,
        type,
        job.paper_size,
        job.color_level,
        job.pages,
        job.total_cost,
        job.paid ? 'Yes' : 'No',
        job.receipt_no || '',
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=printing_report.csv',
    );
    res.send(csv);
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
          {
            id: 'DEV-PRINT-1',
            student_id: 'LIBRARIAN',
            paper_size: 'SHORT',
            color_level: 'BW',
            pages: 5,
            total_cost: 10,
            currency: 'PHP',
            paid: false,
            created_at: new Date(),
          },
        ];
        res.json({ success: true, data: devJobs });
        return;
      }
      res
        .status(500)
        .json({ success: false, message: 'Failed to list print jobs' });
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
        const devPaid = {
          id,
          receipt_no: receipt,
          paid: true,
          paid_at: new Date(),
        };
        res.json({ success: true, data: devPaid });
        return;
      }
      res
        .status(500)
        .json({ success: false, message: 'Failed to mark job paid' });
    }
  }),
);

export default router;
