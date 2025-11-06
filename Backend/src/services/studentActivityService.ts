import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { addMinutes } from 'date-fns';

const prisma = new PrismaClient();

interface StudentReminder {
  type: 'overdue_book' | 'book_due_soon' | 'custom' | 'general';
  message: string;
  priority: 'low' | 'normal' | 'high';
  bookTitle?: string;
  dueDate?: string;
}

interface CheckInResult {
  activityId: string;
  studentId: string;
  studentName: string;
  checkinTime: string;
  autoLogoutAt: string;
  reminders: StudentReminder[];
  customMessage?: string;
}

export class StudentActivityService {
  /**
   * Get student reminders (overdue books, due soon books, custom notes)
   */
  static async getStudentReminders(
    studentId: string,
  ): Promise<StudentReminder[]> {
    const reminders: StudentReminder[] = [];

    try {
      // Check for overdue books
      const overdueBooks = await prisma.book_checkouts.findMany({
        where: {
          student_id: studentId,
          status: 'ACTIVE',
          due_date: { lt: new Date() },
        },
        include: {
          book: {
            select: {
              title: true,
            },
          },
        },
      });

      for (const checkout of overdueBooks) {
        reminders.push({
          type: 'overdue_book',
          message: `You have an overdue book: "${checkout.book.title}"`,
          priority: 'high',
          bookTitle: checkout.book.title,
          dueDate: checkout.due_date.toISOString(),
        });
      }

      // Check for books due soon (within 3 days)
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      const dueSoonBooks = await prisma.book_checkouts.findMany({
        where: {
          student_id: studentId,
          status: 'ACTIVE',
          due_date: {
            gte: new Date(),
            lte: threeDaysFromNow,
          },
        },
        include: {
          book: {
            select: {
              title: true,
            },
          },
        },
      });

      for (const checkout of dueSoonBooks) {
        reminders.push({
          type: 'book_due_soon',
          message: `Book due soon: "${checkout.book.title}"`,
          priority: 'normal',
          bookTitle: checkout.book.title,
          dueDate: checkout.due_date.toISOString(),
        });
      }

      // Fetch custom student notes from system_settings
      const customNotes = await prisma.system_settings.findMany({
        where: {
          category: 'student_notes',
          key: `student_${studentId}`,
        },
      });

      for (const note of customNotes) {
        reminders.push({
          type: 'custom',
          message: note.value,
          priority: 'normal',
        });
      }
    } catch (error) {
      logger.error('Error fetching student reminders', {
        studentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return reminders;
  }

  /**
   * Get librarian's custom welcome/goodbye message
   */
  static async getCustomMessage(
    type: 'welcome' | 'goodbye',
  ): Promise<string | undefined> {
    try {
      const setting = await prisma.system_settings.findFirst({
        where: {
          category: 'attendance_messages',
          key: `${type}_message`,
        },
      });

      return setting?.value || undefined;
    } catch (error) {
      logger.error('Error fetching custom message', {
        type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return undefined;
    }
  }

  /**
   * Check in a student
   */
  static async checkInStudent(studentId: string): Promise<CheckInResult> {
    try {
      // Verify student exists
      const student = await prisma.students.findUnique({
        where: { id: studentId },
        select: {
          id: true,
          first_name: true,
          last_name: true,
        },
      });

      if (!student) {
        throw new Error('Student not found');
      }

      // Check if student already has an active session
      const existingActivity = await prisma.student_activities.findFirst({
        where: {
          student_id: studentId,
          status: 'ACTIVE',
          end_time: null,
        },
      });

      if (existingActivity) {
        throw new Error('Student already checked in');
      }

      // Calculate auto-logout time (15 minutes from now)
      const autoLogoutAt = addMinutes(new Date(), 15);

      // Create activity record
      const activity = await prisma.student_activities.create({
        data: {
          student_id: studentId,
          activity_type: 'CHECK_IN',
          description: 'Student checked in via attendance kiosk',
          start_time: new Date(),
          status: 'ACTIVE',
        },
      });

      // Fetch reminders and custom message
      const reminders = await this.getStudentReminders(studentId);
      const customMessage = await this.getCustomMessage('welcome');

      logger.info('Student checked in successfully', {
        studentId,
        activityId: activity.id,
        autoLogoutAt: autoLogoutAt.toISOString(),
        reminderCount: reminders.length,
      });

      return {
        activityId: activity.id,
        studentId: student.id,
        studentName: `${student.first_name} ${student.last_name}`,
        checkinTime: activity.start_time.toISOString(),
        autoLogoutAt: autoLogoutAt.toISOString(),
        reminders,
        customMessage,
      };
    } catch (error) {
      logger.error('Check-in failed', {
        studentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Check out a student
   */
  static async checkOutStudent(
    studentId: string,
    reason: 'manual' | 'auto' = 'manual',
  ): Promise<{
    activityId: string;
    studentId: string;
    studentName: string;
    checkoutTime: string;
    reason: 'manual' | 'auto';
    customMessage?: string;
  }> {
    try {
      // Find active session
      const activity = await prisma.student_activities.findFirst({
        where: {
          student_id: studentId,
          status: 'ACTIVE',
          end_time: null,
        },
        include: {
          student: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      if (!activity) {
        throw new Error('No active session found');
      }

      // Update activity to mark as completed
      const updatedActivity = await prisma.student_activities.update({
        where: { id: activity.id },
        data: {
          end_time: new Date(),
          status: 'COMPLETED',
          description: `${activity.description} | Checked out (${reason})`,
        },
      });

      // Fetch custom goodbye message
      const customMessage = await this.getCustomMessage('goodbye');

      logger.info('Student checked out successfully', {
        studentId,
        activityId: activity.id,
        reason,
      });

      return {
        activityId: activity.id,
        studentId: activity.student.id,
        studentName: `${activity.student.first_name} ${activity.student.last_name}`,
        checkoutTime: updatedActivity.end_time!.toISOString(),
        reason,
        customMessage,
      };
    } catch (error) {
      logger.error('Check-out failed', {
        studentId,
        reason,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Auto-logout students whose session has expired
   */
  static async autoLogoutExpiredSessions(): Promise<void> {
    try {
      // Find all active sessions older than 15 minutes
      const fifteenMinutesAgo = addMinutes(new Date(), -15);

      const expiredSessions = await prisma.student_activities.findMany({
        where: {
          status: 'ACTIVE',
          end_time: null,
          start_time: { lt: fifteenMinutesAgo },
        },
      });

      for (const session of expiredSessions) {
        await this.checkOutStudent(session.student_id, 'auto');
      }

      if (expiredSessions.length > 0) {
        logger.info('Auto-logged out expired sessions', {
          count: expiredSessions.length,
        });
      }
    } catch (error) {
      logger.error('Auto-logout failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get all active student sessions
   */
  static async getActiveSessions(): Promise<
    Array<{
      activityId: string;
      studentId: string;
      studentName: string;
      checkinTime: string;
      autoLogoutAt: string;
      reminders: StudentReminder[];
    }>
  > {
    try {
      const activeSessions = await prisma.student_activities.findMany({
        where: {
          status: 'ACTIVE',
          end_time: null,
        },
        include: {
          student: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
        orderBy: {
          start_time: 'desc',
        },
      });

      const sessions = await Promise.all(
        activeSessions.map(async (activity) => {
          const reminders = await this.getStudentReminders(activity.student_id);
          const autoLogoutAt = addMinutes(activity.start_time, 15);

          return {
            activityId: activity.id,
            studentId: activity.student.id,
            studentName: `${activity.student.first_name} ${activity.student.last_name}`,
            checkinTime: activity.start_time.toISOString(),
            autoLogoutAt: autoLogoutAt.toISOString(),
            reminders,
          };
        }),
      );

      logger.info('Active sessions retrieved', {
        count: sessions.length,
      });

      return sessions;
    } catch (error) {
      logger.error('Failed to get active sessions', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
