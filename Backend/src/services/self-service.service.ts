import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';

const prisma = new PrismaClient();

// Cooldown period in milliseconds (30 minutes)
const COOLDOWN_PERIOD = 30 * 60 * 1000;

export interface SelfServiceCheckInResponse {
  success: boolean;
  message: string;
  student?: {
    id: string;
    student_id: string;
    name: string;
    grade_level: string;
    section: string;
  };
  activity?: {
    id: string;
    checkInTime: Date;
    timeLimit: number;
  };
  cooldownRemaining?: number;
}

export interface SelfServiceStatusResponse {
  success: boolean;
  isCheckedIn: boolean;
  student?: {
    id: string;
    student_id: string;
    name: string;
    grade_level: string;
    section: string;
  };
  currentActivity?: {
    id: string;
    checkInTime: Date;
    timeLimit: number;
    timeRemaining: number;
  };
  lastCheckOut?: Date;
  canCheckIn: boolean;
  cooldownRemaining?: number;
}

class SelfServiceService {
  /**
   * Check if a student is currently checked in
   */
  async isStudentCheckedIn(student_id: string): Promise<boolean> {
    try {
      const activity = await prisma.student_activities.findFirst({
        where: {
          student_id: student_id,
          end_time: null,
          status: 'ACTIVE',
        },
      });

      return !!activity;
    } catch (error) {
      logger.error('Error checking student status', { error, student_id });
      throw new Error('Failed to check student status');
    }
  }

  /**
   * Get the last activity for a student
   */
  async getLastActivity(student_id: string) {
    try {
      return await prisma.student_activities.findFirst({
        where: { student_id: student_id },
        orderBy: { start_time: 'desc' },
      });
    } catch (error) {
      logger.error('Error getting last activity', { error, student_id });
      throw new Error('Failed to get last activity');
    }
  }

  /**
   * Check if student is in cooldown period
   */
  async isInCooldownPeriod(student_id: string): Promise<{ inCooldown: boolean; remainingMs: number }> {
    try {
      const lastActivity = await this.getLastActivity(student_id);

      if (!lastActivity || !lastActivity.end_time) {
        return { inCooldown: false, remainingMs: 0 };
      }

      const timeSinceCheckOut = Date.now() - lastActivity.end_time.getTime();
      const remainingMs = COOLDOWN_PERIOD - timeSinceCheckOut;

      if (remainingMs > 0) {
        return { inCooldown: true, remainingMs };
      }

      return { inCooldown: false, remainingMs: 0 };
    } catch (error) {
      logger.error('Error checking cooldown', { error, student_id });
      throw new Error('Failed to check cooldown period');
    }
  }

  /**
   * Get student status and check-in eligibility
   */
  async getStudentStatus(studentIdOrQrCode: string): Promise<SelfServiceStatusResponse> {
    try {
      // Find student by ID (using existing schema)
      const student = await prisma.students.findFirst({
        where: {
          student_id: studentIdOrQrCode,
        },
      });

      if (!student) {
        return {
          success: false,
          isCheckedIn: false,
          canCheckIn: false,
          cooldownRemaining: 0,
        };
      }

      // Check if currently checked in
      const isCheckedIn = await this.isStudentCheckedIn(student.id);

      if (isCheckedIn) {
        const currentActivity = await prisma.student_activities.findFirst({
          where: {
            student_id: student.id,
            end_time: null,
            status: 'ACTIVE',
          },
        });

        const timeElapsed = Date.now() - currentActivity!.start_time.getTime();
        const timeRemaining = Math.max(0, currentActivity!.time_limit_minutes - Math.floor(timeElapsed / 60000));

        return {
          success: true,
          isCheckedIn: true,
          student: {
            id: student.id,
            student_id: student.student_id,
            name: `${student.first_name} ${student.last_name}`,
            grade_level: student.grade_level,
            section: student.section || '',
          },
          currentActivity: {
            id: currentActivity!.id,
            checkInTime: currentActivity!.start_time,
            timeLimit: currentActivity!.time_limit_minutes || 60,
            timeRemaining,
          },
          canCheckIn: false,
        };
      }

      // Check cooldown period
      const { inCooldown, remainingMs } = await this.isInCooldownPeriod(student.id);

      const lastActivity = await this.getLastActivity(student.id);

      return {
        success: true,
        isCheckedIn: false,
        student: {
          id: student.id,
          student_id: student.student_id,
          name: `${student.first_name} ${student.last_name}`,
          grade_level: student.grade_level,
          section: student.section || '',
        },
        lastCheckOut: lastActivity?.end_time || undefined,
        canCheckIn: !inCooldown,
        cooldownRemaining: inCooldown ? Math.ceil(remainingMs / 1000) : 0,
      };
    } catch (error) {
      logger.error('Error getting student status', { error, studentIdOrQrCode });
      throw new Error('Failed to get student status');
    }
  }

  /**
   * Process scan with auto check-in/check-out
   */
  async processScan(studentIdOrQrCode: string): Promise<SelfServiceCheckInResponse> {
    try {
      // Find student
      const student = await prisma.students.findFirst({
        where: {
          student_id: studentIdOrQrCode,
        },
      });

      if (!student) {
        return {
          success: false,
          message: 'Student not found. Please contact the librarian.',
        };
      }

      // Check if currently checked in
      const isCheckedIn = await this.isStudentCheckedIn(student.id);

      if (isCheckedIn) {
        // Check out the student
        return await this.checkOut(studentIdOrQrCode);
      } else {
        // Check in the student
        return await this.checkIn(studentIdOrQrCode);
      }
    } catch (error) {
      logger.error('Error during self-service scan', { error, studentIdOrQrCode });
      return {
        success: false,
        message: 'An error occurred. Please contact the librarian.',
      };
    }
  }

  /**
   * Check in a student
   */
  async checkIn(studentIdOrQrCode: string): Promise<SelfServiceCheckInResponse> {
    try {
      // Find student
      const student = await prisma.students.findFirst({
        where: {
          student_id: studentIdOrQrCode,
        },
      });

      if (!student) {
        return {
          success: false,
          message: 'Student not found. Please contact the librarian.',
        };
      }

      // Check if already checked in
      const isCheckedIn = await this.isStudentCheckedIn(student.id);
      if (isCheckedIn) {
        return {
          success: false,
          message: 'You are already checked in. Please check out before checking in again.',
        };
      }

      // Check cooldown period
      const { inCooldown, remainingMs } = await this.isInCooldownPeriod(student.id);
      if (inCooldown) {
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        return {
          success: false,
          message: `Please wait ${remainingMinutes} more minute(s) before checking in again.`,
          cooldownRemaining: Math.ceil(remainingMs / 1000),
        };
      }

      // Determine time limit based on grade level
      const timeLimit = this.getTimeLimitForGrade(student.grade_level);

      // Create activity record
      const activity = await prisma.student_activities.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          student_id: student.id,
          student_name: `${student.first_name} ${student.last_name}`,
          grade_level: student.grade_level,
          grade_category: student.grade_category,
          activity_type: 'GENERAL_VISIT',
          start_time: new Date(),
          time_limit_minutes: timeLimit,
          status: 'ACTIVE',
          processed_by: 'SELF_SERVICE',
          updated_at: new Date(),
        },
      });

      logger.info('Student checked in via self-service', {
        student_id: student.student_id,
        student_name: `${student.first_name} ${student.last_name}`,
        activityId: activity.id,
      });

      return {
        success: true,
        message: `Welcome, ${student.first_name} ${student.last_name}! You have ${timeLimit} minutes.`,
        student: {
          id: student.id,
          student_id: student.student_id,
          name: `${student.first_name} ${student.last_name}`,
          grade_level: student.grade_level,
          section: student.section || '',
        },
        activity: {
          id: activity.id,
          checkInTime: activity.start_time,
          timeLimit: timeLimit,
        },
      };
    } catch (error) {
      logger.error('Error during self-service check-in', { error, studentIdOrQrCode });
      return {
        success: false,
        message: 'An error occurred. Please contact the librarian.',
      };
    }
  }

  /**
   * Check out a student
   */
  async checkOut(studentIdOrQrCode: string): Promise<SelfServiceCheckInResponse> {
    try {
      // Find student
      const student = await prisma.students.findFirst({
        where: {
          student_id: studentIdOrQrCode,
        },
      });

      if (!student) {
        return {
          success: false,
          message: 'Student not found. Please contact the librarian.',
        };
      }

      // Find active activity
      const activity = await prisma.student_activities.findFirst({
        where: {
          student_id: student.id,
          end_time: null,
          status: 'ACTIVE',
        },
      });

      if (!activity) {
        return {
          success: false,
          message: 'You are not currently checked in.',
        };
      }

      // Calculate duration
      const endTime = new Date();
      const duration = Math.floor((endTime.getTime() - activity.start_time.getTime()) / 60000);

      // Update activity with check-out time
      await prisma.student_activities.update({
        where: { id: activity.id },
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          end_time: end_time,
          duration_minutes: duration,
          status: 'COMPLETED',
        },
      });

      logger.info('Student checked out via self-service', {
        student_id: student.student_id,
        student_name: `${student.first_name} ${student.last_name}`,
        activityId: activity.id,
        duration,
      });

      return {
        success: true,
        message: `Goodbye, ${student.first_name} ${student.last_name}! Thank you for visiting.`,
        student: {
          id: student.id,
          student_id: student.student_id,
          name: `${student.first_name} ${student.last_name}`,
          grade_level: student.grade_level,
          section: student.section || '',
        },
      };
    } catch (error) {
      logger.error('Error during self-service check-out', { error, studentIdOrQrCode });
      return {
        success: false,
        message: 'An error occurred. Please contact the librarian.',
      };
    }
  }

  /**
   * Get time limit based on grade level
   */
  private getTimeLimitForGrade(grade_level: string): number {
    // Parse grade level
    const grade = gradeLevel.toLowerCase();

    if (grade.includes('kinder') || grade.includes('k') || grade.includes('pre')) {
      return parseInt(process.env.PRIMARY_TIME_LIMIT || '30');
    }

    if (grade.includes('1') || grade.includes('2') || grade.includes('3') ||
        grade.includes('4') || grade.includes('5') || grade.includes('6')) {
      return parseInt(process.env.GRADE_SCHOOL_TIME_LIMIT || '60');
    }

    if (grade.includes('7') || grade.includes('8') || grade.includes('9') || grade.includes('10')) {
      return parseInt(process.env.JUNIOR_HIGH_TIME_LIMIT || '90');
    }

    if (grade.includes('11') || grade.includes('12')) {
      return parseInt(process.env.SENIOR_HIGH_TIME_LIMIT || '120');
    }

    // Default
    return 60;
  }

  /**
   * Get self-service statistics
   */
  async getStatistics(startDate?: Date, endDate?: Date) {
    try {
      const where: any = {};

      if (startDate || endDate) {
        where.start_time = {};
        if (startDate) where.start_time.gte = startDate;
        if (endDate) where.start_time.lte = endDate;
      }

      const [totalCheckIns, averageTimeSpent, uniqueStudents] = await Promise.all([
        prisma.student_activities.count({ where }),
        prisma.student_activities.aggregate({
          where: {
            ...where,
            end_time: { not: null },
          },
          _avg: {
            duration_minutes: true,
          },
        }),
        prisma.student_activities.findMany({
          where,
          distinct: ['student_id'],
          select: { student_id: true },
        }),
      ]);

      return {
        success: true,
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          totalCheckIns,
          averageTimeSpent: Math.round(averageTimeSpent._avg.duration_minutes || 0),
          uniqueStudents: uniqueStudents.length,
        },
      };
    } catch (error) {
      logger.error('Error getting self-service statistics', { error });
      throw new Error('Failed to get statistics');
    }
  }
}

export const selfServiceService = new SelfServiceService();