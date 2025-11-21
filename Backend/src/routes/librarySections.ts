/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/authenticate';
import { logger } from '../utils/logger';
import { LibrarySectionsService } from '../services/librarySectionsService';

const router = Router();

// GET /api/sections
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('List library sections', {
      query: req.query,
      userId: (req as any).user?.id,
    });
    const onlyActive = req.query['active'] === 'true';
    const sections = await LibrarySectionsService.listSections(onlyActive);
    res.json({ success: true, data: sections });
  }),
);

// GET /api/sections/code/:code
router.get(
  '/code/:code',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Get section by code', {
      code: req.params['code'],
      userId: (req as any).user?.id,
    });
    const section = await LibrarySectionsService.getSectionByCode(
      req.params['code'],
    );
    if (!section) {
      res.status(404).json({ success: false, message: 'Section not found' });
      return;
    }
    res.json({ success: true, data: section });
  }),
);

// POST /api/sections
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Create library section', {
      body: req.body,
      userId: (req as any).user?.id,
    });
    const { code, name, description, is_active } = req.body;
    if (!code || !name) {
      res
        .status(400)
        .json({ success: false, message: 'code and name are required' });
      return;
    }
    const created = await LibrarySectionsService.createSection({
      code,
      name,
      description,
      is_active,
    });
    res.status(201).json({ success: true, data: created });
  }),
);

// PUT /api/sections/:id
router.put(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Update library section', {
      id: req.params['id'],
      fields: Object.keys(req.body),
    });
    const updated = await LibrarySectionsService.updateSection(
      req.params['id'],
      req.body,
    );
    res.json({ success: true, data: updated });
  }),
);

// DELETE /api/sections/:id
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Delete library section', { id: req.params['id'] });
    await LibrarySectionsService.deleteSection(req.params['id']);
    res.json({ success: true, message: 'Section deleted successfully' });
  }),
);

// POST /api/sections/ensure-defaults
router.post(
  '/ensure-defaults',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    await LibrarySectionsService.ensureDefaultSections();
    res.json({ success: true, message: 'Default sections ensured' });
  }),
);

export default router;
