import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, requireRole } from '../middleware/authenticate';
import { AutomationService } from '../services/automationService';

const router = Router();

// All automation routes require authentication (single-user system)
router.use(authenticate);
router.use(requireRole('LIBRARIAN'));

// GET /api/automation/jobs - List all jobs
router.get(
  '/jobs',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    try {
      const jobs = await AutomationService.getJobs();
      res.json(jobs);
    } catch (_error) {
      res.status(500).json({
        message: 'Failed to list automation jobs',
      });
    }
  }),
);

// GET /api/automation/jobs/:id/history - Get job history
router.get(
  '/jobs/:id/history',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const history = await AutomationService.getJobHistory(id);
      res.json(history);
    } catch (_error) {
      res.status(500).json({
        message: 'Failed to get job history',
      });
    }
  }),
);

// POST /api/automation/jobs/:id/enable - Enable job
router.post(
  '/jobs/:id/enable',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const job = await AutomationService.toggleJob(id, true);
      res.json(job);
    } catch (_error) {
      res.status(500).json({
        message: 'Failed to enable job',
      });
    }
  }),
);

// POST /api/automation/jobs/:id/disable - Disable job
router.post(
  '/jobs/:id/disable',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const job = await AutomationService.toggleJob(id, false);
      res.json(job);
    } catch (_error) {
      res.status(500).json({
        message: 'Failed to disable job',
      });
    }
  }),
);

// POST /api/automation/jobs/:id/run - Run job now
router.post(
  '/jobs/:id/run',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await AutomationService.runJob(id);
      res.json({ message: 'Job started successfully' });
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to run job',
      });
    }
  }),
);

export default router;
