/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '../utils/prisma';
import { BarcodeService } from './barcodeService.js';
import { logger } from '../utils/logger';
import { websocketServer } from '../websocket/websocketServer';
import { ScanExportService } from './scanExportService';
import { LeaderboardService } from './LeaderboardService';

export interface CheckInResult {
  success: boolean;
  message: string;
  student?: any;
  activity?: any;
  cooldownRemaining?: number;
}

export interface StatusResult {
  success: boolean;
  isCheckedIn: boolean;
  student?: any;
  currentActivity?: any;
  lastCheckOut?: Date;
  canCheckIn: boolean;
  cooldownRemaining?: number;
}

export interface Statistics {
  totalCheckIns: number;
  averageTimeSpent: number;
  uniqueStudents: number;
}

/**
 * Format student for API response (convert snake_case to camelCase)
 */
function formatStudentForAPI(student: any) {
  // Format grade level properly - convert integer to readable string
  const gradeLevel = student.grade_level;
  let formattedGradeLevel = '';
  if (gradeLevel !== null && gradeLevel !== undefined) {
    const gradeNum = Number(gradeLevel);
    if (!isNaN(gradeNum)) {
      if (gradeNum >= 1 && gradeNum <= 6) {
        formattedGradeLevel = `Grade ${gradeNum}`;
      } else if (gradeNum >= 7 && gradeNum <= 10) {
        formattedGradeLevel = `Grade ${gradeNum}`;
      } else if (gradeNum === 11 || gradeNum === 12) {
        formattedGradeLevel = `Grade ${gradeNum}`;
      } else if (gradeNum === 0) {
        // Check if it's personnel based on grade_category or barcode
        if (
          student.grade_category === 'PERSONNEL' ||
          student.barcode?.startsWith('PN') ||
          student.student_id?.startsWith('PN')
        ) {
          formattedGradeLevel = 'Personnel';
        } else {
          formattedGradeLevel = 'Kindergarten';
        }
      } else {
        formattedGradeLevel = String(gradeNum);
      }
    } else {
      formattedGradeLevel = String(gradeLevel);
    }
  } else if (
    student.grade_category === 'PERSONNEL' ||
    student.barcode?.startsWith('PN') ||
    student.student_id?.startsWith('PN')
  ) {
    formattedGradeLevel = 'Personnel';
  }

  return {
    id: student.id,
    studentId: student.student_id,
    name: `${student.first_name} ${student.last_name}`,
    gradeLevel: formattedGradeLevel,
    section: student.section || '',
    gradeCategory: student.grade_category || 'STUDENT',
  };
}

/**
 * Self-Service Scanning Service
 * Handles barcode scanning for student check-in/check-out
 */
export class SelfService {
  /**
   * Process a scan and determine action (auto check-in or check-out)
   * Enforces 15-minute minimum session before allowing checkout
   */
  static async processScan(
    scanData: string,
    bypassCooldown: boolean = false,
  ): Promise<CheckInResult> {
    try {
      // Find student by barcode
      const student = await this.findStudentByBarcode(scanData);

      if (!student) {
        return {
          success: false,
          message: 'Student not found with this barcode',
        };
      }

      // Check if student has an active session
      const activeActivity = await prisma.student_activities.findFirst({
        where: {
          student_id: student.id,
          status: 'ACTIVE',
        },
        orderBy: { start_time: 'desc' },
      });

      if (activeActivity) {
        // Check if 15-minute minimum session has passed
        const now = new Date();
        const startTime = new Date(activeActivity.start_time);
        const minutesSinceCheckIn =
          (now.getTime() - startTime.getTime()) / 60000;

        if (minutesSinceCheckIn < 15 && !bypassCooldown) {
          const remainingMinutes = Math.ceil(15 - minutesSinceCheckIn);
          const remainingSeconds = Math.ceil((15 - minutesSinceCheckIn) * 60);
          return {
            success: false,
            message: `You must stay checked in for at least 15 minutes. Please wait ${remainingMinutes} more minute(s) before checking out.`,
            cooldownRemaining: remainingSeconds,
            student: formatStudentForAPI(student),
          };
        }

        // Check out the student (15+ minutes passed or bypass)
        return await this.checkOut(student.id, activeActivity.id);
      } else {
        // Check in the student
        return await this.checkIn(student.id, bypassCooldown);
      }
    } catch (error) {
      logger.error('Process scan error:', error);
      return {
        success: false,
        message: 'Failed to process scan',
      };
    }
  }

  /**
   * Get student status by barcode
   */
  static async getStatus(scanData: string): Promise<StatusResult> {
    try {
      const student = await this.findStudentByBarcode(scanData);

      if (!student) {
        return {
          success: false,
          isCheckedIn: false,
          canCheckIn: false,
        };
      }

      // Check for active activity
      const activeActivity = await prisma.student_activities.findFirst({
        where: {
          student_id: student.id,
          status: 'ACTIVE',
        },
        orderBy: { start_time: 'desc' },
      });

      // Get last check-out time
      const lastActivity = await prisma.student_activities.findFirst({
        where: {
          student_id: student.id,
          status: 'COMPLETED',
        },
        orderBy: { end_time: 'desc' },
      });

      const isCheckedIn = !!activeActivity;

      // Calculate cooldown if not checked in
      let cooldownRemaining = 0;
      if (!isCheckedIn && lastActivity?.end_time) {
        cooldownRemaining = await this.getCooldownRemaining(student.id);
      }

      const canCheckIn = !isCheckedIn && cooldownRemaining === 0;

      return {
        success: true,
        isCheckedIn,
        student,
        currentActivity: activeActivity,
        lastCheckOut: lastActivity?.end_time ?? undefined,
        canCheckIn,
        cooldownRemaining,
      };
    } catch (error) {
      logger.error('Get status error:', error);
      return {
        success: false,
        isCheckedIn: false,
        canCheckIn: false,
      };
    }
  }

  /**
   * Check in a student
   */
  static async checkIn(
    studentId: string,
    bypassCooldown: boolean = false,
  ): Promise<CheckInResult> {
    try {
      // Get student
      const student = await prisma.students.findUnique({
        where: { id: studentId },
      });

      if (!student) {
        return {
          success: false,
          message: 'Student not found',
        };
      }

      // Check if student already has an active session
      const existingActivity = await prisma.student_activities.findFirst({
        where: {
          student_id: studentId,
          status: 'ACTIVE',
        },
      });

      if (existingActivity) {
        return {
          success: false,
          message: 'Student is already checked in',
        };
      }

      // Check cooldown period
      const cooldownRemaining = await this.getCooldownRemaining(studentId);
      if (cooldownRemaining > 0 && !bypassCooldown) {
        return {
          success: false,
          message: `Please wait ${Math.ceil(cooldownRemaining / 60)} more minute(s) before checking in again`,
          cooldownRemaining,
        };
      }

      // Create new activity
      const activity = await prisma.student_activities.create({
        data: {
          student_id: studentId,
          activity_type: 'LIBRARY_VISIT',
          description: 'Library check-in',
          status: 'ACTIVE',
        },
      });

      // Auto-assign to Library Space section
      const librarySection = await prisma.library_sections.findFirst({
        where: {
          OR: [
            { code: 'LIBRARY' },
            { code: 'LIBRARY_SPACE' },
            { name: { contains: 'Library' } },
          ],
          is_active: true,
        },
      });

      if (librarySection) {
        await prisma.student_activities_sections.create({
          data: {
            activity_id: activity.id,
            section_id: librarySection.id,
          },
        });
      }

      // Emit WebSocket event
      websocketServer.emitStudentCheckIn({
        activityId: activity.id,
        studentId: student.id,
        studentName: `${student.first_name} ${student.last_name}`,
        gender: student.gender || undefined,
        checkinTime: activity.start_time.toISOString(),
        autoLogoutAt: new Date(
          activity.start_time.getTime() + 30 * 60000,
        ).toISOString(),
      });

      ScanExportService.logStudentScan({
        barcode: student.barcode || student.student_id,
        studentId: student.student_id,
        studentName: `${student.first_name} ${student.last_name}`,
        action: 'CHECK_IN',
        source: 'Self-Service',
        status: 'ACTIVE',
      }).catch(error =>
        logger.error('Failed to log student check-in export', {
          studentId: student.student_id,
          error: error instanceof Error ? error.message : error,
        }),
      );

      // Record scan for leaderboard
      // We don't await this to avoid slowing down the check-in process
      LeaderboardService.recordScan(student.id).catch(err =>
        logger.error('Failed to record leaderboard scan:', err),
      );

      return {
        success: true,
        message: 'Checked in successfully',
        student: formatStudentForAPI(student),
        activity: {
          ...activity,
          timeLimit: 30, // Default 30 minutes
          timeRemaining: 30 * 60, // 30 minutes in seconds
        },
      };
    } catch (error) {
      logger.error('Check in error:', error);
      return {
        success: false,
        message: 'Failed to check in',
      };
    }
  }

  /**
   * Check out a student
   */
  static async checkOut(
    studentId: string,
    activityId?: string,
  ): Promise<CheckInResult> {
    try {
      // Get student
      const student = await prisma.students.findUnique({
        where: { id: studentId },
      });

      if (!student) {
        return {
          success: false,
          message: 'Student not found',
        };
      }

      // Find active activity
      const activity = activityId
        ? await prisma.student_activities.findUnique({
            where: { id: activityId },
          })
        : await prisma.student_activities.findFirst({
            where: {
              student_id: studentId,
              status: 'ACTIVE',
            },
            orderBy: { start_time: 'desc' },
          });

      if (activity?.status !== 'ACTIVE') {
        return {
          success: false,
          message: 'No active session found',
        };
      }

      // Update activity to completed
      const updatedActivity = await prisma.student_activities.update({
        where: { id: activity.id },
        data: {
          status: 'COMPLETED',
          end_time: new Date(),
        },
      });

      // Calculate time spent
      const endTime = updatedActivity.end_time ?? new Date();
      const timeSpent = Math.floor(
        (endTime.getTime() - updatedActivity.start_time.getTime()) / 1000 / 60,
      ); // in minutes

      // Emit WebSocket event
      websocketServer.emitStudentCheckOut({
        activityId: updatedActivity.id,
        studentId: student.id,
        studentName: `${student.first_name} ${student.last_name}`,
        gender: student.gender || undefined,
        checkoutTime: endTime.toISOString(),
        reason: 'manual',
      });

      ScanExportService.logStudentScan({
        barcode: student.barcode || student.student_id,
        studentId: student.student_id,
        studentName: `${student.first_name} ${student.last_name}`,
        action: 'CHECK_OUT',
        source: 'Self-Service',
        status: 'COMPLETED',
        notes: `Time spent: ${timeSpent} mins`,
      }).catch(error =>
        logger.error('Failed to log student check-out export', {
          studentId: student.student_id,
          error: error instanceof Error ? error.message : error,
        }),
      );

      // Check if this was a manual lookup session (excluded from leaderboard)
      let excludeFromLeaderboard = false;
      try {
        const activityMetadata = activity.metadata
          ? JSON.parse(activity.metadata)
          : {};
        excludeFromLeaderboard =
          activityMetadata.excludeFromLeaderboard === true ||
          activityMetadata.manualLookup === true;
      } catch {
        // If metadata parsing fails, don't exclude
      }

      // Record time spent for leaderboard on checkout (unless excluded)
      LeaderboardService.recordScan(
        student.id,
        timeSpent,
        excludeFromLeaderboard,
      ).catch(err =>
        logger.error('Failed to record leaderboard stats on checkout:', err),
      );

      return {
        success: true,
        message: `Checked out successfully. Time spent: ${timeSpent} minutes`,
        student: formatStudentForAPI(student),
        activity: {
          ...updatedActivity,
          timeSpent,
        },
      };
    } catch (error) {
      logger.error('Check out error:', error);
      return {
        success: false,
        message: 'Failed to check out',
      };
    }
  }

  /**
   * Get self-service statistics
   */
  static async getStatistics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<Statistics> {
    try {
      // Build where clause for date range
      // Include all check-in activity types: LIBRARY_VISIT (used by selfService.checkIn),
      // SELF_SERVICE_CHECK_IN, KIOSK_CHECK_IN, and CHECK_IN
      const whereClause: any = {
        activity_type: {
          in: [
            'LIBRARY_VISIT',
            'SELF_SERVICE_CHECK_IN',
            'KIOSK_CHECK_IN',
            'CHECK_IN',
          ],
        },
      };

      if (startDate || endDate) {
        whereClause.start_time = {};
        if (startDate) {
          whereClause.start_time.gte = startDate;
        }
        if (endDate) {
          whereClause.start_time.lte = endDate;
        }
      }

      // Get total check-ins
      const totalCheckIns = await prisma.student_activities.count({
        where: whereClause,
      });

      // Get unique students
      const uniqueStudents = await prisma.student_activities.findMany({
        where: whereClause,
        select: { student_id: true },
        distinct: ['student_id'],
      });

      // Calculate average time spent
      const completedActivities = await prisma.student_activities.findMany({
        where: {
          ...whereClause,
          status: 'COMPLETED',
          end_time: { not: null },
        },
        select: {
          start_time: true,
          end_time: true,
        },
      });

      let averageTimeSpent = 0;
      if (completedActivities.length > 0) {
        const totalMinutes = completedActivities.reduce((sum, activity) => {
          if (!activity.end_time) {
            return sum;
          }
          const minutes = Math.floor(
            (activity.end_time.getTime() - activity.start_time.getTime()) /
              1000 /
              60,
          );
          return sum + minutes;
        }, 0);
        averageTimeSpent = Math.round(
          totalMinutes / completedActivities.length,
        );
      }

      return {
        totalCheckIns,
        averageTimeSpent,
        uniqueStudents: uniqueStudents.length,
      };
    } catch (error) {
      logger.error('Get statistics error:', error);
      return {
        totalCheckIns: 0,
        averageTimeSpent: 0,
        uniqueStudents: 0,
      };
    }
  }

  /**
   * Find student by barcode or student_id
   */
  private static async findStudentByBarcode(barcode: string) {
    const code = String(barcode).trim();

    // First, try to find by student_id (most common case)
    // Note: We don't filter by is_active - student becomes active on first scan
    let student = await prisma.students.findFirst({
      where: { student_id: code },
    });
    if (student) {
      // Activate student on first scan if not already active
      if (!student.is_active) {
        student = await prisma.students.update({
          where: { id: student.id },
          data: { is_active: true },
        });
        logger.info('Student activated on first scan', {
          studentId: student.student_id,
        });
      }
      return student;
    }

    // Validate barcode format for barcode-specific searches
    if (!BarcodeService.validateBarcode(code)) {
      // If not a valid barcode format, we already checked student_id above
      return null;
    }

    // Try exact barcode match
    student = await prisma.students.findFirst({
      where: { barcode: code },
    });
    if (student) {
      // Activate student on first scan if not already active
      if (!student.is_active) {
        student = await prisma.students.update({
          where: { id: student.id },
          data: { is_active: true },
        });
        logger.info('Student activated on first scan', {
          studentId: student.student_id,
        });
      }
      return student;
    }

    // If input is numeric-only, also try PN-prefixed variant
    if (/^\d{5,12}$/.test(code)) {
      const pnCode = `PN${code}`;
      student = await prisma.students.findFirst({
        where: { barcode: pnCode },
      });
      if (student) {
        // Activate student on first scan if not already active
        if (!student.is_active) {
          student = await prisma.students.update({
            where: { id: student.id },
            data: { is_active: true },
          });
          logger.info('Student activated on first scan', {
            studentId: student.student_id,
          });
        }
        return student;
      }
    }
    return null;
  }

  /**
   * Get the minimum check-in interval (cooldown) in seconds
   */
  private static async getMinimumCheckInInterval(): Promise<number> {
    try {
      const setting = await prisma.system_settings.findUnique({
        where: { key: 'attendance.min_check_in_interval_minutes' },
      });

      // Default to 15 minutes if not configured
      return setting ? parseInt(setting.value) * 60 : 15 * 60;
    } catch (error) {
      logger.error('Error getting minimum check-in interval:', error);
      return 15 * 60; // Default 15 minutes
    }
  }

  /**
   * Calculate remaining cooldown time for a student
   */
  private static async getCooldownRemaining(
    studentId: string,
  ): Promise<number> {
    try {
      // Get the minimum interval required between check-ins
      const minimumInterval = await this.getMinimumCheckInInterval();

      // Get last completed activity
      const lastActivity = await prisma.student_activities.findFirst({
        where: {
          student_id: studentId,
          status: 'COMPLETED',
          end_time: { not: null },
        },
        orderBy: { end_time: 'desc' },
      });

      // If no previous activity, no cooldown needed
      if (!lastActivity?.end_time) {
        return 0;
      }

      // Calculate time since last check-out
      const now = new Date();
      const lastCheckOut = new Date(lastActivity.end_time);
      const timeSinceLastCheckOut = Math.floor(
        (now.getTime() - lastCheckOut.getTime()) / 1000,
      );

      // Return remaining cooldown time
      return Math.max(0, minimumInterval - timeSinceLastCheckOut);
    } catch (error) {
      logger.error('Error calculating cooldown remaining:', error);
      return 0;
    }
  }
}
