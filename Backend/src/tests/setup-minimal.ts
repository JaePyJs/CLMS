import { vi } from 'vitest';

// Load test environment variables
process.env.NODE_ENV = 'test';

// Mock the logger to avoid undefined errors in tests
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Prisma client to avoid database connection issues during test setup
vi.mock('@prisma/client', () => {
  const PrismaClient = vi.fn().mockImplementation(() => ({
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
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
    automation_logs: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    barcode_history: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
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
    equipment_sessions: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
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
    automation_jobs: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    audit_logs: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    system_config: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
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
    books: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: '1', title: 'Test Book' }),
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
      create: vi.fn().mockResolvedValue({ id: '1', student_id: 'TEST001' }),
      update: vi.fn().mockResolvedValue({ id: '1', student_id: 'TEST001' }),
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
    $queryRaw: vi.fn().mockResolvedValue([{ test: 1 }]),
  }));

  return {
    PrismaClient,
    users_role: {
      SUPER_ADMIN: 'SUPER_ADMIN',
      ADMIN: 'ADMIN',
      LIBRARIAN: 'LIBRARIAN',
      TEACHER: 'TEACHER',
      STUDENT: 'STUDENT'
    },
    students_grade_category: {
      GRADE_7: 'GRADE_7',
      GRADE_8: 'GRADE_8',
      GRADE_9: 'GRADE_9',
      GRADE_10: 'GRADE_10',
      GRADE_11: 'GRADE_11',
      GRADE_12: 'GRADE_12'
    },
    student_activities_activity_type: {
      CHECK_IN: 'CHECK_IN',
      CHECK_OUT: 'CHECK_OUT',
      BOOK_CHECKOUT: 'BOOK_CHECKOUT',
      BOOK_RETURN: 'BOOK_RETURN',
      EQUIPMENT_USE: 'EQUIPMENT_USE'
    },
    student_activities_status: {
      ACTIVE: 'ACTIVE',
      COMPLETED: 'COMPLETED',
      CANCELLED: 'CANCELLED'
    },
    book_checkouts_status: {
      ACTIVE: 'ACTIVE',
      RETURNED: 'RETURNED',
      OVERDUE: 'OVERDUE'
    },
    automation_jobs_status: {
      IDLE: 'IDLE',
      RUNNING: 'RUNNING',
      COMPLETED: 'COMPLETED',
      FAILED: 'FAILED'
    },
    automation_jobs_type: {
      BACKUP: 'BACKUP',
      SYNC: 'SYNC',
      CLEANUP: 'CLEANUP',
      REPORT: 'REPORT'
    }
  };
});

// Helper function to generate unique test student ID
export function generateTestStudentId(testName: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 5);
  return `TEST-${testName}-${timestamp}-${random}`;
}

// Export mocked prisma client for use in tests
export const prisma = {
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
  automation_logs: {
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  barcode_history: {
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
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
  equipment_sessions: {
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
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
  automation_jobs: {
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  audit_logs: {
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  system_config: {
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
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
  notifications: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: '1', message: 'Test' }),
    update: vi.fn().mockResolvedValue({ id: '1', message: 'Test' }),
    delete: vi.fn().mockResolvedValue({ id: '1' }),
    count: vi.fn().mockResolvedValue(0),
    findFirst: vi.fn().mockResolvedValue(null)
  }
};