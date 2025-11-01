import express from 'express';
import { backupService } from '../services/backup.service';
import { authMiddleware } from '../middleware/auth';
import { requireAdmin } from '../middleware/authorization.middleware';

const router = express.Router();

// Apply authentication and admin check to all routes
router.use(authMiddleware);
router.use(requireAdmin);

/**
 * @route   GET /api/backups
 * @desc    List all backups
 * @access  Private (Admin only)
 */
router.get('/', async (req, res) => {
  try {
    const { type, status, limit } = req.query;

    const backups = await backupService.listBackups({
      type: type as any,
      status: status as string,
      ...(limit ? { limit: parseInt(limit as string) } : {}),
    });

    res.json({
      success: true,
      data: backups,
    });
  } catch (error) {
    console.error('Error listing backups:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list backups',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   GET /api/backups/statistics
 * @desc    Get backup statistics
 * @access  Private (Admin only)
 */
router.get('/statistics', async (req, res) => {
  try {
    const stats = await backupService.getStatistics();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching backup statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch backup statistics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   GET /api/backups/:id
 * @desc    Get backup metadata
 * @access  Private (Admin only)
 */
router.get('/:id', async (req, res) => {
  try {
    const backup = await backupService.getBackupMetadata(req.params.id);

    if (!backup) {
      res.status(404).json({
        success: false,
        message: 'Backup not found',
      });
      return;
    }

    res.json({
      success: true,
      data: backup,
    });
  } catch (error) {
    console.error('Error fetching backup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch backup',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   POST /api/backups/full
 * @desc    Create full backup
 * @access  Private (Admin only)
 */
router.post('/full', async (req, res) => {
  try {
    const { description } = req.body;

    const backup = await backupService.createFullBackup(description);

    res.status(201).json({
      success: true,
      data: backup,
      message: 'Full backup created successfully',
    });
  } catch (error) {
    console.error('Error creating full backup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create full backup',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   POST /api/backups/incremental
 * @desc    Create incremental backup
 * @access  Private (Admin only)
 */
router.post('/incremental', async (req, res) => {
  try {
    const { description } = req.body;

    const backup = await backupService.createIncrementalBackup(description);

    res.status(201).json({
      success: true,
      data: backup,
      message: 'Incremental backup created successfully',
    });
  } catch (error) {
    console.error('Error creating incremental backup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create incremental backup',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   POST /api/backups/:id/verify
 * @desc    Verify backup integrity
 * @access  Private (Admin only)
 */
router.post('/:id/verify', async (req, res) => {
  try {
    const isValid = await backupService.verifyBackup(req.params.id);

    res.json({
      success: true,
      data: { valid: isValid },
      message: isValid ? 'Backup is valid' : 'Backup verification failed',
    });
  } catch (error) {
    console.error('Error verifying backup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify backup',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   POST /api/backups/:id/restore
 * @desc    Restore from backup
 * @access  Private (Admin only)
 */
router.post('/:id/restore', async (req, res) => {
  try {
    const { dryRun } = req.body;

    await backupService.restoreFromBackup({
      backupId: req.params.id,
      dryRun: dryRun === true,
    });

    res.json({
      success: true,
      message: dryRun ? 'Dry run completed successfully' : 'Backup restored successfully',
    });
  } catch (error) {
    console.error('Error restoring backup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restore backup',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   DELETE /api/backups/:id
 * @desc    Delete backup
 * @access  Private (Admin only)
 */
router.delete('/:id', async (req, res) => {
  try {
    await backupService.deleteBackup(req.params.id);

    res.json({
      success: true,
      message: 'Backup deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting backup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete backup',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
