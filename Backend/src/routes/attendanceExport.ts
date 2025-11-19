import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/authenticate';
import { AttendanceExportService } from '../services/attendanceExportService';
import { logger } from '../utils/logger';

const router = Router();

// All attendance export routes require authentication
router.use(authenticate);

// GET /api/attendance-export/data - Get attendance data for export
router.get(
  '/data',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: 'Start date and end date are required',
        });
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Invalid date format',
        });
        return;
      }

      logger.info('Get attendance data for export', {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        userId: req.user!.userId,
      });

      const data = await AttendanceExportService.getAttendanceData(start, end);

      res.json({
        success: true,
        data,
        count: data.length,
      });
    } catch (error) {
      logger.error('Error getting attendance data', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve attendance data',
      });
    }
  }),
);

// GET /api/attendance-export/export/csv - Export attendance to CSV
router.get(
  '/export/csv',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: 'Start date and end date are required',
        });
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Invalid date format',
        });
        return;
      }

      logger.info('Export attendance to CSV', {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        userId: req.user!.userId,
      });

      const csv = await AttendanceExportService.exportToCSV(start, end);

      // Set headers for CSV download
      const filename = `clms-attendance-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );

      res.send(csv);
    } catch (error) {
      logger.error('Error exporting to CSV', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to export to CSV',
      });
    }
  }),
);

// GET /api/attendance-export/summary - Get attendance summary statistics
router.get(
  '/summary',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: 'Start date and end date are required',
        });
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Invalid date format',
        });
        return;
      }

      logger.info('Get attendance summary', {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        userId: req.user!.userId,
      });

      const summary = await AttendanceExportService.generateSummary(start, end);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error('Error generating attendance summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to generate summary',
      });
    }
  }),
);

// GET /api/attendance-export/google-sheets - Prepare data for Google Sheets
router.get(
  '/google-sheets',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: 'Start date and end date are required',
        });
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Invalid date format',
        });
        return;
      }

      logger.info('Prepare data for Google Sheets', {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        userId: req.user!.userId,
      });

      const sheetsData = await AttendanceExportService.prepareGoogleSheetsData(
        start,
        end,
      );

      res.json({
        success: true,
        data: sheetsData,
      });
    } catch (error) {
      logger.error('Error preparing Google Sheets data', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to prepare Google Sheets data',
      });
    }
  }),
);

export default router;
