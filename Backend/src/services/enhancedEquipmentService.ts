import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';
import {
  EquipmentStatus,
  EquipmentType,
  EquipmentConditionRating,
  EquipmentReservationStatus,
  EquipmentMaintenanceType,
  EquipmentMaintenanceStatus,
  EquipmentMaintenancePriority,
  EquipmentAssessmentType,
  EquipmentDamageSeverity,
  EquipmentReportType,
  ActivityType,
  StudentActivitiesStatus,
  Prisma,
} from '@prisma/client';
import { WebSocketServer } from 'ws';
import { getWebSocketServer } from '@/websocket/websocketServer';

// Enhanced equipment interfaces
export interface GetEquipmentOptions {
  type?: EquipmentType;
  status?: EquipmentStatus;
  category?: string;
  location?: string;
  page?: number;
  limit?: number;
  search?: string;
  includeReservations?: boolean;
  includeMaintenance?: boolean;
  includeStats?: boolean;
  conditionRating?: EquipmentConditionRating;
  tags?: string[];
}

export interface CreateEquipmentData {
  equipmentId: string;
  name: string;
  type: EquipmentType;
  location: string;
  maxTimeMinutes: number;
  requiresSupervision?: boolean;
  description?: string;
  category?: string;
  specifications?: Record<string, any>;
  purchaseDate?: Date;
  purchaseCost?: number;
  serialNumber?: string;
  assetTag?: string;
  warrantyExpiry?: Date;
  maintenanceInterval?: number;
  tags?: string[];
}

export interface UpdateEquipmentData extends Partial<CreateEquipmentData> {
  status?: EquipmentStatus;
  conditionRating?: EquipmentConditionRating;
  lastMaintenance?: Date;
  nextMaintenance?: Date;
  totalUsageHours?: number;
  notes?: string;
  isActive?: boolean;
}

export interface CreateReservationData {
  equipmentId: string;
  studentId: string;
  startTime: Date;
  endTime: Date;
  purpose?: string;
  notes?: string;
}

export interface CreateMaintenanceData {
  equipmentId: string;
  maintenanceType: EquipmentMaintenanceType;
  description?: string;
  cost?: number;
  vendor?: string;
  scheduledDate?: Date;
  priority?: EquipmentMaintenancePriority;
  estimatedDuration?: number;
  warrantyClaim?: boolean;
}

export interface CreateConditionReportData {
  equipmentId: string;
  conditionBefore: EquipmentConditionRating;
  conditionAfter: EquipmentConditionRating;
  assessmentType: EquipmentAssessmentType;
  damageType?: string;
  damageSeverity: EquipmentDamageSeverity;
  description?: string;
  costEstimate?: number;
  photos?: string[];
  witnessNames?: string[];
}

export interface EquipmentUsageMetrics {
  totalEquipment: number;
  available: number;
  inUse: number;
  maintenance: number;
  reserved: number;
  outOfOrder: number;
  utilizationRate: number;
  averageSessionLength: number;
  totalUsageHours: number;
  maintenancePending: number;
  upcomingMaintenance: number;
  equipmentByType: Array<{
    type: EquipmentType;
    count: number;
    utilization: number;
  }>;
  equipmentByCondition: Array<{
    condition: EquipmentConditionRating;
    count: number;
  }>;
  topUsedEquipment: Array<{
    equipmentId: string;
    name: string;
    usageHours: number;
    sessions: number;
  }>;
}

export interface ReservationConflict {
  reservationId: string;
  studentName: string;
  startTime: Date;
  endTime: Date;
  conflictType: 'OVERLAP' | 'SAME_TIME';
}

// Enhanced equipment service
export class EquipmentService {
  private wss: WebSocketServer;

  constructor() {
    this.wss = getWebSocketServer();
  }

  // Get equipment with enhanced filtering and relationships
  async getEquipment(options: GetEquipmentOptions = {}) {
    try {
      const {
        type,
        status,
        category,
        location,
        page = 1,
        limit = 50,
        search,
        includeReservations = false,
        includeMaintenance = false,
        includeStats = false,
        conditionRating,
        tags,
      } = options;

      const skip = (page - 1) * limit;

      const where: Prisma.EquipmentWhereInput = {};

      if (type) where.type = type;
      if (status) where.status = status;
      if (category) where.category = category;
      if (location) where.location = { contains: location, mode: 'insensitive' };
      if (conditionRating) where.condition_rating = conditionRating;
      if (tags && tags.length > 0) {
        where.tags = {
          path: [],
          string_contains: tags.join(',')
        };
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { equipment_id: { contains: search, mode: 'insensitive' } },
          { location: { contains: search, mode: 'insensitive' } },
          { asset_tag: { contains: search, mode: 'insensitive' } },
        ];
      }

      const include: Prisma.EquipmentInclude = {};

      if (includeReservations) {
        include.equipment_reservations = {
          where: {
            status: { in: ['PENDING', 'CONFIRMED'] },
            start_time: { gte: new Date() }
          },
          orderBy: { start_time: 'asc' },
          take: 5
        };
      }

      if (includeMaintenance) {
        include.equipment_maintenance = {
          where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] } },
          orderBy: { scheduled_date: 'asc' },
          take: 3
        };
      }

      if (includeStats) {
        include.equipment_usage_stats = {
          orderBy: { date: 'desc' },
          take: 30
        };
      }

      const [equipment, total] = await Promise.all([
        prisma.equipment.findMany({
          where,
          include,
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

  // Get equipment by ID with full details
  async getEquipmentById(id: string) {
    try {
      const equipment = await prisma.equipment.findUnique({
        where: { id },
        include: {
          equipment_reservations: {
            where: {
              start_time: { gte: new Date() }
            },
            orderBy: { start_time: 'asc' },
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
          equipment_maintenance: {
            orderBy: { scheduled_date: 'desc' },
            take: 10,
          },
          equipment_usage_stats: {
            orderBy: { date: 'desc' },
            take: 30,
          },
          equipment_condition_reports: {
            orderBy: { assessment_date: 'desc' },
            take: 10,
          },
          activities: {
            where: { status: StudentActivitiesStatus.ACTIVE },
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

  // Create new equipment
  async createEquipment(data: CreateEquipmentData) {
    try {
      const existing = await prisma.equipment.findUnique({
        where: { equipment_id: data.equipmentId },
      });

      if (existing) {
        logger.warn('Attempted to create duplicate equipment', {
          equipment_id: data.equipmentId,
        });
        throw new Error('Equipment ID already exists');
      }

      const equipment = await prisma.equipment.create({
        data: {
          equipment_id: data.equipmentId,
          name: data.name,
          type: data.type,
          location: data.location,
          max_time_minutes: data.maxTimeMinutes,
          requires_supervision: data.requiresSupervision || false,
          description: data.description || null,
          category: data.category || null,
          specifications: data.specifications || null,
          purchase_date: data.purchaseDate || null,
          purchase_cost: data.purchaseCost || null,
          serial_number: data.serialNumber || null,
          asset_tag: data.assetTag || null,
          warranty_expiry: data.warrantyExpiry || null,
          maintenance_interval: data.maintenanceInterval || null,
          next_maintenance: data.maintenanceInterval
            ? new Date(Date.now() + data.maintenanceInterval * 24 * 60 * 60 * 1000)
            : null,
          tags: data.tags ? { tags } : null,
          status: EquipmentStatus.AVAILABLE,
          condition_rating: EquipmentConditionRating.EXCELLENT,
        },
      });

      logger.info('Equipment created successfully', {
        equipment_id: equipment.equipment_id,
        name: equipment.name,
      });

      // Broadcast update to WebSocket clients
      this.broadcastEquipmentUpdate('CREATED', equipment);

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
  async updateEquipment(id: string, data: UpdateEquipmentData) {
    try {
      const existing = await prisma.equipment.findUnique({ where: { id } });

      if (!existing) {
        logger.warn('Attempted to update non-existent equipment', { id });
        throw new Error('Equipment not found');
      }

      const equipment = await prisma.equipment.update({
        where: { id },
        data: {
          ...(data.equipmentId && { equipment_id: data.equipmentId }),
          ...(data.name && { name: data.name }),
          ...(data.type && { type: data.type }),
          ...(data.location && { location: data.location }),
          ...(data.maxTimeMinutes && { max_time_minutes: data.maxTimeMinutes }),
          ...(data.requiresSupervision !== undefined && { requires_supervision: data.requiresSupervision }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.category && { category: data.category }),
          ...(data.specifications && { specifications: data.specifications }),
          ...(data.purchaseDate && { purchase_date: data.purchaseDate }),
          ...(data.purchaseCost && { purchase_cost: data.purchaseCost }),
          ...(data.serialNumber && { serial_number: data.serialNumber }),
          ...(data.assetTag && { asset_tag: data.assetTag }),
          ...(data.warrantyExpiry && { warranty_expiry: data.warrantyExpiry }),
          ...(data.maintenanceInterval && { maintenance_interval: data.maintenanceInterval }),
          ...(data.status && { status: data.status }),
          ...(data.conditionRating && { condition_rating: data.conditionRating }),
          ...(data.lastMaintenance && { last_maintenance: data.lastMaintenance }),
          ...(data.nextMaintenance && { next_maintenance: data.nextMaintenance }),
          ...(data.totalUsageHours !== undefined && { total_usage_hours: data.totalUsageHours }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.isActive !== undefined && { is_active: data.isActive }),
          ...(data.tags && { tags: { tags: data.tags } }),
          updated_at: new Date(),
        },
      });

      logger.info('Equipment updated successfully', {
        equipment_id: id,
        changes: Object.keys(data)
      });

      // Broadcast update to WebSocket clients
      this.broadcastEquipmentUpdate('UPDATED', equipment);

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
  async deleteEquipment(id: string) {
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

      // Broadcast update to WebSocket clients
      this.broadcastEquipmentUpdate('DELETED', { id, equipment_id: existing.equipment_id });

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

  // Create equipment reservation
  async createReservation(data: CreateReservationData) {
    try {
      // Check for conflicts
      const conflicts = await this.checkReservationConflicts(
        data.equipmentId,
        data.startTime,
        data.endTime,
        undefined // Exclude current reservation from conflict check
      );

      if (conflicts.length > 0) {
        throw new Error(`Reservation conflicts with existing reservations: ${conflicts.map(c => c.reservationId).join(', ')}`);
      }

      // Check student eligibility
      const student = await prisma.students.findUnique({
        where: { id: data.studentId },
      });

      if (!student) {
        throw new Error('Student not found');
      }

      if (student.equipment_ban && student.equipment_ban_until && student.equipment_ban_until > new Date()) {
        throw new Error(`Student is banned from equipment use until: ${student.equipment_ban_until.toLocaleDateString()}`);
      }

      // Check concurrent reservations
      const activeReservations = await prisma.equipment_reservations.count({
        where: {
          student_id: data.studentId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          start_time: { gte: new Date() },
        },
      });

      if (activeReservations >= student.max_concurrent_reservations) {
        throw new Error(`Student has reached maximum concurrent reservations (${student.max_concurrent_reservations})`);
      }

      const reservation = await prisma.equipment_reservations.create({
        data: {
          equipment_id: data.equipmentId,
          student_id: data.studentId,
          start_time: data.startTime,
          end_time: data.endTime,
          purpose: data.purpose || null,
          notes: data.notes || null,
          status: EquipmentReservationStatus.PENDING,
        },
        include: {
          equipment: {
            select: {
              equipment_id: true,
              name: true,
              type: true,
            },
          },
          student: {
            select: {
              student_id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      logger.info('Equipment reservation created', {
        reservationId: reservation.id,
        equipmentId: data.equipmentId,
        studentId: data.studentId,
      });

      // Broadcast update to WebSocket clients
      this.broadcastReservationUpdate('CREATED', reservation);

      return reservation;
    } catch (error) {
      logger.error('Error creating equipment reservation', {
        error: (error as Error).message,
        data,
      });
      throw error;
    }
  }

  // Check for reservation conflicts
  async checkReservationConflicts(
    equipmentId: string,
    startTime: Date,
    endTime: Date,
    excludeReservationId?: string
  ): Promise<ReservationConflict[]> {
    try {
      const where: Prisma.EquipmentReservationsWhereInput = {
        equipment_id: equipmentId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        OR: [
          {
            AND: [
              { start_time: { lt: endTime } },
              { end_time: { gt: startTime } }
            ]
          },
          {
            AND: [
              { start_time: { gte: startTime } },
              { start_time: { lt: endTime } }
            ]
          }
        ]
      };

      if (excludeReservationId) {
        where.id = { not: excludeReservationId };
      }

      const conflictingReservations = await prisma.equipment_reservations.findMany({
        where,
        include: {
          student: {
            select: {
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      return conflictingReservations.map(reservation => ({
        reservationId: reservation.id,
        studentName: `${reservation.student.first_name} ${reservation.student.last_name}`,
        startTime: reservation.start_time,
        endTime: reservation.end_time,
        conflictType: 'OVERLAP' as const,
      }));
    } catch (error) {
      logger.error('Error checking reservation conflicts', {
        error: (error as Error).message,
        equipmentId,
        startTime,
        endTime,
      });
      throw error;
    }
  }

  // Create maintenance record
  async createMaintenance(data: CreateMaintenanceData) {
    try {
      const maintenance = await prisma.equipment_maintenance.create({
        data: {
          equipment_id: data.equipmentId,
          maintenance_type: data.maintenanceType,
          description: data.description || null,
          cost: data.cost || null,
          vendor: data.vendor || null,
          scheduled_date: data.scheduledDate || null,
          priority: data.priority || EquipmentMaintenancePriority.NORMAL,
          estimated_duration: data.estimatedDuration || null,
          warranty_claim: data.warrantyClaim || false,
          status: data.scheduledDate
            ? EquipmentMaintenanceStatus.SCHEDULED
            : EquipmentMaintenanceStatus.ON_HOLD,
        },
        include: {
          equipment: {
            select: {
              equipment_id: true,
              name: true,
              type: true,
              status: true,
            },
          },
        },
      });

      // Update equipment status if maintenance is scheduled
      if (data.scheduledDate && data.scheduledDate <= new Date()) {
        await prisma.equipment.update({
          where: { id: data.equipmentId },
          data: { status: EquipmentStatus.MAINTENANCE },
        });
      }

      logger.info('Equipment maintenance record created', {
        maintenanceId: maintenance.id,
        equipmentId: data.equipmentId,
        type: data.maintenanceType,
      });

      // Broadcast update to WebSocket clients
      this.broadcastMaintenanceUpdate('CREATED', maintenance);

      return maintenance;
    } catch (error) {
      logger.error('Error creating equipment maintenance', {
        error: (error as Error).message,
        data,
      });
      throw error;
    }
  }

  // Create condition report
  async createConditionReport(data: CreateConditionReportData) {
    try {
      const report = await prisma.equipment_condition_reports.create({
        data: {
          equipment_id: data.equipmentId,
          condition_before: data.conditionBefore,
          condition_after: data.conditionAfter,
          assessment_type: data.assessmentType,
          damage_type: data.damageType || null,
          damage_severity: data.damageSeverity,
          description: data.description || null,
          cost_estimate: data.costEstimate || null,
          photos: data.photos ? { urls: data.photos } : null,
          witness_names: data.witnessNames ? { names: data.witnessNames } : null,
        },
        include: {
          equipment: {
            select: {
              equipment_id: true,
              name: true,
              type: true,
              condition_rating: true,
            },
          },
        },
      });

      // Update equipment condition if degraded
      if (data.conditionAfter !== data.conditionBefore) {
        await prisma.equipment.update({
          where: { id: data.equipmentId },
          data: {
            condition_rating: data.conditionAfter,
            status: data.damageSeverity !== EquipmentDamageSeverity.NONE
              ? EquipmentStatus.OUT_OF_ORDER
              : EquipmentStatus.AVAILABLE,
          },
        });
      }

      logger.info('Equipment condition report created', {
        reportId: report.id,
        equipmentId: data.equipmentId,
        conditionAfter: data.conditionAfter,
        damageSeverity: data.damageSeverity,
      });

      // Broadcast update to WebSocket clients
      this.broadcastConditionReportUpdate('CREATED', report);

      return report;
    } catch (error) {
      logger.error('Error creating equipment condition report', {
        error: (error as Error).message,
        data,
      });
      throw error;
    }
  }

  // Get comprehensive equipment metrics
  async getEquipmentMetrics(startDate?: Date, endDate?: Date): Promise<EquipmentUsageMetrics> {
    try {
      const dateFilter = startDate || endDate ? {
        gte: startDate || new Date(new Date().setDate(new Date().getDate() - 30)),
        lte: endDate || new Date(),
      } : undefined;

      const [
        totalEquipment,
        availableEquipment,
        inUseEquipment,
        maintenanceEquipment,
        reservedEquipment,
        outOfOrderEquipment,
        equipmentByType,
        equipmentByCondition,
        usageStats,
        upcomingMaintenance,
        topUsedEquipment,
      ] = await Promise.all([
        prisma.equipment.count({ where: { is_active: true } }),
        prisma.equipment.count({ where: { status: EquipmentStatus.AVAILABLE, is_active: true } }),
        prisma.equipment.count({ where: { status: EquipmentStatus.IN_USE, is_active: true } }),
        prisma.equipment.count({ where: { status: EquipmentStatus.MAINTENANCE, is_active: true } }),
        prisma.equipment.count({ where: { status: EquipmentStatus.RESERVED, is_active: true } }),
        prisma.equipment.count({ where: { status: EquipmentStatus.OUT_OF_ORDER, is_active: true } }),
        prisma.equipment.groupBy({
          by: ['type'],
          where: { is_active: true },
          _count: { id: true },
        }),
        prisma.equipment.groupBy({
          by: ['condition_rating'],
          where: { is_active: true },
          _count: { id: true },
        }),
        prisma.equipment_usage_stats.aggregate({
          where: dateFilter ? { date: dateFilter } : undefined,
          _sum: {
            total_sessions: true,
            total_minutes: true,
          },
          _avg: {
            utilization_rate: true,
            average_session: true,
          },
        }),
        prisma.equipment_maintenance.count({
          where: {
            status: EquipmentMaintenanceStatus.SCHEDULED,
            scheduled_date: { gte: new Date(), lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
          },
        }),
        prisma.equipment.findMany({
          where: { is_active: true },
          orderBy: { total_usage_hours: 'desc' },
          take: 10,
          select: {
            id: true,
            equipment_id: true,
            name: true,
            total_usage_hours: true,
            _count: {
              select: { activities: true },
            },
          },
        }),
      ]);

      const totalUsageHours = usageStats._sum.total_minutes ? Math.floor(usageStats._sum.total_minutes / 60) : 0;
      const averageSessionLength = usageStats._avg.average_session || 0;
      const utilizationRate = usageStats._avg.utilization_rate || 0;

      return {
        totalEquipment,
        available: availableEquipment,
        inUse: inUseEquipment,
        maintenance: maintenanceEquipment,
        reserved: reservedEquipment,
        outOfOrder: outOfOrderEquipment,
        utilizationRate,
        averageSessionLength,
        totalUsageHours,
        maintenancePending: upcomingMaintenance,
        upcomingMaintenance,
        equipmentByType: equipmentByType.map(item => ({
          type: item.type,
          count: item._count.id || 0,
          utilization: 0, // TODO: Calculate per-type utilization
        })),
        equipmentByCondition: equipmentByCondition.map(item => ({
          condition: item.condition_rating,
          count: item._count.id || 0,
        })),
        topUsedEquipment: topUsedEquipment.map(item => ({
          equipmentId: item.equipment_id,
          name: item.name,
          usageHours: item.total_usage_hours,
          sessions: item._count.activities,
        })),
      };
    } catch (error) {
      logger.error('Error fetching equipment metrics', {
        error: (error as Error).message,
        startDate,
        endDate,
      });
      throw error;
    }
  }

  // WebSocket broadcasting methods
  private broadcastEquipmentUpdate(action: string, equipment: any) {
    const message = JSON.stringify({
      type: 'EQUIPMENT_UPDATE',
      action,
      equipment,
      timestamp: new Date().toISOString(),
    });

    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  }

  private broadcastReservationUpdate(action: string, reservation: any) {
    const message = JSON.stringify({
      type: 'RESERVATION_UPDATE',
      action,
      reservation,
      timestamp: new Date().toISOString(),
    });

    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  }

  private broadcastMaintenanceUpdate(action: string, maintenance: any) {
    const message = JSON.stringify({
      type: 'MAINTENANCE_UPDATE',
      action,
      maintenance,
      timestamp: new Date().toISOString(),
    });

    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  }

  private broadcastConditionReportUpdate(action: string, report: any) {
    const message = JSON.stringify({
      type: 'CONDITION_REPORT_UPDATE',
      action,
      report,
      timestamp: new Date().toISOString(),
    });

    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  }
}

// Export singleton instance
export const equipmentService = new EquipmentService();

// Export legacy functions for backward compatibility
export async function getEquipment(options: GetEquipmentOptions = {}) {
  return equipmentService.getEquipment(options);
}

export async function getEquipmentById(id: string) {
  return equipmentService.getEquipmentById(id);
}

export async function getEquipmentByEquipmentId(equipment_id: string) {
  try {
    const equipment = await prisma.equipment.findUnique({
      where: { equipment_id },
      include: {
        activities: {
          where: { status: StudentActivitiesStatus.ACTIVE },
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

export async function createEquipment(data: CreateEquipmentData) {
  return equipmentService.createEquipment(data);
}

export async function updateEquipment(id: string, data: UpdateEquipmentData) {
  return equipmentService.updateEquipment(id, data);
}

export async function deleteEquipment(id: string) {
  return equipmentService.deleteEquipment(id);
}

export async function useEquipment(data: {
  equipment_id: string;
  student_id: string;
  activity_type: ActivityType;
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

    if (equipment.status !== EquipmentStatus.AVAILABLE) {
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
        (data.timeLimitMinutes || equipment.max_time_minutes) * 60000,
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
        start_time: startTime,
        end_time: endTime,
        time_limit_minutes: data.timeLimitMinutes || equipment.max_time_minutes,
        notes: data.notes || null,
        status: StudentActivitiesStatus.ACTIVE,
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

    // Update equipment status and usage
    await prisma.equipment.update({
      where: { id: data.equipment_id },
      data: {
        status: EquipmentStatus.IN_USE,
        total_usage_hours: { increment: (data.timeLimitMinutes || equipment.max_time_minutes) / 60 },
        daily_usage_hours: { increment: (data.timeLimitMinutes || equipment.max_time_minutes) / 60 },
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
        status: StudentActivitiesStatus.COMPLETED,
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
        status: EquipmentStatus.AVAILABLE,
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

export async function getEquipmentUsageHistory(
  options: any = {},
) {
  try {
    const {
      equipment_id,
      student_id,
      activityType,
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

export async function getEquipmentStatistics() {
  try {
    const metrics = await equipmentService.getEquipmentMetrics();
    return metrics;
  } catch (error) {
    logger.error('Error fetching equipment statistics', {
      error: (error as Error).message,
    });
    throw error;
  }
}