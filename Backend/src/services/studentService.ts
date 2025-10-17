import { logger } from '@/utils/logger';
import {
  students_grade_category,
  student_activities_activity_type,
  student_activities_status,
  Prisma,
} from '@prisma/client';
import { performanceOptimizationService } from './performanceOptimizationService';
import { StudentsRepository } from '@/repositories';
import { prisma } from '@/utils/prisma';

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

// Create repository instance
const studentsRepository = new StudentsRepository();

// Get default time limit based on grade category
export function getDefaultTimeLimit(
  grade_category: students_grade_category,
): number {
  const timeLimits = {
    PRIMARY: parseInt(process.env.PRIMARY_TIME_LIMIT || '30'),
    GRADE_SCHOOL: parseInt(process.env.GRADE_SCHOOL_TIME_LIMIT || '60'),
    JUNIOR_HIGH: parseInt(process.env.JUNIOR_HIGH_TIME_LIMIT || '90'),
    SENIOR_HIGH: parseInt(process.env.SENIOR_HIGH_TIME_LIMIT || '120'),
  };

  return timeLimits[grade_category] || 60;
}

// Get student by barcode (optimized with caching)
export async function getStudentByBarcode(barcode: string) {
  return performanceOptimizationService.executeQuery(
    'student_by_barcode',
    async () => {
      const student = await studentsRepository.findByStudentId(barcode);

      if (!student) {
        return null;
      }

      // Get default time limit based on grade category
      const defaultTimeLimit = getDefaultTimeLimit(student.grade_category);

      return {
        ...student,
        defaultTimeLimit,
        hasActiveSession: false, // Would need to query student_activities separately
      };
    },
    {
      key: `student:barcode:${barcode}`,
      ttl: 300, // 5 minutes
      tags: ['student', 'barcode'],
    },
  );
}

// Get student by ID (optimized with caching)
export async function getStudentById(id: string) {
  return performanceOptimizationService.executeQuery(
    'student_by_id',
    async () => {
      const student = await studentsRepository.findById(id);

      if (!student) {
        return null;
      }

      // Get default time limit based on grade category
      const defaultTimeLimit = getDefaultTimeLimit(student.grade_category);

      return {
        ...student,
        defaultTimeLimit,
        hasActiveSession: false, // Will be populated by separate query if needed
      };
    },
    {
      key: `student:id:${id}`,
      ttl: 300, // 5 minutes
      tags: ['student'],
    },
  );
}

// Get all students with optional filtering (optimized with caching)
export async function getStudents(options: GetStudentsOptions = {}) {
  const { gradeCategory, isActive, page = 1, limit = 50 } = options;
  const cacheKey = `students:list:${JSON.stringify({ gradeCategory, isActive, page, limit })}`;

  return performanceOptimizationService.executeQuery(
    'students_list',
    async () => {
      const queryOptions: any = {
        page,
        limit,
        sortBy: 'last_name',
        sortOrder: 'asc',
      };

      if (gradeCategory !== undefined) {
        queryOptions.grade_category = gradeCategory;
      }
      if (isActive !== undefined) {
        queryOptions.isActive = isActive;
      }

      const result = await studentsRepository.getStudents(queryOptions);

      return {
        students: result.students,
        total: result.pagination.total, // Add total directly for backward compatibility with tests
        pagination: result.pagination,
      };
    },
    {
      key: cacheKey,
      ttl: 180, // 3 minutes for lists
      tags: ['students', 'list'],
    },
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
    const student = await studentsRepository.createStudent({
      student_id: data.student_id,
      first_name: data.first_name,
      last_name: data.last_name,
      grade_level: data.grade_level,
      grade_category: data.grade_category,
      section: data.section || '',
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

    // Convert service interface to repository interface
    const updateData: Prisma.studentsUpdateInput = {};
    if (data.firstName !== undefined) updateData.first_name = data.firstName;
    if (data.lastName !== undefined) updateData.last_name = data.lastName;
    if (data.gradeLevel !== undefined) updateData.grade_level = data.gradeLevel;
    if (data.gradeCategory !== undefined)
      updateData.grade_category = data.gradeCategory;
    if (data.section !== undefined) updateData.section = data.section;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    let student;
    if (isDatabaseId) {
      student = await studentsRepository.updateById(identifier, updateData);
    } else {
      student = await studentsRepository.updateByExternalId(
        identifier,
        updateData,
      );
    }

    if (!student) {
      logger.warn('Attempted to update non-existent student', { identifier });
      return null;
    }

    logger.info('Student updated successfully', { identifier });
    return student;
  } catch (error) {
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

    let success;
    if (isDatabaseId) {
      success = await studentsRepository.deleteById(identifier);
    } else {
      success = await studentsRepository.deleteByExternalId(identifier);
    }

    if (!success) {
      logger.warn('Attempted to delete non-existent student', { identifier });
      return null;
    }

    logger.info('Student deleted successfully', { identifier });
    return { success: true };
  } catch (error) {
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
      activityType,
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
      where.activity_type = activityType as any;
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
    const student = await studentsRepository.findByStudentId(data.student_id);

    if (!student) {
      throw new Error('Student not found');
    }

    // Calculate default time limit if not provided
    const timeLimitMinutes =
      data.timeLimitMinutes || getDefaultTimeLimit(student.grade_category);

    // Calculate end time based on time limit
    const startTime = new Date();

    const activity = await prisma.student_activities.create({
      data: {
        id: `activity-${Date.now()}-${student.id}`,
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`.trim(),
        grade_level: student.grade_level,
        grade_category: student.grade_category,
        activity_type: data.activity_type,
        equipment_id: data.equipment_id || null,
        start_time: startTime,
        time_limit_minutes: timeLimitMinutes,
        notes: data.notes || null,
        status: student_activities_status.ACTIVE,
        processed_by: 'System',
        updated_at: new Date(),
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
        updated_at: now,
      },
    });

    // Calculate duration
    if (activity.start_time) {
      if (activity.end_time && activity.start_time) {
        const duration = Math.round(
          (activity.end_time.getTime() - activity.start_time.getTime()) / 60000,
        );
        await prisma.student_activities.update({
          where: { id: activityId },
          data: { duration_minutes: duration },
        });
      }
    }

    logger.info('Student activity ended successfully', {
      activityId,
      student_id: activity.student_id,
      duration: activity.duration_minutes,
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
