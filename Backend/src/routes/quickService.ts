/**
 * Quick Service and Manual Lookup Routes
 * For handling special cases like "print and go" students and forgotten barcodes
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/authenticate';
import {
  QuickServiceMode,
  QuickServiceType,
} from '../services/quickServiceMode';
import { ManualLookupService } from '../services/manualLookupService';
import { logger } from '../utils/logger';

const router = Router();

// ==================== Quick Service Routes ====================

/**
 * POST /api/quick-service
 * Log a quick service (print and go, photocopy, etc.)
 */
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { studentId, serviceType, notes, usedManualLookup } = req.body;

    if (!studentId || !serviceType) {
      res.status(400).json({
        success: false,
        message: 'studentId and serviceType are required',
      });
      return;
    }

    const validTypes: QuickServiceType[] = [
      'PRINTING',
      'PHOTOCOPY',
      'LAMINATION',
      'INQUIRY',
      'OTHER',
    ];
    if (!validTypes.includes(serviceType)) {
      res.status(400).json({
        success: false,
        message: `Invalid serviceType. Must be one of: ${validTypes.join(', ')}`,
      });
      return;
    }

    const result = await QuickServiceMode.startQuickService(
      studentId,
      serviceType,
      notes,
      usedManualLookup || false,
    );

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          serviceId: result.serviceId,
          student: result.student,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    logger.error('Quick service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log quick service',
    });
  }
});

/**
 * GET /api/quick-service/history
 * Get quick service history
 */
router.get(
  '/history',
  authenticate,
  requireRole(['LIBRARIAN', 'ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, limit } = req.query;

      const history = await QuickServiceMode.getQuickServiceHistory(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
        limit ? parseInt(limit as string) : 50,
      );

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      logger.error('Get quick service history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get quick service history',
      });
    }
  },
);

/**
 * GET /api/quick-service/stats
 * Get quick service statistics
 */
router.get(
  '/stats',
  authenticate,
  requireRole(['LIBRARIAN', 'ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;

      const stats = await QuickServiceMode.getQuickServiceStats(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Get quick service stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get quick service statistics',
      });
    }
  },
);

// ==================== Manual Lookup Routes ====================

/**
 * GET /api/manual-lookup/search
 * Search for students by name (for forgotten barcode scenarios)
 */
router.get(
  '/search',
  authenticate,
  requireRole(['LIBRARIAN', 'ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const { q, limit } = req.query;

      if (!q || (q as string).trim().length < 2) {
        res.status(400).json({
          success: false,
          message: 'Search query must be at least 2 characters',
        });
        return;
      }

      const students = await ManualLookupService.searchByName(
        q as string,
        limit ? parseInt(limit as string) : 10,
      );

      res.json({
        success: true,
        data: students,
      });
    } catch (error) {
      logger.error('Manual lookup search error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search students',
      });
    }
  },
);

/**
 * POST /api/manual-lookup/check-in
 * Manually check in a student who forgot their barcode
 */
router.post(
  '/check-in',
  authenticate,
  requireRole(['LIBRARIAN', 'ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const { studentId, reason } = req.body;
      const librarianId = req.user?.userId || 'unknown';

      if (!studentId) {
        res.status(400).json({
          success: false,
          message: 'studentId is required',
        });
        return;
      }

      const result = await ManualLookupService.manualCheckIn(
        studentId,
        librarianId,
        reason || 'Forgot barcode',
      );

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          data: {
            student: result.student,
            activity: result.activity,
          },
          warning: result.warning,
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message,
        });
      }
    } catch (error) {
      logger.error('Manual check-in error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to manually check in student',
      });
    }
  },
);

/**
 * GET /api/manual-lookup/stats
 * Get manual lookup statistics (frequent offenders, etc.)
 */
router.get(
  '/stats',
  authenticate,
  requireRole(['LIBRARIAN', 'ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;

      const stats = await ManualLookupService.getManualLookupStats(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Get manual lookup stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get manual lookup statistics',
      });
    }
  },
);

export { router as quickServiceRoutes };
