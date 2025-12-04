import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/authenticate';
import { logger } from '../utils/logger';
import prisma from '../utils/prisma';

const router = Router();

/**
 * Get all calendar events
 * Optional query params: startDate, endDate, eventType
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, eventType } = req.query;

    const where: Record<string, unknown> = {
      is_active: true,
    };

    // Filter by date range
    if (startDate || endDate) {
      where.event_date = {};
      if (startDate) {
        (where.event_date as Record<string, Date>).gte = new Date(
          startDate as string,
        );
      }
      if (endDate) {
        (where.event_date as Record<string, Date>).lte = new Date(
          endDate as string,
        );
      }
    }

    // Filter by event type
    if (eventType && eventType !== 'all') {
      where.event_type = eventType;
    }

    const events = await prisma.calendar_events.findMany({
      where,
      orderBy: { event_date: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: events,
    });
  } catch (error) {
    logger.error('Get calendar events error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get calendar events',
    });
  }
});

/**
 * Get single calendar event by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const event = await prisma.calendar_events.findUnique({
      where: { id },
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    logger.error('Get calendar event error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get calendar event',
    });
  }
});

/**
 * Create new calendar event
 */
router.post(
  '/',
  authenticate,
  requireRole(['LIBRARIAN', 'ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const {
        title,
        description,
        eventDate,
        endDate,
        eventType,
        color,
        allDay,
      } = req.body;

      if (!title || !eventDate) {
        return res.status(400).json({
          success: false,
          message: 'Title and event date are required',
        });
      }

      // Validate event type
      const validTypes = [
        'reminder',
        'holiday',
        'deadline',
        'meeting',
        'other',
      ];
      const type = eventType || 'reminder';
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid event type. Must be one of: ${validTypes.join(', ')}`,
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (req as any).user?.userId || null;

      const event = await prisma.calendar_events.create({
        data: {
          title,
          description: description || null,
          event_date: new Date(eventDate),
          end_date: endDate ? new Date(endDate) : null,
          event_type: type,
          color: color || '#3b82f6',
          all_day: allDay !== false,
          created_by: userId,
        },
      });

      logger.info('Calendar event created', { eventId: event.id, title });

      return res.status(201).json({
        success: true,
        data: event,
        message: 'Event created successfully',
      });
    } catch (error) {
      logger.error('Create calendar event error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create calendar event',
      });
    }
  },
);

/**
 * Update calendar event
 */
router.put(
  '/:id',
  authenticate,
  requireRole(['LIBRARIAN', 'ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        title,
        description,
        eventDate,
        endDate,
        eventType,
        color,
        allDay,
      } = req.body;

      // Check if event exists
      const existing = await prisma.calendar_events.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Event not found',
        });
      }

      // Build update data
      const updateData: Record<string, unknown> = {};

      if (title !== undefined) {
        updateData.title = title;
      }
      if (description !== undefined) {
        updateData.description = description;
      }
      if (eventDate !== undefined) {
        updateData.event_date = new Date(eventDate);
      }
      if (endDate !== undefined) {
        updateData.end_date = endDate ? new Date(endDate) : null;
      }
      if (eventType !== undefined) {
        const validTypes = [
          'reminder',
          'holiday',
          'deadline',
          'meeting',
          'other',
        ];
        if (!validTypes.includes(eventType)) {
          return res.status(400).json({
            success: false,
            message: `Invalid event type. Must be one of: ${validTypes.join(', ')}`,
          });
        }
        updateData.event_type = eventType;
      }
      if (color !== undefined) {
        updateData.color = color;
      }
      if (allDay !== undefined) {
        updateData.all_day = allDay;
      }

      const event = await prisma.calendar_events.update({
        where: { id },
        data: updateData,
      });

      logger.info('Calendar event updated', { eventId: event.id });

      return res.status(200).json({
        success: true,
        data: event,
        message: 'Event updated successfully',
      });
    } catch (error) {
      logger.error('Update calendar event error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update calendar event',
      });
    }
  },
);

/**
 * Delete calendar event (soft delete)
 */
router.delete(
  '/:id',
  authenticate,
  requireRole(['LIBRARIAN', 'ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Check if event exists
      const existing = await prisma.calendar_events.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Event not found',
        });
      }

      // Soft delete by setting is_active to false
      await prisma.calendar_events.update({
        where: { id },
        data: { is_active: false },
      });

      logger.info('Calendar event deleted', { eventId: id });

      return res.status(200).json({
        success: true,
        message: 'Event deleted successfully',
      });
    } catch (error) {
      logger.error('Delete calendar event error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete calendar event',
      });
    }
  },
);

/**
 * Get events for a specific month (optimized query)
 */
router.get('/month/:year/:month', async (req: Request, res: Response) => {
  try {
    const { year, month } = req.params;
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        success: false,
        message: 'Invalid year or month',
      });
    }

    // Get first and last day of the month
    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59);

    const events = await prisma.calendar_events.findMany({
      where: {
        is_active: true,
        event_date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { event_date: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: events,
    });
  } catch (error) {
    logger.error('Get monthly calendar events error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get monthly events',
    });
  }
});

export default router;
