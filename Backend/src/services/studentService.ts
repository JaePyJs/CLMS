import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';
import {
  students_grade_category,
  student_activities_activity_type,
  student_activities_status,
  Prisma,
} from '@prisma/client';
import { performanceOptimizationService } from './performanceOptimizationService';

export interface GetStudentsOptions {
  gradeCategory?: students_grade_category;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface GetStudentActivitiesOptions {
  student_id?: string;
  startDate?: Date;
  endDate?: Date;
  activityType?: student_activities_activity_type;
  status?: student_activities_status;
  page?: number;
  limit?: number;
}

// Get default time limit based on grade category
export function getDefaultTimeLimit(grade_category: students_grade_category): number {
  const timeLimits = {
    PRIMARY: parseInt(process.env.PRIMARY_TIME_LIMIT || '30'),
    GRADE_SCHOOL: parseInt(process.env.GRADE_SCHOOL_TIME_LIMIT || '60'),
    JUNIOR_HIGH: parseInt(process.env.JUNIOR_HIGH_TIME_LIMIT || '90'),
    SENIOR_HIGH: parseInt(process.env.SENIOR_HIGH_TIME_LIMIT || '120'),
  };

  return timeLimits[gradeCategory] || 60;
}

// Get student by barcode (optimized with caching)
export async function getStudentByBarcode(barcode: string) {
  return performanceOptimizationService.executeQuery(
    'student_by_barcode',
    async () => {
      const student = await prisma.students.findUnique({
        where: { student_id: barcode },
        include: {
          activities: {
            where: { status: student_activities_status.ACTIVE },
            orderBy: { start_time: 'desc' },
            take: 1,
          },
        },
      });

      if (!student) {
        return null;
      }

      // Get default time limit based on grade category
      const defaultTimeLimit = getDefaultTimeLimit(student.grade_category);

      return {
        ...student,
        defaultTimeLimit,
        hasActiveSession: student.activities.length > 0,
      };
    },
    {
      key: `student:barcode:${barcode}`,
      ttl: 300, // 5 minutes
      tags: ['student', 'barcode'],
    }
  );
}

// Get student by ID (optimized with caching)
export async function getStudentById(id: string) {
  return performanceOptimizationService.executeQuery(
    'student_by_id',
    async () => {
      const student = await prisma.students.findUnique({
        where: { id },
        include: {
          activities: {
            where: { status: student_activities_status.ACTIVE },
            orderBy: { start_time: 'desc' },
            take: 1,
          },
        },
      });

      if (!student) {
        return null;
      }

      // Get default time limit based on grade category
      const defaultTimeLimit = getDefaultTimeLimit(student.grade_category);

      return {
        ...student,
        defaultTimeLimit,
        hasActiveSession: student.activities.length > 0,
      };
    },
    {
      key: `student:id:${id}`,
      ttl: 300, // 5 minutes
      tags: ['student'],
    }
  );
}

// Get all students with optional filtering (optimized with caching)
export async function getStudents(options: GetStudentsOptions = {}) {
  const { grade_category, is_active, page = 1, limit = 50 } = options;
  const cacheKey = `students:list:${JSON.stringify({ grade_category, is_active, page, limit })}`;

  return performanceOptimizationService.executeQuery(
    'students_list',
    async () => {
      const skip = (page - 1) * limit;
      const where: Prisma.studentsWhereInput = {};

      if (grade_category) {
        where.grade_category = grade_category;
      }

      if (isActive !== undefined) {
        where.is_active = isActive;
      }

      const [students, total] = await Promise.all([
        prisma.students.findMany({
          where,
          skip,
          take: limit,
          orderBy: { last_name: 'asc' },
        }),
        prisma.students.count({ where }),
      ]);

      return {
        students,
        total, // Add total directly for backward compatibility with tests
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    },
    {
      key: cacheKey,
      ttl: 180, // 3 minutes for lists
      tags: ['students', 'list'],
    }
  );
}

// Create new student
export async function createStudent(data: { 
  student_id: string;
  first_name: string;
  last_name: string;
  grade_level: string;
  grade_category: students_grade_category;
  section?: string;
}) {
  try {
    const existing = await prisma.students.findUnique({
      where: { student_id: data.student_id },
    });

    if (existing) {
      logger.warn('Attempted to create duplicate student', {
        student_id: data.student_id,
      });
      throw new Error('Student ID already exists');
    }

    const student = await prisma.students.create({
      data,
    });

    logger.info('Student created successfully', {
      student_id: student.student_id,
    });
    return student;
  } catch (error) {
    if ((error as Error).message === 'Student ID already exists') {
      throw error;
    }
    logger.error('Error creating student', {
      error: (error as Error).message,
      data,
    });
    throw error;
  }
}

// Update student
export async function updateStudent(
  identifier: string,
  data: { 
    firstName?: string;
    lastName?: string;
    gradeLevel?: string;
    gradeCategory?: students_grade_category;
    section?: string;
    isActive?: boolean;
  },
) {
  try {
    // Check if identifier looks like a database ID (cuid) or student_id
    // Prisma cuIDs are typically 25 characters long and start with 'c'
    const isDatabaseId =
      identifier.length >= 25 && /^[a-z0-9]{25}$/.test(identifier);

    const whereClause = isDatabaseId
      ? { id: identifier }
      : { student_id: identifier };

    const existing = await prisma.students.findUnique({
      where: whereClause,
    });

    if (!existing) {
      logger.warn('Attempted to update non-existent student', { identifier });
      return null;
    }

    const student = await prisma.students.update({
      where: whereClause,
      data,
    });

    logger.info('Student updated successfully', { identifier });
    return student;
  } catch (error) {
    // If record not found, return null instead of throwing
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return null;
    }
    logger.error('Error updating student', {
      error: (error as Error).message,
      identifier,
      data,
    });
    throw error;
  }
}

// Delete student
export async function deleteStudent(identifier: string) {
  try {
    // Check if identifier looks like a database ID (cuid) or student_id
    // Prisma cuIDs are typically 25 characters long and start with 'c'
    const isDatabaseId =
      identifier.length >= 25 && /^[a-z0-9]{25}$/.test(identifier);

    const whereClause = isDatabaseId
      ? { id: identifier }
      : { student_id: identifier };

    const existing = await prisma.students.findUnique({
      where: whereClause,
    });

    if (!existing) {
      logger.warn('Attempted to delete non-existent student', { identifier });
      return null;
    }

    const student = await prisma.students.delete({
      where: whereClause,
    });

    logger.info('Student deleted successfully', { identifier });
    return student;
  } catch (error) {
    // If record not found, return null instead of throwing
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return null;
    }
    logger.error('Error deleting student', {
      error: (error as Error).message,
      identifier,
    });
    throw error;
  }
}

// Get student activities
export async function getStudentActivities(
  options: GetStudentActivitiesOptions = {},
) {
  try {
    const {
      student_id,
      startDate,
      endDate,
      activity_type,
      status,
      page = 1,
      limit = 50,
    } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.student_activitiesWhereInput = {};

    if (student_id) {
      where.student_id = student_id;
    }

    if (startDate || endDate) {
      const startTimeFilter: Prisma.DateTimeFilter = {};
      if (startDate) {
        startTimeFilter.gte = startDate;
      }
      if (endDate) {
        startTimeFilter.lte = endDate;
      }
      where.start_time = startTimeFilter;
    }

    if (activityType) {
      where.activity_type = activityType;
    }

    if (status) {
      where.status = status;
    }

    const [activities, total] = await Promise.all([
      prisma.student_activities.findMany({
        where,
        skip,
        take: limit,
        orderBy: { start_time: 'desc' },
        include: {
          student: {
            select: {
              student_id: true,
              first_name: true,
              last_name: true,
              grade_level: true,
              grade_category: true,
            },
          },
          equipment: {
            select: {
              equipment_id: true,
              name: true,
              type: true,
            },
          },
        },
      }),
      prisma.student_activities.count({ where }),
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
    const activities = await prisma.student_activities.findMany({
      where: { status: student_activities_status.ACTIVE },
      orderBy: { start_time: 'desc' },
      include: {
        student: {
          select: {
            student_id: true,
            first_name: true,
            last_name: true,
            grade_level: true,
            grade_category: true,
          },
        },
        equipment: {
          select: {
            equipment_id: true,
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
  student_id: string;
  activity_type: student_activities_activity_type;
  equipment_id?: string;
  timeLimitMinutes?: number;
  notes?: string;
}) {
  try {
    // Get student to determine grade category
    const student = await prisma.students.findUnique({
      where: { student_id: data.student_id },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    // Calculate default time limit if not provided
    const timeLimitMinutes =
      data.time_limit_minutes || getDefaultTimeLimit(student.grade_category);

    // Calculate end time
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + timeLimitMinutes * 60000);

    const activity = await prisma.student_activities.create({
      data: { 
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`.trim(),
        studentGradeLevel: student.grade_level,
        studentGradeCategory: student.grade_category,
        activity_type: data.activity_type,
        equipment_id: data.equipment_id || null,
        start_time,
        end_time,
        time_limit_minutes,
        notes: data.notes || null,
        status: student_activities_status.ACTIVE,
        processed_by: 'System',
      },
      include: {
        student: {
          select: {
            student_id: true,
            first_name: true,
            last_name: true,
            grade_level: true,
            grade_category: true,
          },
        },
        equipment: {
          select: {
            equipment_id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    logger.info('Student activity created successfully', {
      activityId: activity.id,
      student_id: student.student_id,
      activity_type: data.activity_type,
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

    const activity = await prisma.student_activities.update({
      where: { id: activityId },
      data: { 
        end_time: now,
        status: student_activities_status.COMPLETED,
      },
      include: {
        student: {
          select: {
            student_id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    // Calculate duration
    if (activity.start_time) {
      const duration = Math.floor(
        (now.getTime() - activity.start_time.getTime()) / 60000,
      );
      await prisma.student_activities.update({
        where: { id: activityId },
        data: {  duration_minutes: duration },
      });
    }

    logger.info('Student activity ended successfully', {
      activityId,
      student_id: activity.student.student_id,
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
