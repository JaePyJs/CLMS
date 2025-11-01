import { Router, Request, Response } from 'express'
import { ApiResponse } from '@/types'
import {
  scanBarcode,
  processStudentCheckIn,
  processStudentCheckOut,
  processBookCheckout,
  processBookReturn,
  processEquipmentUse,
  processEquipmentRelease,
  getStudentStatus,
  getBookStatus,
  getEquipmentStatus,
  registerStudent,
  scanStudentBarcode,
  checkDuplicateScan
} from '@/services/scanService'
import { student_activities_activity_type } from '@prisma/client'
import { logger } from '@/utils/logger'

const router = Router()

// Scan barcode and identify entity
router.post('/', async (req: Request, res: Response) => {
  try {
    const { barcode } = req.body

    if (!barcode) {
      res.status(400).json({
        success: false,
        error: 'Barcode is required',
        timestamp: new Date().toISOString()
      })
      return;
    }

    const result = await scanBarcode(barcode)

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    }
    res.json(response)
  } catch (error) {
    logger.error('Error scanning barcode', { error: (error as Error).message, body: req.body })
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString()
    })
  }
})

// Process student check-in
router.post('/student/checkin', async (req: Request, res: Response) => {
  try {
    const { studentId, activityType, notes } = req.body

    if (!studentId || !activityType) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: studentId, activityType',
        timestamp: new Date().toISOString()
      })
      return;
    }

    const activity = await processStudentCheckIn(studentId, activityType as student_activities_activity_type, notes)

    const response: ApiResponse = {
      success: true,
      data: activity,
      message: 'Student check-in processed successfully',
      timestamp: new Date().toISOString()
    }
    res.status(201).json(response)
  } catch (error) {
    logger.error('Error processing student check-in', { error: (error as Error).message, body: req.body })
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString()
    })
  }
})

// Process student check-out
router.post('/student/checkout', async (req: Request, res: Response) => {
  try {
    const { studentId } = req.body

    if (!studentId) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: studentId',
        timestamp: new Date().toISOString()
      })
      return;
    }

    const activity = await processStudentCheckOut(studentId)

    const response: ApiResponse = {
      success: true,
      data: activity,
      message: 'Student check-out processed successfully',
      timestamp: new Date().toISOString()
    }
    res.json(response)
  } catch (error) {
    logger.error('Error processing student check-out', { error: (error as Error).message, body: req.body })
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString()
    })
  }
})

// Process book checkout
router.post('/book/checkout', async (req: Request, res: Response) => {
  try {
    const { bookId, studentId, dueDate, notes } = req.body

    if (!bookId || !studentId || !dueDate) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: bookId, studentId, dueDate',
        timestamp: new Date().toISOString()
      })
      return;
    }

    const checkout = await processBookCheckout(bookId, studentId, new Date(dueDate), notes)

    const response: ApiResponse = {
      success: true,
      data: checkout,
      message: 'Book checkout processed successfully',
      timestamp: new Date().toISOString()
    }
    res.status(201).json(response)
  } catch (error) {
    logger.error('Error processing book checkout', { error: (error as Error).message, body: req.body })
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString()
    })
  }
})

// Process book return
router.post('/book/return', async (req: Request, res: Response) => {
  try {
    const { checkoutId } = req.body

    if (!checkoutId) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: checkoutId',
        timestamp: new Date().toISOString()
      })
      return;
    }

    const checkout = await processBookReturn(checkoutId)

    const response: ApiResponse = {
      success: true,
      data: checkout,
      message: 'Book return processed successfully',
      timestamp: new Date().toISOString()
    }
    res.json(response)
  } catch (error) {
    logger.error('Error processing book return', { error: (error as Error).message, body: req.body })
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString()
    })
  }
})

// Process equipment use
router.post('/equipment/use', async (req: Request, res: Response) => {
  try {
    const { equipmentId, studentId, activityType, notes } = req.body

    if (!equipmentId || !studentId || !activityType) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: equipmentId, studentId, activityType',
        timestamp: new Date().toISOString()
      })
      return;
    }

    const activity = await processEquipmentUse(equipmentId, studentId, activityType as student_activities_activity_type, notes)

    const response: ApiResponse = {
      success: true,
      data: activity,
      message: 'Equipment use processed successfully',
      timestamp: new Date().toISOString()
    }
    res.status(201).json(response)
  } catch (error) {
    logger.error('Error processing equipment use', { error: (error as Error).message, body: req.body })
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString()
    })
  }
})

// Process equipment release
router.post('/equipment/release', async (req: Request, res: Response) => {
  try {
    const { activityId } = req.body

    if (!activityId) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: activityId',
        timestamp: new Date().toISOString()
      })
      return;
    }

    const activity = await processEquipmentRelease(activityId)

    const response: ApiResponse = {
      success: true,
      data: activity,
      message: 'Equipment release processed successfully',
      timestamp: new Date().toISOString()
    }
    res.json(response)
  } catch (error) {
    logger.error('Error processing equipment release', { error: (error as Error).message, body: req.body })
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString()
    })
  }
})

// Get student status
router.get('/status/student/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Student ID is required',
        timestamp: new Date().toISOString()
      })
      return;
    }

    const status = await getStudentStatus(id)

    const response: ApiResponse = {
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    }
    res.json(response)
  } catch (error) {
    logger.error('Error getting student status', { error: (error as Error).message, id: req.params.id })
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString()
    })
  }
})

// Get book status
router.get('/status/book/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Book ID is required',
        timestamp: new Date().toISOString()
      })
      return;
    }

    const status = await getBookStatus(id)

    const response: ApiResponse = {
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    }
    res.json(response)
  } catch (error) {
    logger.error('Error getting book status', { error: (error as Error).message, id: req.params.id })
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString()
    })
  }
})

// Get equipment status
router.get('/status/equipment/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Equipment ID is required',
        timestamp: new Date().toISOString()
      })
      return;
    }

    const status = await getEquipmentStatus(id)

    const response: ApiResponse = {
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    }
    res.json(response)
  } catch (error) {
    logger.error('Error getting equipment status', { error: (error as Error).message, id: req.params.id })
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString()
    })
  }
})

// Register new student
router.post('/student/register', async (req: Request, res: Response) => {
  try {
    const { studentId, firstName, lastName, gradeLevel, gradeCategory, section } = req.body

    if (!studentId || !firstName || !lastName || !gradeLevel || !gradeCategory) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: studentId, firstName, lastName, gradeLevel, gradeCategory',
        timestamp: new Date().toISOString()
      })
      return;
    }

    const student = await registerStudent({
      studentId,
      firstName,
      lastName,
      gradeLevel,
      gradeCategory,
      section
    })

    const response: ApiResponse = {
      success: true,
      data: student,
      message: 'Student registered successfully',
      timestamp: new Date().toISOString()
    }
    res.status(201).json(response)
  } catch (error) {
    logger.error('Error registering student', { error: (error as Error).message, body: req.body })
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString()
    })
  }
})

// Enhanced student barcode scan with registration and duplicate detection
router.post('/student/scan', async (req: Request, res: Response) => {
  try {
    const { studentId } = req.body

    if (!studentId) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: studentId',
        timestamp: new Date().toISOString()
      })
      return;
    }

    const result = await scanStudentBarcode(studentId)

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    }
    res.json(response)
  } catch (error) {
    logger.error('Error scanning student barcode', { error: (error as Error).message, body: req.body })
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString()
    })
  }
})

// Check for duplicate scan
router.get('/student/:studentId/duplicate-check', async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params

    if (!studentId) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: studentId',
        timestamp: new Date().toISOString()
      })
      return;
    }

    const isDuplicate = await checkDuplicateScan(studentId)

    const response: ApiResponse = {
      success: true,
      data: { isDuplicate },
      timestamp: new Date().toISOString()
    }
    res.json(response)
  } catch (error) {
    logger.error('Error checking duplicate scan', { error: (error as Error).message, studentId: req.params.studentId })
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString()
    })
  }
})

// Self-service check-in (automatically handles registration if needed)
router.post('/student/self-checkin', async (req: Request, res: Response) => {
  try {
    const { studentId, firstName, lastName, gradeLevel, gradeCategory, section } = req.body

    if (!studentId) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: studentId',
        timestamp: new Date().toISOString()
      })
      return;
    }

    // First scan the student to check if they need registration
    const scanResult = await scanStudentBarcode(studentId)

    if (scanResult.data.requiresRegistration) {
      // Register the student first
      if (!firstName || !lastName || !gradeLevel || !gradeCategory) {
        res.status(400).json({
          success: false,
          error: 'Student not found and missing registration data. Please provide: firstName, lastName, gradeLevel, gradeCategory',
          timestamp: new Date().toISOString()
        })
        return;
      }

      await registerStudent({
        studentId,
        firstName,
        lastName,
        gradeLevel,
        gradeCategory,
        section
      })
    }

    // Now process the check-in
    const activity = await processStudentCheckIn(studentId, student_activities_activity_type.GENERAL_VISIT)

    const response: ApiResponse = {
      success: true,
      data: {
        activity,
        wasRegistered: scanResult.data.requiresRegistration,
        isDuplicate: scanResult.data.isDuplicate
      },
      message: scanResult.data.requiresRegistration
        ? 'Student registered and checked in successfully'
        : 'Student checked in successfully',
      timestamp: new Date().toISOString()
    }
    res.status(201).json(response)
  } catch (error) {
    logger.error('Error in self-service check-in', { error: (error as Error).message, body: req.body })
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString()
    })
  }
})

// Self-service check-out
router.post('/student/self-checkout', async (req: Request, res: Response) => {
  try {
    const { studentId } = req.body

    if (!studentId) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: studentId',
        timestamp: new Date().toISOString()
      })
      return;
    }

    const activity = await processStudentCheckOut(studentId)

    const response: ApiResponse = {
      success: true,
      data: activity,
      message: 'Student checked out successfully',
      timestamp: new Date().toISOString()
    }
    res.json(response)
  } catch (error) {
    logger.error('Error in self-service check-out', { error: (error as Error).message, body: req.body })
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString()
    })
  }
})

export default router