import { vi } from 'vitest'

// Load test environment variables
process.env.NODE_ENV = 'test'

// Mock the logger
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock Prisma Client
vi.mock('@/utils/prisma', () => ({
  prisma: {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $queryRaw: vi.fn().mockResolvedValue([{ test: 1 }]),
    users: {
      upsert: vi.fn().mockResolvedValue(undefined),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: '1', username: 'test' }),
      update: vi.fn().mockResolvedValue({ id: '1', username: 'test' }),
      delete: vi.fn().mockResolvedValue({ id: '1' }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
      groupBy: vi.fn().mockResolvedValue([])
    },
    books: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: '1', title: 'Test Book', accession_no: 'ACC001', author: 'Test Author', category: 'Fiction', total_copies: 1, available_copies: 1, is_active: true, updated_at: new Date() }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({ id: '1', title: 'Test Book' }),
      delete: vi.fn().mockResolvedValue({ id: '1' }),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null)
    },
    students: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: '1', student_id: 'TEST001', first_name: 'Test', last_name: 'Student', grade_category: 'GRADE_7' }),
      update: vi.fn().mockResolvedValue({ id: '1', student_id: 'TEST001' }),
      delete: vi.fn().mockResolvedValue({ id: '1' }),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null)
    },
    student_activities: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: '1', student_id: '1' }),
      update: vi.fn().mockResolvedValue({ id: '1', student_id: '1' }),
      delete: vi.fn().mockResolvedValue({ id: '1' }),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null)
    },
    equipment: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: '1', name: 'Test Equipment' }),
      update: vi.fn().mockResolvedValue({ id: '1', name: 'Test Equipment' }),
      delete: vi.fn().mockResolvedValue({ id: '1' }),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null)
    },
    book_checkouts: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: '1', book_id: '1' }),
      update: vi.fn().mockResolvedValue({ id: '1', book_id: '1' }),
      delete: vi.fn().mockResolvedValue({ id: '1' }),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null)
    },
    notifications: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: '1', message: 'Test' }),
      update: vi.fn().mockResolvedValue({ id: '1', message: 'Test' }),
      delete: vi.fn().mockResolvedValue({ id: '1' }),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null)
    },
    automation_logs: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    barcode_history: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    equipment_sessions: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    automation_jobs: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    audit_logs: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    system_config: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    }
  }
}))

// Export prisma from the mock
export { prisma } from '@/utils/prisma'

// Mock Prisma enums
export const users_role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  LIBRARIAN: 'LIBRARIAN',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT'
}

export const students_grade_category = {
  GRADE_7: 'GRADE_7',
  GRADE_8: 'GRADE_8',
  GRADE_9: 'GRADE_9',
  GRADE_10: 'GRADE_10',
  GRADE_11: 'GRADE_11',
  GRADE_12: 'GRADE_12'
}

export const student_activities_activity_type = {
  CHECK_IN: 'CHECK_IN',
  CHECK_OUT: 'CHECK_OUT',
  BOOK_CHECKOUT: 'BOOK_CHECKOUT',
  BOOK_RETURN: 'BOOK_RETURN',
  EQUIPMENT_USE: 'EQUIPMENT_USE'
}

export const student_activities_status = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
}

export const book_checkouts_status = {
  ACTIVE: 'ACTIVE',
  RETURNED: 'RETURNED',
  OVERDUE: 'OVERDUE'
}

export const automation_jobs_status = {
  IDLE: 'IDLE',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
}

export const automation_jobs_type = {
  BACKUP: 'BACKUP',
  SYNC: 'SYNC',
  CLEANUP: 'CLEANUP',
  REPORT: 'REPORT'
}
// Helper function to generate unique test student ID
export function generateTestStudentId(testName: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 5);
  return `TEST-${testName}-${timestamp}-${random}`;
}
