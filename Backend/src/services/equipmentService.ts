import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';
import {
  EquipmentStatus,
  ActivityType,
  EquipmentType,
  ActivityStatus,
  Prisma,
} from '@prisma/client';

export interface GetEquipmentOptions {
  type?: EquipmentType;
  status?: EquipmentStatus;
  page?: number;
  limit?: number;
  search?: string;
}

export interface GetEquipmentUsageHistoryOptions {
  equipmentId?: string;
  studentId?: string;
  activityType?: ActivityType;
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
        { equipmentId: { contains: search, mode: 'insensitive' } },
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
          where: { status: ActivityStatus.ACTIVE },
          orderBy: { startTime: 'desc' },
          take: 1,
          include: {
            student: {
              select: {
                studentId: true,
                firstName: true,
                lastName: true,
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
export async function getEquipmentByEquipmentId(equipmentId: string) {
  try {
    const equipment = await prisma.equipment.findUnique({
      where: { equipmentId },
      include: {
        activities: {
          where: { status: ActivityStatus.ACTIVE },
          orderBy: { startTime: 'desc' },
          take: 1,
          include: {
            student: {
              select: {
                studentId: true,
                firstName: true,
                lastName: true,
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
      equipmentId,
    });
    throw error;
  }
}

// Create new equipment
export async function createEquipment(data: {
  equipmentId: string;
  name: string;
  type: EquipmentType;
  location: string;
  maxTimeMinutes: number;
  requiresSupervision?: boolean;
  description?: string;
}) {
  try {
    const existing = await prisma.equipment.findUnique({
      where: { equipmentId: data.equipmentId },
    });

    if (existing) {
      logger.warn('Attempted to create duplicate equipment', {
        equipmentId: data.equipmentId,
      });
      throw new Error('Equipment ID already exists');
    }

    const equipment = await prisma.equipment.create({
      data: {
        equipmentId: data.equipmentId,
        name: data.name,
        type: data.type,
        location: data.location,
        maxTimeMinutes: data.maxTimeMinutes,
        requiresSupervision: data.requiresSupervision || false,
        description: data.description || null,
        status: EquipmentStatus.AVAILABLE,
      },
    });

    logger.info('Equipment created successfully', {
      equipmentId: equipment.equipmentId,
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
    equipmentId?: string;
    name?: string;
    type?: EquipmentType;
    location?: string;
    maxTimeMinutes?: number;
    requiresSupervision?: boolean;
    description?: string;
    status?: EquipmentStatus;
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

    logger.info('Equipment updated successfully', { equipmentId: id });
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

    logger.info('Equipment deleted successfully', { equipmentId: id });
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
  equipmentId: string;
  studentId: string;
  activityType: ActivityType;
  timeLimitMinutes?: number;
  notes?: string;
}) {
  try {
    // Check if equipment is available
    const equipment = await prisma.equipment.findUnique({
      where: { id: data.equipmentId },
    });

    if (!equipment) {
      throw new Error('Equipment not found');
    }

    if (equipment.status !== EquipmentStatus.AVAILABLE) {
      throw new Error('Equipment is not available for use');
    }

    const student = await prisma.student.findUnique({
      where: { id: data.studentId },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    // Calculate end time
    const startTime = new Date();
    const endTime = new Date(
      startTime.getTime() +
        (data.timeLimitMinutes || equipment.maxTimeMinutes) * 60000,
    );

    // Create activity record
    const activity = await prisma.activity.create({
      data: {
        studentId: data.studentId,
        studentName: `${student.firstName} ${student.lastName}`.trim(),
        studentGradeLevel: student.gradeLevel,
        studentGradeCategory: student.gradeCategory,
        activityType: data.activityType,
        equipmentId: data.equipmentId,
        startTime,
        endTime,
        timeLimitMinutes: data.timeLimitMinutes || equipment.maxTimeMinutes,
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

    // Update equipment status
    await prisma.equipment.update({
      where: { id: data.equipmentId },
      data: {
        status: EquipmentStatus.IN_USE,
      },
    });

    logger.info('Equipment used successfully', {
      activityId: activity.id,
      equipmentId: data.equipmentId,
      studentId: data.studentId,
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
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        equipment: true,
      },
    });

    if (!activity) {
      throw new Error('Activity not found');
    }

    if (!activity.equipmentId) {
      throw new Error('Activity is not associated with equipment');
    }

    const now = new Date();

    // Update activity record
    const updatedActivity = await prisma.activity.update({
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
        equipment: {
          select: {
            equipmentId: true,
            name: true,
            type: true,
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

    // Update equipment status
    await prisma.equipment.update({
      where: { id: activity.equipmentId },
      data: {
        status: EquipmentStatus.AVAILABLE,
      },
    });

    logger.info('Equipment released successfully', {
      activityId,
      equipmentId: activity.equipmentId,
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
      equipmentId,
      studentId,
      activityType,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.ActivityWhereInput = {
      equipmentId: { not: null },
    };

    if (equipmentId) {
      where.equipmentId = equipmentId;
    }

    if (studentId) {
      where.studentId = studentId;
    }

    if (activityType) {
      where.activityType = activityType;
    }

    if (startDate || endDate) {
      const startTimeFilter: Prisma.DateTimeFilter = {};
      if (startDate) {
        startTimeFilter.gte = startDate;
      }
      if (endDate) {
        startTimeFilter.lte = endDate;
      }
      where.startTime = startTimeFilter;
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
              location: true,
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
          status: EquipmentStatus.AVAILABLE,
        },
      }),
      prisma.equipment.count({
        where: {
          status: EquipmentStatus.IN_USE,
        },
      }),
      prisma.equipment.count({
        where: {
          status: EquipmentStatus.MAINTENANCE,
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
