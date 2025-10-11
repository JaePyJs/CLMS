import { Router, Request, Response } from 'express';
import { ApiResponse } from '@/types';
import {
  type GetEquipmentOptions,
  type GetEquipmentUsageHistoryOptions,
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
} from '@/services/equipmentService';
import { EquipmentStatus, EquipmentType, ActivityType } from '@prisma/client';
import { logger } from '@/utils/logger';

const router = Router();

// Get all equipment
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type, status, page = '1', limit = '50', search } = req.query;

    const options: GetEquipmentOptions = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    if (type) {
      options.type = type as EquipmentType;
    }

    if (status) {
      options.status = status as EquipmentStatus;
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
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Equipment ID is required',
        timestamp: new Date().toISOString(),
      });
    }

    const equipment = await getEquipmentById(id);

    if (!equipment) {
      return res.status(404).json({
        success: false,
        error: 'Equipment not found',
        timestamp: new Date().toISOString(),
      });
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
router.post('/', async (req: Request, res: Response) => {
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
      return res.status(400).json({
        success: false,
        error:
          'Missing required fields: equipmentId, name, type, location, maxTimeMinutes',
        timestamp: new Date().toISOString(),
      });
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
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Equipment ID is required',
        timestamp: new Date().toISOString(),
      });
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
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Equipment ID is required',
        timestamp: new Date().toISOString(),
      });
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
router.post('/scan', async (req: Request, res: Response) => {
  try {
    const { barcode } = req.body;

    if (!barcode) {
      return res.status(400).json({
        success: false,
        error: 'Barcode is required',
        timestamp: new Date().toISOString(),
      });
    }

    const equipment = await getEquipmentByEquipmentId(barcode);

    if (!equipment) {
      return res.status(404).json({
        success: false,
        error: 'Equipment not found',
        timestamp: new Date().toISOString(),
      });
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
router.post('/use', async (req: Request, res: Response) => {
  try {
    const { equipmentId, studentId, activityType, timeLimitMinutes, notes } =
      req.body;

    if (!equipmentId || !studentId || !activityType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: equipmentId, studentId, activityType',
        timestamp: new Date().toISOString(),
      });
    }

    const activity = await useEquipment({
      equipmentId,
      studentId,
      activityType,
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
router.post('/release', async (req: Request, res: Response) => {
  try {
    const { activityId } = req.body;

    if (!activityId) {
      return res.status(400).json({
        success: false,
        error: 'Activity ID is required',
        timestamp: new Date().toISOString(),
      });
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
router.get('/usage/history', async (req: Request, res: Response) => {
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
      options.activityType = activityType as ActivityType;
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
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const statistics = await getEquipmentStatistics();

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

export default router;
