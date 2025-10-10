import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';
import { GradeCategory, ActivityType, ActivityStatus } from '@prisma/client';

// Get default time limit based on grade category
export function getDefaultTimeLimit(gradeCategory: GradeCategory): number {
  const timeLimits = {
    PRIMARY: parseInt(process.env.PRIMARY_TIME_LIMIT || '30'),
    GRADE_SCHOOL: parseInt(process.env.GRADE_SCHOOL_TIME_LIMIT || '60'),
    JUNIOR_HIGH: parseInt(process.env.JUNIOR_HIGH_TIME_LIMIT || '90'),
    SENIOR_HIGH: parseInt(process.env.SENIOR_HIGH_TIME_LIMIT || '120'),
  };

  return timeLimits[gradeCategory] || 60;
}

// Get student by barcode
export async function getStudentByBarcode(barcode: string) {
  try {
    const student = await prisma.student.findUnique({
      where: { studentId: barcode },
      include: {
        activities: {
          where: { status: ActivityStatus.ACTIVE },
          orderBy: { startTime: 'desc' },
          take: 1,
        },
      },
    });

    if (!student) {
      return null;
    }

    // Get default time limit based on grade category
    const defaultTimeLimit = getDefaultTimeLimit(student.gradeCategory);

    return {
      ...student,
      defaultTimeLimit,
      hasActiveSession: student.activities.length > 0,
    };
  } catch (error) {
    logger.error('Error fetching student by barcode', {
      error: (error as Error).message,
      barcode,
    });
    throw error;
  }
}

// Get all students with optional filtering
export async function getStudents(
  options: {
    gradeCategory?: GradeCategory;
    isActive?: boolean;
    page?: number;
    limit?: number;
  } = {},
) {
  try {
    const { gradeCategory, isActive, page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (gradeCategory) {
      where.gradeCategory = gradeCategory;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastName: 'asc' },
      }),
      prisma.student.count({ where }),
    ]);

    return {
      students,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error('Error fetching students', {
      error: (error as Error).message,
      options,
    });
    throw error;
  }
}

// Create new student
export async function createStudent(data: {
  studentId: string;
  firstName: string;
  lastName: string;
  gradeLevel: string;
  gradeCategory: GradeCategory;
  section?: string;
}) {
  try {
    const student = await prisma.student.create({
      data,
    });

    logger.info('Student created successfully', {
      studentId: student.studentId,
    });
    return student;
  } catch (error) {
    logger.error('Error creating student', {
      error: (error as Error).message,
      data,
    });
    throw error;
  }
}

// Update student
export async function updateStudent(
  studentId: string,
  data: {
    firstName?: string;
    lastName?: string;
    gradeLevel?: string;
    gradeCategory?: GradeCategory;
    section?: string;
    isActive?: boolean;
  },
) {
  try {
    const student = await prisma.student.update({
      where: { studentId },
      data,
    });

    logger.info('Student updated successfully', { studentId });
    return student;
  } catch (error) {
    logger.error('Error updating student', {
      error: (error as Error).message,
      studentId,
      data,
    });
    throw error;
  }
}

// Delete student
export async function deleteStudent(studentId: string) {
  try {
    await prisma.student.delete({
      where: { studentId },
    });

    logger.info('Student deleted successfully', { studentId });
    return true;
  } catch (error) {
    logger.error('Error deleting student', {
      error: (error as Error).message,
      studentId,
    });
    throw error;
  }
}

// Get student activities
export async function getStudentActivities(
  options: {
    studentId?: string;
    startDate?: Date;
    endDate?: Date;
    activityType?: ActivityType;
    status?: ActivityStatus;
    page?: number;
    limit?: number;
  } = {},
) {
  try {
    const {
      studentId,
      startDate,
      endDate,
      activityType,
      status,
      page = 1,
      limit = 50,
    } = options;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (studentId) {
      where.studentId = studentId;
    }

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = startDate;
      if (endDate) where.startTime.lte = endDate;
    }

    if (activityType) {
      where.activityType = activityType;
    }

    if (status) {
      where.status = status;
    }

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startTime: 'desc' },
        include: {
          student: {
            select: {
              studentId: true,
              firstName: true,
              lastName: true,
              gradeLevel: true,
              gradeCategory: true,
            },
          },
          equipment: {
            select: {
              equipmentId: true,
              name: true,
              type: true,
            },
          },
        },
      }),
      prisma.activity.count({ where }),
    ]);

    return {
      activities,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error('Error fetching student activities', {
      error: (error as Error).message,
      options,
    });
    throw error;
  }
}

// Get active sessions
export async function getActiveSessions() {
  try {
    const activities = await prisma.activity.findMany({
      where: { status: ActivityStatus.ACTIVE },
      orderBy: { startTime: 'desc' },
      include: {
        student: {
          select: {
            studentId: true,
            firstName: true,
            lastName: true,
            gradeLevel: true,
            gradeCategory: true,
          },
        },
        equipment: {
          select: {
            equipmentId: true,
            name: true,
            type: true,
          },
        },
      },
    });

    return activities;
  } catch (error) {
    logger.error('Error fetching active sessions', {
      error: (error as Error).message,
    });
    throw error;
  }
}

// Create student activity
export async function createStudentActivity(data: {
  studentId: string;
  activityType: ActivityType;
  equipmentId?: string;
  timeLimitMinutes?: number;
  notes?: string;
}) {
  try {
    // Get student to determine grade category
    const student = await prisma.student.findUnique({
      where: { studentId: data.studentId },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    // Calculate default time limit if not provided
    const timeLimitMinutes =
      data.timeLimitMinutes || getDefaultTimeLimit(student.gradeCategory);

    // Calculate end time
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + timeLimitMinutes * 60000);

    const activity = await prisma.activity.create({
      data: {
        studentId: student.id,
        activityType: data.activityType,
        equipmentId: data.equipmentId || null,
        startTime,
        endTime,
        timeLimitMinutes,
        notes: data.notes || null,
        status: ActivityStatus.ACTIVE,
        processedBy: 'System',
      },
      include: {
        student: {
          select: {
            studentId: true,
            firstName: true,
            lastName: true,
            gradeLevel: true,
            gradeCategory: true,
          },
        },
        equipment: {
          select: {
            equipmentId: true,
            name: true,
            type: true,
          },
        },
      },
    });

    logger.info('Student activity created successfully', {
      activityId: activity.id,
      studentId: student.studentId,
      activityType: data.activityType,
    });

    return activity;
  } catch (error) {
    logger.error('Error creating student activity', {
      error: (error as Error).message,
      data,
    });
    throw error;
  }
}

// End student activity
export async function endStudentActivity(activityId: string) {
  try {
    const now = new Date();

    const activity = await prisma.activity.update({
      where: { id: activityId },
      data: {
        endTime: now,
        status: ActivityStatus.COMPLETED,
      },
      include: {
        student: {
          select: {
            studentId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Calculate duration
    if (activity.startTime) {
      const duration = Math.floor(
        (now.getTime() - activity.startTime.getTime()) / 60000,
      );
      await prisma.activity.update({
        where: { id: activityId },
        data: { durationMinutes: duration },
      });
    }

    logger.info('Student activity ended successfully', {
      activityId,
      studentId: activity.student.studentId,
    });

    return activity;
  } catch (error) {
    logger.error('Error ending student activity', {
      error: (error as Error).message,
      activityId,
    });
    throw error;
  }
}
