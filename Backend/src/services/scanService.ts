import {
  getStudentByBarcode,
  getActiveSessions,
  createStudentActivity,
  endStudentActivity,
  createStudent
} from './studentService'
import {
  getBookByAccessionNo,
  getBookByIsbn,
  getBookById,
  checkoutBook,
  returnBook,
  getBookCheckouts
} from './bookService'
import {
  getEquipmentByEquipmentId,
  getEquipmentById,
  useEquipment,
  releaseEquipment
} from './equipmentService'
import { logger } from '@/utils/logger'
import { ActivityType, ActivityStatus, CheckoutStatus, GradeCategory } from '@prisma/client'
import { prisma } from '@/utils/prisma'

// Scan result interface
export interface ScanResult {
  type: 'student' | 'book' | 'equipment' | 'unknown'
  data: any
  message: string
  timestamp: string
  requiresRegistration?: boolean
  isDuplicate?: boolean
  canCheckOut?: boolean
}

// Student registration interface
export interface StudentRegistrationData {
  studentId: string
  firstName: string
  lastName: string
  gradeLevel: string
  gradeCategory: GradeCategory
  section?: string
}

// Enhanced scan result for students
export interface StudentScanResult extends ScanResult {
  type: 'student'
  data: {
    student?: any
    requiresRegistration?: boolean
    isDuplicate?: boolean
    canCheckOut?: boolean
    lastActivity?: any
  }
}

// Register new student
export async function registerStudent(registrationData: StudentRegistrationData) {
  try {
    const student = await createStudent(registrationData)

    logger.info('Student registered successfully', {
      studentId: student.studentId,
      name: `${student.firstName} ${student.lastName}`
    })

    return student
  } catch (error) {
    logger.error('Error registering student', {
      error: (error as Error).message,
      registrationData
    })
    throw error
  }
}

// Check for duplicate scans within 30 minutes
export async function checkDuplicateScan(studentId: string): Promise<boolean> {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)

    // Check for recent GENERAL_VISIT activities (check-ins) within 30 minutes
    const recentActivities = await prisma.activity.findMany({
      where: {
        studentId,
        activityType: ActivityType.GENERAL_VISIT,
        startTime: {
          gte: thirtyMinutesAgo
        },
        status: ActivityStatus.ACTIVE
      }
    })

    return recentActivities.length > 0
  } catch (error) {
    logger.error('Error checking duplicate scan', {
      error: (error as Error).message,
      studentId
    })
    return false
  }
}

// Enhanced student scan with registration and duplicate detection
export async function scanStudentBarcode(studentId: string): Promise<StudentScanResult> {
  try {
    // Check if student exists
    const student = await getStudentByBarcode(studentId)

    if (!student) {
      return {
        type: 'student',
        data: {
          requiresRegistration: true,
          student: null
        },
        message: 'Student not found. Registration required.',
        timestamp: new Date().toISOString(),
        requiresRegistration: true
      }
    }

    // Check for duplicate scan within 30 minutes
    const isDuplicate = await checkDuplicateScan(studentId)

    if (isDuplicate) {
      return {
        type: 'student',
        data: {
          student,
          isDuplicate: true,
          canCheckOut: true // Allow checkout even for duplicates
        },
        message: 'Duplicate scan detected within 30 minutes. You can check out if needed.',
        timestamp: new Date().toISOString(),
        isDuplicate: true,
        canCheckOut: true
      }
    }

    // Check if student has active session
    const hasActiveSession = student.hasActiveSession

    return {
      type: 'student',
      data: {
        student,
        isDuplicate: false,
        canCheckOut: hasActiveSession
      },
      message: hasActiveSession
        ? 'Student found with active session. Ready for check-out.'
        : 'Student found. Ready for check-in.',
      timestamp: new Date().toISOString(),
      canCheckOut: hasActiveSession
    }
  } catch (error) {
    logger.error('Error scanning student barcode', {
      error: (error as Error).message,
      studentId
    })
    return {
      type: 'student',
      data: {
        student: null,
        requiresRegistration: false,
        isDuplicate: false,
        canCheckOut: false
      },
      message: 'Error scanning student barcode',
      timestamp: new Date().toISOString()
    }
  }
}

// Scan barcode and identify the entity (enhanced version)
export async function scanBarcode(barcode: string): Promise<ScanResult> {
  try {
    // Try to identify as student first (student IDs are typically numeric)
    if (/^\d+$/.test(barcode)) {
      return await scanStudentBarcode(barcode)
    }

    // Try to identify as book by accession number
    const bookByAccession = await getBookByAccessionNo(barcode)
    if (bookByAccession) {
      return {
        type: 'book',
        data: bookByAccession,
        message: 'Book found successfully',
        timestamp: new Date().toISOString()
      }
    }

    // Try to identify as book by ISBN
    const bookByIsbn = await getBookByIsbn(barcode)
    if (bookByIsbn) {
      return {
        type: 'book',
        data: bookByIsbn,
        message: 'Book found successfully',
        timestamp: new Date().toISOString()
      }
    }

    // Try to identify as equipment
    const equipment = await getEquipmentByEquipmentId(barcode)
    if (equipment) {
      return {
        type: 'equipment',
        data: equipment,
        message: 'Equipment found successfully',
        timestamp: new Date().toISOString()
      }
    }

    // If nothing matches, return unknown
    return {
      type: 'unknown',
      data: null,
      message: 'No matching entity found for this barcode',
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    logger.error('Error scanning barcode', { error: (error as Error).message, barcode })
    return {
      type: 'unknown',
      data: null,
      message: 'Error scanning barcode',
      timestamp: new Date().toISOString()
    }
  }
}

// Process student check-in
export async function processStudentCheckIn(studentId: string, activityType: ActivityType, notes?: string) {
  try {
    // Check if student has an active session
    const activeSessions = await getActiveSessions()
    const existingSession = activeSessions.find(session => session.student.studentId === studentId)

    if (existingSession) {
      // End the existing session
      await endStudentActivity(existingSession.id)
      logger.info('Student check-out processed', { studentId, activityId: existingSession.id })
    }

    // Create new activity
    const activityData: any = {
      studentId,
      activityType
    }
    
    if (notes) {
      activityData.notes = notes
    }
    
    const activity = await createStudentActivity(activityData)

    logger.info('Student check-in processed', { studentId, activityId: activity.id })
    return activity
  } catch (error) {
    logger.error('Error processing student check-in', { error: (error as Error).message, studentId, activityType })
    throw error
  }
}

// Process student check-out
export async function processStudentCheckOut(studentId: string) {
  try {
    // Check if student has an active session
    const activeSessions = await getActiveSessions()
    const existingSession = activeSessions.find(session => session.student.studentId === studentId)

    if (!existingSession) {
      throw new Error('No active session found for this student')
    }

    // End the existing session
    const activity = await endStudentActivity(existingSession.id)
    logger.info('Student check-out processed', { studentId, activityId: activity.id })
    return activity
  } catch (error) {
    logger.error('Error processing student check-out', { error: (error as Error).message, studentId })
    throw error
  }
}

// Process book checkout
export async function processBookCheckout(bookId: string, studentId: string, dueDate: Date, notes?: string) {
  try {
    // Check if student has already checked out this book
    const activeCheckouts = await getBookCheckouts({
      bookId,
      studentId,
      status: CheckoutStatus.ACTIVE
    })

    if (activeCheckouts.checkouts.length > 0) {
      throw new Error('Student has already checked out this book')
    }

    // Process checkout
    const checkoutData: any = {
      bookId,
      studentId,
      dueDate
    }
    
    if (notes) {
      checkoutData.notes = notes
    }
    
    const checkout = await checkoutBook(checkoutData)

    logger.info('Book checkout processed', { bookId, studentId, checkoutId: checkout.id })
    return checkout
  } catch (error) {
    logger.error('Error processing book checkout', { error: (error as Error).message, bookId, studentId })
    throw error
  }
}

// Process book return
export async function processBookReturn(checkoutId: string) {
  try {
    // Process return
    const checkout = await returnBook(checkoutId)
    logger.info('Book return processed', { checkoutId })
    return checkout
  } catch (error) {
    logger.error('Error processing book return', { error: (error as Error).message, checkoutId })
    throw error
  }
}

// Process equipment use
export async function processEquipmentUse(equipmentId: string, studentId: string, activityType: ActivityType, notes?: string) {
  try {
    // Process equipment use
    const activityData: any = {
      equipmentId,
      studentId,
      activityType
    }
    
    if (notes) {
      activityData.notes = notes
    }
    
    const activity = await useEquipment(activityData)

    logger.info('Equipment use processed', { equipmentId, studentId, activityId: activity.id })
    return activity
  } catch (error) {
    logger.error('Error processing equipment use', { error: (error as Error).message, equipmentId, studentId })
    throw error
  }
}

// Process equipment release
export async function processEquipmentRelease(activityId: string) {
  try {
    // Process equipment release
    const activity = await releaseEquipment(activityId)
    logger.info('Equipment release processed', { activityId })
    return activity
  } catch (error) {
    logger.error('Error processing equipment release', { error: (error as Error).message, activityId })
    throw error
  }
}

// Get student status (active sessions, checked out books, etc.)
export async function getStudentStatus(studentId: string) {
  try {
    const student = await getStudentByBarcode(studentId)
    if (!student) {
      throw new Error('Student not found')
    }

    // Get active sessions
    const activeSessions = await getActiveSessions()
    const studentActiveSession = activeSessions.find(session => session.student.studentId === studentId)

    // Get active book checkouts
    const activeCheckouts = await getBookCheckouts({
      studentId,
      status: CheckoutStatus.ACTIVE
    })

    // Get equipment usage
    const equipmentUsage = await getBookCheckouts({
      studentId,
      status: ActivityStatus.ACTIVE
    })

    return {
      student,
      hasActiveSession: !!studentActiveSession,
      activeSession: studentActiveSession || null,
      activeBookCheckouts: activeCheckouts.checkouts.length,
      activeBookCheckoutsData: activeCheckouts.checkouts,
      equipmentUsage: equipmentUsage.checkouts.length,
      equipmentUsageData: equipmentUsage.checkouts
    }
  } catch (error) {
    logger.error('Error getting student status', { error: (error as Error).message, studentId })
    throw error
  }
}

// Get book status (availability, active checkout, etc.)
export async function getBookStatus(bookId: string) {
  try {
    const book = await getBookById(bookId)
    if (!book) {
      throw new Error('Book not found')
    }

    // Get active checkout
    const activeCheckouts = await getBookCheckouts({
      bookId,
      status: CheckoutStatus.ACTIVE
    })

    return {
      book,
      isAvailable: book.availableCopies > 0,
      activeCheckout: activeCheckouts.checkouts.length > 0 ? activeCheckouts.checkouts[0] : null
    }
  } catch (error) {
    logger.error('Error getting book status', { error: (error as Error).message, bookId })
    throw error
  }
}

// Get equipment status (availability, active session, etc.)
export async function getEquipmentStatus(equipmentId: string) {
  try {
    const equipment = await getEquipmentById(equipmentId)
    if (!equipment) {
      throw new Error('Equipment not found')
    }

    // Get active session
    const activeSessions = await getActiveSessions()
    const equipmentActiveSession = activeSessions.find(session => 
      session.equipment && session.equipment.equipmentId === equipment.equipmentId
    )

    return {
      equipment,
      isAvailable: equipment.status === 'AVAILABLE',
      activeSession: equipmentActiveSession || null
    }
  } catch (error) {
    logger.error('Error getting equipment status', { error: (error as Error).message, equipmentId })
    throw error
  }
}