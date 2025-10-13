import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';
import {
  equipment_status,
  student_activities_activity_type,
  equipment_type,
  student_activities_status,
  Prisma,
} from '@prisma/client';

export interface GetEquipmentOptions {
  type?: equipment_type;
  status?: equipment_status;
  page?: number;
  limit?: number;
  search?: string;
}

export interface GetEquipmentUsageHistoryOptions {
  equipment_id?: string;
  student_id?: string;
  activityType?: student_activities_activity_type;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

// Get all equipment with optional filtering
export async function getEquipment(options: GetEquipmentOptions = {}) {
  try {
    const { type, status, page = 1, limit = 50, search } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.EquipmentWhereInput = {};

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { equipment_id: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ] as unknown as Prisma.EquipmentWhereInput['OR'];
    }

    const [equipment, total] = await Promise.all([
      prisma.equipment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.equipment.count({ where }),
    ]);

    return {
      equipment,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error('Error fetching equipment', {
      error: (error as Error).message,
      options,
    });
    throw error;
  }
}

// Get equipment by ID
export async function getEquipmentById(id: string) {
  try {
    const equipment = await prisma.equipment.findUnique({
      where: { id },
      include: {
        activities: {
          where: { status: student_activities_status.ACTIVE },
          orderBy: { start_time: 'desc' },
          take: 1,
          include: {
            student: {
              select: {
                student_id: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
    });

    return equipment;
  } catch (error) {
    logger.error('Error fetching equipment by ID', {
      error: (error as Error).message,
      id,
    });
    throw error;
  }
}

// Get equipment by equipment ID
export async function getEquipmentByEquipmentId(equipment_id: string) {
  try {
    const equipment = await prisma.equipment.findUnique({
      where: { equipment_id },
      include: {
        activities: {
          where: { status: student_activities_status.ACTIVE },
          orderBy: { start_time: 'desc' },
          take: 1,
          include: {
            student: {
              select: {
                student_id: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
    });

    return equipment;
  } catch (error) {
    logger.error('Error fetching equipment by equipment ID', {
      error: (error as Error).message,
      equipment_id,
    });
    throw error;
  }
}

// Create new equipment
export async function createEquipment(data: { 
  equipment_id: string;
  name: string;
  type: equipment_type;
  location: string;
  max_time_minutes: number;
  requiresSupervision?: boolean;
  description?: string;
}) {
  try {
    const existing = await prisma.equipment.findUnique({
      where: { equipment_id: data.equipment_id },
    });

    if (existing) {
      logger.warn('Attempted to create duplicate equipment', {
        equipment_id: data.equipment_id,
      });
      throw new Error('Equipment ID already exists');
    }

    const equipment = await prisma.equipment.create({
      data: { 
        equipment_id: data.equipment_id,
        name: data.name,
        type: data.type,
        location: data.location,
        max_time_minutes: data.max_time_minutes,
        requires_supervision: data.requires_supervision || false,
        description: data.description || null,
        status: equipment_status.AVAILABLE,
      },
    });

    logger.info('Equipment created successfully', {
      equipment_id: equipment.equipment_id,
    });
    return equipment;
  } catch (error) {
    if ((error as Error).message === 'Equipment ID already exists') {
      throw error;
    }
    logger.error('Error creating equipment', {
      error: (error as Error).message,
      data,
    });
    throw error;
  }
}

// Update equipment
export async function updateEquipment(
  id: string,
  data: { 
    equipment_id?: string;
    name?: string;
    type?: equipment_type;
    location?: string;
    maxTimeMinutes?: number;
    requiresSupervision?: boolean;
    description?: string;
    status?: equipment_status;
  },
) {
  try {
    const existing = await prisma.equipment.findUnique({ where: { id } });

    if (!existing) {
      logger.warn('Attempted to update non-existent equipment', { id });
      throw new Error('Equipment not found');
    }

    const equipment = await prisma.equipment.update({
      where: { id },
      data,
    });

    logger.info('Equipment updated successfully', { equipment_id: id });
    return equipment;
  } catch (error) {
    if ((error as Error).message === 'Equipment not found') {
      throw error;
    }
    logger.error('Error updating equipment', {
      error: (error as Error).message,
      id,
      data,
    });
    throw error;
  }
}

// Delete equipment
export async function deleteEquipment(id: string) {
  try {
    const existing = await prisma.equipment.findUnique({ where: { id } });

    if (!existing) {
      logger.warn('Attempted to delete non-existent equipment', { id });
      throw new Error('Equipment not found');
    }

    await prisma.equipment.delete({
      where: { id },
    });

    logger.info('Equipment deleted successfully', { equipment_id: id });
    return true;
  } catch (error) {
    if ((error as Error).message === 'Equipment not found') {
      throw error;
    }
    logger.error('Error deleting equipment', {
      error: (error as Error).message,
      id,
    });
    throw error;
  }
}

// Use equipment
export async function useEquipment(data: { 
  equipment_id: string;
  student_id: string;
  activity_type: student_activities_activity_type;
  timeLimitMinutes?: number;
  notes?: string;
}) {
  try {
    // Check if equipment is available
    const equipment = await prisma.equipment.findUnique({
      where: { id: data.equipment_id },
    });

    if (!equipment) {
      throw new Error('Equipment not found');
    }

    if (equipment.status !== equipment_status.AVAILABLE) {
      throw new Error('Equipment is not available for use');
    }

    const student = await prisma.students.findUnique({
      where: { id: data.student_id },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    // Calculate end time
    const startTime = new Date();
    const endTime = new Date(
      startTime.getTime() +
        (data.time_limit_minutes || equipment.max_time_minutes) * 60000,
    );

    // Create activity record
    const activity = await prisma.student_activities.create({
      data: { 
        student_id: data.student_id,
        student_name: `${student.first_name} ${student.last_name}`.trim(),
        studentGradeLevel: student.grade_level,
        studentGradeCategory: student.grade_category,
        activity_type: data.activity_type,
        equipment_id: data.equipment_id,
        start_time,
        end_time,
        time_limit_minutes: data.time_limit_minutes || equipment.max_time_minutes,
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

    // Update equipment status
    await prisma.equipment.update({
      where: { id: data.equipment_id },
      data: { 
        status: equipment_status.IN_USE,
      },
    });

    logger.info('Equipment used successfully', {
      activityId: activity.id,
      equipment_id: data.equipment_id,
      student_id: data.student_id,
    });

    return activity;
  } catch (error) {
    logger.error('Error using equipment', {
      error: (error as Error).message,
      data,
    });
    throw error;
  }
}

// Release equipment
export async function releaseEquipment(activityId: string) {
  try {
    const activity = await prisma.student_activities.findUnique({
      where: { id: activityId },
      include: {
        equipment: true,
      },
    });

    if (!activity) {
      throw new Error('Activity not found');
    }

    if (!activity.equipment_id) {
      throw new Error('Activity is not associated with equipment');
    }

    const now = new Date();

    // Update activity record
    const updatedActivity = await prisma.student_activities.update({
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
        equipment: {
          select: {
            equipment_id: true,
            name: true,
            type: true,
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

    // Update equipment status
    await prisma.equipment.update({
      where: { id: activity.equipment_id },
      data: { 
        status: equipment_status.AVAILABLE,
      },
    });

    logger.info('Equipment released successfully', {
      activityId,
      equipment_id: activity.equipment_id,
    });

    return updatedActivity;
  } catch (error) {
    logger.error('Error releasing equipment', {
      error: (error as Error).message,
      activityId,
    });
    throw error;
  }
}

// Get equipment usage history
export async function getEquipmentUsageHistory(
  options: GetEquipmentUsageHistoryOptions = {},
) {
  try {
    const {
      equipment_id,
      student_id,
      activity_type,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.student_activitiesWhereInput = {
      equipment_id: { not: null },
    };

    if (equipment_id) {
      where.equipment_id = equipment_id;
    }

    if (student_id) {
      where.student_id = student_id;
    }

    if (activityType) {
      where.activity_type = activityType;
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
              location: true,
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
    logger.error('Error fetching equipment usage history', {
      error: (error as Error).message,
      options,
    });
    throw error;
  }
}

// Get equipment statistics
export async function getEquipmentStatistics() {
  try {
    const [
      totalEquipment,
      availableEquipment,
      inUseEquipment,
      maintenanceEquipment,
      equipmentByType,
    ] = await Promise.all([
      prisma.equipment.count(),
      prisma.equipment.count({
        where: {
          status: equipment_status.AVAILABLE,
        },
      }),
      prisma.equipment.count({
        where: {
          status: equipment_status.IN_USE,
        },
      }),
      prisma.equipment.count({
        where: {
          status: equipment_status.MAINTENANCE,
        },
      }),
      prisma.equipment.groupBy({
        by: ['type'],
        _count: {
          id: true,
        },
      }),
    ]);

    return {
      total: totalEquipment,
      available: availableEquipment,
      inUse: inUseEquipment,
      maintenance: maintenanceEquipment,
      byType: equipmentByType.map(item => ({
        type: item.type,
        count: item._count.id || 0,
      })),
    };
  } catch (error) {
    logger.error('Error fetching equipment statistics', {
      error: (error as Error).message,
    });
    throw error;
  }
}
