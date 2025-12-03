import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, requireRole } from '../middleware/authenticate';
import { BackupService } from '../services/backupService';

const router = Router();

// All backup routes require authentication and admin/librarian role
router.use(authenticate);
router.use(requireRole(['LIBRARIAN']));

// GET /api/backups - List all backups
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    try {
      const backups = await BackupService.listBackups();
      res.json({
        success: true,
        data: backups,
      });
    } catch (_error) {
      res.status(500).json({
        success: false,
        message: 'Failed to list backups',
      });
    }
  }),
);

// GET /api/backups/statistics - Get backup statistics
router.get(
  '/statistics',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    try {
      const backups = await BackupService.listBackups();

      const stats = {
        total: backups.length,
        fullBackups: backups.filter(b => b.type === 'FULL').length,
        incrementalBackups: backups.filter(b => b.type === 'INCREMENTAL')
          .length,
        totalSize: backups.reduce((acc, b) => acc + b.size, 0),
        lastBackup: backups.length > 0 ? backups[0] : null,
        averageSize:
          backups.length > 0
            ? backups.reduce((acc, b) => acc + b.size, 0) / backups.length
            : 0,
      };

      res.json({
        success: true,
        data: stats,
      });
    } catch (_error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get backup statistics',
      });
    }
  }),
);

// POST /api/backups/full - Create full backup
router.post(
  '/full',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { description } = req.body;
      const backup = await BackupService.createBackup(description);

      res.json({
        success: true,
        data: backup,
        message: 'Backup created successfully',
      });
    } catch (_error) {
      res.status(500).json({
        success: false,
        message: 'Failed to create backup',
      });
    }
  }),
);

// POST /api/backups/incremental - Create incremental backup (Alias to full for now)
router.post(
  '/incremental',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { description } = req.body;
      // For now, we only support full backups via JSON dump
      const backup = await BackupService.createBackup(description);

      res.json({
        success: true,
        data: backup,
        message: 'Backup created successfully',
      });
    } catch (_error) {
      res.status(500).json({
        success: false,
        message: 'Failed to create backup',
      });
    }
  }),
);

// POST /api/backups/:id/restore - Restore backup
router.post(
  '/:id/restore',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await BackupService.restoreBackup(id);

      res.json({
        success: true,
        message: 'Backup restored successfully',
      });
    } catch (_error) {
      res.status(500).json({
        success: false,
        message: 'Failed to restore backup',
      });
    }
  }),
);

// DELETE /api/backups/:id - Delete backup
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await BackupService.deleteBackup(id);

      res.json({
        success: true,
        message: 'Backup deleted successfully',
      });
    } catch (_error) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete backup',
      });
    }
  }),
);

export default router;
