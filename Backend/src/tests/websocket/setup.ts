import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createServer } from 'http'
import WebSocket from 'ws'
import app from '../../app'
import { webSocketManager } from '../../websocket/websocketServer'
import jwt from 'jsonwebtoken'

// Load WebSocket test environment
process.env.NODE_ENV = 'test'

// Mock external services for WebSocket testing
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }
}))

// Test database setup
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'mysql://clms_user:clms_password@localhost:3308/clms_websocket_test'
    }
  },
  log: ['error'],
  errorFormat: 'minimal'
})

// Test server setup
let testServer: any = null
const TEST_PORT = parseInt(process.env.TEST_PORT || '3005')
const TEST_WS_PORT = parseInt(process.env.TEST_WS_PORT || '3006')

// WebSocket client utilities
export class WebSocketTestClient {
  private ws: WebSocket | null = null
  private messageQueue: any[] = []
  private isConnected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3

  constructor(private jwtToken: string) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `ws://localhost:${TEST_WS_PORT}/ws`

      this.ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${this.jwtToken}`,
          'User-Agent': 'WebSocket-Test-Client'
        }
      })

      this.ws.on('open', () => {
        this.isConnected = true
        this.reconnectAttempts = 0
        resolve()
      })

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString())
          this.messageQueue.push(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      })

      this.ws.on('close', () => {
        this.isConnected = false
      })

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error)
        reject(error)
      })

      // Connection timeout
      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('WebSocket connection timeout'))
        }
      }, 10000)
    })
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.isConnected = false
    this.messageQueue = []
  }

  async sendMessage(message: any): Promise<void> {
    if (!this.ws || !this.isConnected) {
      throw new Error('WebSocket not connected')
    }

    this.ws.send(JSON.stringify(message))
  }

  async waitForMessage(type: string, timeout = 10000): Promise<any> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const message = this.messageQueue.find(msg => msg.type === type)
      if (message) {
        this.messageQueue = this.messageQueue.filter(msg => msg !== message)
        return message
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    throw new Error(`Timeout waiting for message type: ${type}`)
  }

  async waitForMessages(count: number, timeout = 10000): Promise<any[]> {
    const startTime = Date.now()
    const messages: any[] = []

    while (messages.length < count && Date.now() - startTime < timeout) {
      if (this.messageQueue.length > 0) {
        messages.push(this.messageQueue.shift())
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return messages
  }

  clearMessages(): void {
    this.messageQueue = []
  }

  get isConnectedState(): boolean {
    return this.isConnected
  }

  get queuedMessages(): any[] {
    return [...this.messageQueue]
  }
}

// Global WebSocket test setup
beforeAll(async () => {
  try {
    // Connect to test database
    await prisma.$connect()

    // Create test users
    await setupTestUsers()

    // Start test server
    testServer = createServer(app)
    await new Promise<void>((resolve) => {
      testServer.listen(TEST_PORT, resolve)
    })

    // Initialize WebSocket server for testing
    await webSocketManager.initialize(testServer)

    console.log('WebSocket test environment setup completed')
  } catch (error) {
    console.error('WebSocket test setup failed:', error)
    throw error
  }
})

// Global WebSocket test teardown
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

    console.log('WebSocket test environment teardown completed')
  } catch (error) {
    console.error('WebSocket test teardown failed:', error)
  }
})

// Clean up database before each WebSocket test
beforeEach(async () => {
  try {
    // Clean up activity data
    await prisma.automation_logs.deleteMany()
    await prisma.student_activities.deleteMany()
    await prisma.equipment_sessions.deleteMany()
    await prisma.book_checkouts.deleteMany()
    await prisma.audit_logs.deleteMany()
    // Keep users, students, equipment, and books
  } catch (error) {
    console.error('WebSocket test cleanup failed:', error)
  }
})

// Clean up after each WebSocket test
afterEach(async () => {
  // Clear any remaining WebSocket connections
  vi.clearAllMocks()
})

// Helper function to setup test users
async function setupTestUsers() {
  const testUsers = [
    {
      username: 'ws-admin',
      password: 'ws-test-password',
      role: 'ADMIN',
      is_active: true,
      email: 'ws-admin@test.com'
    },
    {
      username: 'ws-librarian',
      password: 'ws-test-password',
      role: 'LIBRARIAN',
      is_active: true,
      email: 'ws-librarian@test.com'
    },
    {
      username: 'ws-staff',
      password: 'ws-test-password',
      role: 'STAFF',
      is_active: true,
      email: 'ws-staff@test.com'
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

// Export test utilities
export { testPrisma as prisma }
export const testServerUrl = `http://localhost:${TEST_PORT}`
export const testWebSocketUrl = `ws://localhost:${TEST_WS_PORT}/ws`

// JWT token generation for WebSocket authentication
export function generateTestJWT(username: string, role: string = 'ADMIN'): string {
  return jwt.sign(
    {
      id: username,
      username,
      role,
      permissions: ['read', 'write']
    },
    process.env.JWT_SECRET || 'test-jwt-secret-key-websocket',
    {
      expiresIn: '1h',
      issuer: 'clms-test'
    }
  )
}

// WebSocket message builders
export const wsMessageBuilders = {
  subscribe: (subscriptions: string[]) => ({
    type: 'subscribe',
    data: { id: crypto.randomUUID(), updated_at: new Date(),  subscriptions }
  }),

  unsubscribe: (subscriptions: string[]) => ({
    type: 'unsubscribe',
    data: { id: crypto.randomUUID(), updated_at: new Date(),  subscriptions }
  }),

  getActivity: (filters?: any) => ({
    type: 'get_activity',
    data: { id: crypto.randomUUID(), updated_at: new Date(),  filters }
  }),

  getActivityStats: (timeframe?: string) => ({
    type: 'get_activity_stats',
    data: { id: crypto.randomUUID(), updated_at: new Date(),  timeframe }
  }),

  getEquipmentStatus: () => ({
    type: 'get_equipment_status',
    data: { id: crypto.randomUUID(), updated_at: new Date(), }
  }),

  ping: () => ({
    type: 'ping',
    data: { id: crypto.randomUUID(), updated_at: new Date(),  timestamp: new Date().toISOString() }
  }),

  // Activity logging
  logActivity: (activityData: any) => ({
    type: 'log_activity',
    data: activityData
  }),

  // Equipment control
  requestEquipment: (equipment_id: string, student_id: string) => ({
    type: 'request_equipment',
    data: { id: crypto.randomUUID(), updated_at: new Date(),  equipment_id, student_id }
  }),

  releaseEquipment: (sessionId: string) => ({
    type: 'release_equipment',
    data: { id: crypto.randomUUID(), updated_at: new Date(),  sessionId }
  })
}

// Test data generators
export function generateWebSocketTestData() {
  const timestamp = Date.now()
  return {
    activity: {
      student_id: `WS-STU-${timestamp}`,
      activity_type: 'COMPUTER_USE',
      equipment_id: `WS-EQ-${timestamp}`,
      notes: 'WebSocket test activity'
    },
    equipment: {
      name: `WS Equipment ${timestamp}`,
      type: 'computer',
      status: 'AVAILABLE',
      location: 'WebSocket Test Lab'
    },
    student: {
      student_id: `WS-STU-${timestamp}`,
      first_name: 'WebSocket',
      last_name: `Test ${timestamp}`,
      grade_level: 'Grade 10',
      grade_category: 'SENIOR_HIGH',
      section: '10-A'
    }
  }
}