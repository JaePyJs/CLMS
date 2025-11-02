import { Router, Request, Response } from 'express';
import { ApiResponse } from '@/types';
import { equipmentService, releaseEquipment, getEquipmentUsageHistory } from '@/services/enhancedEquipmentService';
import { prisma } from '@/utils/prisma';
import {
  equipment_status,
  equipment_type,
  equipment_condition_rating,
  equipment_reservations_status,
  equipment_maintenance_maintenance_type,
  equipment_maintenance_status,
  equipment_maintenance_priority,
  equipment_condition_reports_assessment_type,
  equipment_condition_reports_damage_severity,
  student_activities_activity_type
} from '@prisma/client';
import { logger } from '@/utils/logger';
import { requirePermission } from '@/middleware/authorization.middleware';
import { Permission } from '@/config/permissions';

const router = Router();

// GET ALL EQUIPMENT WITH ENHANCED FILTERING
router.get('/', requirePermission(Permission.EQUIPMENT_VIEW), async (req: Request, res: Response) => {
  try {
    const {
      type,
      status,
      category,
      location,
      page = '1',
      limit = '50',
      search,
      includeReservations = 'false',
      includeMaintenance = 'false',
      includeStats = 'false',
      conditionRating,
      tags
    } = req.query;

    const options = {
      type: type as equipment_type,
      status: status as equipment_status,
      category: category as string,
      location: location as string,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      search: search as string,
      includeReservations: includeReservations === 'true',
      includeMaintenance: includeMaintenance === 'true',
      includeStats: includeStats === 'true',
      conditionRating: conditionRating as equipment_condition_rating,
      ...(tags ? { tags: (tags as string).split(',') } : {}),
    };

    const result = await equipmentService.getEquipment(options);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error fetching equipment', {
      error: (error as Error).message,
      query: req.query,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET EQUIPMENT BY ID WITH FULL DETAILS
router.get('/:id', requirePermission(Permission.EQUIPMENT_VIEW), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Equipment ID is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const equipment = await equipmentService.getEquipmentById(id);

    if (!equipment) {
      res.status(404).json({
        success: false,
        error: 'Equipment not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const response: ApiResponse = {
      success: true,
      data: equipment,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error fetching equipment', {
      error: (error as Error).message,
      id: req.params.id,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// CREATE NEW EQUIPMENT
router.post('/', requirePermission(Permission.EQUIPMENT_CREATE), async (req: Request, res: Response) => {
  try {
    const {
      equipmentId,
      name,
      type,
      location,
      maxTimeMinutes,
      requiresSupervision,
      description,
      category,
      specifications,
      purchaseDate,
      purchaseCost,
      serialNumber,
      assetTag,
      warrantyExpiry,
      maintenanceInterval,
      tags,
    } = req.body;

    if (!equipmentId || !name || !type || !location || !maxTimeMinutes) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: equipmentId, name, type, location, maxTimeMinutes',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const equipmentData: any = {
      equipmentId,
      name,
      type,
      location,
      maxTimeMinutes,
      requiresSupervision,
      description,
      category,
      specifications,
      purchaseCost,
      serialNumber,
      assetTag,
      maintenanceInterval,
      tags,
    };

    if (purchaseDate) {
      equipmentData.purchaseDate = new Date(purchaseDate);
    }

    if (warrantyExpiry) {
      equipmentData.warrantyExpiry = new Date(warrantyExpiry);
    }

    const equipment = await equipmentService.createEquipment(equipmentData);

    const response: ApiResponse = {
      success: true,
      data: equipment,
      message: 'Equipment created successfully',
      timestamp: new Date().toISOString(),
    };
    res.status(201).json(response);
  } catch (error) {
    logger.error('Error creating equipment', {
      error: (error as Error).message,
      body: req.body,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// UPDATE EQUIPMENT
router.put('/:id', requirePermission(Permission.EQUIPMENT_UPDATE), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Equipment ID is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const {
      equipmentId,
      name,
      type,
      location,
      maxTimeMinutes,
      requiresSupervision,
      description,
      status,
      category,
      specifications,
      purchaseDate,
      purchaseCost,
      serialNumber,
      assetTag,
      warrantyExpiry,
      maintenanceInterval,
      conditionRating,
      lastMaintenance,
      nextMaintenance,
      totalUsageHours,
      notes,
      isActive,
      tags,
    } = req.body;

    const updateData: any = {
      equipmentId,
      name,
      type,
      location,
      maxTimeMinutes,
      requiresSupervision,
      description,
      status,
      category,
      specifications,
      purchaseCost,
      serialNumber,
      assetTag,
      maintenanceInterval,
      conditionRating,
      totalUsageHours,
      notes,
      isActive,
      tags,
    };

    // Only add Date properties if they have values
    if (purchaseDate) {
      updateData.purchaseDate = new Date(purchaseDate);
    }
    if (warrantyExpiry) {
      updateData.warrantyExpiry = new Date(warrantyExpiry);
    }
    if (lastMaintenance) {
      updateData.lastMaintenance = new Date(lastMaintenance);
    }
    if (nextMaintenance) {
      updateData.nextMaintenance = new Date(nextMaintenance);
    }

    const equipment = await equipmentService.updateEquipment(id, updateData);

    const response: ApiResponse = {
      success: true,
      data: equipment,
      message: 'Equipment updated successfully',
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error updating equipment', {
      error: (error as Error).message,
      id: req.params.id,
      body: req.body,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// DELETE EQUIPMENT
router.delete('/:id', requirePermission(Permission.EQUIPMENT_DELETE), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Equipment ID is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await equipmentService.deleteEquipment(id);

    const response: ApiResponse = {
      success: true,
      message: 'Equipment deleted successfully',
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error deleting equipment', {
      error: (error as Error).message,
      id: req.params.id,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// SCAN EQUIPMENT BY BARCODE
router.post('/scan', requirePermission(Permission.EQUIPMENT_VIEW), async (req: Request, res: Response) => {
  try {
    const { barcode } = req.body;

    if (!barcode) {
      res.status(400).json({
        success: false,
        error: 'Barcode is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const equipment = await equipmentService.getEquipmentByEquipmentId(barcode);

    if (!equipment) {
      res.status(404).json({
        success: false,
        error: 'Equipment not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const response: ApiResponse = {
      success: true,
      message: 'Equipment found successfully',
      data: equipment,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error scanning equipment barcode', {
      error: (error as Error).message,
      body: req.body,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// USE EQUIPMENT
router.post('/use', requirePermission(Permission.EQUIPMENT_ASSIGN), async (req: Request, res: Response) => {
  try {
    const { equipmentId, studentId, activityType, timeLimitMinutes, notes } = req.body;

    if (!equipmentId || !studentId || !activityType) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: equipmentId, studentId, activityType',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const activity = await equipmentService.useEquipment(equipmentId, studentId, activityType as student_activities_activity_type);

    const response: ApiResponse = {
      success: true,
      data: activity,
      message: 'Equipment used successfully',
      timestamp: new Date().toISOString(),
    };
    res.status(201).json(response);
  } catch (error) {
    logger.error('Error using equipment', {
      error: (error as Error).message,
      body: req.body,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// RELEASE EQUIPMENT
router.post('/release', requirePermission(Permission.EQUIPMENT_ASSIGN), async (req: Request, res: Response) => {
  try {
    const { activityId } = req.body;

    if (!activityId) {
      res.status(400).json({
        success: false,
        error: 'Activity ID is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const activity = await releaseEquipment(activityId);

    const response: ApiResponse = {
      success: true,
      data: activity,
      message: 'Equipment released successfully',
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error releasing equipment', {
      error: (error as Error).message,
      body: req.body,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// CREATE RESERVATION
router.post('/reservations', requirePermission(Permission.EQUIPMENT_RESERVE), async (req: Request, res: Response) => {
  try {
    const { equipmentId, studentId, startTime, endTime, purpose, notes } = req.body;

    if (!equipmentId || !studentId || !startTime || !endTime) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: equipmentId, studentId, startTime, endTime',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const reservation = await equipmentService.createReservation({
      equipmentId,
      studentId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      purpose,
      notes,
    });

    const response: ApiResponse = {
      success: true,
      data: reservation,
      message: 'Reservation created successfully',
      timestamp: new Date().toISOString(),
    };
    res.status(201).json(response);
  } catch (error) {
    logger.error('Error creating reservation', {
      error: (error as Error).message,
      body: req.body,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// CHECK RESERVATION CONFLICTS
router.post('/reservations/check-conflicts', requirePermission(Permission.EQUIPMENT_VIEW), async (req: Request, res: Response) => {
  try {
    const { equipmentId, startTime, endTime, excludeReservationId } = req.body;

    if (!equipmentId || !startTime || !endTime) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: equipmentId, startTime, endTime',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const conflicts = await equipmentService.checkReservationConflicts(
      equipmentId,
      new Date(startTime),
      new Date(endTime),
      excludeReservationId
    );

    const response: ApiResponse = {
      success: true,
      data: { conflicts, hasConflicts: conflicts.length > 0 },
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error checking reservation conflicts', {
      error: (error as Error).message,
      body: req.body,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// CREATE MAINTENANCE RECORD
router.post('/maintenance', requirePermission(Permission.EQUIPMENT_MAINTENANCE), async (req: Request, res: Response) => {
  try {
    const {
      equipmentId,
      maintenanceType,
      description,
      cost,
      vendor,
      scheduledDate,
      priority,
      estimatedDuration,
      warrantyClaim,
    } = req.body;

    if (!equipmentId || !maintenanceType) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: equipmentId, maintenanceType',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const maintenanceData: any = {
      equipmentId,
      maintenanceType: maintenanceType as equipment_maintenance_maintenance_type,
      description,
      cost,
      vendor,
      priority: priority as equipment_maintenance_priority,
      estimatedDuration,
      warrantyClaim,
    };

    // Only add scheduledDate if it has a value
    if (scheduledDate) {
      maintenanceData.scheduledDate = new Date(scheduledDate);
    }

    const maintenance = await equipmentService.createMaintenance(maintenanceData);

    const response: ApiResponse = {
      success: true,
      data: maintenance,
      message: 'Maintenance record created successfully',
      timestamp: new Date().toISOString(),
    };
    res.status(201).json(response);
  } catch (error) {
    logger.error('Error creating maintenance record', {
      error: (error as Error).message,
      body: req.body,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// CREATE CONDITION REPORT
router.post('/condition-reports', requirePermission(Permission.EQUIPMENT_ASSIGN), async (req: Request, res: Response) => {
  try {
    const {
      equipmentId,
      conditionBefore,
      conditionAfter,
      assessmentType,
      damageType,
      damageSeverity,
      description,
      costEstimate,
      photos,
      witnessNames,
    } = req.body;

    if (!equipmentId || !conditionBefore || !conditionAfter || !assessmentType) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: equipmentId, conditionBefore, conditionAfter, assessmentType',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const report = await equipmentService.createConditionReport({
      equipmentId,
      conditionBefore: conditionBefore as equipment_condition_rating,
      conditionAfter: conditionAfter as equipment_condition_rating,
      assessmentType: assessmentType as equipment_condition_reports_assessment_type,
      damageType,
      damageSeverity: damageSeverity as equipment_condition_reports_damage_severity,
      description,
      costEstimate,
      photos,
      witnessNames,
    });

    const response: ApiResponse = {
      success: true,
      data: report,
      message: 'Condition report created successfully',
      timestamp: new Date().toISOString(),
    };
    res.status(201).json(response);
  } catch (error) {
    logger.error('Error creating condition report', {
      error: (error as Error).message,
      body: req.body,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET EQUIPMENT USAGE HISTORY
router.get('/usage/history', requirePermission(Permission.EQUIPMENT_VIEW), async (req: Request, res: Response) => {
  try {
    const {
      equipmentId,
      studentId,
      activityType,
      startDate,
      endDate,
      page = '1',
      limit = '50',
    } = req.query;

    const options = {
      equipment_id: equipmentId as string,
      student_id: studentId as string,
      activityType: activityType as student_activities_activity_type,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    const result = await getEquipmentUsageHistory(options);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error fetching equipment usage history', {
      error: (error as Error).message,
      query: req.query,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET EQUIPMENT STATISTICS AND METRICS
router.get('/statistics', requirePermission(Permission.EQUIPMENT_VIEW), async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const metrics = await equipmentService.getEquipmentMetrics(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    const response: ApiResponse = {
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error fetching equipment statistics', {
      error: (error as Error).message,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET EQUIPMENT CATEGORIES
router.get('/categories/list', requirePermission(Permission.EQUIPMENT_VIEW), async (req: Request, res: Response) => {
  try {
    const categories = await prisma.equipment.findMany({
      where: {
        is_active: true,
        category: { not: null }
      },
      select: {
        category: true,
        _count: {
          select: { id: true }
        }
      },
      distinct: ['category'],
    });

    const categoryList = categories.map((c: any) => ({
      name: c.category,
      count: c._count.id,
    }));

    const response: ApiResponse = {
      success: true,
      data: categoryList,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error fetching equipment categories', {
      error: (error as Error).message,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET EQUIPMENT LOCATIONS
router.get('/locations/list', requirePermission(Permission.EQUIPMENT_VIEW), async (req: Request, res: Response) => {
  try {
    const locations = await prisma.equipment.findMany({
      where: { is_active: true },
      select: {
        location: true,
        _count: {
          select: { id: true }
        }
      },
      distinct: ['location'],
    });

    const locationList = locations.map((l: any) => ({
      name: l.location,
      count: l._count.id,
    }));

    const response: ApiResponse = {
      success: true,
      data: locationList,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error fetching equipment locations', {
      error: (error as Error).message,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;