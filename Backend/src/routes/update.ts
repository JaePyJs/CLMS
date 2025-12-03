/**
 * Update Management API Routes
 *
 * Provides endpoints for:
 * - Checking for updates
 * - Performing one-click updates
 * - Force updates
 * - Rollback functionality
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/authenticate';
import { asyncHandler } from '../utils/asyncHandler';
import { updateService } from '../services/updateService';
// Types reserved for future use: VersionInfo, UpdateStatus
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/update/check
 * Check for available updates
 */
router.get(
  '/check',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Update check request', {
      userId: req.user?.userId,
      ip: req.ip,
    });

    try {
      const versionInfo = await updateService.checkForUpdates();
      res.json({
        success: true,
        data: versionInfo,
      });
    } catch (error) {
      logger.error('Update check error:', error);
      res.status(500).json({
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : 'Failed to check for updates',
        },
      });
    }
  }),
);

/**
 * POST /api/update/apply
 * Apply updates (one-click update)
 */
router.post(
  '/apply',
  authenticate,
  requireRole(['LIBRARIAN']), // Only authenticated librarians can apply updates
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Update apply request', {
      userId: req.user?.userId,
      force: req.body.force,
    });

    try {
      // Check if update is already in progress
      if (updateService.isUpdateInProgress()) {
        return res.status(409).json({
          success: false,
          error: {
            message: 'Update is already in progress',
          },
        });
      }

      // Start update process (async)
      const updatePromise = updateService.performUpdate(req.body.force);

      // Send initial response
      res.json({
        success: true,
        message: 'Update started',
        data: {
          status: 'Update process initiated',
        },
      });

      // Log the update process
      try {
        await updatePromise;
        logger.info('Update completed successfully');
      } catch (error) {
        logger.error('Update failed:', error);
      }
    } catch (error) {
      logger.error('Update apply error:', error);
      res.status(500).json({
        success: false,
        error: {
          message:
            error instanceof Error ? error.message : 'Failed to apply updates',
        },
      });
    }
  }),
);

/**
 * POST /api/update/force
 * Force update without checking
 */
router.post(
  '/force',
  authenticate,
  requireRole(['LIBRARIAN']),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Force update request', {
      userId: req.user?.userId,
    });

    try {
      if (updateService.isUpdateInProgress()) {
        return res.status(409).json({
          success: false,
          error: {
            message: 'Update is already in progress',
          },
        });
      }

      const updatePromise = updateService.forceUpdate();

      res.json({
        success: true,
        message: 'Force update started',
        data: {
          status: 'Force update process initiated',
        },
      });

      try {
        await updatePromise;
        logger.info('Force update completed successfully');
      } catch (error) {
        logger.error('Force update failed:', error);
      }
    } catch (error) {
      logger.error('Force update error:', error);
      res.status(500).json({
        success: false,
        error: {
          message:
            error instanceof Error ? error.message : 'Failed to force update',
        },
      });
    }
  }),
);

/**
 * POST /api/update/quick
 * Quick update (build only, skip backup)
 */
router.post(
  '/quick',
  authenticate,
  requireRole(['LIBRARIAN']),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Quick update request', {
      userId: req.user?.userId,
    });

    try {
      if (updateService.isUpdateInProgress()) {
        return res.status(409).json({
          success: false,
          error: {
            message: 'Update is already in progress',
          },
        });
      }

      const updatePromise = updateService.quickUpdate();

      res.json({
        success: true,
        message: 'Quick update started',
        data: {
          status: 'Quick update process initiated',
        },
      });

      try {
        await updatePromise;
        logger.info('Quick update completed successfully');
      } catch (error) {
        logger.error('Quick update failed:', error);
      }
    } catch (error) {
      logger.error('Quick update error:', error);
      res.status(500).json({
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : 'Failed to perform quick update',
        },
      });
    }
  }),
);

/**
 * GET /api/update/status
 * Get current update status
 */
router.get(
  '/status',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    try {
      const status = updateService.getUpdateStatus();
      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error('Update status error:', error);
      res.status(500).json({
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : 'Failed to get update status',
        },
      });
    }
  }),
);

/**
 * POST /api/update/rollback
 * Rollback to previous version
 */
router.post(
  '/rollback',
  authenticate,
  requireRole(['LIBRARIAN']),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Rollback request', {
      userId: req.user?.userId,
    });

    try {
      if (updateService.isUpdateInProgress()) {
        return res.status(409).json({
          success: false,
          error: {
            message: 'Cannot rollback while update is in progress',
          },
        });
      }

      await updateService.rollbackUpdate();

      logger.info('Rollback completed successfully');
      res.json({
        success: true,
        message: 'Rollback completed successfully',
      });
    } catch (error) {
      logger.error('Rollback error:', error);
      res.status(500).json({
        success: false,
        error: {
          message:
            error instanceof Error ? error.message : 'Failed to rollback',
        },
      });
    }
  }),
);

/**
 * GET /api/update/versions
 * Get list of available updates
 */
router.get(
  '/versions',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    try {
      const versions = await updateService.getAvailableUpdates();
      res.json({
        success: true,
        data: versions,
      });
    } catch (error) {
      logger.error('Get versions error:', error);
      res.status(500).json({
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : 'Failed to get available versions',
        },
      });
    }
  }),
);

/**
 * POST /api/update/cleanup
 * Clean up old backups
 */
router.post(
  '/cleanup',
  authenticate,
  requireRole(['LIBRARIAN']),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Backup cleanup request', {
      userId: req.user?.userId,
      keepCount: req.body.keepCount,
    });

    try {
      await updateService.cleanupOldBackups(req.body.keepCount || 5);

      res.json({
        success: true,
        message: 'Backup cleanup completed',
      });
    } catch (error) {
      logger.error('Backup cleanup error:', error);
      res.status(500).json({
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : 'Failed to cleanup backups',
        },
      });
    }
  }),
);

/**
 * GET /api/update/build-info
 * Get build and version information
 */
router.get(
  '/build-info',
  asyncHandler(async (_req: Request, res: Response) => {
    try {
      const version = await updateService.getCurrentVersion();

      const buildInfo = {
        version,
        buildTime: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        environment: process.env.NODE_ENV || 'development',
      };

      res.json({
        success: true,
        data: buildInfo,
      });
    } catch (error) {
      logger.error('Build info error:', error);
      res.status(500).json({
        success: false,
        error: {
          message:
            error instanceof Error ? error.message : 'Failed to get build info',
        },
      });
    }
  }),
);

export default router;
