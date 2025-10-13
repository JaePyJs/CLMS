import { vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

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

// Helper function to generate unique test student ID
export function generateTestStudentId(testName: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 5);
  return `TEST-${testName}-${timestamp}-${random}`;
}

// Export prisma client for use in tests
export { prisma };
