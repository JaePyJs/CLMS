import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/authenticate';
import {
  scanRateLimiter,
  checkStudentScanRate,
} from '../middleware/rateLimiter';
import { logger } from '../utils/logger';
import prisma from '../utils/prisma';
import { webSocketManager } from '../websocket/websocketServer';

const router = Router();
// Use shared Prisma client

interface ConfirmCheckInRequest {
  studentId: string;
  purpose?: string;
  purposes?: string[];
  scanData: string;
}

const announcementConfig: {
  quietMode: boolean;
  intervalSeconds: number;
  messages: string[];
} = {
  quietMode: false,
  intervalSeconds: 60,
  messages: [
    'Reading is dreaming with open eyes.',
    'A book a day keeps boredom away.',
    'Today a reader, tomorrow a leader.',
    'Dive into a good book!',
  ],
};

// ... (keep announcementConfig)

/**
 * Handle initial tap-in/scan
 * Checks if student exists and cooldown status
 * Rate limited to prevent barcode scanner spam
 */
router.post('/tap-in', scanRateLimiter, async (req: Request, res: Response) => {
  try {
    const { scanData } = req.body;
    if (!scanData) {
      return res
        .status(400)
        .json({ success: false, message: 'Scan data required' });
    }

    // Check per-barcode rate limit
    const barcodeRateCheck = checkStudentScanRate(scanData);
    if (!barcodeRateCheck.allowed) {
      logger.warn('Kiosk tap-in rate limit exceeded', {
        scanData,
        waitSeconds: barcodeRateCheck.waitSeconds,
      });
      return res.status(429).json({
        success: false,
        message: `Scanning too fast! Please wait ${barcodeRateCheck.waitSeconds} second(s).`,
        cooldownRemaining: barcodeRateCheck.waitSeconds,
        canCheckIn: false,
      });
    }

    // Find student
    let student = await prisma.students.findFirst({
      where: {
        OR: [{ barcode: scanData }, { student_id: scanData }],
      },
    });

    if (!student) {
      return res
        .status(200)
        .json({ success: false, message: 'Student not found' });
    }

    // Activate student on first scan if not already active
    if (!student.is_active) {
      student = await prisma.students.update({
        where: { id: student.id },
        data: { is_active: true },
      });
      logger.info('Student activated on first kiosk tap', {
        studentId: student.student_id,
      });
    }

    // Check active session
    const activeSession = await prisma.student_activities.findFirst({
      where: {
        student_id: student.id,
        status: 'ACTIVE',
      },
    });

    let cooldownRemaining = 0;
    let canCheckIn = true;
    let message = 'Ready to check in';

    if (activeSession) {
      const now = new Date();
      const startTime = new Date(activeSession.start_time);
      const diffMins = (now.getTime() - startTime.getTime()) / 60000;

      if (diffMins < 15) {
        cooldownRemaining = Math.ceil((15 - diffMins) * 60);
        canCheckIn = false;
        message = 'Cooldown active';
      } else {
        // Already checked in > 15 mins
        // For now, we block check-in until they check out (or auto-checkout happens)
        // But the prompt implies "displays 'already logged in' or proceeds"
        // If we want to allow "proceeds", we might need to auto-checkout?
        // Let's stick to blocking for now to prevent duplicates.
        canCheckIn = false;
        message = 'You are already checked in';
      }
    }

    return res.status(200).json({
      success: true,
      message,
      canCheckIn,
      cooldownRemaining,
      student: {
        id: student.id,
        studentId: student.student_id,
        name: `${student.first_name} ${student.last_name}`,
        gradeLevel:
          student.grade_level !== null && student.grade_level !== undefined
            ? student.grade_level === 0
              ? student.grade_category === 'PERSONNEL' ||
                student.barcode?.startsWith('PN') ||
                student.student_id?.startsWith('PN')
                ? 'Personnel'
                : 'Kindergarten'
              : `Grade ${student.grade_level}`
            : '',
        section: student.section || '',
        barcode: student.barcode || '',
      },
    });
  } catch (error) {
    logger.error('Tap-in error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process tap-in',
    });
  }
});

/**
 * Get active students for kiosk display (Public)
 */
router.get('/active-students', async (_req: Request, res: Response) => {
  try {
    // Include ALL active check-in types for comprehensive display
    const activeActivities = await prisma.student_activities.findMany({
      where: {
        activity_type: {
          in: [
            'KIOSK_CHECK_IN',
            'CHECK_IN',
            'LIBRARY_VISIT',
            'SELF_SERVICE_CHECK_IN',
            'SELF_SERVICE',
          ],
        },
        status: 'ACTIVE',
      },
      include: {
        student: {
          select: {
            first_name: true,
            last_name: true,
            student_id: true,
          },
        },
      },
      orderBy: {
        start_time: 'desc',
      },
    });

    const activeStudents = activeActivities.map(activity => {
      // Calculate auto-logout time (15 mins after start)
      const startTime = new Date(activity.start_time);
      const autoLogoutAt = new Date(startTime.getTime() + 15 * 60000);

      return {
        id: activity.id,
        studentId: activity.student_id,
        name: `${activity.student.first_name} ${activity.student.last_name}`,
        checkinTime: activity.start_time,
        autoLogoutAt: autoLogoutAt,
        reminders: [],
      };
    });

    return res.status(200).json({
      success: true,
      data: activeStudents,
    });
  } catch (error) {
    logger.error('Get active students error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get active students',
    });
  }
});

/**
 * Confirm check-in with purpose
 * Creates activity record and handles navigation
 */
router.post(
  '/confirm-check-in',
  async (
    req: Request<
      Record<string, never>,
      Record<string, never>,
      ConfirmCheckInRequest
    >,
    res: Response,
  ) => {
    try {
      const { studentId, purpose, purposes, scanData } = req.body;

      if (
        !studentId ||
        (!purpose && (!purposes || purposes.length === 0)) ||
        !scanData
      ) {
        return res.status(400).json({
          success: false,
          message: 'Student ID, purpose(s), and scan data are required',
        });
      }

      // Normalize purposes
      const selectedPurposes = purposes || (purpose ? [purpose] : []);

      // Validate purposes
      const validPurposes = [
        'avr',
        'computer',
        'library',
        'borrowing',
        'recreation',
        'reading',
        'gaming',
      ];
      const invalidPurposes = selectedPurposes.filter(
        (p: string) => !validPurposes.includes(p),
      );

      if (invalidPurposes.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid purpose(s): ${invalidPurposes.join(', ')}`,
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
          message: 'You are already checked in',
        });
      }

      const purposeStr = selectedPurposes.join(', ');

      // Create activity record with purpose
      const activity = await prisma.student_activities.create({
        data: {
          student_id: studentId,
          activity_type: 'KIOSK_CHECK_IN',
          description: `Kiosk check-in: ${purposeStr}`,
          status: 'ACTIVE',
          metadata: JSON.stringify({
            purposes: selectedPurposes,
            purpose: selectedPurposes[0], // Primary purpose for backward compat
            scanData,
            kioskCheckIn: true,
          }),
        },
      });

      // Log the check-in for analytics (separate from the active session)
      await prisma.student_activities.create({
        data: {
          student_id: studentId,
          activity_type: 'CHECK_IN_LOG',
          description: `Student checked in for ${purposeStr}`,
          status: 'COMPLETED',
          end_time: new Date(),
          metadata: JSON.stringify({
            purposes: selectedPurposes,
            activityId: activity.id,
          }),
        },
      });

      logger.info(
        `Student ${studentId} checked in via kiosk for ${purposeStr}`,
      );

      // Map purposes to section codes and create section mappings
      const purposeToSectionCode: Record<string, string[]> = {
        library: ['LIBRARY', 'LIBRARY_SPACE'],
        reading: ['LIBRARY', 'LIBRARY_SPACE'],
        computer: ['COMPUTER'],
        gaming: ['COMPUTER'],
        avr: ['AVR'],
        recreation: ['RECREATION'],
        study: ['STUDY'],
        borrowing: ['BORROWING', 'LIBRARY', 'LIBRARY_SPACE'],
      };

      // Collect all possible section codes for the selected purposes
      const allSectionCodes = selectedPurposes
        .flatMap((p: string) => purposeToSectionCode[p] || [])
        .filter((v, i, arr) => arr.indexOf(v) === i); // unique

      let assignedSection = false;
      if (allSectionCodes.length > 0) {
        const sections = await prisma.library_sections.findMany({
          where: {
            code: { in: allSectionCodes },
            is_active: true,
          },
        });

        if (sections.length > 0) {
          // SQLite doesn't support skipDuplicates, so we use individual creates with try/catch
          for (const section of sections) {
            try {
              await prisma.student_activities_sections.create({
                data: {
                  activity_id: activity.id,
                  section_id: section.id,
                },
              });
              assignedSection = true;
            } catch {
              // Ignore duplicate entries
            }
          }
        }
      }

      // If no section was assigned, fallback to default Library Space
      if (!assignedSection) {
        const defaultSection = await prisma.library_sections.findFirst({
          where: {
            OR: [
              { code: 'LIBRARY' },
              { code: 'LIBRARY_SPACE' },
              { name: { contains: 'Library' } },
            ],
            is_active: true,
          },
        });

        if (defaultSection) {
          try {
            await prisma.student_activities_sections.create({
              data: {
                activity_id: activity.id,
                section_id: defaultSection.id,
              },
            });
          } catch {
            // Ignore duplicate entries
          }
        }
      }

      // Emit attendance event to kiosk display subscribers
      try {
        const student = await prisma.students.findUnique({
          where: { id: studentId },
          select: {
            first_name: true,
            last_name: true,
            student_id: true,
            grade_level: true,
            gender: true,
          },
        });
        const autoLogoutAt = new Date(Date.now() + 15 * 60000).toISOString();
        // Build reminders: overdue and due soon
        const checkouts = await prisma.book_checkouts.findMany({
          where: { student_id: studentId, status: 'ACTIVE' },
          select: { due_date: true, book_id: true },
        });
        const reminders: Array<{
          type: string;
          message: string;
          priority: string;
          bookTitle?: string;
          dueDate?: string;
        }> = [];
        for (const c of checkouts) {
          const due = c.due_date as Date | null;
          if (!due) {
            continue;
          }
          const diffDays = Math.floor((due.getTime() - Date.now()) / 86400000);
          const book = await prisma.books.findUnique({
            where: { id: c.book_id },
            select: { title: true },
          });
          if (diffDays < 0) {
            reminders.push({
              type: 'overdue_book',
              message: `Overdue book`,
              priority: 'high',
              bookTitle: book?.title || 'Book',
              dueDate: due.toISOString(),
            });
          } else if (diffDays <= 3) {
            reminders.push({
              type: 'book_due_soon',
              message: `Book due in ${diffDays} day(s)`,
              priority: 'normal',
              bookTitle: book?.title || 'Book',
              dueDate: due.toISOString(),
            });
          }
        }

        // Format grade level display
        let gradeDisplay = '';
        if (
          student?.grade_level !== undefined &&
          student?.grade_level !== null
        ) {
          if (student.grade_level === 0) {
            gradeDisplay = 'Pre-School';
          } else {
            gradeDisplay = `Grade ${student.grade_level}`;
          }
        }

        webSocketManager.emitStudentCheckIn({
          activityId: String(activity.id),
          studentId: String(studentId),
          studentName:
            `${student?.first_name || ''} ${student?.last_name || ''}`.trim() ||
            'Student',
          gradeLevel: gradeDisplay,
          gender: student?.gender || undefined,
          checkinTime: new Date(
            activity.start_time || new Date(),
          ).toISOString(),
          autoLogoutAt,
          reminders,
        });
        await broadcastSectionOccupancy();
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        logger.warn('Failed to emit student check-in event', err as any);
      }

      return res.status(200).json({
        success: true,
        message: 'Check-in confirmed successfully',
        activity: {
          id: activity.id,
          purpose: purposeStr,
          checkInTime: activity.start_time,
        },
      });
    } catch (error) {
      logger.error('Confirm check-in error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to confirm check-in',
      });
    }
  },
);

/**
 * Confirm check-out for active session
 * Enforces 15-minute minimum session time (unless force=true for librarian use)
 */
router.post('/checkout', async (req: Request, res: Response) => {
  try {
    const {
      studentId,
      reason = 'manual',
      force = false,
    } = req.body as {
      studentId: string;
      reason?: 'manual' | 'auto';
      force?: boolean; // Librarian can force checkout before 15 mins
    };
    if (!studentId) {
      return res
        .status(400)
        .json({ success: false, message: 'Student ID required' });
    }
    const active = await prisma.student_activities.findFirst({
      where: { student_id: studentId, status: 'ACTIVE' },
    });
    if (!active) {
      return res
        .status(404)
        .json({ success: false, message: 'No active session' });
    }

    // Check 15-minute minimum session time (unless forced by librarian)
    if (!force && reason !== 'auto') {
      const now = new Date();
      const startTime = new Date(active.start_time);
      const minutesSinceCheckIn = (now.getTime() - startTime.getTime()) / 60000;

      if (minutesSinceCheckIn < 15) {
        const remainingMinutes = Math.ceil(15 - minutesSinceCheckIn);
        const remainingSeconds = Math.ceil((15 - minutesSinceCheckIn) * 60);
        return res.status(400).json({
          success: false,
          message: `Must stay checked in for at least 15 minutes. Please wait ${remainingMinutes} more minute(s).`,
          cooldownRemaining: remainingSeconds,
          canCheckOut: false,
        });
      }
    }

    await prisma.student_activities.update({
      where: { id: active.id },
      data: { status: 'COMPLETED', end_time: new Date() },
    });
    const student = await prisma.students.findUnique({
      where: { id: studentId },
      select: {
        first_name: true,
        last_name: true,
        gender: true,
        grade_level: true,
      },
    });

    // Format grade level display
    let gradeDisplay = '';
    if (student?.grade_level !== undefined && student?.grade_level !== null) {
      if (student.grade_level === 0) {
        gradeDisplay = 'Pre-School';
      } else {
        gradeDisplay = `Grade ${student.grade_level}`;
      }
    }

    webSocketManager.emitStudentCheckOut({
      activityId: String(active.id),
      studentId: String(studentId),
      studentName:
        `${student?.first_name || ''} ${student?.last_name || ''}`.trim() ||
        'Student',
      gradeLevel: gradeDisplay,
      gender: student?.gender || undefined,
      checkoutTime: new Date().toISOString(),
      reason,
    });
    await broadcastSectionOccupancy();
    return res.status(200).json({
      success: true,
      message: 'Check-out confirmed',
      activityId: active.id,
    });
  } catch (error) {
    logger.error('Checkout error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Failed to check out' });
  }
});

/**
 * Broadcast announcement to attendance display
 */
router.post(
  '/broadcast',
  authenticate,
  requireRole(['LIBRARIAN']),
  async (req: Request, res: Response) => {
    try {
      const { message } = req.body as { message: string };
      if (!message?.trim()) {
        return res
          .status(400)
          .json({ success: false, message: 'Message required' });
      }
      if (announcementConfig.quietMode) {
        return res.status(429).json({
          success: false,
          message: 'Announcements are currently disabled (Quiet Mode)',
          waitSeconds: null,
        });
      }
      const now = Date.now();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const last = (global as any).__lastAnnouncementAt || 0;
      const minIntervalMs =
        Math.max(10, announcementConfig.intervalSeconds) * 1000;
      if (now - last < minIntervalMs) {
        const waitMs = minIntervalMs - (now - last);
        return res.status(429).json({
          success: false,
          message: `Please wait ${Math.ceil(waitMs / 1000)}s before sending another announcement`,
          waitSeconds: Math.ceil(waitMs / 1000),
        });
      }
      webSocketManager.broadcastToRoom('attendance', {
        id: `announcement-${Date.now()}`,
        type: 'announcement',
        data: {
          message,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          userId: (req as any).user?.userId || 'UNKNOWN',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          userName: (req as any).user?.username || 'unknown',
        },
        timestamp: new Date(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      await prisma.announcements.create({
        data: {
          title: message.length > 64 ? message.slice(0, 64) : message,
          content: message,
          start_time: new Date(),
          priority: 'NORMAL',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          created_by_user_id: (req as any).user?.userId || null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          created_by_username: (req as any).user?.username || null,
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).__lastAnnouncementAt = now;
      return res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Broadcast error:', error);
      return res
        .status(500)
        .json({ success: false, message: 'Failed to broadcast' });
    }
  },
);

router.get('/announcements/config', async (_req: Request, res: Response) => {
  return res.status(200).json({ success: true, data: announcementConfig });
});

router.put(
  '/announcements/config',
  authenticate,
  requireRole(['LIBRARIAN']),
  async (req: Request, res: Response) => {
    try {
      const { quietMode, intervalSeconds, messages } = req.body as {
        quietMode?: boolean;
        intervalSeconds?: number;
        messages?: string[];
      };
      if (typeof quietMode === 'boolean') {
        announcementConfig.quietMode = quietMode;
      }
      if (
        typeof intervalSeconds === 'number' &&
        intervalSeconds >= 10 &&
        intervalSeconds <= 600
      ) {
        announcementConfig.intervalSeconds = intervalSeconds;
      }
      if (Array.isArray(messages)) {
        announcementConfig.messages = messages
          .filter(m => typeof m === 'string' && m.trim().length > 0)
          .slice(0, 20);
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      try {
        await prisma.app_notifications.create({
          data: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            userId: (req as any).user?.userId || null,
            type: 'SYSTEM_ALERT',
            title: 'Announcement config updated',
            message: `Quiet: ${announcementConfig.quietMode} • Interval: ${announcementConfig.intervalSeconds}s • Messages: ${announcementConfig.messages.length}`,
            metadata: JSON.stringify({
              quietMode: announcementConfig.quietMode,
              intervalSeconds: announcementConfig.intervalSeconds,
              messages: announcementConfig.messages,
            }),
          },
        });
      } catch {
        // Ignore error
      }
      return res.status(200).json({ success: true, data: announcementConfig });
    } catch (error) {
      logger.error('Update announcement config error:', error);
      return res
        .status(500)
        .json({ success: false, message: 'Failed to update config' });
    }
  },
);

router.get(
  '/announcements/recent',
  authenticate,
  requireRole(['LIBRARIAN']),
  async (req: Request, res: Response) => {
    try {
      const limit = Math.min(
        Math.max(parseInt(String(req.query.limit || '10')), 1),
        100,
      );
      const page = Math.max(parseInt(String(req.query.page || '1')), 1);
      const priority = String(req.query.priority || '').toUpperCase();
      const isActiveParam = String(req.query.is_active || '').toLowerCase();
      const dateFrom = req.query.dateFrom
        ? new Date(String(req.query.dateFrom))
        : undefined;
      const dateTo = req.query.dateTo
        ? new Date(String(req.query.dateTo))
        : undefined;
      const search = String(req.query.search || '').trim();

      const where: Record<string, unknown> = {};
      if (priority) {
        where['priority'] = priority;
      }
      if (isActiveParam === 'true') {
        where['is_active'] = true;
      }
      if (isActiveParam === 'false') {
        where['is_active'] = false;
      }
      if (dateFrom || dateTo) {
        where['start_time'] = {
          ...(dateFrom ? { gte: dateFrom } : {}),
          ...(dateTo ? { lte: dateTo } : {}),
        };
      }
      if (search) {
        // SQLite case-insensitive search: use lowercase contains
        const searchLower = search.toLowerCase();
        where['OR'] = [
          { title: { contains: searchLower } },
          { content: { contains: searchLower } },
        ];
      }

      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        prisma.announcements.findMany({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          where: where as any,
          orderBy: { start_time: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            title: true,
            content: true,
            start_time: true,
            end_time: true,
            is_active: true,
            priority: true,
            created_at: true,
            created_by_user_id: true,
            created_by_username: true,
          },
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prisma.announcements.count({ where: where as any }),
      ]);

      res.status(200).json({
        success: true,
        data: items,
        pagination: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logger.error('Fetch recent announcements error:', error as any);
      res
        .status(500)
        .json({ success: false, message: 'Failed to fetch announcements' });
    }
  },
);

/**
 * Change section(s) for an active student session
 */
router.post(
  '/change-section',
  authenticate,
  requireRole(['LIBRARIAN']),
  async (req: Request, res: Response) => {
    try {
      const { studentId, toSections } = req.body as {
        studentId: string;
        toSections: string[];
      };
      if (!studentId || !Array.isArray(toSections) || toSections.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'studentId and toSections required',
        });
      }
      const active = await prisma.student_activities.findFirst({
        where: { student_id: studentId, status: 'ACTIVE' },
      });
      if (!active) {
        return res
          .status(404)
          .json({ success: false, message: 'No active session' });
      }
      // Parse existing metadata from string
      const existingMeta = active.metadata ? JSON.parse(active.metadata) : {};
      const fromSections = existingMeta?.sections || [];
      const meta = { ...existingMeta, sections: toSections };
      await prisma.student_activities.update({
        where: { id: active.id },
        data: { metadata: JSON.stringify(meta) },
      });
      const student = await prisma.students.findUnique({
        where: { id: studentId },
        select: { first_name: true, last_name: true },
      });
      webSocketManager.emitSectionChange({
        studentId: String(studentId),
        studentName:
          `${student?.first_name || ''} ${student?.last_name || ''}`.trim() ||
          'Student',
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
            metadata: JSON.stringify({
              studentId,
              from: Array.isArray(fromSections) ? fromSections : [],
              to: toSections,
            }),
          },
        });
      } catch {
        // Ignore error
      }
      await broadcastSectionOccupancy();
      return res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Change section error:', error);
      return res
        .status(500)
        .json({ success: false, message: 'Failed to change section' });
    }
  },
);

/**
 * Get recent scans for search dropdown
 * Shows students who have recently used the kiosk (check-in OR check-out)
 */
router.get('/recent-scans', async (_req: Request, res: Response) => {
  try {
    // Get most recent activities (regardless of check-in or check-out)
    const recentActivities = await prisma.student_activities.findMany({
      where: {
        activity_type: {
          in: ['KIOSK_CHECK_IN', 'KIOSK_CHECK_OUT', 'LIBRARY_VISIT'],
        },
      },
      take: 10,
      orderBy: {
        start_time: 'desc',
      },
      include: {
        student: {
          select: {
            id: true,
            student_id: true,
            first_name: true,
            last_name: true,
            grade_level: true,
            grade_category: true,
          },
        },
      },
      distinct: ['student_id'],
    });

    // Deduplicate by student id and take top 5
    const seenStudents = new Set<string>();
    const recentScans = recentActivities
      .filter(activity => {
        if (seenStudents.has(activity.student.id)) {
          return false;
        }
        seenStudents.add(activity.student.id);
        return true;
      })
      .slice(0, 5)
      .map(activity => ({
        id: activity.student.id,
        studentId: activity.student.student_id,
        name: `${activity.student.first_name} ${activity.student.last_name}`,
        grade_level: activity.student.grade_level,
        grade_category: activity.student.grade_category,
        timestamp: activity.start_time,
      }));

    return res.status(200).json({
      success: true,
      data: recentScans,
    });
  } catch (error) {
    logger.error('Get recent scans error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get recent scans',
    });
  }
});

/**
 * Get current kiosk status
 * For monitoring and analytics
 */
router.get(
  '/status',
  authenticate,
  requireRole(['LIBRARIAN']),
  async (_req: Request, res: Response) => {
    try {
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );

      // Get today's kiosk check-ins
      const todayCheckIns = await prisma.student_activities.count({
        where: {
          activity_type: 'KIOSK_CHECK_IN',
          start_time: {
            gte: todayStart,
          },
        },
      });

      // Get currently checked-in students
      const currentlyCheckedIn = await prisma.student_activities.count({
        where: {
          activity_type: 'KIOSK_CHECK_IN',
          status: 'ACTIVE',
        },
      });

      // Get breakdown by purpose
      const allActivities = await prisma.student_activities.findMany({
        where: {
          activity_type: 'KIOSK_CHECK_IN',
          start_time: {
            gte: todayStart,
          },
        },
        select: {
          id: true,
          metadata: true,
        },
      });

      // Parse metadata to get purpose breakdown
      const purposes = {
        avr: 0,
        computer: 0,
        library: 0,
        borrowing: 0,
        recreation: 0,
      };

      allActivities.forEach(item => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const metadata = item.metadata as any;
        if (
          metadata?.purpose &&
          Object.prototype.hasOwnProperty.call(purposes, metadata.purpose)
        ) {
          purposes[metadata.purpose as keyof typeof purposes] += 1;
        }
      });

      return res.status(200).json({
        success: true,
        data: {
          todayCheckIns,
          currentlyCheckedIn,
          purposes,
          lastUpdated: now,
        },
      });
    } catch (error) {
      logger.error('Kiosk status error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get kiosk status',
      });
    }
  },
);

/**
 * Get recent kiosk activities
 */
router.get(
  '/recent',
  authenticate,
  requireRole(['LIBRARIAN']),
  async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;

      const recentActivities = await prisma.student_activities.findMany({
        where: {
          activity_type: 'KIOSK_CHECK_IN',
        },
        include: {
          student: {
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
              grade_level: true,
              section: true,
            },
          },
        },
        orderBy: {
          start_time: 'desc',
        },
        take: limit,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formattedActivities = recentActivities.map((activity: any) => ({
        id: activity.id,
        studentName:
          `${activity.student?.first_name || ''} ${activity.student?.last_name || ''}`.trim(),
        studentId: activity.student?.student_id,
        gradeLevel: activity.student?.grade_level,
        section: activity.student?.section,
        purpose: activity.metadata?.purpose,
        checkInTime: activity.start_time,
        status: activity.status,
      }));

      return res.status(200).json({
        success: true,
        data: formattedActivities,
      });
    } catch (error) {
      logger.error('Recent activities error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get recent activities',
      });
    }
  },
);

// Helper functions - must be defined before export
async function computeSectionOccupancy() {
  const active = await prisma.student_activities.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
  });
  const counts: Record<string, number> = {
    LIBRARY_SPACE: 0,
    COMPUTER: 0,
    AVR: 0,
    RECREATION: 0,
    BORROWING: 0,
  };
  const activeIds = active.map(a => a.id);
  if (activeIds.length === 0) {
    return counts;
  }
  const mappings = await prisma.student_activities_sections.findMany({
    where: { activity_id: { in: activeIds } },
    include: { section: { select: { code: true } } },
  });
  for (const m of mappings) {
    const code = String(m.section?.code || '').toUpperCase();
    if (code in counts) {
      counts[code] += 1;
    }
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    webSocketManager.broadcastToRoom('attendance', {
      id: `occupancy-${Date.now()}`,
      type: 'attendance:occupancy',
      data: payload,
      timestamp: now,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logger.warn('Failed to broadcast section occupancy', err as any);
  }
}

router.get('/occupancy', async (_req: Request, res: Response) => {
  try {
    const sections = await computeSectionOccupancy();
    return res.status(200).json({
      success: true,
      data: { sections, updatedAt: new Date().toISOString() },
    });
  } catch (error) {
    logger.error('Occupancy error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Failed to get occupancy' });
  }
});

/**
 * Bulk checkout all active students
 * "Check Out All" button for end of day
 */
router.post(
  '/checkout-all',
  authenticate,
  requireRole(['LIBRARIAN']),
  async (req: Request, res: Response) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const librarianId = (req as any).user?.userId || 'UNKNOWN';

      // Import scannerHandler dynamically to avoid circular dependency
      const { scannerHandler } = await import('../websocket/scannerHandler');
      const result = await scannerHandler.bulkCheckout(librarianId);

      await broadcastSectionOccupancy();

      return res.status(200).json({
        success: result.success,
        message: result.message,
        count: result.count,
      });
    } catch (error) {
      logger.error('Bulk checkout error:', error);
      return res
        .status(500)
        .json({ success: false, message: 'Failed to bulk checkout' });
    }
  },
);

/**
 * Manual checkout by librarian (force checkout, removes from dashboard)
 */
router.post(
  '/manual-checkout',
  authenticate,
  requireRole(['LIBRARIAN']),
  async (req: Request, res: Response) => {
    try {
      const { studentId } = req.body as { studentId: string };

      if (!studentId) {
        return res
          .status(400)
          .json({ success: false, message: 'Student ID required' });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const librarianId = (req as any).user?.userId || 'UNKNOWN';

      // Import scannerHandler dynamically to avoid circular dependency
      const { scannerHandler } = await import('../websocket/scannerHandler');
      const result = await scannerHandler.manualCheckout(
        studentId,
        librarianId,
      );

      if (result.success) {
        await broadcastSectionOccupancy();
      }

      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Manual checkout error:', error);
      return res
        .status(500)
        .json({ success: false, message: 'Failed to checkout' });
    }
  },
);

export { router as kioskRoutes };
