/**
 * Scanner Handler - Centralized barcode processing for multi-PC scanner system
 *
 * Handles:
 * - barcode:scanned events from scanner daemons (PC1, PC2)
 * - Student check-in/out processing
 * - 15-minute auto-checkout scheduling (attendance only, NOT dashboard removal)
 * - Manual checkout (removes from dashboard + room)
 * - Print job checkout integration
 * - Latest scanned student tracking for printing workflow
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import websocketServer from './websocketServer';

interface ScanEvent {
  barcode: string;
  timestamp: number;
  pcId: string;
}

interface ScanResult {
  success: boolean;
  type: 'student' | 'book' | 'unknown';
  action?: 'checkin' | 'checkout' | 'cooldown' | 'book_scan';
  message: string;
  data?: {
    studentId?: string;
    studentName?: string;
    activityId?: string;
    bookId?: string;
    bookTitle?: string;
  };
}

class ScannerHandler {
  // Track auto-checkout timers by activity ID
  private autoCheckoutTimers: Map<string, NodeJS.Timeout> = new Map();

  // Track latest scanned student for printing workflow
  private latestScannedStudent: {
    studentId: string;
    studentName: string;
    scannedAt: number;
    pcId: string;
  } | null = null;

  // Duplicate scan prevention (barcode -> last scan timestamp)
  private recentScans: Map<string, number> = new Map();
  private readonly DUPLICATE_THRESHOLD_MS = 5000; // 5 seconds

  // Auto-checkout time in minutes
  private readonly AUTO_CHECKOUT_MINUTES = 15;

  /**
   * Handle incoming barcode scan from scanner daemon
   */
  async handleBarcodeScan(scanEvent: ScanEvent): Promise<ScanResult> {
    const { barcode, timestamp, pcId } = scanEvent;

    logger.info('Scanner: Received barcode scan', { barcode, pcId, timestamp });

    // Check for duplicate scan
    const lastScan = this.recentScans.get(barcode);
    if (lastScan && timestamp - lastScan < this.DUPLICATE_THRESHOLD_MS) {
      logger.info('Scanner: Duplicate scan ignored', {
        barcode,
        timeSinceLastScan: timestamp - lastScan,
      });
      return {
        success: false,
        type: 'unknown',
        message: 'Duplicate scan - please wait a moment',
      };
    }
    this.recentScans.set(barcode, timestamp);

    // Clean up old scan records (older than 1 minute)
    const oneMinuteAgo = Date.now() - 60000;
    for (const [bc, ts] of this.recentScans.entries()) {
      if (ts < oneMinuteAgo) {
        this.recentScans.delete(bc);
      }
    }

    // Detect barcode type
    const barcodeType = await this.detectBarcodeType(barcode);

    switch (barcodeType.type) {
      case 'student':
        return this.processStudentScan(
          barcodeType.data as {
            id: string;
            student_id: string;
            first_name: string;
            last_name: string;
            grade_level: number;
            section: string | null;
            gender: string | null;
          },
          pcId,
        );
      case 'book':
        return this.processBookScan(
          barcodeType.data as {
            id: string;
            title: string;
            accession_no: string;
          },
          pcId,
        );
      default:
        return {
          success: false,
          type: 'unknown',
          message: `Barcode not recognized: ${barcode}`,
        };
    }
  }

  /**
   * Detect barcode type by querying database
   */
  private async detectBarcodeType(
    barcode: string,
  ): Promise<{ type: 'student' | 'book' | 'unknown'; data?: unknown }> {
    // Check students table first (by barcode or student_id)
    const student = await prisma.students.findFirst({
      where: {
        OR: [{ barcode: barcode }, { student_id: barcode }],
      },
    });

    if (student) {
      return { type: 'student', data: student };
    }

    // Check books table (by accession_no)
    const book = await prisma.books.findFirst({
      where: { accession_no: barcode },
    });

    if (book) {
      return { type: 'book', data: book };
    }

    return { type: 'unknown' };
  }

  /**
   * Process student barcode scan
   */
  private async processStudentScan(
    student: {
      id: string;
      student_id: string;
      first_name: string;
      last_name: string;
      grade_level: number;
      section: string | null;
      gender: string | null;
    },
    pcId: string,
  ): Promise<ScanResult> {
    const studentName = `${student.first_name} ${student.last_name}`;

    // Update latest scanned student for printing workflow
    this.latestScannedStudent = {
      studentId: student.id,
      studentName,
      scannedAt: Date.now(),
      pcId,
    };

    // Check for active session
    const activeSession = await prisma.student_activities.findFirst({
      where: {
        student_id: student.id,
        status: 'ACTIVE',
      },
    });

    if (activeSession) {
      // Student is already checked in - this is a check-out scan
      return this.processStudentCheckOut(student, activeSession, pcId);
    } else {
      // Student is not checked in - this is a check-in scan
      return this.processStudentCheckIn(student, pcId);
    }
  }

  /**
   * Process student check-in
   */
  private async processStudentCheckIn(
    student: {
      id: string;
      student_id: string;
      first_name: string;
      last_name: string;
      grade_level: number;
      section: string | null;
      gender: string | null;
    },
    pcId: string,
  ): Promise<ScanResult> {
    const studentName = `${student.first_name} ${student.last_name}`;
    const now = new Date();
    const autoLogoutAt = new Date(
      now.getTime() + this.AUTO_CHECKOUT_MINUTES * 60000,
    );

    // Create activity record
    const activity = await prisma.student_activities.create({
      data: {
        student_id: student.id,
        activity_type: 'KIOSK_CHECK_IN',
        description: `Scanner check-in from ${pcId}`,
        status: 'ACTIVE',
        start_time: now,
        metadata: JSON.stringify({
          pcId,
          scanType: 'AUTO',
          autoLogoutAt: autoLogoutAt.toISOString(),
          source: 'scanner_daemon',
        }),
      },
    });

    // Format grade level for display
    let gradeDisplay = '';
    if (student.grade_level === 0) {
      gradeDisplay = 'Pre-School';
    } else if (student.grade_level === -1) {
      gradeDisplay = 'Personnel';
    } else if (student.grade_level === -2) {
      gradeDisplay = 'Kindergarten';
    } else {
      gradeDisplay = `Grade ${student.grade_level}`;
    }

    // Emit WebSocket events for real-time updates
    websocketServer.emitStudentCheckIn({
      activityId: activity.id,
      studentId: student.id,
      studentName,
      gradeLevel: gradeDisplay,
      gender: student.gender || undefined,
      checkinTime: now.toISOString(),
      autoLogoutAt: autoLogoutAt.toISOString(),
    });

    // Schedule auto-checkout (attendance only - does NOT remove from dashboard)
    this.scheduleAutoCheckout(activity.id, student.id, studentName);

    logger.info('Scanner: Student checked in', {
      studentId: student.id,
      studentName,
      activityId: activity.id,
      pcId,
    });

    return {
      success: true,
      type: 'student',
      action: 'checkin',
      message: `Welcome, ${studentName}!`,
      data: {
        studentId: student.id,
        studentName,
        activityId: activity.id,
      },
    };
  }

  /**
   * Process student check-out (scan while already checked in)
   */
  private async processStudentCheckOut(
    student: {
      id: string;
      first_name: string;
      last_name: string;
      grade_level: number;
      gender: string | null;
    },
    activity: { id: string },
    pcId: string,
  ): Promise<ScanResult> {
    const studentName = `${student.first_name} ${student.last_name}`;
    const now = new Date();

    // Update activity to completed
    await prisma.student_activities.update({
      where: { id: activity.id },
      data: {
        end_time: now,
        status: 'COMPLETED',
        description: `Checked out via scanner at ${pcId}`,
      },
    });

    // Clear auto-checkout timer
    this.clearAutoCheckoutTimer(activity.id);

    // Remove from room assignments
    await prisma.student_activities_sections.deleteMany({
      where: { activity_id: activity.id },
    });

    // Format grade level for display
    let gradeDisplay = '';
    if (student.grade_level === 0) {
      gradeDisplay = 'Pre-School';
    } else if (student.grade_level === -1) {
      gradeDisplay = 'Personnel';
    } else if (student.grade_level === -2) {
      gradeDisplay = 'Kindergarten';
    } else {
      gradeDisplay = `Grade ${student.grade_level}`;
    }

    // Emit checkout event (manual checkout removes from dashboard)
    websocketServer.emitStudentCheckOut({
      activityId: activity.id,
      studentId: student.id,
      studentName,
      gradeLevel: gradeDisplay,
      gender: student.gender || undefined,
      checkoutTime: now.toISOString(),
      reason: 'manual',
    });

    logger.info('Scanner: Student checked out', {
      studentId: student.id,
      studentName,
      activityId: activity.id,
      pcId,
    });

    return {
      success: true,
      type: 'student',
      action: 'checkout',
      message: `Goodbye, ${studentName}!`,
      data: {
        studentId: student.id,
        studentName,
        activityId: activity.id,
      },
    };
  }

  /**
   * Schedule auto-checkout after 15 minutes
   * NOTE: This only updates attendance records, does NOT remove from dashboard
   */
  private scheduleAutoCheckout(
    activityId: string,
    studentId: string,
    studentName: string,
  ): void {
    // Clear existing timer if any
    this.clearAutoCheckoutTimer(activityId);

    const timer = setTimeout(
      () => {
        void (async () => {
          try {
            // Check if activity is still active
            const activity = await prisma.student_activities.findUnique({
              where: { id: activityId },
            });

            if (activity?.status === 'ACTIVE') {
              const now = new Date();

              // Update activity (auto-checkout)
              await prisma.student_activities.update({
                where: { id: activityId },
                data: {
                  end_time: now,
                  status: 'COMPLETED',
                  description: 'Auto checkout - session expired (15 min)',
                },
              });

              // IMPORTANT: Emit attendance:autoCheckout, NOT student:manualCheckout
              // This updates attendance tab but does NOT remove from dashboard
              websocketServer.emitStudentCheckOut({
                activityId,
                studentId,
                studentName,
                checkoutTime: now.toISOString(),
                reason: 'auto', // 'auto' = attendance only, 'manual' = remove from dashboard
              });

              logger.info('Scanner: Auto-checkout completed', {
                activityId,
                studentId,
                studentName,
              });
            }
          } catch (error) {
            logger.error('Scanner: Auto-checkout failed', {
              activityId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          } finally {
            this.autoCheckoutTimers.delete(activityId);
          }
        })();
      },
      this.AUTO_CHECKOUT_MINUTES * 60 * 1000,
    );

    this.autoCheckoutTimers.set(activityId, timer);
    logger.debug('Scanner: Auto-checkout scheduled', {
      activityId,
      timeoutMinutes: this.AUTO_CHECKOUT_MINUTES,
    });
  }

  /**
   * Clear auto-checkout timer for an activity
   */
  private clearAutoCheckoutTimer(activityId: string): void {
    const timer = this.autoCheckoutTimers.get(activityId);
    if (timer) {
      clearTimeout(timer);
      this.autoCheckoutTimers.delete(activityId);
      logger.debug('Scanner: Auto-checkout timer cleared', { activityId });
    }
  }

  /**
   * Process book barcode scan
   */
  private async processBookScan(
    book: { id: string; title: string; accession_no: string },
    pcId: string,
  ): Promise<ScanResult> {
    // Book scans are informational - they link to the latest scanned student
    const latestStudent = this.latestScannedStudent;

    logger.info('Scanner: Book scanned', {
      bookId: book.id,
      bookTitle: book.title,
      latestStudent: latestStudent?.studentName,
      pcId,
    });

    return {
      success: true,
      type: 'book',
      action: 'book_scan',
      message: `Book: ${book.title}`,
      data: {
        bookId: book.id,
        bookTitle: book.title,
        studentId: latestStudent?.studentId,
        studentName: latestStudent?.studentName,
      },
    };
  }

  /**
   * Get the latest scanned student (for printing auto-fill)
   */
  getLatestScannedStudent(): {
    studentId: string;
    studentName: string;
    scannedAt: number;
    pcId: string;
  } | null {
    // Return null if the scan is older than 5 minutes
    if (
      this.latestScannedStudent &&
      Date.now() - this.latestScannedStudent.scannedAt > 5 * 60 * 1000
    ) {
      return null;
    }
    return this.latestScannedStudent;
  }

  /**
   * Manual checkout by librarian (removes from dashboard and room)
   */
  async manualCheckout(
    studentId: string,
    librarianId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const now = new Date();

      // Find all active activities for this student
      const activeActivities = await prisma.student_activities.findMany({
        where: {
          student_id: studentId,
          status: 'ACTIVE',
        },
        include: {
          student: true,
        },
      });

      if (activeActivities.length === 0) {
        return { success: false, message: 'Student has no active session' };
      }

      // Update all active activities to completed
      for (const activity of activeActivities) {
        // Clear auto-checkout timer
        this.clearAutoCheckoutTimer(activity.id);

        // Update activity
        await prisma.student_activities.update({
          where: { id: activity.id },
          data: {
            end_time: now,
            status: 'COMPLETED',
            description: `Manually checked out by librarian (${librarianId})`,
          },
        });

        // Remove from room assignments
        await prisma.student_activities_sections.deleteMany({
          where: { activity_id: activity.id },
        });
      }

      const student = activeActivities[0].student;
      const studentName = student
        ? `${student.first_name} ${student.last_name}`
        : 'Unknown';

      // Emit manual checkout event (removes from dashboard)
      websocketServer.emitStudentCheckOut({
        activityId: activeActivities[0].id,
        studentId,
        studentName,
        checkoutTime: now.toISOString(),
        reason: 'manual',
      });

      logger.info('Scanner: Manual checkout completed', {
        studentId,
        studentName,
        librarianId,
        activitiesUpdated: activeActivities.length,
      });

      return { success: true, message: `${studentName} checked out` };
    } catch (error) {
      logger.error('Scanner: Manual checkout failed', {
        studentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { success: false, message: 'Checkout failed' };
    }
  }

  /**
   * Print job checkout - removes from dashboard and room when print job is created
   */
  async printJobCheckout(
    studentId: string,
    printJobId: string,
    printDetails: { pages: number; paper_size: string; color_level: string },
  ): Promise<void> {
    try {
      const now = new Date();

      // Find all active activities for this student
      const activeActivities = await prisma.student_activities.findMany({
        where: {
          student_id: studentId,
          status: 'ACTIVE',
        },
        include: {
          student: true,
        },
      });

      for (const activity of activeActivities) {
        // Clear auto-checkout timer
        this.clearAutoCheckoutTimer(activity.id);

        // Update activity
        await prisma.student_activities.update({
          where: { id: activity.id },
          data: {
            end_time: now,
            status: 'COMPLETED',
            description: `Print job created: ${printDetails.pages} pages, ${printDetails.paper_size}, ${printDetails.color_level}`,
          },
        });

        // Remove from room assignments
        await prisma.student_activities_sections.deleteMany({
          where: { activity_id: activity.id },
        });
      }

      if (activeActivities.length > 0) {
        const student = activeActivities[0].student;
        const studentName = student
          ? `${student.first_name} ${student.last_name}`
          : 'Unknown';

        // Emit checkout event (removes from dashboard)
        websocketServer.emitStudentCheckOut({
          activityId: activeActivities[0].id,
          studentId,
          studentName,
          checkoutTime: now.toISOString(),
          reason: 'manual', // Print checkout is treated as manual (removes from dashboard)
        });

        logger.info('Scanner: Print job checkout completed', {
          studentId,
          studentName,
          printJobId,
          activitiesUpdated: activeActivities.length,
        });
      }
    } catch (error) {
      logger.error('Scanner: Print job checkout failed', {
        studentId,
        printJobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Bulk checkout all active students (end of day)
   */
  async bulkCheckout(
    librarianId: string,
  ): Promise<{ success: boolean; count: number; message: string }> {
    try {
      const now = new Date();

      // Find all active activities
      const activeActivities = await prisma.student_activities.findMany({
        where: { status: 'ACTIVE' },
        include: { student: true },
      });

      // Clear all timers
      for (const activity of activeActivities) {
        this.clearAutoCheckoutTimer(activity.id);
      }

      // Bulk update all activities
      await prisma.student_activities.updateMany({
        where: { status: 'ACTIVE' },
        data: {
          end_time: now,
          status: 'COMPLETED',
          description: `Bulk checkout by librarian (${librarianId})`,
        },
      });

      // Clear all room assignments for these activities
      const activityIds = activeActivities.map(a => a.id);
      await prisma.student_activities_sections.deleteMany({
        where: { activity_id: { in: activityIds } },
      });

      // Emit checkout events for each student
      for (const activity of activeActivities) {
        const studentName = activity.student
          ? `${activity.student.first_name} ${activity.student.last_name}`
          : 'Unknown';

        websocketServer.emitStudentCheckOut({
          activityId: activity.id,
          studentId: activity.student_id,
          studentName,
          checkoutTime: now.toISOString(),
          reason: 'manual',
        });
      }

      logger.info('Scanner: Bulk checkout completed', {
        librarianId,
        count: activeActivities.length,
      });

      return {
        success: true,
        count: activeActivities.length,
        message: `${activeActivities.length} students checked out`,
      };
    } catch (error) {
      logger.error('Scanner: Bulk checkout failed', {
        librarianId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { success: false, count: 0, message: 'Bulk checkout failed' };
    }
  }

  /**
   * Get active timers count (for debugging)
   */
  getActiveTimersCount(): number {
    return this.autoCheckoutTimers.size;
  }
}

// Singleton instance
export const scannerHandler = new ScannerHandler();
export default scannerHandler;
