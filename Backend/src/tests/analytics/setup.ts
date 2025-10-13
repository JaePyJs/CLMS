import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createServer } from 'http'
import app from '../../app'
import { analyticsService } from '../../services/analyticsService'

// Load analytics test environment
process.env.NODE_ENV = 'test'

// Mock external services for analytics testing
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
      url: process.env.DATABASE_URL || 'mysql://clms_user:clms_password@localhost:3308/clms_analytics_test'
    }
  },
  log: ['error'],
  errorFormat: 'minimal'
})

// Test server setup
let testServer: any = null
const TEST_PORT = parseInt(process.env.TEST_PORT || '3007')

// Global analytics test setup
beforeAll(async () => {
  try {
    // Connect to test database
    await prisma.$connect()

    // Create test users
    await setupTestUsers()

    // Create comprehensive test data for analytics
    await setupAnalyticsTestData()

    // Start test server
    testServer = createServer(app)
    await new Promise<void>((resolve) => {
      testServer.listen(TEST_PORT, resolve)
    })

    console.log('Analytics test environment setup completed')
  } catch (error) {
    console.error('Analytics test setup failed:', error)
    throw error
  }
})

// Global analytics test teardown
afterAll(async () => {
  try {
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

    console.log('Analytics test environment teardown completed')
  } catch (error) {
    console.error('Analytics test teardown failed:', error)
  }
})

// Clean up database before each analytics test
beforeEach(async () => {
  try {
    // Clean up activity data but keep reference data
    await prisma.automation_logs.deleteMany()
    await prisma.student_activities.deleteMany()
    await prisma.equipment_sessions.deleteMany()
    await prisma.book_checkouts.deleteMany()
    await prisma.audit_logs.deleteMany()
    // Keep users, students, equipment, and books for analytics tests
  } catch (error) {
    console.error('Analytics test cleanup failed:', error)
  }
})

// Clean up after each analytics test
afterEach(async () => {
  // Clear any remaining test state
  vi.clearAllMocks()
})

// Helper function to setup test users
async function setupTestUsers() {
  const testUsers = [
    {
      username: 'analytics-admin',
      password: 'analytics-test-password',
      role: 'ADMIN',
      is_active: true,
      email: 'analytics-admin@test.com'
    },
    {
      username: 'analytics-librarian',
      password: 'analytics-test-password',
      role: 'LIBRARIAN',
      is_active: true,
      email: 'analytics-librarian@test.com'
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

// Helper function to setup comprehensive test data for analytics
async function setupAnalyticsTestData() {
  // Create diverse set of students for analytics
  const students = []

  // Primary students
  for (let i = 1; i <= 10; i++) {
    students.push({
      student_id: `AN-STU-P${String(i).padStart(3, '0')}`,
      first_name: `Primary Student ${i}`,
      last_name: 'Analytics',
      grade_level: `Grade ${i}`,
      grade_category: 'PRIMARY',
      section: `${Math.ceil(i / 2)}-A`,
      is_active: true
    })
  }

  // Junior high students
  for (let i = 1; i <= 12; i++) {
    students.push({
      student_id: `AN-STU-J${String(i).padStart(3, '0')}`,
      first_name: `Junior Student ${i}`,
      last_name: 'Analytics',
      grade_level: `Grade ${6 + Math.ceil(i / 4)}`,
      grade_category: 'JUNIOR_HIGH',
      section: `${7 + Math.floor((i - 1) / 4)}-${['A', 'B', 'C'][i % 3]}`,
      is_active: true
    })
  }

  // Senior high students
  for (let i = 1; i <= 15; i++) {
    students.push({
      student_id: `AN-STU-S${String(i).padStart(3, '0')}`,
      first_name: `Senior Student ${i}`,
      last_name: 'Analytics',
      grade_level: `Grade ${10 + Math.ceil(i / 5)}`,
      grade_category: 'SENIOR_HIGH',
      section: `${10 + Math.floor((i - 1) / 5)}-${['A', 'B', 'C', 'D'][i % 4]}`,
      is_active: true
    })
  }

  for (const student of students) {
    await prisma.students.create({
      data: student
    })
  }

  // Create diverse equipment for analytics
  const equipment = []

  // Computers
  for (let i = 1; i <= 15; i++) {
    equipment.push({
      name: `Analytics Computer ${i}`,
      type: 'computer',
      status: i <= 10 ? 'AVAILABLE' : 'MAINTENANCE',
      location: ['Analytics Lab 1', 'Analytics Lab 2', 'Analytics Lab 3'][Math.floor((i - 1) / 5)],
      description: JSON.stringify({
        cpu: i <= 5 ? 'Intel Core i5' : i <= 10 ? 'Intel Core i7' : 'Intel Core i9',
        ram: i <= 5 ? '16GB' : i <= 10 ? '32GB' : '64GB',
        storage: '512GB SSD',
        gpu: i <= 8 ? 'Integrated' : 'NVIDIA GTX 1660'
      })
    })
  }

  // Gaming consoles
  for (let i = 1; i <= 8; i++) {
    equipment.push({
      name: `Analytics Console ${i}`,
      type: 'gaming',
      status: i <= 6 ? 'AVAILABLE' : 'IN_USE',
      location: 'Analytics Gaming Room',
      description: JSON.stringify({
        console: i <= 4 ? 'PlayStation 5' : 'Xbox Series X',
        games: [`Game ${i * 10}`, `Game ${i * 10 + 1}`, `Game ${i * 10 + 2}`],
        accessories: ['Controller 1', 'Controller 2']
      })
    })
  }

  // Study areas
  for (let i = 1; i <= 6; i++) {
    equipment.push({
      name: `Analytics Study Area ${i}`,
      type: 'study_area',
      status: i <= 4 ? 'AVAILABLE' : 'OCCUPIED',
      location: 'Analytics Study Hall',
      description: JSON.stringify({
        capacity: 4 + (i % 3) * 2,
        amenities: ['Desk', 'Chair', 'Lamp', 'Power Outlet'],
        noiseLevel: i <= 2 ? 'Quiet' : 'Moderate'
      })
    })
  }

  for (const eq of equipment) {
    await prisma.equipment.create({
      data: eq
    })
  }

  // Create diverse books for analytics
  const books = []

  const categories = ['Fiction', 'Non-Fiction', 'Science', 'Technology', 'History', 'Mathematics', 'Literature']
  for (let i = 1; i <= 25; i++) {
    books.push({
      accession_no: `AN-BOOK-${String(i).padStart(3, '0')}`,
      title: `Analytics Test Book ${i}`,
      author: `Author ${i}`,
      isbn: `978-0-${String(i).padStart(8, '0')}-${i % 10}`,
      category: categories[i % categories.length],
      status: i % 4 === 0 ? 'CHECKED_OUT' : 'AVAILABLE',
      location: `Analytics Library - Section ${['A', 'B', 'C', 'D'][i % 4]}`,
      year: 2020 + (i % 4),
      total_copies: 1 + (i % 2),
      available_copies: i % 4 === 0 ? 0 : 1 + (i % 2)
    })
  }

  for (const book of books) {
    await prisma.books.create({
      data: book
    })
  }
}

// Export test utilities
export { testPrisma as prisma, analyticsService }
export const testServerUrl = `http://localhost:${TEST_PORT}`

// Analytics test data generators
export function generateAnalyticsActivities(count: number = 100) {
  const activities = []
  const now = new Date()
  const activityTypes = ['COMPUTER_USE', 'GAMING', 'STUDY', 'BOOK_BORROW', 'BOOK_RETURN', 'RESEARCH']
  const statuses = ['ACTIVE', 'COMPLETED']

  for (let i = 0; i < count; i++) {
    const startTime = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Random time in last 30 days
    const endTime = statuses[Math.floor(Math.random() * statuses.length)] === 'COMPLETED'
      ? new Date(startTime.getTime() + Math.random() * 4 * 60 * 60 * 1000) // 0-4 hours duration
      : null

    activities.push({
      student_id: `AN-STU-${['P', 'J', 'S'][Math.floor(Math.random() * 3)]}${String(Math.floor(Math.random() * 15) + 1).padStart(3, '0')}`,
      activity_type: activityTypes[Math.floor(Math.random() * activityTypes.length)],
      equipment_id: Math.random() > 0.3 ? Math.floor(Math.random() * 29) + 1 : null, // 70% have equipment
      book_id: Math.random() > 0.8 ? Math.floor(Math.random() * 25) + 1 : null, // 20% have books
      start_time,
      end_time,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      notes: Math.random() > 0.7 ? `Analytics test note ${i}` : null
    })
  }

  return activities
}

export function generateAnalyticsBookCheckouts(count: number = 50) {
  const checkouts = []
  const now = new Date()

  for (let i = 0; i < count; i++) {
    const checkoutDate = new Date(now.getTime() - Math.random() * 60 * 24 * 60 * 60 * 1000) // Random time in last 60 days
    const dueDate = new Date(checkoutDate.getTime() + 14 * 24 * 60 * 60 * 1000) // 14 days due
    const returnDate = Math.random() > 0.3 // 70% returned
      ? new Date(checkoutDate.getTime() + Math.random() * 21 * 24 * 60 * 60 * 1000) // Returned within 21 days
      : null

    checkouts.push({
      student_id: `AN-STU-${['P', 'J', 'S'][Math.floor(Math.random() * 3)]}${String(Math.floor(Math.random() * 15) + 1).padStart(3, '0')}`,
      book_id: Math.floor(Math.random() * 25) + 1,
      checkout_date,
      due_date,
      return_date,
      status: returnDate ? 'RETURNED' : returnDate && returnDate > dueDate ? 'OVERDUE' : 'CHECKED_OUT',
      fine_amount: returnDate && returnDate > dueDate ? Math.floor((returnDate.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)) * 0.50 : 0
    })
  }

  return checkouts
}

// Analytics test helpers
export async function seedAnalyticsData(activitiesCount = 100, checkoutsCount = 50) {
  // Create activities
  const activities = generateAnalyticsActivities(activitiesCount)
  for (const activity of activities) {
    await prisma.student_activities.create({
      data: activity
    })
  }

  // Create book checkouts
  const checkouts = generateAnalyticsBookCheckouts(checkoutsCount)
  for (const checkout of checkouts) {
    await prisma.book_checkouts.create({
      data: checkout
    })
  }
}

// Analytics validation helpers
export function validateTimeSeriesData(data: any[], expectedLength?: number) {
  expect(data).toBeInstanceOf(Array)
  if (expectedLength) {
    expect(data).toHaveLength(expectedLength)
  }

  data.forEach((point, index) => {
    expect(point).toHaveProperty('timestamp')
    expect(point).toHaveProperty('value')
    expect(new Date(point.timestamp)).toBeInstanceOf(Date)
    expect(typeof point.value).toBe('number')
    expect(point.value).toBeGreaterThanOrEqual(0)
  })
}

export function validatePredictiveInsight(insight: any) {
  expect(insight).toHaveProperty('type')
  expect(insight).toHaveProperty('title')
  expect(insight).toHaveProperty('description')
  expect(insight).toHaveProperty('confidence')
  expect(insight).toHaveProperty('impact')
  expect(insight).toHaveProperty('recommendations')
  expect(insight).toHaveProperty('data')
  expect(insight).toHaveProperty('validUntil')

  expect(['demand_forecast', 'peak_prediction', 'resource_optimization', 'anomaly_detection']).toContain(insight.type)
  expect(insight.confidence).toBeGreaterThanOrEqual(0)
  expect(insight.confidence).toBeLessThanOrEqual(1)
  expect(['low', 'medium', 'high']).toContain(insight.impact)
  expect(insight.recommendations).toBeInstanceOf(Array)
  expect(new Date(insight.validUntil)).toBeInstanceOf(Date)
}

export function validateHeatMapData(data: any[]) {
  expect(data).toBeInstanceOf(Array)

  data.forEach(point => {
    expect(point).toHaveProperty('hour')
    expect(point).toHaveProperty('dayOfWeek')
    expect(point).toHaveProperty('intensity')

    expect(point.hour).toBeGreaterThanOrEqual(0)
    expect(point.hour).toBeLessThanOrEqual(23)
    expect(point.dayOfWeek).toBeGreaterThanOrEqual(0)
    expect(point.dayOfWeek).toBeLessThanOrEqual(6)
    expect(typeof point.intensity).toBe('number')
    expect(point.intensity).toBeGreaterThanOrEqual(0)
  })
}

export function validateResourceForecast(forecast: any) {
  expect(forecast).toHaveProperty('resourceType')
  expect(forecast).toHaveProperty('currentUtilization')
  expect(forecast).toHaveProperty('predictedUtilization')
  expect(forecast).toHaveProperty('recommendedCapacity')
  expect(forecast).toHaveProperty('riskLevel')
  expect(forecast).toHaveProperty('timeHorizon')

  expect(['computer', 'gaming', 'study_area', 'books']).toContain(forecast.resourceType)
  expect(typeof forecast.currentUtilization).toBe('number')
  expect(forecast.currentUtilization).toBeGreaterThanOrEqual(0)
  expect(forecast.currentUtilization).toBeLessThanOrEqual(100)
  expect(forecast.predictedUtilization).toBeInstanceOf(Array)
  expect(['low', 'medium', 'high']).toContain(forecast.riskLevel)
  expect(['day', 'week', 'month']).toContain(forecast.timeHorizon)
}