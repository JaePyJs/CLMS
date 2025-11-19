import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { errorLogService } from '../services/errorLogService';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/logs/errors
 * Get all error logs
 */
router.get('/errors', authenticate, async (req: Request, res: Response) => {
  try {
    const level = req.query.level as string | undefined;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : undefined;

    const errors = await errorLogService.getErrorLogs({
      level,
      limit,
    });

    res.json({
      success: true,
      data: {
        errors,
        count: errors.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching error logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch error logs',
    });
  }
});

/**
 * POST /api/logs/errors
 * Create a new error log entry
 */
router.post('/errors', async (req: Request, res: Response) => {
  try {
    const { level, message, stack, userId, endpoint, method, userAgent } =
      req.body;

    if (!level || !message) {
      return res.status(400).json({
        success: false,
        error: 'Level and message are required',
      });
    }

    await errorLogService.logError({
      level,
      message,
      stack,
      userId,
      endpoint,
      method,
      userAgent,
      ipAddress: req.ip || req.connection.remoteAddress,
    });

    res.status(201).json({
      success: true,
      message: 'Error logged successfully',
    });
  } catch (error) {
    logger.error('Error creating error log:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log error',
    });
  }
});

/**
 * DELETE /api/logs/errors/clear
 * Clear all error logs
 */
router.delete(
  '/errors/clear',
  authenticate,
  async (_req: Request, res: Response) => {
    try {
      const result = await errorLogService.clearLogs();

      res.json({
        success: true,
        message: `Cleared ${result.count} error logs`,
        data: result,
      });
    } catch (error) {
      logger.error('Error clearing error logs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear error logs',
      });
    }
  },
);

/**
 * GET /api/logs/errors/statistics
 * Get error log statistics
 */
router.get(
  '/errors/statistics',
  authenticate,
  async (_req: Request, res: Response) => {
    try {
      const stats = await errorLogService.getStatistics();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error fetching error statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch error statistics',
      });
    }
  },
);

export default router;
