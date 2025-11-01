import { Router, Request, Response } from 'express';
import { ApiResponse } from '@/types';
import {
  type GetStudentActivitiesOptions,
  type GetStudentsOptions,
  getStudentByBarcode,
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentActivities,
  getActiveSessions,
  createStudentActivity,
  endStudentActivity,
} from '@/services/studentService';
import { GradeCategory, student_activities_activity_type, ActivityStatus } from '@prisma/client';
import { logger } from '@/utils/logger';
import { requirePermission } from '@/middleware/authorization.middleware';
import { Permission } from '@/config/permissions';
import { auditMiddleware, ferpaAccessCheck, parentalConsentCheck } from '@/middleware/ferpa.middleware';

const router = Router();

// Get all students
router.get('/', 
  auditMiddleware('LIST_STUDENTS'),
  ferpaAccessCheck('READ'),
  requirePermission(Permission.STUDENTS_VIEW), 
  async (req: Request, res: Response) => {
  try {
    const { gradeCategory, isActive, page = '1', limit = '50' } = req.query;

    const options: GetStudentsOptions = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    if (gradeCategory) {
      options.gradeCategory = gradeCategory as GradeCategory;
    }

    if (isActive !== undefined) {
      options.isActive = isActive === 'true';
    }

    const result = await getStudents(options);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error fetching students', {
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

// Get student by ID
router.get('/:id', 
  auditMiddleware('READ_STUDENT_DATA'),
  ferpaAccessCheck('READ'),
  parentalConsentCheck,
  requirePermission(Permission.STUDENTS_VIEW), 
  async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Student ID is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const student = await getStudentByBarcode(id);

    if (!student) {
      res.status(404).json({
        success: false,
        error: 'Student not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const response: ApiResponse = {
      success: true,
      data: student,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error fetching student', {
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

// Create new student
router.post('/', 
  auditMiddleware('CREATE_STUDENT'),
  ferpaAccessCheck('WRITE'),
  requirePermission(Permission.STUDENTS_CREATE), 
  async (req: Request, res: Response) => {
  try {
    const {
      studentId,
      firstName,
      lastName,
      gradeLevel,
      gradeCategory,
      section,
    } = req.body;

    if (
      !studentId ||
      !firstName ||
      !lastName ||
      !gradeLevel ||
      !gradeCategory
    ) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const student = await createStudent({
      studentId,
      firstName,
      lastName,
      gradeLevel,
      gradeCategory,
      section,
    });

    const response: ApiResponse = {
      success: true,
      data: student,
      message: 'Student created successfully',
      timestamp: new Date().toISOString(),
    };
    res.status(201).json(response);
  } catch (error) {
    logger.error('Error creating student', {
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

// Update student
router.put('/:id', 
  auditMiddleware('UPDATE_STUDENT'),
  ferpaAccessCheck('WRITE'),
  requirePermission(Permission.STUDENTS_UPDATE), 
  async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Student ID is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const {
      firstName,
      lastName,
      gradeLevel,
      gradeCategory,
      section,
      isActive,
    } = req.body;

    const student = await updateStudent(id, {
      firstName,
      lastName,
      gradeLevel,
      gradeCategory,
      section,
      isActive,
    });

    const response: ApiResponse = {
      success: true,
      data: student,
      message: 'Student updated successfully',
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error updating student', {
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

// Delete student
router.delete('/:id', 
  auditMiddleware('DELETE_STUDENT'),
  ferpaAccessCheck('DELETE'),
  requirePermission(Permission.STUDENTS_DELETE), 
  async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Student ID is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await deleteStudent(id);

    const response: ApiResponse = {
      success: true,
      message: 'Student deleted successfully',
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error deleting student', {
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

// Get student activities
router.get('/activities/all', 
  auditMiddleware('READ_STUDENT_ACTIVITIES'),
  ferpaAccessCheck('READ'),
  requirePermission(Permission.ACTIVITIES_VIEW), 
  async (req: Request, res: Response) => {
  try {
    const {
      studentId,
      startDate,
      endDate,
      activityType,
      status,
      page = '1',
      limit = '50',
    } = req.query;

    const options: GetStudentActivitiesOptions = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    if (studentId) {
      options.studentId = studentId as string;
    }

    if (startDate) {
      options.startDate = new Date(startDate as string);
    }

    if (endDate) {
      options.endDate = new Date(endDate as string);
    }

    if (activityType) {
      options.activityType = activityType as student_activities_activity_type;
    }

    if (status) {
      options.status = status as ActivityStatus;
    }

    const result = await getStudentActivities(options);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error fetching student activities', {
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

// Get active sessions
router.get('/activities/active', 
  auditMiddleware('LIST_ACTIVE_SESSIONS'),
  requirePermission(Permission.ACTIVITIES_VIEW), 
  async (req: Request, res: Response) => {
  try {
    const activities = await getActiveSessions();

    const response: ApiResponse = {
      success: true,
      data: activities,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error fetching active sessions', {
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

// Create student activity
router.post('/activities', 
  auditMiddleware('CREATE_STUDENT_ACTIVITY'),
  requirePermission(Permission.ACTIVITIES_CREATE), 
  async (req: Request, res: Response) => {
  try {
    const { studentId, activityType, equipmentId, timeLimitMinutes, notes } =
      req.body;

    if (!studentId || !activityType) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: studentId, activityType',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const activity = await createStudentActivity({
      student_id: studentId,
      activity_type: activityType,
      equipment_id: equipmentId,
      timeLimitMinutes,
      notes,
    });

    const response: ApiResponse = {
      success: true,
      data: activity,
      message: 'Student activity created successfully',
      timestamp: new Date().toISOString(),
    };
    res.status(201).json(response);
  } catch (error) {
    logger.error('Error creating student activity', {
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

// End student activity
router.patch('/activities/:id/end', 
  auditMiddleware('END_STUDENT_ACTIVITY'),
  requirePermission(Permission.ACTIVITIES_UPDATE), 
  async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Activity ID is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const activity = await endStudentActivity(id);

    const response: ApiResponse = {
      success: true,
      data: activity,
      message: 'Student activity ended successfully',
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error ending student activity', {
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

// Scan student barcode
router.post('/scan', 
  auditMiddleware('SCAN_STUDENT_BARCODE'),
  ferpaAccessCheck('READ'),
  requirePermission(Permission.STUDENTS_VIEW), 
  async (req: Request, res: Response) => {
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

    const student = await getStudentByBarcode(barcode);

    if (!student) {
      res.status(404).json({
        success: false,
        error: 'Student not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const response: ApiResponse = {
      success: true,
      message: 'Student found successfully',
      data: student,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Error scanning student barcode', {
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

export default router;
