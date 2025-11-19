import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/authenticate';
import { SelfService } from '../services/selfService';
import { logger } from '../utils/logger';
import prisma from '../utils/prisma';
import { webSocketManager } from '../websocket/websocketServer';

const router = Router();
// Use shared Prisma client

interface TapInRequest {
  scanData: string;
}

interface ConfirmCheckInRequest {
  studentId: string;
  purpose: string;
  scanData: string;
}

const announcementConfig: { quietMode: boolean; intervalSeconds: number; messages: string[] } = {
  quietMode: false,
  intervalSeconds: 60,
  messages: [
    'Reading is dreaming with open eyes.',
    'A book a day keeps boredom away.',
    'Today a reader, tomorrow a leader.',
    'Dive into a good book!',
  ],
};

/**
 * Process tap-in scan
 * Validates student and checks cooldown period
 */
router.post('/tap-in', async (req: Request<{}, {}, TapInRequest>, res: Response) => {
  try {
    const { scanData } = req.body;

    if (!scanData) {
      return res.status(400).json({
        success: false,
        message: 'Scan data is required',
        canCheckIn: false
      });
    }

    // Use existing self-service logic for cooldown and validation
    const statusResult = await SelfService.getStatus(scanData);

    if (!statusResult.success) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
        canCheckIn: false
      });
    }

    // Check if student is already checked in
    if (statusResult.isCheckedIn) {
      return res.status(200).json({
        success: false,
        message: 'You are already checked in',
        student: statusResult.student,
        canCheckIn: false
      });
    }

    // Check cooldown period
    if (statusResult.cooldownRemaining && statusResult.cooldownRemaining > 0) {
      return res.status(200).json({
        success: false,
        message: `Please wait ${Math.ceil(statusResult.cooldownRemaining / 60)} more minute(s) before checking in again`,
        cooldownRemaining: statusResult.cooldownRemaining,
        canCheckIn: false
      });
    }

    // Student can check in
    return res.status(200).json({
      success: true,
      message: 'Student validated successfully',
      student: statusResult.student,
      canCheckIn: true
    });

  } catch (error) {
    logger.error('Tap-in error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process tap-in',
      canCheckIn: false
    });
  }
});

/**
 * Confirm check-in with purpose
 * Creates activity record and handles navigation
 */
  router.post('/confirm-check-in', async (req: Request<{}, {}, ConfirmCheckInRequest>, res: Response) => {
  try {
    const { studentId, purpose, scanData } = req.body;

    if (!studentId || !purpose || !scanData) {
      return res.status(400).json({
        success: false,
        message: 'Student ID, purpose, and scan data are required'
      });
    }

    // Validate purpose
    const validPurposes = ['avr', 'computer', 'library', 'borrowing', 'recreation'];
    if (!validPurposes.includes(purpose)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid purpose selected'
      });
    }

    // Check if student already has an active session
    const existingActivity = await prisma.student_activities.findFirst({
      where: {
        student_id: studentId,
        status: 'ACTIVE',
      },
    });

    if (existingActivity) {
      return res.status(200).json({
        success: false,
        message: 'You are already checked in'
      });
    }

    // Create activity record with purpose
    const activity = await prisma.student_activities.create({
      data: {
        student_id: studentId,
        activity_type: 'KIOSK_CHECK_IN',
        description: `Kiosk check-in: ${purpose}`,
        status: 'ACTIVE',
        metadata: {
          purpose,
          scanData,
          kioskCheckIn: true
        } as any
      },
    });

    // Log the check-in for analytics
    await prisma.student_activities.create({
      data: {
        student_id: studentId,
        activity_type: 'KIOSK_CHECK_IN',
        description: `Student checked in for ${purpose}`,
        metadata: {
          purpose,
          activityId: activity.id
        } as any
      }
    });

    logger.info(`Student ${studentId} checked in via kiosk for ${purpose}`);

    // Emit attendance event to kiosk display subscribers
    try {
      const student = await prisma.students.findUnique({ where: { id: studentId }, select: { first_name: true, last_name: true, student_id: true } });
      const autoLogoutAt = new Date(Date.now() + 15 * 60000).toISOString();
      // Build reminders: overdue and due soon
      const checkouts = await prisma.book_checkouts.findMany({ where: { student_id: studentId, status: 'ACTIVE' }, select: { due_date: true, book_id: true } });
      const reminders: Array<{ type: string; message: string; priority: string; bookTitle?: string; dueDate?: string }> = [];
      for (const c of checkouts) {
        const due = c.due_date as Date | null;
        if (!due) continue;
        const diffDays = Math.floor(((due as Date).getTime() - Date.now()) / 86400000);
        const book = await prisma.books.findUnique({ where: { id: c.book_id }, select: { title: true } });
        if (diffDays < 0) {
          reminders.push({ type: 'overdue_book', message: `Overdue book`, priority: 'high', bookTitle: book?.title || 'Book', dueDate: (due as Date).toISOString() });
        } else if (diffDays <= 3) {
          reminders.push({ type: 'book_due_soon', message: `Book due in ${diffDays} day(s)`, priority: 'normal', bookTitle: book?.title || 'Book', dueDate: (due as Date).toISOString() });
        }
      }
      webSocketManager.emitStudentCheckIn({
        activityId: String(activity.id),
        studentId: String(studentId),
        studentName: `${student?.first_name || ''} ${student?.last_name || ''}`.trim() || 'Student',
        checkinTime: new Date(activity.start_time || new Date()).toISOString(),
        autoLogoutAt,
        reminders,
      });
      await broadcastSectionOccupancy();
    } catch (err) {
      logger.warn('Failed to emit student check-in event', err as any);
    }

    return res.status(200).json({
      success: true,
      message: 'Check-in confirmed successfully',
      activity: {
        id: activity.id,
        purpose,
        checkInTime: activity.start_time
      }
    });

  } catch (error) {
    logger.error('Confirm check-in error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to confirm check-in'
    });
  }
});

/**
 * Confirm check-out for active session
 */
router.post('/checkout', async (req: Request, res: Response) => {
  try {
    const { studentId, reason = 'manual' } = req.body as { studentId: string; reason?: 'manual' | 'auto' };
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Student ID required' });
    }
    const active = await prisma.student_activities.findFirst({ where: { student_id: studentId, status: 'ACTIVE' } });
    if (!active) {
      return res.status(404).json({ success: false, message: 'No active session' });
    }
    await prisma.student_activities.update({ where: { id: active.id }, data: { status: 'COMPLETED', end_time: new Date() } });
    const student = await prisma.students.findUnique({ where: { id: studentId }, select: { first_name: true, last_name: true } });
    webSocketManager.emitStudentCheckOut({
      activityId: String(active.id),
      studentId: String(studentId),
      studentName: `${student?.first_name || ''} ${student?.last_name || ''}`.trim() || 'Student',
      checkoutTime: new Date().toISOString(),
      reason,
    });
    await broadcastSectionOccupancy();
    return res.status(200).json({ success: true, message: 'Check-out confirmed', activityId: active.id });
  } catch (error) {
    logger.error('Checkout error:', error);
    return res.status(500).json({ success: false, message: 'Failed to check out' });
  }
});

/**
 * Broadcast announcement to attendance display
 */
router.post('/broadcast', authenticate, requireRole(['LIBRARIAN', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const { message } = req.body as { message: string };
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message required' });
    }
    if (announcementConfig.quietMode) {
      return res.status(429).json({ success: false, message: 'Announcements are currently disabled (Quiet Mode)', waitSeconds: null });
    }
    const now = Date.now();
    const last = (global as any).__lastAnnouncementAt || 0;
    const minIntervalMs = Math.max(10, announcementConfig.intervalSeconds) * 1000;
    if (now - last < minIntervalMs) {
      const waitMs = minIntervalMs - (now - last);
      return res.status(429).json({ success: false, message: `Please wait ${Math.ceil(waitMs / 1000)}s before sending another announcement`, waitSeconds: Math.ceil(waitMs / 1000) });
    }
    webSocketManager.broadcastToRoom('attendance', {
      id: `announcement-${Date.now()}`,
      type: 'announcement',
      data: { message, userId: (req as any).user?.userId || 'UNKNOWN', userName: (req as any).user?.username || 'unknown' },
      timestamp: new Date(),
    } as any);
    await prisma.announcements.create({
      data: {
        title: message.length > 64 ? message.slice(0, 64) : message,
        content: message,
        start_time: new Date(),
        priority: 'NORMAL',
        created_by_user_id: (req as any).user?.userId || null,
        created_by_username: (req as any).user?.username || null,
      },
    });
    (global as any).__lastAnnouncementAt = now;
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Broadcast error:', error);
    return res.status(500).json({ success: false, message: 'Failed to broadcast' });
  }
});

router.get('/announcements/config', authenticate, requireRole(['LIBRARIAN', 'ADMIN']), async (_req: Request, res: Response) => {
  return res.status(200).json({ success: true, data: announcementConfig });
});

router.put('/announcements/config', authenticate, requireRole(['LIBRARIAN', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const { quietMode, intervalSeconds, messages } = req.body as { quietMode?: boolean; intervalSeconds?: number; messages?: string[] };
    if (typeof quietMode === 'boolean') announcementConfig.quietMode = quietMode;
    if (typeof intervalSeconds === 'number' && intervalSeconds >= 10 && intervalSeconds <= 600) {
      announcementConfig.intervalSeconds = intervalSeconds;
    }
    if (Array.isArray(messages)) {
      announcementConfig.messages = messages.filter((m) => typeof m === 'string' && m.trim().length > 0).slice(0, 20);
    }
    webSocketManager.broadcastToRoom('attendance', {
      id: `announcement-config-${Date.now()}`,
      type: 'announcement_config',
      data: {
        quietMode: announcementConfig.quietMode,
        intervalSeconds: announcementConfig.intervalSeconds,
        messages: announcementConfig.messages,
      },
      timestamp: new Date(),
    } as any);
    webSocketManager.broadcastToRoom('attendance', {
      id: `announcement-config-${Date.now()}`,
      type: 'announcement:config',
      data: {
        quietMode: announcementConfig.quietMode,
        intervalSeconds: announcementConfig.intervalSeconds,
        messages: announcementConfig.messages,
      },
      timestamp: new Date(),
    } as any);
    try {
      await prisma.app_notifications.create({
        data: {
          userId: (req as any).user?.userId || null,
          type: 'SYSTEM_ALERT',
          title: 'Announcement config updated',
          message: `Quiet: ${announcementConfig.quietMode} • Interval: ${announcementConfig.intervalSeconds}s • Messages: ${announcementConfig.messages.length}`,
          metadata: {
            quietMode: announcementConfig.quietMode,
            intervalSeconds: announcementConfig.intervalSeconds,
            messages: announcementConfig.messages,
          },
        },
      });
    } catch {}
    return res.status(200).json({ success: true, data: announcementConfig });
  } catch (error) {
    logger.error('Update announcement config error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update config' });
  }
});

router.get('/announcements/recent', authenticate, requireRole(['LIBRARIAN', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '10')), 1), 100);
    const page = Math.max(parseInt(String(req.query.page || '1')), 1);
    const priority = String(req.query.priority || '').toUpperCase();
    const isActiveParam = String(req.query.is_active || '').toLowerCase();
    const dateFrom = req.query.dateFrom ? new Date(String(req.query.dateFrom)) : undefined;
    const dateTo = req.query.dateTo ? new Date(String(req.query.dateTo)) : undefined;
    const search = String(req.query.search || '').trim();

    const where: Record<string, unknown> = {};
    if (priority) where['priority'] = priority;
    if (isActiveParam === 'true') where['is_active'] = true;
    if (isActiveParam === 'false') where['is_active'] = false;
    if (dateFrom || dateTo) {
      where['start_time'] = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      };
    }
    if (search) {
      where['OR'] = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.announcements.findMany({
        where: where as any,
        orderBy: { start_time: 'desc' },
        skip,
        take: limit,
        select: { id: true, title: true, content: true, start_time: true, end_time: true, is_active: true, priority: true, created_at: true, created_by_user_id: true, created_by_username: true }
      }),
      prisma.announcements.count({ where: where as any }),
    ]);

    res.status(200).json({
      success: true,
      data: items,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    logger.error('Fetch recent announcements error:', error as any);
    res.status(500).json({ success: false, message: 'Failed to fetch announcements' });
  }
});

/**
 * Change section(s) for an active student session
 */
router.post('/change-section', authenticate, requireRole(['LIBRARIAN', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const { studentId, toSections } = req.body as { studentId: string; toSections: string[] };
    if (!studentId || !Array.isArray(toSections) || toSections.length === 0) {
      return res.status(400).json({ success: false, message: 'studentId and toSections required' });
    }
    const active = await prisma.student_activities.findFirst({ where: { student_id: studentId, status: 'ACTIVE' } });
    if (!active) {
      return res.status(404).json({ success: false, message: 'No active session' });
    }
    const fromSections = (active.metadata as any)?.sections || [];
    const meta = { ...(active.metadata as any), sections: toSections };
    await prisma.student_activities.update({ where: { id: active.id }, data: { metadata: meta } as any });
    const student = await prisma.students.findUnique({ where: { id: studentId }, select: { first_name: true, last_name: true } });
    webSocketManager.emitSectionChange({
      studentId: String(studentId),
      studentName: `${student?.first_name || ''} ${student?.last_name || ''}`.trim() || 'Student',
      from: Array.isArray(fromSections) ? fromSections : [],
      to: toSections,
      at: new Date().toISOString(),
    });
    try {
      await prisma.student_activities.create({
        data: {
          student_id: studentId,
          activity_type: 'SECTION_CHANGE',
          description: 'Change student section',
          metadata: { studentId, from: Array.isArray(fromSections) ? fromSections : [], to: toSections } as any,
        },
      });
    } catch {}
    await broadcastSectionOccupancy();
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Change section error:', error);
    return res.status(500).json({ success: false, message: 'Failed to change section' });
  }
});

/**
 * Get current kiosk status
 * For monitoring and analytics
 */
router.get('/status', authenticate, requireRole(['LIBRARIAN', 'ADMIN']), async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get today's kiosk check-ins
    const todayCheckIns = await prisma.student_activities.count({
      where: {
        activity_type: 'KIOSK_CHECK_IN',
        start_time: {
          gte: todayStart
        }
      }
    });

    // Get currently checked-in students
    const currentlyCheckedIn = await prisma.student_activities.count({
      where: {
        activity_type: 'KIOSK_CHECK_IN',
        status: 'ACTIVE'
      }
    });

    // Get breakdown by purpose
    const allActivities = await prisma.student_activities.findMany({
      where: {
        activity_type: 'KIOSK_CHECK_IN',
        start_time: {
          gte: todayStart
        }
      },
      select: {
        id: true,
        metadata: true
      }
    });

    // Parse metadata to get purpose breakdown
    const purposes = {
      avr: 0,
      computer: 0,
      library: 0,
      borrowing: 0,
      recreation: 0
    };

    allActivities.forEach(item => {
      const metadata = item.metadata as any;
      if (metadata?.purpose && purposes.hasOwnProperty(metadata.purpose)) {
        purposes[metadata.purpose as keyof typeof purposes] += 1;
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        todayCheckIns,
        currentlyCheckedIn,
        purposes,
        lastUpdated: now
      }
    });

  } catch (error) {
    logger.error('Kiosk status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get kiosk status'
    });
  }
});

/**
 * Get recent kiosk activities
 */
router.get('/recent', authenticate, requireRole(['LIBRARIAN', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;

    const recentActivities = await prisma.student_activities.findMany({
      where: {
        activity_type: 'KIOSK_CHECK_IN'
      },
      include: {
        student: {
          select: {
            id: true,
            student_id: true,
            first_name: true,
            last_name: true,
            grade_level: true,
            section: true
          }
        }
      },
      orderBy: {
        start_time: 'desc'
      },
      take: limit
    });

    const formattedActivities = recentActivities.map((activity: any) => ({
      id: activity.id,
      studentName: `${activity.student?.first_name || ''} ${activity.student?.last_name || ''}`.trim(),
      studentId: activity.student?.student_id,
      gradeLevel: activity.student?.grade_level,
      section: activity.student?.section,
      purpose: (activity.metadata as any)?.purpose,
      checkInTime: activity.start_time,
      status: activity.status
    }));

    return res.status(200).json({
      success: true,
      data: formattedActivities
    });

  } catch (error) {
    logger.error('Recent activities error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get recent activities'
    });
  }
});

export { router as kioskRoutes };
async function computeSectionOccupancy() {
  const active = await prisma.student_activities.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true }
  });
  const counts: Record<string, number> = {
    LIBRARY_SPACE: 0,
    COMPUTER: 0,
    AVR: 0,
    RECREATION: 0,
    BORROWING: 0,
  };
  const activeIds = active.map((a) => a.id);
  if (activeIds.length === 0) return counts;
  const mappings = await prisma.student_activities_sections.findMany({
    where: { activity_id: { in: activeIds } },
    include: { section: { select: { code: true } } },
  });
  for (const m of mappings) {
    const code = String(m.section?.code || '').toUpperCase();
    if (code in counts) counts[code] += 1;
  }
  return counts;
}

async function broadcastSectionOccupancy() {
  try {
    const sections = await computeSectionOccupancy();
    const now = new Date();
    const payload = {
      sections,
      counts: sections,
      updatedAt: now.toISOString(),
    };
    webSocketManager.broadcastToRoom('attendance', {
      id: `occupancy-${Date.now()}`,
      type: 'attendance_occupancy',
      data: payload,
      timestamp: now,
    } as any);
    webSocketManager.broadcastToRoom('attendance', {
      id: `occupancy-${Date.now()}`,
      type: 'attendance:occupancy',
      data: payload,
      timestamp: now,
    } as any);
  } catch (err) {
    logger.warn('Failed to broadcast section occupancy', err as any);
  }
}

router.get('/occupancy', authenticate, requireRole(['LIBRARIAN', 'ADMIN']), async (_req: Request, res: Response) => {
  try {
    const sections = await computeSectionOccupancy();
    return res.status(200).json({ success: true, data: { sections, updatedAt: new Date().toISOString() } });
  } catch (error) {
    logger.error('Occupancy error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get occupancy' });
  }
});
