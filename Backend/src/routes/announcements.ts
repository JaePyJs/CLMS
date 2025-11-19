/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/authenticate';
import { AnnouncementService } from '../services/announcementService';

const router = Router();

// GET /api/announcements
router.get(
  '/',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    const all = await AnnouncementService.listAll();
    res.json({ success: true, data: all });
  }),
);

// GET /api/announcements/active
router.get(
  '/active',
  asyncHandler(async (_req: Request, res: Response) => {
    const active = await AnnouncementService.listActive();
    res.json({ success: true, data: active });
  }),
);

// POST /api/announcements
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { title, content, start_time, end_time, is_active, priority } = req.body;
    if (!title || !content || !start_time) {
      res.status(400).json({ success: false, message: 'title, content, start_time are required' });
      return;
    }
    const created = await AnnouncementService.create({
      title,
      content,
      start_time: new Date(start_time),
      end_time: end_time ? new Date(end_time) : undefined,
      is_active,
      priority,
    });
    res.status(201).json({ success: true, data: created });
  }),
);

// PUT /api/announcements/:id
router.put(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await AnnouncementService.update(req.params['id'], req.body);
    res.json({ success: true, data: updated });
  }),
);

// DELETE /api/announcements/:id
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    await AnnouncementService.delete(req.params['id']);
    res.json({ success: true, message: 'Announcement deleted successfully' });
  }),
);

export default router;