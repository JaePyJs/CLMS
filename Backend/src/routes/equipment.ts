/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, requireRole } from '../middleware/authenticate';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

// GET /api/equipment
router.get(
  '/',
  authenticate,
  requireRole(['LIBRARIAN', 'ADMIN']),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Get equipment request', {
      query: req.query,
      userId: (req as any).user?.id,
    });

    try {
      const {
        page = 1,
        limit = 10,
        category,
        status,
        search,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = req.query as any;

      const where: any = {};

      if (category) {
        where.category = { contains: category, mode: 'insensitive' };
      }

      if (status) {
        where.status = status;
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { serial_number: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } },
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const total = await prisma.equipment.count({ where });

      const orderBy: any = {};
      orderBy[sortBy] = sortOrder;

      const equipment = await prisma.equipment.findMany({
        where,
        orderBy,
        skip,
        take: parseInt(limit),
      });

      res.json({
        success: true,
        data: equipment,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      logger.error('Error retrieving equipment', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// GET /api/equipment/:id
router.get(
  '/:id',
  authenticate,
  requireRole(['LIBRARIAN', 'ADMIN']),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Get equipment by ID request', {
      equipmentId: req.params['id'],
      userId: (req as any).user?.id,
    });

    try {
      const equipment = await prisma.equipment.findUnique({
        where: { id: req.params['id'] },
      });

      if (!equipment) {
        return res.status(404).json({
          success: false,
          message: 'Equipment not found',
        });
      }

      res.json({
        success: true,
        data: equipment,
      });
    } catch (error) {
      logger.error('Error retrieving equipment', {
        equipmentId: req.params['id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// POST /api/equipment
router.post(
  '/',
  authenticate,
  requireRole(['LIBRARIAN', 'ADMIN']),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Create equipment request', {
      name: req.body.name,
      serial_number: req.body.serial_number,
      createdBy: (req as any).user?.id,
    });

    try {
      const { name, category, serial_number, status, purchase_date, notes } =
        req.body;

      const equipment = await prisma.equipment.create({
        data: {
          name,
          category: category || null,
          serial_number: serial_number || null,
          status: status || 'AVAILABLE',
          purchase_date: purchase_date ? new Date(purchase_date) : null,
          notes: notes || null,
          is_active: true,
        },
      });

      res.status(201).json({
        success: true,
        data: equipment,
      });
    } catch (error) {
      logger.error('Error creating equipment', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// PUT /api/equipment/:id
router.put(
  '/:id',
  authenticate,
  requireRole(['LIBRARIAN', 'ADMIN']),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Update equipment request', {
      equipmentId: req.params['id'],
      updatedBy: (req as any).user?.id,
      fields: Object.keys(req.body),
    });

    try {
      const equipment = await prisma.equipment.update({
        where: { id: req.params['id'] },
        data: {
          ...req.body,
          purchase_date: req.body.purchase_date
            ? new Date(req.body.purchase_date)
            : undefined,
          updated_at: new Date(),
        },
      });

      res.json({
        success: true,
        data: equipment,
      });
    } catch (error) {
      logger.error('Error updating equipment', {
        equipmentId: req.params['id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// PATCH /api/equipment/:id
router.patch(
  '/:id',
  authenticate,
  requireRole(['LIBRARIAN', 'ADMIN']),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Partial update equipment request', {
      equipmentId: req.params['id'],
      updatedBy: (req as any).user?.id,
      fields: Object.keys(req.body),
    });

    try {
      const equipment = await prisma.equipment.update({
        where: { id: req.params['id'] },
        data: {
          ...req.body,
          purchase_date: req.body.purchase_date
            ? new Date(req.body.purchase_date)
            : undefined,
          updated_at: new Date(),
        },
      });

      res.json({
        success: true,
        data: equipment,
      });
    } catch (error) {
      logger.error('Error updating equipment', {
        equipmentId: req.params['id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// DELETE /api/equipment/:id
router.delete(
  '/:id',
  authenticate,
  requireRole(['LIBRARIAN', 'ADMIN']),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Delete equipment request', {
      equipmentId: req.params['id'],
      deletedBy: (req as any).user?.id,
    });

    try {
      await prisma.equipment.delete({
        where: { id: req.params['id'] },
      });

      res.json({
        success: true,
        message: 'Equipment deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting equipment', {
        equipmentId: req.params['id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

export default router;
