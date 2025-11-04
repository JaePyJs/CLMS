import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/authenticate';
import { StudentService, CreateStudentData, UpdateStudentData } from '../services/studentService';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/v1/students - List all students
router.get('/', authenticate, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('List all students request', { 
      userId: req.user!.userId,
      username: req.user!.username,
      ip: req.ip 
    });

    const students = await StudentService.listStudents();
    
    logger.info('Students list retrieved successfully', { 
      count: students.length,
      userId: req.user!.userId,
      ip: req.ip 
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
      error: error instanceof Error ? error.message : 'Unknown error' 
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve students',
      code: 'LIST_STUDENTS_FAILED',
    });
  }
}));

// GET /api/v1/students/:id - Get student by ID
router.get('/:id', authenticate, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  // Validate ID parameter
  if (!id) {
    logger.warn('Get student failed: missing student ID', {
      userId: req.user!.userId,
      ip: req.ip
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
      userId: req.user!.userId,
      username: req.user!.username,
      ip: req.ip 
    });

    const student = await StudentService.getStudentById(id);
    
    logger.info('Student retrieved successfully', { 
      studentId: id,
      student_number: student.student_id,
      userId: req.user!.userId,
      ip: req.ip 
    });

    res.json({
      success: true,
      data: student,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Student not found') {
      logger.warn('Student not found', {
        studentId: id,
        userId: req.user!.userId,
        ip: req.ip
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
      error: error instanceof Error ? error.message : 'Unknown error' 
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve student',
      code: 'GET_STUDENT_FAILED',
    });
  }
}));

// POST /api/v1/students - Create new student
router.post('/', authenticate, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentData: CreateStudentData = req.body;

  // Validate required fields
  const requiredFields = ['student_id', 'first_name', 'last_name', 'grade_level', 'grade_category'];
  const missingFields = requiredFields.filter(field => !studentData[field as keyof CreateStudentData]);
  
  if (missingFields.length > 0) {
    logger.warn('Student creation failed: missing required fields', {
      missingFields,
      userId: req.user!.userId,
      ip: req.ip
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
      userId: req.user!.userId,
      username: req.user!.username,
      ip: req.ip 
    });

    const student = await StudentService.createStudent(studentData);
    
    logger.info('Student created successfully', { 
      studentId: student.id,
      student_id: student.student_id,
      userId: req.user!.userId,
      ip: req.ip 
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
        userId: req.user!.userId,
        ip: req.ip
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
      error: error instanceof Error ? error.message : 'Unknown error' 
    });

    res.status(500).json({
      success: false,
      message: 'Failed to create student',
      code: 'CREATE_STUDENT_FAILED',
    });
  }
}));

// PUT /api/v1/students/:id - Update student
router.put('/:id', authenticate, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const updateData: UpdateStudentData = req.body;

  // Validate ID parameter
  if (!id) {
    logger.warn('Update student failed: missing student ID', {
      userId: req.user!.userId,
      ip: req.ip
    });

    res.status(400).json({
      success: false,
      message: 'Student ID is required',
      code: 'MISSING_STUDENT_ID',
    });
    return;
  }

  // Check if there's at least one field to update
  const allowedFields = ['first_name', 'last_name', 'grade_level', 'grade_category', 'section', 'max_concurrent_reservations', 'is_active', 'equipment_ban', 'equipment_ban_reason', 'equipment_ban_until', 'fine_balance'];
  const updateFields = Object.keys(updateData).filter(field => allowedFields.includes(field));
  
  if (updateFields.length === 0) {
    logger.warn('Update student failed: no valid fields to update', {
      studentId: id,
      userId: req.user!.userId,
      ip: req.ip
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
      userId: req.user!.userId,
      username: req.user!.username,
      ip: req.ip 
    });

    const student = await StudentService.updateStudent(id, updateData);
    
    logger.info('Student updated successfully', { 
      studentId: id,
      student_id: student.student_id,
      userId: req.user!.userId,
      ip: req.ip 
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
        userId: req.user!.userId,
        ip: req.ip
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
      error: error instanceof Error ? error.message : 'Unknown error' 
    });

    res.status(500).json({
      success: false,
      message: 'Failed to update student',
      code: 'UPDATE_STUDENT_FAILED',
    });
  }
}));

// DELETE /api/v1/students/:id - Delete student
router.delete('/:id', authenticate, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  // Validate ID parameter
  if (!id) {
    logger.warn('Delete student failed: missing student ID', {
      userId: req.user!.userId,
      ip: req.ip
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
      userId: req.user!.userId,
      username: req.user!.username,
      ip: req.ip 
    });

    await StudentService.deleteStudent(id);
    
    logger.info('Student deleted successfully', { 
      studentId: id,
      userId: req.user!.userId,
      ip: req.ip 
    });

    res.json({
      success: true,
      message: 'Student deleted successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Student not found') {
      logger.warn('Delete student failed: student not found', {
        studentId: id,
        userId: req.user!.userId,
        ip: req.ip
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
      error: error instanceof Error ? error.message : 'Unknown error' 
    });

    res.status(500).json({
      success: false,
      message: 'Failed to delete student',
      code: 'DELETE_STUDENT_FAILED',
    });
  }
}));

export default router;