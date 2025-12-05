import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { websocketServer } from '../websocket/websocketServer';
import { ScanExportService } from './scanExportService';

/**
 * Auto-Checkout Service
 * Automatically checks out students after 15 minutes of being checked in
 */
export class AutoCheckoutService {
  private static intervalId: NodeJS.Timeout | null = null;
  private static readonly CHECK_INTERVAL_MS = 30 * 1000; // Check every 30 seconds
  private static readonly SESSION_DURATION_MS = 15 * 60 * 1000; // 15 minutes

  /**
   * Start the auto-checkout scheduler
   */
  static start(): void {
    if (this.intervalId) {
      logger.warn('Auto-checkout service already running');
      return;
    }

    logger.info('Starting auto-checkout service (15 min sessions)');

    // Run immediately on start
    this.processExpiredSessions().catch(err =>
      logger.error('Auto-checkout initial run failed:', err),
    );

    // Then run every 30 seconds
    this.intervalId = setInterval(() => {
      this.processExpiredSessions().catch(err =>
        logger.error('Auto-checkout scheduled run failed:', err),
      );
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Stop the auto-checkout scheduler
   */
  static stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Auto-checkout service stopped');
    }
  }

  /**
   * Process all expired sessions (older than 15 minutes)
   */
  static async processExpiredSessions(): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - this.SESSION_DURATION_MS);

      // Find all active sessions that started more than 15 minutes ago
      const expiredSessions = await prisma.student_activities.findMany({
        where: {
          status: 'ACTIVE',
          end_time: null,
          start_time: { lte: cutoffTime },
        },
        include: {
          student: {
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
              barcode: true,
              gender: true,
            },
          },
        },
      });

      if (expiredSessions.length === 0) {
        return 0;
      }

      logger.info(
        `Auto-checkout: Found ${expiredSessions.length} expired sessions`,
      );

      let checkedOutCount = 0;

      for (const session of expiredSessions) {
        try {
          await this.checkoutSession(session);
          checkedOutCount++;
        } catch (err) {
          logger.error(`Failed to auto-checkout session ${session.id}:`, err);
        }
      }

      logger.info(`Auto-checkout: Checked out ${checkedOutCount} sessions`);
      return checkedOutCount;
    } catch (error) {
      logger.error('Auto-checkout processExpiredSessions error:', error);
      return 0;
    }
  }

  /**
   * Checkout a single session
   */
  private static async checkoutSession(session: {
    id: string;
    start_time: Date;
    student: {
      id: string;
      student_id: string;
      first_name: string;
      last_name: string;
      barcode: string | null;
      gender: string | null;
    };
  }): Promise<void> {
    const endTime = new Date();
    const timeSpentMs = endTime.getTime() - session.start_time.getTime();
    const timeSpentMinutes = Math.floor(timeSpentMs / 1000 / 60);

    // Update the activity to completed
    await prisma.student_activities.update({
      where: { id: session.id },
      data: {
        status: 'COMPLETED',
        end_time: endTime,
      },
    });

    // Emit WebSocket event for kiosk/displays
    websocketServer.emitStudentCheckOut({
      activityId: session.id,
      studentId: session.student.id,
      studentName: `${session.student.first_name} ${session.student.last_name}`,
      gender: session.student.gender || undefined,
      checkoutTime: endTime.toISOString(),
      reason: 'auto',
    });

    // Log the auto-checkout
    ScanExportService.logStudentScan({
      barcode: session.student.barcode || session.student.student_id,
      studentId: session.student.student_id,
      studentName: `${session.student.first_name} ${session.student.last_name}`,
      action: 'CHECK_OUT',
      source: 'Auto-Checkout',
      status: 'COMPLETED',
      notes: `Auto checkout after 15 mins. Time spent: ${timeSpentMinutes} mins`,
    }).catch(error =>
      logger.error('Failed to log auto-checkout export', {
        studentId: session.student.student_id,
        error: error instanceof Error ? error.message : error,
      }),
    );

    logger.info('Auto-checkout completed', {
      studentId: session.student.student_id,
      studentName: `${session.student.first_name} ${session.student.last_name}`,
      timeSpentMinutes,
    });
  }
}
