import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { TestDataFactory } from './factories/TestDataFactory';
import type { PrismaClient } from '@prisma/client';

// Load test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.DATABASE_URL = 'mysql://test:test@localhost:3308/clms_test';

// Mock external dependencies
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
    silly: vi.fn(),
    http: vi.fn(),
  },
}));

// Mock performance optimization service
vi.mock('@/services/performanceOptimizationService', () => ({
  performanceOptimizationService: {
    executeQuery: vi.fn().mockImplementation((query: any) => {
      // Handle the isActive parameter issue
      if (typeof query === 'function') {
        return query();
      }
      return Promise.resolve([]);
    }),
    invalidateCache: vi.fn().mockResolvedValue(undefined),
    clearCache: vi.fn().mockResolvedValue(undefined),
    getCacheStats: vi.fn().mockResolvedValue({
      hitRate: 0.8,
      totalRequests: 100,
      totalHits: 80
    })
  }
}));

// Mock Bull queues
vi.mock('bull', () => ({
  default: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'test-job-id' }),
    process: vi.fn(),
    getJob: vi.fn().mockResolvedValue({
      getState: vi.fn().mockResolvedValue('completed'),
      finished: vi.fn(),
      failed: vi.fn(),
    }),
    close: vi.fn().mockResolvedValue(undefined),
    isRunning: vi.fn().mockResolvedValue(false),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    clean: vi.fn().mockResolvedValue(0),
    getWaiting: vi.fn().mockResolvedValue([]),
    getActive: vi.fn().mockResolvedValue([]),
    getCompleted: vi.fn().mockResolvedValue([]),
    getFailed: vi.fn().mockResolvedValue([])
  }))
}));

// Mock Redis
vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    keys: vi.fn().mockResolvedValue([]),
    flushall: vi.fn().mockResolvedValue('OK'),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue('PONG')
  }))
}));

// Mock Google APIs
vi.mock('googleapis', () => ({
  google: {
    auth: {
      GoogleAuth: vi.fn().mockImplementation(() => ({
        getClient: vi.fn().mockResolvedValue({
          request: vi.fn().mockResolvedValue({ data: [] })
        })
      }))
    },
    sheets: vi.fn().mockReturnValue({
      spreadsheets: {
        values: {
          get: vi.fn().mockResolvedValue({
            data: {
              values: [['Header1', 'Header2'], ['Value1', 'Value2']]
            }
          }),
          update: vi.fn().mockResolvedValue({
            data: { updatedRows: 1 }
          }),
          append: vi.fn().mockResolvedValue({
            data: { updatedRows: 1 }
          })
        }
      }
    })
  }
}));

// Mock JWT
vi.mock('jsonwebtoken', () => ({
  sign: vi.fn().mockReturnValue('mock-jwt-token'),
  verify: vi.fn().mockReturnValue({
    id: '1',
    username: 'test-user',
    role: 'LIBRARIAN'
  }),
  decode: vi.fn().mockReturnValue({
    id: '1',
    username: 'test-user',
    role: 'LIBRARIAN'
  })
}));

// Mock bcrypt
vi.mock('bcrypt', () => ({
  hash: vi.fn().mockResolvedValue('hashed-password'),
  compare: vi.fn().mockResolvedValue(true),
  genSalt: vi.fn().mockResolvedValue('salt')
}));

// Mock file upload
vi.mock('multer', () => ({
  default: vi.fn().mockReturnValue({
    single: vi.fn().mockReturnValue((req: any, res: any, next: any) => {
      req.file = {
        fieldname: 'file',
        originalname: 'test.csv',
        encoding: '7bit',
        mimetype: 'text/csv',
        size: 1024,
        buffer: Buffer.from('test data')
      };
      next();
    })
  })
}));

// Mock Winston logger
vi.mock('winston', () => ({
  format: {
    combine: vi.fn(),
    timestamp: vi.fn(),
    errors: vi.fn(),
    json: vi.fn(),
    printf: vi.fn()
  },
  transports: {
    Console: vi.fn(),
    File: vi.fn()
  },
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
    silly: vi.fn(),
    http: vi.fn(),
    log: vi.fn()
  })
}));

// Mock WebSocket
vi.mock('ws', () => ({
  default: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1 // WebSocket.OPEN
  }))
}));

// Mock USB Scanner
vi.mock('node-hid', () => ({
  default: {
    devices: vi.fn().mockReturnValue([]),
    HID: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      close: vi.fn(),
      readSync: vi.fn().mockReturnValue([])
    }))
  }
}));

// Mock QR Code libraries
vi.mock('qrcode', () => ({
  toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock-qrcode'),
  toBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-qrcode'))
}));

vi.mock('@zxing/library', () => ({
  BrowserMultiFormatReader: vi.fn().mockImplementation(() => ({
    decodeFromImageUrl: vi.fn().mockResolvedValue({
      getText: vi.fn().mockReturnValue('TEST123')
    }),
    decodeFromVideoDevice: vi.fn().mockResolvedValue({
      getText: vi.fn().mockReturnValue('TEST123')
    })
  }))
}));

// Mock email service
vi.mock('nodemailer', () => ({
  createTransport: vi.fn().mockReturnValue({
    sendMail: vi.fn().mockResolvedValue({
      messageId: 'test-message-id',
      response: '250 OK'
    }),
    verify: vi.fn().mockResolvedValue(true)
  })
}));

// Mock PDF generation
vi.mock('pdf-lib', () => ({
  PDFDocument: vi.fn().mockImplementation(() => ({
    addPage: vi.fn().mockReturnValue({
      drawText: vi.fn(),
      drawRectangle: vi.fn(),
      embedImage: vi.fn().mockResolvedValue({ width: 100, height: 100 })
    }),
    embedFont: vi.fn().mockResolvedValue({}),
    save: vi.fn().mockResolvedValue(Buffer.from('mock-pdf'))
  }))
}));

// Mock Excel generation
vi.mock('exceljs', () => ({
  Workbook: vi.fn().mockImplementation(() => ({
    addWorksheet: vi.fn().mockReturnValue({
      addRow: vi.fn(),
      getRow: vi.fn().mockReturnValue({
        eachCell: vi.fn()
      }),
      commit: vi.fn()
    }),
    xlsx: {
      writeBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-excel'))
    }
  }))
}));

// Mock CSV parsing
vi.mock('csv-parse', () => ({
  parse: vi.fn().mockImplementation((data: any, callback: any) => {
    callback(null, [
      ['student_id', 'first_name', 'last_name', 'grade_category'],
      ['2023001', 'John', 'Doe', 'GRADE_7'],
      ['2023002', 'Jane', 'Smith', 'GRADE_8']
    ]);
  })
}));

// Enhanced Prisma mock with createMany support
const createPrismaMock = (): any => {
  const createMockOperations = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: '1' }),
    createMany: vi.fn().mockResolvedValue({ count: 1 }),
    update: vi.fn().mockResolvedValue({ id: '1' }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    delete: vi.fn().mockResolvedValue({ id: '1' }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    count: vi.fn().mockResolvedValue(0),
    groupBy: vi.fn().mockResolvedValue([]),
    aggregate: vi.fn().mockResolvedValue({ _count: { id: 0 } }),
    findRaw: vi.fn().mockResolvedValue([]),
    aggregateRaw: vi.fn().mockResolvedValue([])
  });

  return {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $transaction: vi.fn().mockImplementation((callback) => callback(createPrismaMock())),
    $queryRaw: vi.fn().mockResolvedValue([{ test: 1 }]),
    $executeRaw: vi.fn().mockResolvedValue({ count: 1 }),

    // All tables with full CRUD operations
    users: createMockOperations(),
    students: createMockOperations(),
    books: createMockOperations(),
    equipment: createMockOperations(),
    student_activities: createMockOperations(),
    book_checkouts: createMockOperations(),
    barcode_history: createMockOperations(),
    audit_logs: createMockOperations(),
    automation_jobs: createMockOperations(),
    automation_logs: createMockOperations(),
    notifications: createMockOperations(),
    system_config: createMockOperations(),
    equipment_sessions: createMockOperations()
  };
};

// Mock Prisma Client
const mockPrisma = createPrismaMock();
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => mockPrisma),
  ...require('@prisma/client')
}));

// Global test helpers
export const createTestPrisma = (): PrismaClient => mockPrisma;

export const mockPrismaForService = (serviceName: string, data: any[] = []) => {
  const mock = mockPrisma[serviceName] || mockPrisma[`${serviceName.toLowerCase()}s`];
  if (mock) {
    mock.findMany.mockResolvedValue(data);
    mock.findUnique.mockResolvedValue(data[0] || null);
    mock.findFirst.mockResolvedValue(data[0] || null);
    mock.create.mockResolvedValue(data[0] || { id: '1' });
    mock.createMany.mockResolvedValue({ count: data.length });
    mock.count.mockResolvedValue(data.length);
  }
};

export const resetAllMocks = (): void => {
  vi.clearAllMocks();
  TestDataFactory.resetCounter();
};

export const setupTestDatabase = (): void => {
  TestDataFactory.resetCounter();
  const dataset = TestDataFactory.createTestDataset();

  // Setup mock data
  mockPrismaForService('students', dataset.students);
  mockPrismaForService('books', dataset.books);
  mockPrismaForService('equipment', dataset.equipment);
  mockPrismaForService('users', dataset.users);
  mockPrismaForService('studentActivities', dataset.activities);
  mockPrismaForService('bookCheckouts', dataset.checkouts);
  mockPrismaForService('barcodeHistory', dataset.barcodeHistories);
  mockPrismaForService('auditLogs', dataset.auditLogs);
  mockPrismaForService('notifications', dataset.notifications);
};

// Global setup and teardown
beforeAll(() => {
  console.log('🧪 Setting up comprehensive test environment');
});

beforeEach(() => {
  setupTestDatabase();
});

afterEach(() => {
  resetAllMocks();
});

afterAll(() => {
  console.log('🧹 Cleaning up test environment');
});

// Export common test utilities
export { TestDataFactory };
export { mockPrisma as prisma };

// Performance testing utilities
export const measurePerformance = async (fn: () => Promise<any> | any, label: string = 'Operation') => {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  const duration = end - start;

  console.log(`⏱️  ${label}: ${duration.toFixed(2)}ms`);

  // Fail if operation takes too long (adjust threshold as needed)
  if (duration > 1000) {
    console.warn(`⚠️  ${label} exceeded performance threshold (${duration.toFixed(2)}ms > 1000ms)`);
  }

  return { result, duration };
};

// Async test utilities
export const expectAsyncError = async (fn: () => Promise<any>, expectedError?: string) => {
  await expect(fn()).rejects.toThrow(expectedError);
};

export const expectNoAsyncError = async (fn: () => Promise<any>) => {
  await expect(fn()).resolves.toBeDefined();
};

// Mock HTTP context
export const createMockHttpContext = (userOverrides: any = {}) => ({
  req: {
    user: {
      id: '1',
      username: 'test-user',
      role: 'LIBRARIAN',
      ...userOverrides
    },
    ip: '127.0.0.1',
    headers: {
      'user-agent': 'test-agent',
      'authorization': 'Bearer mock-jwt-token'
    },
    method: 'GET',
    url: '/api/test',
    body: {},
    params: {},
    query: {}
  },
  res: {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
    headers: {},
    locals: {}
  }
});