import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/authenticate';
import { SelfService } from '../services/selfService';
import { logger } from '../utils/logger';

const router = Router();

// All self-service routes require authentication
router.use(authenticate);

// POST /api/v1/self-service/scan - Process a student scan (auto check-in or check-out)
router.post(
  '/scan',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { scanData } = req.body;

    if (!scanData) {
      res.status(400).json({
        success: false,
        message: 'Scan data is required',
        code: 'MISSING_SCAN_DATA',
      });
      return;
    }

    try {
      logger.info('Self-service scan request', {
        scanData: `${scanData.substring(0, 10)}...`, // Log partial barcode
        userId: req.user.userId,
        ip: req.ip,
      });

      const result = await SelfService.processScan(scanData);

      if (!result.success) {
        logger.warn('Self-service scan failed', {
          scanData: `${scanData.substring(0, 10)}...`,
          reason: result.message,
          userId: req.user.userId,
        });
      } else {
        logger.info('Self-service scan successful', {
          scanData: `${scanData.substring(0, 10)}...`,
          action: result.message,
          userId: req.user.userId,
        });
      }

      res.json(result);
    } catch (error) {
      logger.error('Self-service scan error', {
        scanData: `${scanData.substring(0, 10)}...`,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.userId,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to process scan',
        code: 'SCAN_PROCESSING_FAILED',
      });
    }
  }),
);

// GET /api/v1/self-service/status/:scanData - Get student status
router.get(
  '/status/:scanData',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { scanData } = req.params;

    if (!scanData) {
      res.status(400).json({
        success: false,
        message: 'Scan data is required',
        code: 'MISSING_SCAN_DATA',
      });
      return;
    }

    try {
      logger.info('Self-service status request', {
        scanData: `${scanData.substring(0, 10)}...`,
        userId: req.user.userId,
        ip: req.ip,
      });

      const result = await SelfService.getStatus(scanData);

      logger.info('Self-service status retrieved', {
        scanData: `${scanData.substring(0, 10)}...`,
        isCheckedIn: result.isCheckedIn,
        userId: req.user.userId,
      });

      res.json(result);
    } catch (error) {
      logger.error('Self-service status error', {
        scanData: `${scanData.substring(0, 10)}...`,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.userId,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get status',
        code: 'STATUS_RETRIEVAL_FAILED',
      });
    }
  }),
);

// POST /api/v1/self-service/check-in - Check in a student
router.post(
  '/check-in',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { scanData } = req.body;

    if (!scanData) {
      res.status(400).json({
        success: false,
        message: 'Scan data is required',
        code: 'MISSING_SCAN_DATA',
      });
      return;
    }

    try {
      logger.info('Self-service check-in request', {
        scanData: `${scanData.substring(0, 10)}...`,
        userId: req.user.userId,
        ip: req.ip,
      });

      // First find student by barcode
      const statusResult = await SelfService.getStatus(scanData);

      if (!statusResult.success) {
        res.status(404).json({
          success: false,
          message: 'Student not found',
          code: 'STUDENT_NOT_FOUND',
        });
        return;
      }

      if (statusResult.isCheckedIn) {
        res.status(400).json({
          success: false,
          message: 'Student is already checked in',
          code: 'ALREADY_CHECKED_IN',
        });
        return;
      }

      const result = await SelfService.checkIn(statusResult.student!.id);

      if (!result.success) {
        logger.warn('Self-service check-in failed', {
          scanData: `${scanData.substring(0, 10)}...`,
          reason: result.message,
          userId: req.user.userId,
        });
      } else {
        logger.info('Self-service check-in successful', {
          scanData: `${scanData.substring(0, 10)}...`,
          studentId: result.student!.id,
          userId: req.user.userId,
        });
      }

      res.json(result);
    } catch (error) {
      logger.error('Self-service check-in error', {
        scanData: `${scanData.substring(0, 10)}...`,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.userId,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to check in',
        code: 'CHECK_IN_FAILED',
      });
    }
  }),
);

// POST /api/v1/self-service/check-out - Check out a student
router.post(
  '/check-out',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { scanData } = req.body;

    if (!scanData) {
      res.status(400).json({
        success: false,
        message: 'Scan data is required',
        code: 'MISSING_SCAN_DATA',
      });
      return;
    }

    try {
      logger.info('Self-service check-out request', {
        scanData: `${scanData.substring(0, 10)}...`,
        userId: req.user.userId,
        ip: req.ip,
      });

      // First find student and check status
      const statusResult = await SelfService.getStatus(scanData);

      if (!statusResult.success) {
        res.status(404).json({
          success: false,
          message: 'Student not found',
          code: 'STUDENT_NOT_FOUND',
        });
        return;
      }

      if (!statusResult.isCheckedIn || !statusResult.currentActivity) {
        res.status(400).json({
          success: false,
          message: 'Student is not checked in',
          code: 'NOT_CHECKED_IN',
        });
        return;
      }

      const result = await SelfService.checkOut(
        statusResult.student!.id,
        statusResult.currentActivity.id,
      );

      if (!result.success) {
        logger.warn('Self-service check-out failed', {
          scanData: `${scanData.substring(0, 10)}...`,
          reason: result.message,
          userId: req.user.userId,
        });
      } else {
        logger.info('Self-service check-out successful', {
          scanData: `${scanData.substring(0, 10)}...`,
          studentId: result.student!.id,
          userId: req.user.userId,
        });
      }

      res.json(result);
    } catch (error) {
      logger.error('Self-service check-out error', {
        scanData: `${scanData.substring(0, 10)}...`,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.userId,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to check out',
        code: 'CHECK_OUT_FAILED',
      });
    }
  }),
);

// GET /api/v1/self-service/statistics - Get self-service statistics
router.get(
  '/statistics',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { startDate, endDate } = req.query;

    try {
      logger.info('Self-service statistics request', {
        startDate,
        endDate,
        userId: req.user.userId,
        ip: req.ip,
      });

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const statistics = await SelfService.getStatistics(start, end);

      logger.info('Self-service statistics retrieved', {
        totalCheckIns: statistics.totalCheckIns,
        uniqueStudents: statistics.uniqueStudents,
        userId: req.user.userId,
      });

      res.json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      logger.error('Self-service statistics error', {
        startDate,
        endDate,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.userId,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get statistics',
        code: 'STATISTICS_RETRIEVAL_FAILED',
      });
    }
  }),
);

export default router;
