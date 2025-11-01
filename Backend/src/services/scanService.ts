import {
  getStudentByBarcode,
  getActiveSessions,
  createStudentActivity,
  endStudentActivity,
  createStudent,
} from './studentService';
import {
  getBookByAccessionNo,
  getBookByIsbn,
  getBookById,
  checkoutBook,
  returnBook,
  getBookCheckouts,
} from './bookService';
import {
  getEquipmentByEquipmentId,
  getEquipmentById,
  getEquipmentUsageHistory,
  useEquipment,
  releaseEquipment,
} from './equipmentService';
import { logger } from '@/utils/logger';
import { createServiceErrorHandler, ErrorPatterns } from '@/utils/errorHandler';

// Create service-specific error handler
const errorHandler = createServiceErrorHandler('scanService');
import {
  student_activities_activity_type,
  student_activities_status,
  book_checkouts_status,
  students_grade_category,
} from '@prisma/client';
import { prisma } from '@/utils/prisma';

type StudentDetails = Awaited<ReturnType<typeof getStudentByBarcode>>;
export interface ScanResult<T = unknown> {
  type: 'student' | 'book' | 'equipment' | 'unknown';
  data: T;
  message: string;
  timestamp: string;
  requiresRegistration?: boolean;
  isDuplicate?: boolean;
  canCheckOut?: boolean;
}

// Student registration interface
export interface StudentRegistrationData {
  student_id: string;
  first_name: string;
  last_name: string;
  grade_level: string;
  grade_category: students_grade_category;
  section?: string;
}

export interface StudentScanData {
  student: StudentDetails | null;
  requiresRegistration?: boolean;
  isDuplicate?: boolean;
  canCheckOut?: boolean;
  lastActivity?: unknown;
}

// Enhanced scan result for students
export interface StudentScanResult extends ScanResult<StudentScanData> {
  type: 'student';
}

// Register new student
export async function registerStudent(
  registrationData: StudentRegistrationData,
) {
  try {
    const student = await createStudent(registrationData);

    logger.info('Student registered successfully', {
      student_id: student.student_id,
      name: `${student.first_name} ${student.last_name}`,
    });

    return student;
  } catch (error) {
    errorHandler.handleDatabaseError(error, 'registerStudent', {
      registrationData,
    });
    throw error;
  }
}

// Check for duplicate scans within 30 minutes
export async function checkDuplicateScan(student_id: string): Promise<boolean> {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    // Check for recent GENERAL_VISIT activities (check-ins) within 30 minutes
    const recentActivities = await prisma.student_activities.findMany({
      where: {
        student_id,
        activity_type: student_activities_activity_type.GENERAL_VISIT,
        start_time: {
          gte: thirtyMinutesAgo,
        },
        status: student_activities_status.ACTIVE,
      },
    });

    return recentActivities.length > 0;
  } catch (error) {
    return ErrorPatterns.duplicateCheck(error, 'checkDuplicateScan', {
      student_id,
    });
  }
}

// Enhanced student scan with registration and duplicate detection
export async function scanStudentBarcode(
  student_id: string,
): Promise<StudentScanResult> {
  try {
    // Check if student exists
    const student = await getStudentByBarcode(student_id);

    if (!student) {
      return {
        type: 'student',
        data: {
          requiresRegistration: true,
          student: null,
        },
        message: 'Student not found. Registration required.',
        timestamp: new Date().toISOString(),
        requiresRegistration: true,
      };
    }

    // Check for duplicate scan within 30 minutes
    const isDuplicate = await checkDuplicateScan(student_id);

    if (isDuplicate) {
      return {
        type: 'student',
        data: {
          student,
          isDuplicate: true,
          canCheckOut: true, // Allow checkout even for duplicates
        },
        message:
          'Duplicate scan detected within 30 minutes. You can check out if needed.',
        timestamp: new Date().toISOString(),
        isDuplicate: true,
        canCheckOut: true,
      };
    }

    // Check if student has active session
    const hasActiveSession = student.hasActiveSession;

    return {
      type: 'student',
      data: {
        student,
        isDuplicate: false,
        canCheckOut: hasActiveSession,
      },
      message: hasActiveSession
        ? 'Student found with active session. Ready for check-out.'
        : 'Student found. Ready for check-in.',
      timestamp: new Date().toISOString(),
      canCheckOut: hasActiveSession,
    };
  } catch (error) {
    errorHandler.handleBusinessError(error, 'scanStudentBarcode', {
      student_id,
    });
    return {
      type: 'student',
      data: {
        student: null,
        requiresRegistration: false,
        isDuplicate: false,
        canCheckOut: false,
      },
      message: 'Error scanning student barcode',
      timestamp: new Date().toISOString(),
    };
  }
}

// Scan barcode and identify the entity (enhanced version)
export async function scanBarcode(barcode: string): Promise<ScanResult> {
  try {
    // Try to identify as student first (student IDs are typically numeric)
    if (/^\d+$/.test(barcode)) {
      return await scanStudentBarcode(barcode);
    }

    // Try to identify as book by accession number
    const bookByAccession = await getBookByAccessionNo(barcode);
    if (bookByAccession) {
      return {
        type: 'book',
        data: bookByAccession,
        message: 'Book found successfully',
        timestamp: new Date().toISOString(),
      };
    }

    // Try to identify as book by ISBN
    const bookByIsbn = await getBookByIsbn(barcode);
    if (bookByIsbn) {
      return {
        type: 'book',
        data: bookByIsbn,
        message: 'Book found successfully',
        timestamp: new Date().toISOString(),
      };
    }

    // Try to identify as equipment
    const equipment = await getEquipmentByEquipmentId(barcode);
    if (equipment) {
      return {
        type: 'equipment',
        data: equipment,
        message: 'Equipment found successfully',
        timestamp: new Date().toISOString(),
      };
    }

    // If nothing matches, return unknown
    return {
      type: 'unknown',
      data: null,
      message: 'No matching entity found for this barcode',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    errorHandler.handleBusinessError(error, 'scanBarcode', { barcode });
    return {
      type: 'unknown',
      data: null,
      message: 'Error scanning barcode',
      timestamp: new Date().toISOString(),
    };
  }
}

// Process student check-in
export async function processStudentCheckIn(
  student_id: string,
  activity_type: student_activities_activity_type,
  notes?: string,
) {
  try {
    const studentRecord = await getStudentByBarcode(student_id);

    if (!studentRecord) {
      throw new Error('Student not found');
    }

    // Check if student has an active session
    const activeSessions = await getActiveSessions();
    const existingSession = activeSessions.find(
      session => session.student_id === studentRecord.id,
    );

    if (existingSession) {
      // End the existing session
      await endStudentActivity(existingSession.id);
      logger.info('Student check-out processed', {
        student_id,
        activityId: existingSession.id,
      });
    }

    // Create new activity
    const activityData: Parameters<typeof createStudentActivity>[0] = {
      student_id,
      activity_type,
    };

    if (notes) {
      activityData.notes = notes;
    }

    const activity = await createStudentActivity(activityData);

    logger.info('Student check-in processed', {
      student_id,
      activityId: activity.id,
    });
    return activity;
  } catch (error) {
    errorHandler.handleDatabaseError(error, 'processStudentCheckIn', {
      student_id,
      activity_type,
    });
    throw error;
  }
}

// Process student check-out
export async function processStudentCheckOut(student_id: string) {
  try {
    const studentRecord = await getStudentByBarcode(student_id);

    if (!studentRecord) {
      throw new Error('Student not found');
    }

    // Check if student has an active session
    const activeSessions = await getActiveSessions();
    const existingSession = activeSessions.find(
      session => session.student_id === studentRecord.id,
    );

    if (!existingSession) {
      throw new Error('No active session found for this student');
    }

    // End the existing session
    const activity = await endStudentActivity(existingSession.id);
    logger.info('Student check-out processed', {
      student_id,
      activityId: activity.id,
    });
    return activity;
  } catch (error) {
    errorHandler.handleDatabaseError(error, 'processStudentCheckOut', {
      student_id,
    });
    throw error;
  }
}

// Process book checkout
export async function processBookCheckout(
  book_id: string,
  student_id: string,
  due_date: Date,
  notes?: string,
) {
  try {
    // Check if student has already checked out this book
    const existingCheckouts = await getBookCheckouts({
      book_id,
      student_id,
    });

    const hasActiveCheckout = existingCheckouts.checkouts.some(
      checkout => checkout.status === book_checkouts_status.ACTIVE,
    );

    if (hasActiveCheckout) {
      throw new Error('Student has already checked out this book');
    }

    // Process checkout
    const checkoutData: Parameters<typeof checkoutBook>[0] = {
      book_id,
      student_id,
      due_date,
    };

    if (notes) {
      checkoutData.notes = notes;
    }

    const checkout = await checkoutBook(checkoutData);

    logger.info('Book checkout processed', {
      book_id,
      student_id,
      checkout_id: checkout.id,
    });
    return checkout;
  } catch (error) {
    errorHandler.handleDatabaseError(error, 'processBookCheckout', {
      book_id,
      student_id,
    });
    throw error;
  }
}

// Process book return
export async function processBookReturn(checkout_id: string) {
  try {
    // Process return
    const checkout = await returnBook(checkout_id);
    logger.info('Book return processed', { checkout_id });
    return checkout;
  } catch (error) {
    errorHandler.handleDatabaseError(error, 'processBookReturn', {
      checkout_id,
    });
    throw error;
  }
}

// Process equipment use
export async function processEquipmentUse(
  equipment_id: string,
  student_id: string,
  activity_type: student_activities_activity_type,
  notes?: string,
) {
  try {
    // Process equipment use
    const activityData: Parameters<typeof useEquipment>[0] = {
      equipment_id,
      student_id,
      activity_type,
    };

    if (notes) {
      activityData.notes = notes;
    }

    const activity = await useEquipment(activityData);

    logger.info('Equipment use processed', {
      equipment_id,
      student_id,
      activityId: activity.id,
    });
    return activity;
  } catch (error) {
    errorHandler.handleDatabaseError(error, 'processEquipmentUse', {
      equipment_id,
      student_id,
    });
    throw error;
  }
}

// Process equipment release
export async function processEquipmentRelease(activityId: string) {
  try {
    // Process equipment release
    const activity = await releaseEquipment(activityId);
    logger.info('Equipment release processed', { activityId });
    return activity;
  } catch (error) {
    errorHandler.handleDatabaseError(error, 'processEquipmentRelease', {
      activityId,
    });
    throw error;
  }
}

// Get student status (active sessions, checked out books, etc.)
export async function getStudentStatus(student_id: string) {
  try {
    const student = await getStudentByBarcode(student_id);
    if (!student) {
      throw new Error('Student not found');
    }

    const studentInternalId = student.id;

    // Get active sessions
    const activeSessions = await getActiveSessions();
    const studentActiveSession = activeSessions.find(
      session => session.student_id === studentInternalId,
    );

    // Get active book checkouts
    const studentCheckouts = await getBookCheckouts({
      student_id: studentInternalId,
    });

    const activeCheckouts = studentCheckouts.checkouts.filter(
      checkout => checkout.status === book_checkouts_status.ACTIVE,
    );

    // Get equipment usage
    const equipmentUsageHistory = await getEquipmentUsageHistory({
      student_id: studentInternalId,
    });

    const activeEquipmentUsage = equipmentUsageHistory.activities.filter(
      activity => activity.status === student_activities_status.ACTIVE,
    );

    return {
      student: {
        ...student,
        hasActiveSession: !!studentActiveSession,
      },
      activeSession: studentActiveSession || null,
      activeBookCheckouts: activeCheckouts.length,
      activeBookCheckoutsData: activeCheckouts,
      equipmentUsage: activeEquipmentUsage.length,
      equipmentUsageData: activeEquipmentUsage,
    };
  } catch (error) {
    errorHandler.handleDatabaseError(error, 'getStudentStatus', { student_id });
    throw error;
  }
}

// Get book status (availability, active checkout, etc.)
export async function getBookStatus(book_id: string) {
  try {
    const book = await getBookById(book_id);
    if (!book) {
      throw new Error('Book not found');
    }

    // Get active checkout
    const bookCheckouts = await getBookCheckouts({
      book_id,
    });

    const activeCheckouts = bookCheckouts.checkouts.filter(
      checkout => checkout.status === book_checkouts_status.ACTIVE,
    );

    return {
      book,
      isAvailable: book.available_copies > 0,
      activeCheckout: activeCheckouts.length > 0 ? activeCheckouts[0] : null,
    };
  } catch (error) {
    logger.error('Error getting book status', {
      error: (error as Error).message,
      book_id,
    });
    throw error;
  }
}

// Get equipment status (availability, active session, etc.)
export async function getEquipmentStatus(equipment_id: string) {
  try {
    const equipment = await getEquipmentById(equipment_id);
    if (!equipment) {
      throw new Error('Equipment not found');
    }

    // Get active session
    const activeSessions = await getActiveSessions();
    const equipmentActiveSession = activeSessions.find(
      session => session.equipment_id === equipment.id,
    );

    return {
      equipment,
      isAvailable: equipment.status === 'AVAILABLE',
      activeSession: equipmentActiveSession || null,
    };
  } catch (error) {
    logger.error('Error getting equipment status', {
      error: (error as Error).message,
      equipment_id,
    });
    throw error;
  }
}
