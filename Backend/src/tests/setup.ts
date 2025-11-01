import { vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { generateTestStudentId } from '@/utils/common';

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

// Test database setup with MySQL
const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.DATABASE_URL ||
        'mysql://clms_user:clms_password@localhost:3308/clms_test_database',
    },
  },
  log: ['error'], // Only show errors, suppress query logs
  errorFormat: 'minimal', // Minimal error format for cleaner test output
});

// Export prisma client for use in tests
export { prisma };

// Re-export generateTestStudentId from common utilities
export { generateTestStudentId };
