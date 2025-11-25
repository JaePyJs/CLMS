/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '../utils/prisma';
import { BarcodeService } from './barcodeService.js';
import { logger } from '../utils/logger';
import { websocketServer } from '../websocket/websocketServer';

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
 * Self-Service Scanning Service
 * Handles barcode scanning for student check-in/check-out
 */
export class SelfService {
  /**
   * Process a scan and determine action (auto check-in or check-out)
   */
  static async processScan(scanData: string): Promise<CheckInResult> {
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
        // Check out the student
        return await this.checkOut(student.id, activeActivity.id);
      } else {
        // Check in the student
        return await this.checkIn(student.id);
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
  static async checkIn(studentId: string): Promise<CheckInResult> {
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
      if (cooldownRemaining > 0) {
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
          activity_type: 'SELF_SERVICE_CHECK_IN',
          description: 'Self-service check-in',
          status: 'ACTIVE',
        },
      });

      // Emit WebSocket event
      websocketServer.emitStudentCheckIn({
        activityId: activity.id,
        studentId: student.id,
        studentName: `${student.first_name} ${student.last_name}`,
        checkinTime: activity.start_time.toISOString(),
        autoLogoutAt: new Date(
          activity.start_time.getTime() + 30 * 60000,
        ).toISOString(),
      });

      return {
        success: true,
        message: 'Checked in successfully',
        student,
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
        checkoutTime: endTime.toISOString(),
        reason: 'manual',
      });

      return {
        success: true,
        message: `Checked out successfully. Time spent: ${timeSpent} minutes`,
        student,
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
      const whereClause: any = {
        activity_type: {
          contains: 'SELF_SERVICE',
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
   * Find student by barcode
   */
  private static async findStudentByBarcode(barcode: string) {
    // Accept numeric-only or PN-prefixed codes
    const code = String(barcode).trim();
    if (!BarcodeService.validateBarcode(code)) {
      return null;
    }
    // Exact match first
    let student = await prisma.students.findFirst({
      where: { barcode: code, is_active: true },
    });
    if (student) {
      return student;
    }
    // If input is numeric-only, also try PN-prefixed variant
    if (/^\d{5,12}$/.test(code)) {
      const pnCode = `PN${code}`;
      student = await prisma.students.findFirst({
        where: { barcode: pnCode, is_active: true },
      });
      if (student) {
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
