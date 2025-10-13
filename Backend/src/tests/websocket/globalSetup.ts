import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'mysql://clms_user:clms_password@localhost:3308/clms_websocket_test'
    }
  }
})

export default async function globalSetup() {
  console.log('Starting global WebSocket test setup...')

  try {
    // Ensure database connection
    await prisma.$connect()

    // Clean up all data before WebSocket tests
    await cleanupWebSocketTestDatabase()

    // Create WebSocket test database schema
    await ensureWebSocketDatabaseSchema()

    // Seed WebSocket-specific test data
    await seedWebSocketTestData()

    console.log('Global WebSocket test setup completed successfully')
  } catch (error) {
    console.error('Global WebSocket test setup failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

async function cleanupWebSocketTestDatabase() {
  console.log('Cleaning up WebSocket test database...')

  // Delete all data for WebSocket tests
  const tables = [
    'automationLog',
    'barcodeHistory',
    'activity',
    'equipmentSession',
    'bookCheckout',
    'automationJob',
    'auditLog',
    'systemConfig',
    'equipment',
    'book',
    'student',
    'user'
  ]

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM ${table}`)
      console.log(`Cleared table: ${table}`)
    } catch (error) {
      console.warn(`Failed to clear table ${table}:`, error)
    }
  }
}

async function ensureWebSocketDatabaseSchema() {
  console.log('Ensuring WebSocket test database schema...')

  try {
    // Run Prisma push to ensure schema is up to date
    const { execSync } = require('child_process')
    execSync('npx prisma db push --force-reset', {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL
      }
    })
    console.log('WebSocket test database schema ensured')
  } catch (error) {
    console.error('Failed to ensure WebSocket test database schema:', error)
    throw error
  }
}

async function seedWebSocketTestData() {
  console.log('Seeding WebSocket-specific test data...')

  // Create WebSocket test users with different roles
  const wsTestUsers = [
    {
      username: 'ws-super-admin',
      password: await bcrypt.hash('ws-test-password-123', 12),
      role: 'SUPER_ADMIN',
      is_active: true,
      email: 'ws-superadmin@test.com',
      first_name: 'WebSocket Super',
      last_name: 'Admin'
    },
    {
      username: 'ws-admin',
      password: await bcrypt.hash('ws-test-password-123', 12),
      role: 'ADMIN',
      is_active: true,
      email: 'ws-admin@test.com',
      first_name: 'WebSocket',
      last_name: 'Admin'
    },
    {
      username: 'ws-librarian',
      password: await bcrypt.hash('ws-test-password-123', 12),
      role: 'LIBRARIAN',
      is_active: true,
      email: 'ws-librarian@test.com',
      first_name: 'WebSocket',
      last_name: 'Librarian'
    },
    {
      username: 'ws-staff',
      password: await bcrypt.hash('ws-test-password-123', 12),
      role: 'STAFF',
      is_active: true,
      email: 'ws-staff@test.com',
      first_name: 'WebSocket',
      last_name: 'Staff'
    },
    {
      username: 'ws-viewer',
      password: await bcrypt.hash('ws-test-password-123', 12),
      role: 'VIEWER',
      is_active: true,
      email: 'ws-viewer@test.com',
      first_name: 'WebSocket',
      last_name: 'Viewer'
    }
  ]

  for (const user of wsTestUsers) {
    await prisma.users.create({
      data: user
    })
  }

  // Create WebSocket test students
  const wsTestStudents = [
    {
      student_id: 'WS-STU-001',
      first_name: 'WebSocket',
      last_name: 'Student One',
      grade_level: 'Grade 11',
      grade_category: 'SENIOR_HIGH',
      section: '11-A',
      is_active: true
    },
    {
      student_id: 'WS-STU-002',
      first_name: 'WebSocket',
      last_name: 'Student Two',
      grade_level: 'Grade 7',
      grade_category: 'JUNIOR_HIGH',
      section: '7-B',
      is_active: true
    },
    {
      student_id: 'WS-STU-003',
      first_name: 'WebSocket',
      last_name: 'Student Three',
      grade_level: 'Grade 3',
      grade_category: 'PRIMARY',
      section: '3-A',
      is_active: true
    }
  ]

  for (const student of wsTestStudents) {
    await prisma.students.create({
      data: student
    })
  }

  // Create WebSocket test equipment
  const wsTestEquipment = [
    {
      name: 'WS Computer 1',
      type: 'computer',
      status: 'AVAILABLE',
      location: 'WS Test Lab 1',
      description: JSON.stringify({
        cpu: 'Intel Core i5 WebSocket',
        ram: '16GB WebSocket',
        storage: '512GB SSD',
        gpu: 'Integrated Graphics',
        networkAdapter: 'WebSocket Enabled'
      })
    },
    {
      name: 'WS Computer 2',
      type: 'computer',
      status: 'IN_USE',
      location: 'WS Test Lab 1',
      description: JSON.stringify({
        cpu: 'Intel Core i7 WebSocket',
        ram: '32GB WebSocket',
        storage: '1TB SSD',
        gpu: 'NVIDIA RTX 3060',
        networkAdapter: 'WebSocket Enabled'
      })
    },
    {
      name: 'WS Gaming Console 1',
      type: 'gaming',
      status: 'AVAILABLE',
      location: 'WS Test Gaming Room',
      description: JSON.stringify({
        console: 'PlayStation 5 WebSocket',
        games: ['WS Test Game 1', 'WS Test Game 2', 'WS Test Game 3'],
        accessories: ['WS Controller 1', 'WS Controller 2', 'WS Headset'],
        onlineCapabilities: 'WebSocket Connected'
      })
    },
    {
      name: 'WS Study Area 1',
      type: 'study_area',
      status: 'AVAILABLE',
      location: 'WS Test Study Hall',
      description: JSON.stringify({
        capacity: 6,
        amenities: ['WS Desk', 'WS Chair', 'WS Lamp', 'Power Outlet', 'WebSocket Port'],
        noiseLevel: 'Quiet',
        facilities: ['Whiteboard', 'Projector']
      })
    },
    {
      name: 'WS Study Area 2',
      type: 'study_area',
      status: 'MAINTENANCE',
      location: 'WS Test Study Hall',
      description: JSON.stringify({
        capacity: 4,
        amenities: ['WS Desk', 'WS Chair', 'Power Outlet'],
        noiseLevel: 'Moderate',
        facilities: ['WebSocket Charging Station']
      })
    }
  ]

  for (const equipment of wsTestEquipment) {
    await prisma.equipment.create({
      data: equipment
    })
  }

  // Create WebSocket test books
  const wsTestBooks = [
    {
      accession_no: 'WS-BOOK-001',
      title: 'WebSocket Programming Guide',
      author: 'WS Test Author',
      isbn: '978-0-111111-11-1',
      category: 'Technology',
      status: 'AVAILABLE',
      location: 'WS Test Library - Tech Section',
      year: 2023,
      total_copies: 1,
      available_copies: 1
    },
    {
      accession_no: 'WS-BOOK-002',
      title: 'Real-Time Systems with WebSocket',
      author: 'WS Real-Time Author',
      isbn: '978-0-222222-22-2',
      category: 'Technology',
      status: 'CHECKED_OUT',
      location: 'WS Test Library - Tech Section',
      year: 2023,
      total_copies: 1,
      available_copies: 0
    }
  ]

  for (const book of wsTestBooks) {
    await prisma.books.create({
      data: book
    })
  }

  // Create WebSocket-specific system configuration
  await prisma.system_config.createMany({
    data: [
      {
        key: 'websocket_enabled',
        value: 'true',
        description: 'Enable WebSocket real-time features'
      },
      {
        key: 'websocket_max_connections',
        value: '100',
        description: 'Maximum WebSocket connections per user'
      },
      {
        key: 'websocket_heartbeat_interval',
        value: '30000',
        description: 'WebSocket heartbeat interval in milliseconds'
      },
      {
        key: 'websocket_message_history',
        value: '1000',
        description: 'Number of messages to keep in history'
      },
      {
        key: 'real_time_activity_updates',
        value: 'true',
        description: 'Enable real-time activity updates via WebSocket'
      },
      {
        key: 'real_time_equipment_status',
        value: 'true',
        description: 'Enable real-time equipment status updates'
      }
    ]
  })

  console.log('WebSocket-specific test data seeded successfully')
}