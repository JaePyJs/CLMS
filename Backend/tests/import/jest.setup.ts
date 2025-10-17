import { prisma } from '../../src/utils/prisma';

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'file:./test.db';
  
  // Connect to test database
  await prisma.$connect();
});

afterAll(async () => {
  // Disconnect from test database
  await prisma.$disconnect();
});

// Increase timeout for large dataset tests
jest.setTimeout(60000);

// Mock console methods to reduce noise during tests
const originalConsole = global.console;

beforeEach(() => {
  global.console = {
    ...originalConsole,
    // Uncomment to suppress console.log during tests
    // log: jest.fn(),
    // debug: jest.fn(),
    // info: jest.fn(),
    // warn: jest.fn(),
    // error: jest.fn(),
  };
});

afterEach(() => {
  global.console = originalConsole;
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});