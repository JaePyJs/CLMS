import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/authenticate';
import {
  StudentService,
  CreateStudentData,
  UpdateStudentData,
} from '../services/studentService';
import { StudentActivityService } from '../services/studentActivityService';
import { BarcodeService } from '../services/barcodeService';
import { websocketServer } from '../websocket/websocketServer';
import { PrismaClient } from '@prisma/client';
import {
  // createStudentSchema,  // Reserved for future validation
  // updateStudentSchema,  // Reserved for future validation
  searchStudentsSchema,
  getStudentByBarcodeSchema,
} from '../validation/student.schema';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

const router = Router();

// GET /api/v1/students - List all students
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      logger.info('List all students request', {
        userId: req.user.userId,
        username: req.user.username,
        ip: req.ip,
      });

      const students = await StudentService.listStudents();

      logger.info('Students list retrieved successfully', {
        count: students.length,
        userId: req.user.userId,
        ip: req.ip,
      });

      res.json({
        success: true,
        data: students,
        count: students.length,
      });
    } catch (error) {
      logger.error('List students failed', {
        userId: req.user?.userId,
        ip: req.ip,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve students',
        code: 'LIST_STUDENTS_FAILED',
      });
    }
  }),
);

// GET /api/v1/students/:id - Get student by ID
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    // Validate ID parameter
    if (!id) {
      logger.warn('Get student failed: missing student ID', {
        userId: req.user.userId,
        ip: req.ip,
      });

      res.status(400).json({
        success: false,
        message: 'Student ID is required',
        code: 'MISSING_STUDENT_ID',
      });
      return;
    }

    try {
      logger.info('Get student by ID request', {
        studentId: id,
        userId: req.user.userId,
        username: req.user.username,
        ip: req.ip,
      });

      const student = await StudentService.getStudentById(id);

      logger.info('Student retrieved successfully', {
        studentId: id,
        student_number: student.student_id,
        userId: req.user.userId,
        ip: req.ip,
      });

      res.json({
        success: true,
        data: student,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Student not found') {
        logger.warn('Student not found', {
          studentId: id,
          userId: req.user.userId,
          ip: req.ip,
        });

        res.status(404).json({
          success: false,
          message: 'Student not found',
          code: 'STUDENT_NOT_FOUND',
        });
        return;
      }

      logger.error('Get student failed', {
        studentId: id,
        userId: req.user?.userId,
        ip: req.ip,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve student',
        code: 'GET_STUDENT_FAILED',
      });
    }
  }),
);

// POST /api/v1/students - Create new student
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const studentData: CreateStudentData = req.body;

    // Validate required fields
    const requiredFields = [
      'student_id',
      'first_name',
      'last_name',
      'grade_level',
      'grade_category',
    ];
    const missingFields = requiredFields.filter(
      field => !studentData[field as keyof CreateStudentData],
    );

    if (missingFields.length > 0) {
      logger.warn('Student creation failed: missing required fields', {
        missingFields,
        userId: req.user.userId,
        ip: req.ip,
      });

      res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`,
        code: 'MISSING_REQUIRED_FIELDS',
      });
      return;
    }

    try {
      logger.info('Create student request', {
        student_id: studentData.student_id,
        name: `${studentData.first_name} ${studentData.last_name}`,
        userId: req.user.userId,
        username: req.user.username,
        ip: req.ip,
      });

      const student = await StudentService.createStudent(studentData);

      logger.info('Student created successfully', {
        studentId: student.id,
        student_id: student.student_id,
        userId: req.user.userId,
        ip: req.ip,
      });

      res.status(201).json({
        success: true,
        data: student,
        message: 'Student created successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        logger.warn('Student creation failed: duplicate student ID', {
          student_id: studentData.student_id,
          userId: req.user.userId,
          ip: req.ip,
        });

        res.status(409).json({
          success: false,
          message: 'Student with this ID already exists',
          code: 'STUDENT_ID_EXISTS',
        });
        return;
      }

      logger.error('Student creation failed', {
        student_id: studentData.student_id,
        userId: req.user?.userId,
        ip: req.ip,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to create student',
        code: 'CREATE_STUDENT_FAILED',
      });
    }
  }),
);

// PUT /api/v1/students/:id - Update student
router.put(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const updateData: UpdateStudentData = req.body;

    // Validate ID parameter
    if (!id) {
      logger.warn('Update student failed: missing student ID', {
        userId: req.user.userId,
        ip: req.ip,
      });

      res.status(400).json({
        success: false,
        message: 'Student ID is required',
        code: 'MISSING_STUDENT_ID',
      });
      return;
    }

    // Check if there's at least one field to update
    const allowedFields = [
      'first_name',
      'last_name',
      'grade_level',
      'grade_category',
      'section',
      'max_concurrent_reservations',
      'is_active',
      'equipment_ban',
      'equipment_ban_reason',
      'equipment_ban_until',
      'fine_balance',
    ];
    const updateFields = Object.keys(updateData).filter(field =>
      allowedFields.includes(field),
    );

    if (updateFields.length === 0) {
      logger.warn('Update student failed: no valid fields to update', {
        studentId: id,
        userId: req.user.userId,
        ip: req.ip,
      });

      res.status(400).json({
        success: false,
        message: 'No valid fields provided for update',
        code: 'NO_UPDATE_FIELDS',
      });
      return;
    }

    try {
      logger.info('Update student request', {
        studentId: id,
        updateFields,
        userId: req.user.userId,
        username: req.user.username,
        ip: req.ip,
      });

      const student = await StudentService.updateStudent(id, updateData);

      logger.info('Student updated successfully', {
        studentId: id,
        student_id: student.student_id,
        userId: req.user.userId,
        ip: req.ip,
      });

      res.json({
        success: true,
        data: student,
        message: 'Student updated successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Student not found') {
        logger.warn('Update student failed: student not found', {
          studentId: id,
          userId: req.user.userId,
          ip: req.ip,
        });

        res.status(404).json({
          success: false,
          message: 'Student not found',
          code: 'STUDENT_NOT_FOUND',
        });
        return;
      }

      logger.error('Student update failed', {
        studentId: id,
        userId: req.user?.userId,
        ip: req.ip,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to update student',
        code: 'UPDATE_STUDENT_FAILED',
      });
    }
  }),
);

// DELETE /api/v1/students/:id - Delete student
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    // Validate ID parameter
    if (!id) {
      logger.warn('Delete student failed: missing student ID', {
        userId: req.user.userId,
        ip: req.ip,
      });

      res.status(400).json({
        success: false,
        message: 'Student ID is required',
        code: 'MISSING_STUDENT_ID',
      });
      return;
    }

    try {
      logger.info('Delete student request', {
        studentId: id,
        userId: req.user.userId,
        username: req.user.username,
        ip: req.ip,
      });

      await StudentService.deleteStudent(id);

      logger.info('Student deleted successfully', {
        studentId: id,
        userId: req.user.userId,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: 'Student deleted successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Student not found') {
        logger.warn('Delete student failed: student not found', {
          studentId: id,
          userId: req.user.userId,
          ip: req.ip,
        });

        res.status(404).json({
          success: false,
          message: 'Student not found',
          code: 'STUDENT_NOT_FOUND',
        });
        return;
      }

      logger.error('Student deletion failed', {
        studentId: id,
        userId: req.user?.userId,
        ip: req.ip,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to delete student',
        code: 'DELETE_STUDENT_FAILED',
      });
    }
  }),
);

// GET /api/v1/students/search - Search students (query parameter format)
router.get(
  '/search',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const query = req.query.q as string;
    const { limit = 50, offset = 0 } = req.query;

    if (!query) {
      res.status(400).json({
        success: false,
        message: 'Query parameter "q" is required',
      });
      return;
    }

    try {
      logger.info('Search students request (query format)', {
        query,
        limit,
        offset,
        userId: req.user?.userId,
        ip: req.ip,
      });

      const searchQuery = query.toLowerCase();
      const students = await prisma.students.findMany({
        where: {
          OR: [
            { first_name: { contains: searchQuery } },
            { last_name: { contains: searchQuery } },
            { student_id: { contains: searchQuery } },
            { email: { contains: searchQuery } },
          ],
        },
        take: Number(limit),
        skip: Number(offset),
        orderBy: { last_name: 'asc' },
      });

      logger.info('Students search completed (query format)', {
        query,
        count: students.length,
      });

      res.json({
        success: true,
        data: students,
        count: students.length,
      });
    } catch (error) {
      logger.error('Search students failed', {
        query,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to search students',
        code: 'SEARCH_STUDENTS_FAILED',
      });
    }
  }),
);

// GET /api/v1/students/search/:query - Search students (path parameter format)
router.get(
  '/search/:query',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { query } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    try {
      logger.info('Search students request', {
        query,
        limit,
        offset,
        userId: req.user.userId,
        ip: req.ip,
      });

      // Validate search parameters
      const searchParams = searchStudentsSchema.parse({
        query,
        limit: Number(limit),
        offset: Number(offset),
      });

      // Search students by name, student_id, or email
      // Note: MySQL doesn't support mode: "insensitive" in Prisma
      // For case-insensitive search in MySQL, we use contains with lowercase comparison
      const searchQuery = searchParams.query.toLowerCase();
      const students = await prisma.students.findMany({
        where: {
          OR: [
            { first_name: { contains: searchQuery } },
            { last_name: { contains: searchQuery } },
            { student_id: { contains: searchQuery } },
            { email: { contains: searchQuery } },
          ],
        },
        take: searchParams.limit,
        skip: searchParams.offset,
        orderBy: { last_name: 'asc' },
      });

      logger.info('Students search completed', {
        query,
        count: students.length,
        userId: req.user.userId,
        ip: req.ip,
      });

      res.json({
        success: true,
        data: students,
        count: students.length,
        pagination: {
          limit: searchParams.limit,
          offset: searchParams.offset,
          query: searchParams.query,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        logger.warn('Search students failed: validation error', {
          query,
          userId: req.user.userId,
          ip: req.ip,
        });

        res.status(400).json({
          success: false,
          message: 'Invalid search parameters',
          code: 'VALIDATION_ERROR',
          errors: (error as { errors?: unknown }).errors,
        });
        return;
      }

      logger.error('Search students failed', {
        query,
        userId: req.user?.userId,
        ip: req.ip,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to search students',
        code: 'SEARCH_STUDENTS_FAILED',
      });
    }
  }),
);

// GET /api/v1/students/barcode/:barcode - Get student by barcode
router.get(
  '/barcode/:barcode',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { barcode } = req.params;

    try {
      logger.info('Get student by barcode request', {
        barcode,
        userId: req.user.userId,
        ip: req.ip,
      });

      // Validate barcode
      const barcodeData = getStudentByBarcodeSchema.parse({ barcode });

      // Find student by barcode
      const student = await prisma.students.findFirst({
        where: { barcode: barcodeData.barcode },
      });

      if (!student) {
        logger.warn('Student not found by barcode', {
          barcode,
          userId: req.user.userId,
          ip: req.ip,
        });

        res.status(404).json({
          success: false,
          message: 'No student found with this barcode',
          code: 'STUDENT_NOT_FOUND',
        });
        return;
      }

      logger.info('Student retrieved by barcode successfully', {
        barcode,
        studentId: student.id,
        userId: req.user.userId,
        ip: req.ip,
      });

      res.json({
        success: true,
        data: student,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        logger.warn('Get student by barcode failed: validation error', {
          barcode,
          userId: req.user.userId,
          ip: req.ip,
        });

        res.status(400).json({
          success: false,
          message: 'Invalid barcode format',
          code: 'VALIDATION_ERROR',
          errors: (error as { errors?: unknown }).errors,
        });
        return;
      }

      logger.error('Get student by barcode failed', {
        barcode,
        userId: req.user?.userId,
        ip: req.ip,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve student',
        code: 'GET_STUDENT_BY_BARCODE_FAILED',
      });
    }
  }),
);

// POST /api/v1/students/generate-barcode/:studentId - Generate barcode for student
router.post(
  '/generate-barcode/:studentId',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { studentId } = req.params;

    try {
      logger.info('Generate barcode request', {
        studentId,
        userId: req.user.userId,
        ip: req.ip,
      });

      // Generate barcode
      const barcode = await BarcodeService.generateBarcode();

      // Update student with barcode
      const updatedStudent = await prisma.students.update({
        where: { id: studentId },
        data: { barcode },
      });

      logger.info('Barcode generated successfully', {
        studentId,
        barcode,
        userId: req.user.userId,
        ip: req.ip,
      });

      res.json({
        success: true,
        data: updatedStudent,
        message: 'Barcode generated successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Student not found') {
        logger.warn('Generate barcode failed: student not found', {
          studentId,
          userId: req.user.userId,
          ip: req.ip,
        });

        res.status(404).json({
          success: false,
          message: 'Student not found',
          code: 'STUDENT_NOT_FOUND',
        });
        return;
      }

      logger.error('Generate barcode failed', {
        studentId,
        userId: req.user?.userId,
        ip: req.ip,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to generate barcode',
        code: 'GENERATE_BARCODE_FAILED',
      });
    }
  }),
);

// GET /api/v1/students/active-sessions - Get all currently checked-in students
router.get(
  '/active-sessions',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      logger.info('Active sessions request', {
        ip: req.ip,
      });

      const sessions = await StudentActivityService.getActiveSessions();

      logger.info('Active sessions retrieved successfully', {
        count: sessions.length,
        ip: req.ip,
      });

      res.json({
        success: true,
        data: sessions,
        count: sessions.length,
        message: 'Active sessions retrieved successfully',
      });
    } catch (error) {
      logger.error('Failed to get active sessions', {
        ip: req.ip,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve active sessions',
        code: 'GET_ACTIVE_SESSIONS_FAILED',
      });
    }
  }),
);

// POST /api/v1/students/:id/check-in - Check in a student
router.post(
  '/:id/check-in',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id: studentId } = req.params;

    try {
      logger.info('Student check-in request', {
        studentId,
        ip: req.ip,
      });

      const result = await StudentActivityService.checkInStudent(studentId);

      // Emit WebSocket event to 'attendance' channel
      websocketServer.emitStudentCheckIn({
        activityId: result.activityId,
        studentId: result.studentId,
        studentName: result.studentName,
        checkinTime: result.checkinTime,
        autoLogoutAt: result.autoLogoutAt,
        reminders: result.reminders,
        customMessage: result.customMessage,
      });

      logger.info('Student checked in successfully', {
        studentId,
        activityId: result.activityId,
        ip: req.ip,
      });

      res.json({
        success: true,
        data: result,
        message: 'Student checked in successfully',
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Student not found') {
          logger.warn('Check-in failed: student not found', {
            studentId,
            ip: req.ip,
          });

          res.status(404).json({
            success: false,
            message: 'Student not found',
            code: 'STUDENT_NOT_FOUND',
          });
          return;
        }

        if (error.message === 'Student already checked in') {
          logger.warn('Check-in failed: already checked in', {
            studentId,
            ip: req.ip,
          });

          res.status(400).json({
            success: false,
            message: 'Student already checked in',
            code: 'ALREADY_CHECKED_IN',
          });
          return;
        }
      }

      logger.error('Check-in failed', {
        studentId,
        ip: req.ip,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to check in student',
        code: 'CHECKIN_FAILED',
      });
    }
  }),
);

// POST /api/v1/students/:id/check-out - Check out a student
router.post(
  '/:id/check-out',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id: studentId } = req.params;
    const { reason = 'manual' } = req.body;

    try {
      logger.info('Student check-out request', {
        studentId,
        reason,
        ip: req.ip,
      });

      const result = await StudentActivityService.checkOutStudent(
        studentId,
        reason,
      );

      // Emit WebSocket event to 'attendance' channel
      websocketServer.emitStudentCheckOut({
        activityId: result.activityId,
        studentId: result.studentId,
        studentName: result.studentName,
        checkoutTime: result.checkoutTime,
        reason: result.reason,
        customMessage: result.customMessage,
      });

      logger.info('Student checked out successfully', {
        studentId,
        activityId: result.activityId,
        reason,
        ip: req.ip,
      });

      res.json({
        success: true,
        data: result,
        message: 'Student checked out successfully',
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'No active session found'
      ) {
        logger.warn('Check-out failed: no active session', {
          studentId,
          ip: req.ip,
        });

        res.status(404).json({
          success: false,
          message: 'No active session found for this student',
          code: 'NO_ACTIVE_SESSION',
        });
        return;
      }

      logger.error('Check-out failed', {
        studentId,
        reason,
        ip: req.ip,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to check out student',
        code: 'CHECKOUT_FAILED',
      });
    }
  }),
);

export default router;
