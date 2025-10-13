import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createServer } from 'http'
import app from '../../app'
import { webSocketManager } from '../../websocket/websocketServer'

// Load integration test environment
process.env.NODE_ENV = 'test'

// Mock external services for integration testing
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }
}))

vi.mock('../../services/googleSheets', () => ({
  syncToGoogleSheets: vi.fn().mockResolvedValue(true)
}))

// Test database setup
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'mysql://clms_user:clms_password@localhost:3308/clms_integration_test'
    }
  },
  log: ['error'], // Only show errors
  errorFormat: 'minimal'
})

// Test server setup
let testServer: any = null
const TEST_PORT = parseInt(process.env.TEST_PORT || '3003')

// Global integration test setup
beforeAll(async () => {
  try {
    // Connect to test database
    await prisma.$connect()

    // Create test users for different roles
    await setupTestUsers()

    // Create test data
    await setupTestData()

    // Start test server
    testServer = createServer(app)
    await new Promise<void>((resolve) => {
      testServer.listen(TEST_PORT, resolve)
    })

    // Initialize WebSocket server for testing
    await webSocketManager.initialize(testServer)

    console.log('Integration test environment setup completed')
  } catch (error) {
    console.error('Integration test setup failed:', error)
    throw error
  }
})

// Global integration test teardown
afterAll(async () => {
  try {
    // Close WebSocket server
    await webSocketManager.shutdown()

    // Close test server
    if (testServer) {
      await new Promise<void>((resolve) => {
        testServer.close(() => {
          resolve()
        })
      })
    }

    // Disconnect from database
    await prisma.$disconnect()

    console.log('Integration test environment teardown completed')
  } catch (error) {
    console.error('Integration test teardown failed:', error)
  }
})

// Clean up database before each test
beforeEach(async () => {
  try {
    // Clean up data in correct order (respecting foreign key constraints)
    await prisma.automation_logs.deleteMany()
    await prisma.barcode_history.deleteMany()
    await prisma.student_activities.deleteMany()
    await prisma.equipment_sessions.deleteMany()
    await prisma.book_checkouts.deleteMany()
    await prisma.automation_jobs.deleteMany()
    await prisma.audit_logs.deleteMany()
    await prisma.system_config.deleteMany()
    await prisma.equipment.deleteMany()
    await prisma.books.deleteMany()
    // Keep students and users for integration tests
  } catch (error) {
    console.error('Database cleanup failed:', error)
  }
})

// Clean up after each test
afterEach(async () => {
  // Additional cleanup if needed
  vi.clearAllMocks()
})

// Helper function to setup test users
async function setupTestUsers() {
  const testUsers = [
    {
      username: 'integration-admin',
      password: 'test-password-123',
      role: 'SUPER_ADMIN',
      is_active: true
    },
    {
      username: 'integration-librarian',
      password: 'test-password-123',
      role: 'LIBRARIAN',
      is_active: true
    },
    {
      username: 'integration-staff',
      password: 'test-password-123',
      role: 'STAFF',
      is_active: true
    },
    {
      username: 'integration-viewer',
      password: 'test-password-123',
      role: 'VIEWER',
      is_active: true
    }
  ]

  for (const user of testUsers) {
    await prisma.users.upsert({
      where: { username: user.username },
      update: {},
      create: user
    })
  }
}

// Helper function to setup test data
async function setupTestData() {
  // Create test students
  const testStudents = [
    {
      student_id: 'INT-STU-001',
      first_name: 'Integration',
      last_name: 'Student One',
      grade_level: 'Grade 10',
      grade_category: 'SENIOR_HIGH',
      section: '10-A',
      is_active: true
    },
    {
      student_id: 'INT-STU-002',
      first_name: 'Integration',
      last_name: 'Student Two',
      grade_level: 'Grade 8',
      grade_category: 'JUNIOR_HIGH',
      section: '8-B',
      is_active: true
    }
  ]

  for (const student of testStudents) {
    await prisma.students.upsert({
      where: { student_id: student.student_id },
      update: {},
      create: student
    })
  }

  // Create test equipment
  const testEquipment = [
    {
      name: 'Integration Computer 1',
      type: 'computer',
      status: 'AVAILABLE',
      location: 'Integration Lab',
      description: JSON.stringify({
        cpu: 'Test CPU',
        ram: '16GB',
        storage: '512GB SSD'
      })
    },
    {
      name: 'Integration Gaming Console 1',
      type: 'gaming',
      status: 'AVAILABLE',
      location: 'Integration Gaming Area',
      description: JSON.stringify({
        console: 'Test Console',
        games: ['Test Game 1', 'Test Game 2']
      })
    }
  ]

  for (const equipment of testEquipment) {
    await prisma.equipment.upsert({
      where: { name: equipment.name },
      update: {},
      create: equipment
    })
  }

  // Create test books
  const testBooks = [
    {
      accession_no: 'INT-BOOK-001',
      title: 'Integration Test Book 1',
      author: 'Test Author 1',
      isbn: '978-0-123456-78-9',
      category: 'Test Category',
      status: 'AVAILABLE',
      location: 'Integration Library'
    },
    {
      accession_no: 'INT-BOOK-002',
      title: 'Integration Test Book 2',
      author: 'Test Author 2',
      isbn: '978-0-987654-32-1',
      category: 'Test Category',
      status: 'AVAILABLE',
      location: 'Integration Library'
    }
  ]

  for (const book of testBooks) {
    await prisma.books.upsert({
      where: { accession_no: book.accession_no },
      update: {},
      create: book
    })
  }
}

// Export test utilities
export const testPrisma = prisma
export const testServerUrl = `http://localhost:${TEST_PORT}`
export const testWebSocketUrl = `ws://localhost:${TEST_PORT}/ws`

// Test data generators
export function generateTestStudent(prefix = 'INT') {
  const timestamp = Date.now()
  return {
    student_id: `${prefix}-STU-${timestamp}`,
    first_name: 'Test',
    last_name: `Student ${timestamp}`,
    grade_level: 'Grade 9',
    grade_category: 'JUNIOR_HIGH',
    section: '9-A',
    is_active: true
  }
}

export function generateTestEquipment(prefix = 'INT') {
  const timestamp = Date.now()
  return {
    name: `${prefix} Equipment ${timestamp}`,
    type: 'computer',
    status: 'AVAILABLE',
    location: 'Test Location',
    description: JSON.stringify({
      cpu: 'Test CPU',
      ram: '16GB',
      storage: '512GB SSD'
    })
  }
}

export function generateTestBook(prefix = 'INT') {
  const timestamp = Date.now()
  return {
    accession_no: `${prefix}-BOOK-${timestamp}`,
    title: `Test Book ${timestamp}`,
    author: 'Test Author',
    isbn: `978-0-${timestamp}-12-3`,
    category: 'Test Category',
    status: 'AVAILABLE',
    location: 'Test Library'
  }
}