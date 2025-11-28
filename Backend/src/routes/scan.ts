import { Router, Request, Response } from 'express';
import { authenticate as authenticateRequest } from '../middleware/authenticate';
import { ScanDispatchService } from '../services/scanDispatchService';
import { logger } from '../utils/logger';

const router = Router();

router.post('/', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const { barcode, ...payload } = req.body || {};
    if (!barcode) {
      return res.status(400).json({
        success: false,
        message: 'barcode is required',
      });
    }

    // Allow librarians and admins to bypass cooldown

    const user = (req as unknown as { user: { role: string } }).user;
    if (user && ['LIBRARIAN', 'ADMIN'].includes(user.role)) {
      payload.overrideCooldown = true;
    }

    const result = await ScanDispatchService.processScan(barcode, payload);
    const status = result.success ? 200 : 400;
    return res.status(status).json(result);
  } catch (error) {
    logger.error('Scan processing failed', {
      error: error instanceof Error ? error.message : error,
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to process scan',
    });
  }
});

export default router;
