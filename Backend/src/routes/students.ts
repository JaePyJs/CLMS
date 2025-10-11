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
import { GradeCategory, ActivityType, ActivityStatus } from '@prisma/client';
import { logger } from '@/utils/logger';

const router = Router();

// Get all students
router.get('/', async (req: Request, res: Response) => {
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
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Student ID is required',
        timestamp: new Date().toISOString(),
      });
    }

    const student = await getStudentByBarcode(id);

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found',
        timestamp: new Date().toISOString(),
      });
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
router.post('/', async (req: Request, res: Response) => {
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
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        timestamp: new Date().toISOString(),
      });
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
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Student ID is required',
        timestamp: new Date().toISOString(),
      });
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
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Student ID is required',
        timestamp: new Date().toISOString(),
      });
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
router.get('/activities/all', async (req: Request, res: Response) => {
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
      options.activityType = activityType as ActivityType;
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
router.get('/activities/active', async (req: Request, res: Response) => {
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
router.post('/activities', async (req: Request, res: Response) => {
  try {
    const { studentId, activityType, equipmentId, timeLimitMinutes, notes } =
      req.body;

    if (!studentId || !activityType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: studentId, activityType',
        timestamp: new Date().toISOString(),
      });
    }

    const activity = await createStudentActivity({
      studentId,
      activityType,
      equipmentId,
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
router.patch('/activities/:id/end', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Activity ID is required',
        timestamp: new Date().toISOString(),
      });
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

    const student = await getStudentByBarcode(barcode);

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found',
        timestamp: new Date().toISOString(),
      });
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
