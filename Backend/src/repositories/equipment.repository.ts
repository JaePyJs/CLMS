import {
  Prisma,
  equipment,
  equipment_status,
  equipment_type,
  equipment_condition_rating,
} from '@prisma/client';
import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';
import { BaseRepository } from './base.repository';

/**
 * Equipment Repository
 *
 * Extends BaseRepository to provide equipment-specific operations with flexible
 * ID handling for equipment_id (external equipment identifier).
 */
export class EquipmentRepository extends BaseRepository<
  equipment,
  Prisma.equipmentCreateInput,
  Prisma.equipmentUpdateInput
> {
  constructor() {
    super(prisma, 'equipment', 'equipment_id');
  }

  /**
   * Find equipment by equipment_id
   */
  async findByEquipmentId(equipment_id: string): Promise<equipment | null> {
    try {
      const equipment = await this.getModel().findUnique({
        where: { equipment_id },
        include: {
          equipment_reservations: {
            where: { status: 'ACTIVE' },
            orderBy: { start_time: 'desc' },
            take: 1,
          },
          equipment_sessions: {
            where: { status: 'ACTIVE' },
            orderBy: { session_start: 'desc' },
            take: 1,
          },
        },
      });

      return equipment;
    } catch (error) {
      this.handleDatabaseError(error, 'findByEquipmentId', { equipment_id });
    }
  }

  /**
   * Find equipment by asset tag
   */
  async findByAssetTag(asset_tag: string): Promise<equipment | null> {
    try {
      const equipment = await this.getModel().findFirst({
        where: { asset_tag },
        include: {
          equipment_reservations: {
            where: { status: 'ACTIVE' },
            orderBy: { start_time: 'desc' },
            take: 1,
          },
        },
      });

      return equipment;
    } catch (error) {
      this.handleDatabaseError(error, 'findByAssetTag', { asset_tag });
    }
  }

  /**
   * Find equipment by serial number
   */
  async findBySerialNumber(serial_number: string): Promise<equipment | null> {
    try {
      const equipment = await this.getModel().findFirst({
        where: { serial_number },
        include: {
          equipment_reservations: {
            where: { status: 'ACTIVE' },
            orderBy: { start_time: 'desc' },
            take: 1,
          },
        },
      });

      return equipment;
    } catch (error) {
      this.handleDatabaseError(error, 'findBySerialNumber', { serial_number });
    }
  }

  /**
   * Create a new equipment with automatic field population
   */
  async createEquipment(data: {
    equipment_id: string;
    name: string;
    type: equipment_type;
    location: string;
    status?: equipment_status;
    description?: string;
    max_time_minutes: number;
    requires_supervision?: boolean;
    purchase_date?: Date;
    purchase_cost?: number;
    serial_number?: string;
    asset_tag?: string;
    warranty_expiry?: Date;
    condition_rating?: equipment_condition_rating;
    maintenance_interval?: number;
    category?: string;
    tags?: any;
    specifications?: any;
    notes?: string;
  }): Promise<equipment> {
    try {
      const processedData = this.populateMissingFields({
        equipment_id: data.equipment_id.trim(),
        name: data.name.trim(),
        type: data.type,
        location: data.location.trim(),
        status: data.status || equipment_status.AVAILABLE,
        description: data.description?.trim() || null,
        max_time_minutes: data.max_time_minutes,
        requires_supervision: data.requires_supervision || false,
        purchase_date: data.purchase_date || null,
        purchase_cost: data.purchase_cost || null,
        serial_number: data.serial_number?.trim() || null,
        asset_tag: data.asset_tag?.trim() || null,
        warranty_expiry: data.warranty_expiry || null,
        condition_rating:
          data.condition_rating || equipment_condition_rating.EXCELLENT,
        maintenance_interval: data.maintenance_interval || null,
        last_maintenance: data.maintenance_interval ? new Date() : null,
        next_maintenance: data.maintenance_interval
          ? new Date(
              Date.now() + data.maintenance_interval * 24 * 60 * 60 * 1000,
            )
          : null,
        category: data.category?.trim() || null,
        tags: data.tags || null,
        specifications: data.specifications || null,
        notes: data.notes?.trim() || null,
        total_usage_hours: 0,
        daily_usage_hours: 0,
        qr_code_data: null,
        barcode_data: null,
        is_active: true,
      });

      const equipment = await this.getModel().create({
        data: processedData,
      });

      logger.info('Equipment created successfully', {
        id: equipment.id,
        equipment_id: equipment.equipment_id,
        name: equipment.name,
        type: equipment.type,
      });

      return equipment;
    } catch (error) {
      // Handle unique constraint violation for equipment_id
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = (error.meta?.target as any)?.find((field: string) =>
          field.includes('equipment_id'),
        );

        if (target) {
          throw new Error(
            `Equipment with equipment_id '${data.equipment_id}' already exists`,
          );
        }
      }

      this.handleDatabaseError(error, 'createEquipment', {
        equipment_id: data.equipment_id,
        name: data.name,
        type: data.type,
      });
    }
  }

  /**
   * Upsert equipment by equipment_id (ideal for imports)
   */
  async upsertByEquipmentId(
    equipment_id: string,
    data: {
      name: string;
      type: equipment_type;
      location: string;
      status?: equipment_status;
      description?: string;
      max_time_minutes: number;
      requires_supervision?: boolean;
      purchase_date?: Date;
      purchase_cost?: number;
      serial_number?: string;
      asset_tag?: string;
      warranty_expiry?: Date;
      condition_rating?: equipment_condition_rating;
      maintenance_interval?: number;
      category?: string;
      tags?: any;
      specifications?: any;
      notes?: string;
      is_active?: boolean;
    },
  ): Promise<equipment> {
    try {
      const whereClause = { equipment_id };

      const createData = this.populateMissingFields({
        equipment_id: equipment_id.trim(),
        name: data.name.trim(),
        type: data.type,
        location: data.location.trim(),
        status: data.status || equipment_status.AVAILABLE,
        description: data.description?.trim() || null,
        max_time_minutes: data.max_time_minutes,
        requires_supervision: data.requires_supervision || false,
        purchase_date: data.purchase_date || null,
        purchase_cost: data.purchase_cost || null,
        serial_number: data.serial_number?.trim() || null,
        asset_tag: data.asset_tag?.trim() || null,
        warranty_expiry: data.warranty_expiry || null,
        condition_rating:
          data.condition_rating || equipment_condition_rating.EXCELLENT,
        maintenance_interval: data.maintenance_interval || null,
        last_maintenance: data.maintenance_interval ? new Date() : null,
        next_maintenance: data.maintenance_interval
          ? new Date(
              Date.now() + data.maintenance_interval * 24 * 60 * 60 * 1000,
            )
          : null,
        category: data.category?.trim() || null,
        tags: data.tags || null,
        specifications: data.specifications || null,
        notes: data.notes?.trim() || null,
        total_usage_hours: 0,
        daily_usage_hours: 0,
        qr_code_data: null,
        barcode_data: null,
        is_active: data.is_active !== undefined ? data.is_active : true,
      });

      const updateData = {
        ...(data.name && { name: data.name.trim() }),
        ...(data.type && { type: data.type }),
        ...(data.location && { location: data.location.trim() }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.description !== undefined && {
          description: data.description?.trim() || null,
        }),
        ...(data.max_time_minutes !== undefined && {
          max_time_minutes: data.max_time_minutes,
        }),
        ...(data.requires_supervision !== undefined && {
          requires_supervision: data.requires_supervision,
        }),
        ...(data.purchase_date !== undefined && {
          purchase_date: data.purchase_date || null,
        }),
        ...(data.purchase_cost !== undefined && {
          purchase_cost: data.purchase_cost || null,
        }),
        ...(data.serial_number !== undefined && {
          serial_number: data.serial_number?.trim() || null,
        }),
        ...(data.asset_tag !== undefined && {
          asset_tag: data.asset_tag?.trim() || null,
        }),
        ...(data.warranty_expiry !== undefined && {
          warranty_expiry: data.warranty_expiry || null,
        }),
        ...(data.condition_rating !== undefined && {
          condition_rating: data.condition_rating,
        }),
        ...(data.maintenance_interval !== undefined && {
          maintenance_interval: data.maintenance_interval || null,
          // Update next maintenance if interval changed
          ...(data.maintenance_interval && {
            next_maintenance: new Date(
              Date.now() + data.maintenance_interval * 24 * 60 * 60 * 1000,
            ),
          }),
        }),
        ...(data.category !== undefined && {
          category: data.category?.trim() || null,
        }),
        ...(data.tags !== undefined && { tags: data.tags || null }),
        ...(data.specifications !== undefined && {
          specifications: data.specifications || null,
        }),
        ...(data.notes !== undefined && { notes: data.notes?.trim() || null }),
        ...(data.is_active !== undefined && { is_active: data.is_active }),
        updated_at: new Date(),
      };

      const equipment = await this.getModel().upsert({
        where: whereClause,
        create: createData,
        update: updateData,
      });

      const isCreated =
        equipment.created_at.getTime() === equipment.updated_at.getTime();

      logger.info(
        `Equipment ${isCreated ? 'created' : 'updated'} successfully via upsert`,
        {
          id: equipment.id,
          equipment_id: equipment.equipment_id,
          name: equipment.name,
          type: equipment.type,
          action: isCreated ? 'created' : 'updated',
        },
      );

      return equipment;
    } catch (error) {
      this.handleDatabaseError(error, 'upsertByEquipmentId', {
        equipment_id,
        name: data.name,
        type: data.type,
      });
    }
  }

  /**
   * Update equipment status
   */
  async updateStatus(
    equipment_id: string,
    status: equipment_status,
    notes?: string,
  ): Promise<equipment | null> {
    try {
      const updateData: Prisma.equipmentUpdateInput = {
        status,
        updated_at: new Date(),
      };

      if (notes !== undefined) {
        updateData.notes = notes.trim() || null;
      }

      // Update maintenance dates if going to or from maintenance
      if (status === equipment_status.MAINTENANCE) {
        updateData.last_maintenance = new Date();
      }

      const equipment = await this.getModel().update({
        where: { equipment_id },
        data: updateData,
      });

      logger.info(`Equipment status updated`, {
        equipment_id,
        oldStatus: status,
        newStatus: status,
        notes,
      });

      return equipment;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        logger.warn(`Attempted to update status for non-existent equipment`, {
          equipment_id,
        });
        return null;
      }

      this.handleDatabaseError(error, 'updateStatus', { equipment_id, status });
    }
  }

  /**
   * Get equipment with flexible filtering options
   */
  async getEquipment(
    options: {
      type?: equipment_type;
      status?: equipment_status;
      location?: string;
      category?: string;
      isActive?: boolean;
      availableOnly?: boolean;
      page?: number;
      limit?: number;
      search?: string;
      sortBy?:
        | 'name'
        | 'type'
        | 'location'
        | 'status'
        | 'created_at'
        | 'next_maintenance';
      sortOrder?: 'asc' | 'desc';
    } = {},
  ): Promise<{
    equipment: equipment[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      const {
        type,
        status,
        location,
        category,
        isActive,
        availableOnly = false,
        page = 1,
        limit = 50,
        search,
        sortBy = 'name',
        sortOrder = 'asc',
      } = options;

      const skip = (page - 1) * limit;
      const where: Prisma.equipmentWhereInput = {};

      // Apply filters
      if (type) {
        where.type = type;
      }

      if (status) {
        where.status = status;
      }

      if (location) {
        where.location = { contains: location };
      }

      if (category) {
        where.category = { contains: category };
      }

      if (isActive !== undefined) {
        where.is_active = isActive;
      }

      if (availableOnly) {
        where.status = equipment_status.AVAILABLE;
      }

      // Apply search across multiple fields
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { equipment_id: { contains: search } },
          { serial_number: { contains: search } },
          { asset_tag: { contains: search } },
          { location: { contains: search } },
          { category: { contains: search } },
          { description: { contains: search } },
        ];
      }

      // Build order by clause
      const orderBy: Prisma.equipmentOrderByWithRelationInput = {};
      orderBy[sortBy] = sortOrder;

      const [equipment, total] = await Promise.all([
        this.getModel().findMany({
          where,
          skip,
          take: limit,
          orderBy,
        }),
        this.getModel().count({ where }),
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
      this.handleDatabaseError(error, 'getEquipment', options);
    }
  }

  /**
   * Search equipment by multiple criteria with advanced filtering
   */
  async searchEquipment(criteria: {
    query?: string;
    type?: equipment_type;
    status?: equipment_status;
    location?: string;
    category?: string;
    conditionRating?: equipment_condition_rating;
    availableOnly?: boolean;
    requiresMaintenance?: boolean;
    page?: number;
    limit?: number;
    sortBy?:
      | 'name'
      | 'type'
      | 'location'
      | 'status'
      | 'created_at'
      | 'next_maintenance';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    equipment: equipment[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      const {
        query,
        type,
        status,
        location,
        category,
        conditionRating,
        availableOnly = false,
        requiresMaintenance = false,
        page = 1,
        limit = 50,
        sortBy = 'name',
        sortOrder = 'asc',
      } = criteria;

      const skip = (page - 1) * limit;
      const where: Prisma.equipmentWhereInput = {};

      // Build search conditions
      const andConditions: Prisma.equipmentWhereInput[] = [];

      if (query) {
        andConditions.push({
          OR: [
            { name: { contains: query } },
            { equipment_id: { contains: query } },
            { serial_number: { contains: query } },
            { asset_tag: { contains: query } },
            { description: { contains: query } },
          ],
        });
      }

      if (type) {
        andConditions.push({ type });
      }

      if (status) {
        andConditions.push({ status });
      }

      if (location) {
        andConditions.push({
          location: { contains: location },
        });
      }

      if (category) {
        andConditions.push({
          category: { contains: category },
        });
      }

      if (conditionRating) {
        andConditions.push({ condition_rating: conditionRating });
      }

      if (availableOnly) {
        andConditions.push({
          status: equipment_status.AVAILABLE,
        });
      }

      if (requiresMaintenance) {
        andConditions.push({
          OR: [
            { status: equipment_status.MAINTENANCE },
            { next_maintenance: { lte: new Date() } },
          ],
        });
      }

      if (andConditions.length > 0) {
        where.AND = andConditions;
      }

      // Build order by clause
      const orderBy: Prisma.equipmentOrderByWithRelationInput = {};
      orderBy[sortBy] = sortOrder;

      const [equipment, total] = await Promise.all([
        this.getModel().findMany({
          where,
          skip,
          take: limit,
          orderBy,
        }),
        this.getModel().count({ where }),
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
      this.handleDatabaseError(error, 'searchEquipment', criteria);
    }
  }

  /**
   * Get equipment types with counts
   */
  async getTypesWithCounts(): Promise<
    { type: equipment_type; count: number }[]
  > {
    try {
      const types = await this.getModel().groupBy({
        by: ['type'],
        _count: {
          type: true,
        },
        where: {
          is_active: true,
        },
      });

      return types.map((item: any) => ({
        type: item.type,
        count: item._count.type,
      }));
    } catch (error) {
      this.handleDatabaseError(error, 'getTypesWithCounts');
    }
  }

  /**
   * Get locations with equipment counts
   */
  async getLocationsWithCounts(): Promise<
    { location: string; count: number }[]
  > {
    try {
      const locations = await this.getModel().groupBy({
        by: ['location'],
        _count: {
          location: true,
        },
        where: {
          is_active: true,
        },
      });

      return locations.map((item: any) => ({
        location: item.location,
        count: item._count.location,
      }));
    } catch (error) {
      this.handleDatabaseError(error, 'getLocationsWithCounts');
    }
  }

  /**
   * Update equipment usage statistics
   */
  async updateUsageStats(
    equipment_id: string,
    sessionMinutes: number,
  ): Promise<equipment | null> {
    try {
      const equipment = await this.getModel().update({
        where: { equipment_id },
        data: {
          total_usage_hours: {
            increment: sessionMinutes / 60,
          },
          daily_usage_hours: {
            increment: sessionMinutes / 60,
          },
          updated_at: new Date(),
        },
      });

      logger.info(`Equipment usage stats updated`, {
        equipment_id,
        sessionMinutes,
        newTotalHours: equipment.total_usage_hours,
      });

      return equipment;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        logger.warn(
          `Attempted to update usage stats for non-existent equipment`,
          { equipment_id },
        );
        return null;
      }

      this.handleDatabaseError(error, 'updateUsageStats', {
        equipment_id,
        sessionMinutes,
      });
    }
  }

  /**
   * Bulk upsert equipment for import operations
   */
  async bulkUpsertEquipment(
    equipmentData: Array<{
      equipment_id: string;
      name: string;
      type: equipment_type;
      location: string;
      status?: equipment_status;
      description?: string;
      max_time_minutes: number;
      requires_supervision?: boolean;
      purchase_date?: Date;
      purchase_cost?: number;
      serial_number?: string;
      asset_tag?: string;
      warranty_expiry?: Date;
      condition_rating?: equipment_condition_rating;
      maintenance_interval?: number;
      category?: string;
      tags?: any;
      specifications?: any;
      notes?: string;
    }>,
  ): Promise<{ created: number; updated: number; errors: string[] }> {
    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[],
    };

    for (const data of equipmentData) {
      try {
        const existing = await this.findByEquipmentId(data.equipment_id);

        if (existing) {
          await this.upsertByEquipmentId(data.equipment_id, data);
          results.updated++;
        } else {
          await this.createEquipment(data);
          results.created++;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Equipment ${data.equipment_id}: ${errorMessage}`);
        logger.error(`Failed to upsert equipment ${data.equipment_id}`, {
          error: errorMessage,
          equipment: data,
        });
      }
    }

    logger.info(`Bulk equipment upsert completed`, {
      total: equipmentData.length,
      created: results.created,
      updated: results.updated,
      errors: results.errors.length,
    });

    return results;
  }

  /**
   * Validate equipment data
   */
  private validateEquipmentData(data: any): void {
    if (!data.equipment_id || typeof data.equipment_id !== 'string') {
      throw new Error('Equipment ID is required and must be a string');
    }

    if (!data.name || typeof data.name !== 'string') {
      throw new Error('Equipment name is required and must be a string');
    }

    if (!data.type || !Object.values(equipment_type).includes(data.type)) {
      throw new Error(
        `Equipment type is required and must be one of: ${Object.values(equipment_type).join(', ')}`,
      );
    }

    if (!data.location || typeof data.location !== 'string') {
      throw new Error('Equipment location is required and must be a string');
    }

    if (
      data.max_time_minutes !== undefined &&
      (typeof data.max_time_minutes !== 'number' || data.max_time_minutes <= 0)
    ) {
      throw new Error('Max time minutes must be a positive number');
    }

    if (data.status && !Object.values(equipment_status).includes(data.status)) {
      throw new Error(
        `Equipment status must be one of: ${Object.values(equipment_status).join(', ')}`,
      );
    }

    if (
      data.condition_rating &&
      !Object.values(equipment_condition_rating).includes(data.condition_rating)
    ) {
      throw new Error(
        `Equipment condition rating must be one of: ${Object.values(equipment_condition_rating).join(', ')}`,
      );
    }
  }

  override async create(data: Prisma.equipmentCreateInput): Promise<equipment> {
    this.validateEquipmentData(data);
    return super.create(data);
  }

  override async updateByExternalId(
    externalId: string,
    data: Prisma.equipmentUpdateInput,
  ): Promise<equipment | null> {
    this.validateEquipmentData(data);
    return super.updateByExternalId(externalId, data);
  }
}

// Export singleton instance
export const equipmentRepository = new EquipmentRepository();