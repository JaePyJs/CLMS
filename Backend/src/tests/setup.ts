import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'

// Load test environment variables
process.env.NODE_ENV = 'test'

// Mock the logger to avoid undefined errors in tests
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }
}))

// Suppress console.error for expected Prisma constraint errors in test environment
const originalConsoleError = console.error
beforeAll(() => {
  console.error = (...args: any[]) => {
    const message = args.join(' ')
    // Filter out expected Prisma errors from test scenarios
    const expectedErrors = [
      'Unique constraint failed',
      'Record to update not found',
      'Record to delete does not exist',
      'Invalid `prisma.student.create()`',
      'Invalid `prisma.student.update()`',
      'Invalid `prisma.student.delete()`'
    ]

    const isExpectedPrismaError = expectedErrors.some(error =>
      message.includes(error)
    )

    if (!isExpectedPrismaError) {
      originalConsoleError(...args)
    }
  }
})

afterAll(() => {
  console.error = originalConsoleError
})

// Test database setup with MySQL
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'mysql://clms_user:clms_password@localhost:3308/clms_test_database'
    }
  },
  log: ['error'], // Only show errors, suppress query logs
  errorFormat: 'minimal' // Minimal error format for cleaner test output
})

// Global test setup
beforeAll(async () => {
  // Ensure test database exists
  try {
    // Connect to test database
    await prisma.$connect()

    // Create a test user to bypass authentication
    await prisma.user.upsert({
      where: { username: 'test-user' },
      update: {},
      create: {
        username: 'test-user',
        password: 'test-password',
        role: 'ADMIN',
        isActive: true
      }
    })

    console.log('Test database setup completed')
  } catch (error) {
    console.error('Test database setup failed:', error)
    throw error
  }
})

// Global test teardown
afterAll(async () => {
  // Disconnect from test database
  await prisma.$disconnect()
})

// Clean up database before each test
beforeEach(async () => {
  try {
    // Clean up all tables in correct order (respecting foreign key constraints)
    await prisma.automationLog.deleteMany()
    await prisma.barcodeHistory.deleteMany()
    await prisma.activity.deleteMany()
    await prisma.equipmentSession.deleteMany()
    await prisma.bookCheckout.deleteMany()
    await prisma.automationJob.deleteMany()
    await prisma.auditLog.deleteMany()
    await prisma.systemConfig.deleteMany()
    await prisma.equipment.deleteMany()
    await prisma.book.deleteMany()
    await prisma.student.deleteMany()

    // Don't delete users - keep test user

    console.log('Database cleanup completed')
  } catch (error) {
    console.error('Database cleanup failed:', error)
    // Continue with test even if cleanup fails
  }
})

// Also clean up after each test to ensure proper isolation
afterEach(async () => {
  try {
    // Clean up all tables in correct order (respecting foreign key constraints)
    await prisma.automationLog.deleteMany()
    await prisma.barcodeHistory.deleteMany()
    await prisma.activity.deleteMany()
    await prisma.equipmentSession.deleteMany()
    await prisma.bookCheckout.deleteMany()
    await prisma.automationJob.deleteMany()
    await prisma.auditLog.deleteMany()
    await prisma.systemConfig.deleteMany()
    await prisma.equipment.deleteMany()
    await prisma.book.deleteMany()
    await prisma.student.deleteMany()

    console.log('Database after-test cleanup completed')
  } catch (error) {
    console.error('Database after-test cleanup failed:', error)
    // Continue with test even if cleanup fails
  }
})

// Helper function to generate unique test student ID
export function generateTestStudentId(testName: string): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 5)
  return `TEST-${testName}-${timestamp}-${random}`
}

// Export prisma client for use in tests
export { prisma }