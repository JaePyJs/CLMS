import { Router, Request, Response } from 'express';
import { ApiResponse } from '@/types';
import {
  type GetEquipmentOptions,
  type GetEquipmentUsageHistoryOptions,
  type CreateEquipmentData,
  type UpdateEquipmentData,
  type CreateReservationData,
  type CreateMaintenanceData,
  type CreateConditionReportData,
  getEquipment,
  getEquipmentById,
  getEquipmentByEquipmentId,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  useEquipment,
  releaseEquipment,
  getEquipmentUsageHistory,
  getEquipmentStatistics,
} from '@/services/enhancedEquipmentService';
import { equipmentService } from '@/services/enhancedEquipmentService';
import { equipment_status, equipment_type, student_activities_activity_type, equipment_condition_rating } from '@prisma/client';
import { logger } from '@/utils/logger';
import { requirePermission } from '@/middleware/authorization.middleware';
import { Permission } from '@/config/permissions';

const router = Router();

// Get all equipment
router.get('/', requirePermission(Permission.EQUIPMENT_VIEW), async (req: Request, res: Response) => {
  try {
    const { type, status, page = '1', limit = '50', search } = req.query;

    const options: GetEquipmentOptions = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    if (type) {
      options.type = type as equipment_type;
    }

    if (status) {
      options.status = status as equipment_status;
    }

    if (search) {
      options.search = search as string;
    }

    const result = await getEquipment(options);

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

// Get equipment by ID
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

    const equipment = await getEquipmentById(id);

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

// Create new equipment
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
    } = req.body;

    if (!equipmentId || !name || !type || !location || !maxTimeMinutes) {
      res.status(400).json({
        success: false,
        error:
          'Missing required fields: equipmentId, name, type, location, maxTimeMinutes',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const equipment = await createEquipment({
      equipmentId,
      name,
      type,
      location,
      maxTimeMinutes,
      requiresSupervision,
      description,
    });

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

// Update equipment
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
    } = req.body;

    const equipment = await updateEquipment(id, {
      equipmentId,
      name,
      type,
      location,
      maxTimeMinutes,
      requiresSupervision,
      description,
      status,
    });

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

// Delete equipment
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

    await deleteEquipment(id);

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

// Search equipment by barcode (equipment ID)
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

    const equipment = await getEquipmentByEquipmentId(barcode);

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

// Use equipment
router.post('/use', requirePermission(Permission.EQUIPMENT_ASSIGN), async (req: Request, res: Response) => {
  try {
    const { equipmentId, studentId, activityType, timeLimitMinutes, notes } =
      req.body;

    if (!equipmentId || !studentId || !activityType) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: equipmentId, studentId, activityType',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const activity = await useEquipment({
      equipment_id: equipmentId,
      student_id: studentId,
      activity_type: activityType,
      timeLimitMinutes,
      notes,
    });

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

// Release equipment
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

// Get equipment usage history
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

    const options: GetEquipmentUsageHistoryOptions = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    if (equipmentId) {
      options.equipmentId = equipmentId as string;
    }

    if (studentId) {
      options.studentId = studentId as string;
    }

    if (activityType) {
      options.activityType = activityType as student_activities_activity_type;
    }

    if (startDate) {
      options.startDate = new Date(startDate as string);
    }

    if (endDate) {
      options.endDate = new Date(endDate as string);
    }

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

// Get equipment statistics
router.get('/statistics', requirePermission(Permission.EQUIPMENT_VIEW), async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const statistics = await equipmentService.getEquipmentMetrics(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    const response: ApiResponse = {
      success: true,
      data: statistics,
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

// ==================== ENHANCED EQUIPMENT MANAGEMENT ROUTES ====================

// CREATE EQUIPMENT RESERVATION
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

    const maintenance = await equipmentService.createMaintenance({
      equipmentId,
      maintenanceType,
      description,
      cost,
      vendor,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
      priority,
      estimatedDuration,
      warrantyClaim,
    });

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
router.post('/condition-reports', requirePermission(Permission.EQUIPMENT_ASSESS), async (req: Request, res: Response) => {
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
      conditionBefore,
      conditionAfter,
      assessmentType,
      damageType,
      damageSeverity,
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

// GET EQUIPMENT METRICS (ENHANCED VERSION)
router.get('/metrics', requirePermission(Permission.EQUIPMENT_VIEW), async (req: Request, res: Response) => {
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
    logger.error('Error fetching equipment metrics', {
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

// GET EQUIPMENT BY ID WITH FULL DETAILS
router.get('/:id/details', requirePermission(Permission.EQUIPMENT_VIEW), async (req: Request, res: Response) => {
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
    logger.error('Error fetching equipment details', {
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

export default router;
