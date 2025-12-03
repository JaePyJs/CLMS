/* eslint-disable @typescript-eslint/no-explicit-any */
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { GoogleSheetsService } from './googleSheetsService';
import { prisma } from '../utils/prisma';
import { websocketServer } from '../websocket/websocketServer';
import { ScanExportService } from './scanExportService';

export interface CheckInWithSectionsInput {
  studentId: string;
  sectionCodes: string[];
}

export interface CheckInWithSectionsResult {
  success: boolean;
  message: string;
  student?: any;
  activity?: any;
  sections?: any[];
  cooldownRemaining?: number;
}

export class EnhancedSelfService {
  public static async processScanWithSelection(
    scanData: string,
    sectionCodes: string[],
  ): Promise<CheckInWithSectionsResult> {
    try {
      // Allow searching by student_id or barcode
      // Note: We don't filter by is_active - student becomes active on first scan
      let student = await prisma.students.findFirst({
        where: {
          OR: [{ barcode: scanData }, { student_id: scanData }],
        },
      });

      if (!student) {
        return {
          success: false,
          message: 'Student not found with this barcode or ID',
        };
      }

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

      const active = await prisma.student_activities.findFirst({
        where: { student_id: student.id, status: 'ACTIVE' },
        orderBy: { start_time: 'desc' },
      });
      if (active) {
        const now = new Date();
        const startTime = new Date(active.start_time);
        const durationMinutes =
          (now.getTime() - startTime.getTime()) / 1000 / 60;

        if (durationMinutes < 15) {
          return {
            success: false,
            message: 'You are already logged in. No need to tap again.',
          };
        }

        return await this.checkOut(student.id, active.id);
      }
      return await this.checkInWithSections({
        studentId: student.id,
        sectionCodes,
      });
    } catch (error) {
      logger.error('Process scan with selection failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { success: false, message: 'Failed to process scan' };
    }
  }

  public static async checkInWithSections(
    input: CheckInWithSectionsInput,
  ): Promise<CheckInWithSectionsResult> {
    try {
      const student = await prisma.students.findUnique({
        where: { id: input.studentId },
      });
      if (!student) {
        return { success: false, message: 'Student not found' };
      }
      const existing = await prisma.student_activities.findFirst({
        where: { student_id: input.studentId, status: 'ACTIVE' },
      });
      if (existing) {
        return { success: false, message: 'Student is already checked in' };
      }
      const cooldownRemaining = await this.getCooldownRemaining(
        input.studentId,
      );
      if (cooldownRemaining > 0) {
        return {
          success: false,
          message: `Please wait ${Math.ceil(cooldownRemaining / 60)} more minute(s) before checking in again`,
          cooldownRemaining,
        };
      }
      const sessionId = uuidv4();
      const activity = await prisma.student_activities.create({
        data: {
          student_id: input.studentId,
          activity_type: 'LIBRARY_VISIT',
          description: 'Library visit with selected sections',
          status: 'ACTIVE',
          session_id: sessionId,
        },
      });
      const validSections = await prisma.library_sections.findMany({
        where: { code: { in: input.sectionCodes }, is_active: true },
      });
      const mappings = [] as any[];
      for (const s of validSections) {
        const map = await prisma.student_activities_sections.create({
          data: { activity_id: activity.id, section_id: s.id },
        });
        mappings.push(map);
      }

      // Google Sheets Integration
      try {
        const row = [
          student.student_id,
          `${student.first_name} ${student.last_name}`,
          student.grade_level.toString(),
          'CHECK_IN',
          new Date().toISOString(),
          validSections.map(s => s.name).join(', '),
        ];
        await GoogleSheetsService.appendRow(row);
      } catch (e) {
        logger.error('Google Sheets push failed', e);
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
        source: 'Enhanced Self-Service',
        status: 'ACTIVE',
        notes: validSections.map(s => s.name).join(', '),
      }).catch(error =>
        logger.error('Failed to log enhanced student check-in export', {
          studentId: student.student_id,
          error: error instanceof Error ? error.message : error,
        }),
      );

      return {
        success: true,
        message: 'Checked in successfully',
        student,
        activity,
        sections: validSections,
      };
    } catch (error) {
      logger.error('Check in with sections failed', {
        studentId: input.studentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { success: false, message: 'Failed to check in' };
    }
  }

  public static async checkOut(
    studentId: string,
    activityId?: string,
  ): Promise<CheckInWithSectionsResult> {
    try {
      const student = await prisma.students.findUnique({
        where: { id: studentId },
      });
      if (!student) {
        return { success: false, message: 'Student not found' };
      }
      const activity = activityId
        ? await prisma.student_activities.findUnique({
            where: { id: activityId },
          })
        : await prisma.student_activities.findFirst({
            where: { student_id: studentId, status: 'ACTIVE' },
            orderBy: { start_time: 'desc' },
          });
      if (activity?.status !== 'ACTIVE') {
        return { success: false, message: 'No active session found' };
      }
      const updated = await prisma.student_activities.update({
        where: { id: activity.id },
        data: { status: 'COMPLETED', end_time: new Date() },
      });
      const endTime = updated.end_time ?? new Date();
      const timeSpent = Math.floor(
        (endTime.getTime() - updated.start_time.getTime()) / 1000 / 60,
      );

      // Google Sheets Integration
      try {
        const row = [
          student.student_id,
          `${student.first_name} ${student.last_name}`,
          student.grade_level.toString(),
          'CHECK_OUT',
          endTime.toISOString(),
          `Duration: ${timeSpent} mins`,
        ];
        await GoogleSheetsService.appendRow(row);
      } catch (e) {
        logger.error('Google Sheets push failed', e);
      }

      // Emit WebSocket event
      websocketServer.emitStudentCheckOut({
        activityId: updated.id,
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
        source: 'Enhanced Self-Service',
        status: 'COMPLETED',
        notes: `Time spent: ${timeSpent} mins`,
      }).catch(error =>
        logger.error('Failed to log enhanced student check-out export', {
          studentId: student.student_id,
          error: error instanceof Error ? error.message : error,
        }),
      );

      return {
        success: true,
        message: `Checked out successfully. Time spent: ${timeSpent} minutes`,
        student,
        activity: { ...updated, timeSpent },
      };
    } catch (error) {
      logger.error('Enhanced check out failed', {
        studentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { success: false, message: 'Failed to check out' };
    }
  }

  private static async getMinimumCheckInInterval(): Promise<number> {
    try {
      const setting = await prisma.system_settings.findUnique({
        where: { key: 'attendance.min_check_in_interval_minutes' },
      });
      return setting ? parseInt(setting.value) * 60 : 15 * 60;
    } catch {
      return 15 * 60;
    }
  }

  private static async getCooldownRemaining(
    studentId: string,
  ): Promise<number> {
    try {
      const minimumInterval = await this.getMinimumCheckInInterval();
      const lastActivity = await prisma.student_activities.findFirst({
        where: {
          student_id: studentId,
          status: 'COMPLETED',
          end_time: { not: null },
        },
        orderBy: { end_time: 'desc' },
      });
      if (!lastActivity?.end_time) {
        return 0;
      }
      const now = new Date();
      const lastCheckOut = new Date(lastActivity.end_time);
      const elapsed = Math.floor(
        (now.getTime() - lastCheckOut.getTime()) / 1000,
      );
      return Math.max(0, minimumInterval - elapsed);
    } catch {
      return 0;
    }
  }
}
