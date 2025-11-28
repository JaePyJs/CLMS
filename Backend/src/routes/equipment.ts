/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, requireRole } from '../middleware/authenticate';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
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

      const activeSessions = await prisma.student_activities.findMany({
        where: {
          activity_type: 'EQUIPMENT_USE',
          status: 'ACTIVE',
        },
        include: {
          student: true,
        },
      });

      // Map sessions to equipment
      const equipmentWithSessions = equipment.map(eq => {
        const session = activeSessions.find(s => {
          const meta = (s as any).metadata;
          return meta && meta.equipmentId === eq.id;
        });

        const transformedEq = {
          ...eq,
          status: eq.status.toLowerCase(),
          type: eq.category?.toLowerCase() || 'computer',
        };

        if (session) {
          const meta = (session as any).metadata;
          const startTime = new Date(session.start_time);
          const timeLimit = meta.timeLimitMinutes || 60;
          const elapsedMinutes = Math.floor(
            (Date.now() - startTime.getTime()) / 60000,
          );
          const remainingMinutes = Math.max(0, timeLimit - elapsedMinutes);

          return {
            ...transformedEq,
            currentSession: {
              id: session.id,
              studentId: session.student.student_id,
              studentName: `${session.student.first_name} ${session.student.last_name}`,
              startTime: session.start_time,
              timeLimitMinutes: timeLimit,
              remainingMinutes: remainingMinutes,
            },
          };
        }
        return transformedEq;
      });

      res.json({
        success: true,
        data: equipmentWithSessions,
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

// POST /api/equipment/session
router.post(
  '/session',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { equipmentId, studentId, timeLimitMinutes } = req.body;

    logger.info('🎮 Start session request received:', {
      equipmentId,
      studentId,
      timeLimitMinutes,
      bodyKeys: Object.keys(req.body),
      bodyRaw: JSON.stringify(req.body),
    });

    // Validate required fields
    if (!equipmentId) {
      logger.warn('❌ Start session failed: Missing equipmentId', {
        receivedBody: req.body,
      });
      res.status(400).json({
        success: false,
        message: 'equipmentId is required',
        debug: {
          receivedEquipmentId: equipmentId,
          receivedStudentId: studentId,
        },
      });
      return;
    }

    if (!studentId) {
      logger.warn('❌ Start session failed: Missing studentId', {
        receivedBody: req.body,
      });
      res.status(400).json({
        success: false,
        message: 'studentId is required',
        debug: {
          receivedEquipmentId: equipmentId,
          receivedStudentId: studentId,
        },
      });
      return;
    }

    try {
      const result = await prisma.$transaction(async tx => {
        // Check if equipment exists and is available
        logger.info(`🔍 Looking for equipment with id: ${equipmentId}`);
        const equipment = await tx.equipment.findUnique({
          where: { id: equipmentId },
        });

        if (!equipment) {
          throw new Error('Equipment not found');
        }

        logger.info(
          `✅ Equipment found: ${equipment.name}, status: ${equipment.status}`,
        );

        // Normalize status to uppercase for comparison (handles both 'AVAILABLE' and 'available')
        const normalizedStatus = equipment.status.toUpperCase();
        if (normalizedStatus !== 'AVAILABLE') {
          throw new Error(
            `Equipment is not available (current status: ${equipment.status})`,
          );
        }

        // Find student by multiple fields
        logger.info(
          `🔍 Looking for student with id/student_id/barcode: ${studentId}`,
        );
        const student = await tx.students.findFirst({
          where: {
            OR: [
              { id: studentId },
              { student_id: studentId },
              { barcode: studentId },
            ],
          },
        });

        if (!student) {
          throw new Error('Student not found');
        }

        logger.info(
          `✅ Student found: ${student.first_name} ${student.last_name}`,
          {
            internalId: student.id,
            studentId: student.student_id,
            barcode: student.barcode,
          },
        );

        // Check if student already has an active equipment session
        const existingSession = await tx.student_activities.findFirst({
          where: {
            student_id: student.id,
            activity_type: 'EQUIPMENT_USE',
            status: 'ACTIVE',
          },
        });

        if (existingSession) {
          throw new Error('Student already has an active equipment session');
        }

        // Create session (activity)
        logger.info('📝 Creating equipment session...');
        const session = await tx.student_activities.create({
          data: {
            student_id: student.id,
            activity_type: 'EQUIPMENT_USE',
            description: `Using equipment: ${equipment.name}`,
            status: 'ACTIVE',
            metadata: {
              equipmentId: equipment.id,
              equipmentName: equipment.name,
              timeLimitMinutes: timeLimitMinutes || 60,
              startTime: new Date().toISOString(),
              studentName: `${student.first_name} ${student.last_name}`,
            },
          } as any,
        });

        logger.info(`✅ Session created: ${session.id}`);

        // Update equipment status
        await tx.equipment.update({
          where: { id: equipmentId },
          data: { status: 'IN_USE' },
        });

        logger.info(`✅ Equipment status updated to IN_USE`);

        return session;
      });

      logger.info('🎉 Session started successfully', {
        sessionId: result.id,
      });

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      logger.error('💥 Error starting session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        equipmentId,
        studentId,
      });

      if (error instanceof Error) {
        if (
          error.message === 'Equipment not found' ||
          error.message === 'Student not found'
        ) {
          return res
            .status(404)
            .json({ success: false, message: error.message });
        }
        if (
          error.message.includes('not available') ||
          error.message.includes('active equipment session')
        ) {
          return res
            .status(400)
            .json({ success: false, message: error.message });
        }
      }

      res.status(500).json({
        success: false,
        message: 'Failed to start session',
        debug: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }),
);

// GET /api/equipment/:id/sessions
router.get(
  '/:id/sessions',
  authenticate,
  requireRole(['LIBRARIAN', 'ADMIN']),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const sessions = await prisma.student_activities.findMany({
        where: {
          activity_type: 'EQUIPMENT_USE',
          metadata: {
            path: ['equipmentId'],
            equals: req.params['id'],
          },
        } as any,
        include: {
          student: true,
        },
        orderBy: {
          start_time: 'desc',
        },
        take: 50, // Limit to last 50 sessions
      });

      res.json({
        success: true,
        data: sessions,
      });
    } catch (error) {
      logger.error('Error retrieving equipment sessions', {
        equipmentId: req.params['id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// POST /api/equipment/session/:id/end
router.post(
  '/session/:id/end',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params['id'];

    try {
      const result = await prisma.$transaction(async tx => {
        // Find session
        const session = await tx.student_activities.findUnique({
          where: { id: sessionId },
        });

        if (!session) {
          throw new Error('Session not found');
        }

        if (session.status !== 'ACTIVE') {
          throw new Error('Session is not active');
        }

        // Update session
        const updatedSession = await tx.student_activities.update({
          where: { id: sessionId },
          data: {
            status: 'COMPLETED',
            end_time: new Date(),
          },
        });

        // Update equipment status
        const metadata = (session as any).metadata;
        if (metadata?.equipmentId) {
          await tx.equipment.update({
            where: { id: metadata.equipmentId },
            data: { status: 'AVAILABLE' },
          });
        }

        return updatedSession;
      });

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error ending session', { error });

      if (error instanceof Error) {
        if (error.message === 'Session not found') {
          return res
            .status(404)
            .json({ success: false, message: error.message });
        }
        if (error.message === 'Session is not active') {
          return res
            .status(400)
            .json({ success: false, message: error.message });
        }
      }

      res
        .status(500)
        .json({ success: false, message: 'Failed to end session' });
    }
  }),
);

// POST /api/equipment/session/:id/extend
router.post(
  '/session/:id/extend',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params['id'];
    const { additionalMinutes } = req.body;

    try {
      const session = await prisma.student_activities.findUnique({
        where: { id: sessionId },
      });

      if (session?.status !== 'ACTIVE') {
        res
          .status(404)
          .json({ success: false, message: 'Active session not found' });
        return;
      }

      const metadata = (session as any).metadata || {};
      const currentLimit = metadata.timeLimitMinutes || 60;
      const newLimit = currentLimit + (additionalMinutes || 15);

      const updatedSession = await prisma.student_activities.update({
        where: { id: sessionId },
        data: {
          metadata: {
            ...metadata,
            timeLimitMinutes: newLimit,
          },
        } as any,
      });

      res.json({ success: true, data: updatedSession });
    } catch (error) {
      logger.error('Error extending session', { error });
      res
        .status(500)
        .json({ success: false, message: 'Failed to extend session' });
    }
  }),
);

export default router;
