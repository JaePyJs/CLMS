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

      // Fetch active sessions for these equipment
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
          const meta = s.metadata as any;
          return meta && meta.equipmentId === eq.id;
        });

        const transformedEq = {
          ...eq,
          status: eq.status.toLowerCase(),
          type: eq.category?.toLowerCase() || 'computer',
        };

        if (session) {
          const meta = session.metadata as any;
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
      // Check if equipment exists and is available
      logger.info(`🔍 Looking for equipment with id: ${equipmentId}`);
      const equipment = await prisma.equipment.findUnique({
        where: { id: equipmentId },
      });

      if (!equipment) {
        logger.warn(`❌ Start session failed: Equipment not found`, {
          equipmentId,
          searchedBy: 'id',
        });
        res.status(404).json({
          success: false,
          message: 'Equipment not found',
          debug: { searchedEquipmentId: equipmentId },
        });
        return;
      }

      logger.info(
        `✅ Equipment found: ${equipment.name}, status: ${equipment.status}`,
      );

      // Normalize status to uppercase for comparison (handles both 'AVAILABLE' and 'available')
      const normalizedStatus = equipment.status.toUpperCase();
      if (normalizedStatus !== 'AVAILABLE') {
        logger.warn(`❌ Start session failed: Equipment not available`, {
          equipmentId,
          equipmentName: equipment.name,
          currentStatus: equipment.status,
          expectedStatus: 'AVAILABLE',
        });
        res.status(400).json({
          success: false,
          message: `Equipment is not available (current status: ${equipment.status})`,
          debug: {
            equipmentId,
            equipmentName: equipment.name,
            currentStatus: equipment.status,
          },
        });
        return;
      }

      // Find student by multiple fields
      logger.info(
        `🔍 Looking for student with id/student_id/barcode: ${studentId}`,
      );
      const student = await prisma.students.findFirst({
        where: {
          OR: [
            { id: studentId },
            { student_id: studentId },
            { barcode: studentId },
          ],
        },
      });

      if (!student) {
        logger.warn(`❌ Start session failed: Student not found`, {
          studentId,
          searchedBy: ['id', 'student_id', 'barcode'],
        });
        res.status(404).json({
          success: false,
          message: 'Student not found',
          debug: {
            searchedStudentId: studentId,
            searchedFields: ['id', 'student_id', 'barcode'],
          },
        });
        return;
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
      const existingSession = await prisma.student_activities.findFirst({
        where: {
          student_id: student.id,
          activity_type: 'EQUIPMENT_USE',
          status: 'ACTIVE',
        },
      });

      if (existingSession) {
        logger.warn(
          `❌ Start session failed: Student already has active equipment session`,
          {
            studentId: student.id,
            existingSessionId: existingSession.id,
          },
        );
        res.status(400).json({
          success: false,
          message: 'Student already has an active equipment session',
          debug: {
            existingSessionId: existingSession.id,
            studentName: `${student.first_name} ${student.last_name}`,
          },
        });
        return;
      }

      // Create session (activity)
      logger.info('📝 Creating equipment session...');
      const session = await prisma.student_activities.create({
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
        },
      });

      logger.info(`✅ Session created: ${session.id}`);

      // Update equipment status
      await prisma.equipment.update({
        where: { id: equipmentId },
        data: { status: 'IN_USE' },
      });

      logger.info(`✅ Equipment status updated to IN_USE`);

      logger.info('🎉 Session started successfully', {
        sessionId: session.id,
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        studentId: student.id,
        studentName: `${student.first_name} ${student.last_name}`,
      });

      res.status(201).json({ success: true, data: session });
    } catch (error) {
      logger.error('💥 Error starting session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        equipmentId,
        studentId,
      });
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

// POST /api/equipment/session/:id/end
router.post(
  '/session/:id/end',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params['id'];

    try {
      // Find session
      const session = await prisma.student_activities.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        // Try to find by equipment ID if sessionId is actually equipmentId (frontend might send equipmentId sometimes?)
        // But the route says :id is sessionId.
        // Let's assume it's sessionId.
        res.status(404).json({ success: false, message: 'Session not found' });
        return;
      }

      if (session.status !== 'ACTIVE') {
        res
          .status(400)
          .json({ success: false, message: 'Session is not active' });
        return;
      }

      // Update session
      const updatedSession = await prisma.student_activities.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          end_time: new Date(),
        },
      });

      // Update equipment status
      const metadata = session.metadata as any;
      if (metadata?.equipmentId) {
        await prisma.equipment.update({
          where: { id: metadata.equipmentId },
          data: { status: 'AVAILABLE' },
        });
      }

      res.json({ success: true, data: updatedSession });
    } catch (error) {
      logger.error('Error ending session', { error });
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

      const metadata = (session.metadata as any) || {};
      const currentLimit = metadata.timeLimitMinutes || 60;
      const newLimit = currentLimit + (additionalMinutes || 15);

      const updatedSession = await prisma.student_activities.update({
        where: { id: sessionId },
        data: {
          metadata: {
            ...metadata,
            timeLimitMinutes: newLimit,
          },
        },
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
