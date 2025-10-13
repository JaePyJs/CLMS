import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'mysql://clms_user:clms_password@localhost:3308/clms_integration_test'
    }
  }
})

export default async function globalSetup() {
  console.log('Starting global integration test setup...')

  try {
    // Ensure database connection
    await prisma.$connect()

    // Clean up all data before tests
    await cleanupDatabase()

    // Create test database schema
    await ensureDatabaseSchema()

    // Seed initial test data
    await seedInitialData()

    console.log('Global integration test setup completed successfully')
  } catch (error) {
    console.error('Global integration test setup failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

async function cleanupDatabase() {
  console.log('Cleaning up database...')

  // Delete in correct order to respect foreign key constraints
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

async function ensureDatabaseSchema() {
  console.log('Ensuring database schema...')

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
    console.log('Database schema ensured')
  } catch (error) {
    console.error('Failed to ensure database schema:', error)
    throw error
  }
}

async function seedInitialData() {
  console.log('Seeding initial test data...')

  // Create test users with different roles
  const testUsers = [
    {
      username: 'test-super-admin',
      password: await bcrypt.hash('test-password-123', 12),
      role: 'SUPER_ADMIN',
      is_active: true,
      email: 'superadmin@test.com',
      first_name: 'Super',
      last_name: 'Admin'
    },
    {
      username: 'test-admin',
      password: await bcrypt.hash('test-password-123', 12),
      role: 'ADMIN',
      is_active: true,
      email: 'admin@test.com',
      first_name: 'Test',
      last_name: 'Admin'
    },
    {
      username: 'test-librarian',
      password: await bcrypt.hash('test-password-123', 12),
      role: 'LIBRARIAN',
      is_active: true,
      email: 'librarian@test.com',
      first_name: 'Test',
      last_name: 'Librarian'
    },
    {
      username: 'test-staff',
      password: await bcrypt.hash('test-password-123', 12),
      role: 'STAFF',
      is_active: true,
      email: 'staff@test.com',
      first_name: 'Test',
      last_name: 'Staff'
    },
    {
      username: 'test-viewer',
      password: await bcrypt.hash('test-password-123', 12),
      role: 'VIEWER',
      is_active: true,
      email: 'viewer@test.com',
      first_name: 'Test',
      last_name: 'Viewer'
    }
  ]

  for (const user of testUsers) {
    await prisma.users.create({
      data: user
    })
  }

  // Create test students
  const testStudents = [
    {
      student_id: 'TEST-STU-001',
      first_name: 'John',
      last_name: 'Doe',
      grade_level: 'Grade 12',
      grade_category: 'SENIOR_HIGH',
      section: '12-A',
      is_active: true
    },
    {
      student_id: 'TEST-STU-002',
      first_name: 'Jane',
      last_name: 'Smith',
      grade_level: 'Grade 8',
      grade_category: 'JUNIOR_HIGH',
      section: '8-B',
      is_active: true
    },
    {
      student_id: 'TEST-STU-003',
      first_name: 'Alice',
      last_name: 'Johnson',
      grade_level: 'Grade 4',
      grade_category: 'PRIMARY',
      section: '4-A',
      is_active: true
    }
  ]

  for (const student of testStudents) {
    await prisma.students.create({
      data: student
    })
  }

  // Create test equipment
  const testEquipment = [
    {
      name: 'Test Computer 1',
      type: 'computer',
      status: 'AVAILABLE',
      location: 'Test Lab 1',
      description: JSON.stringify({
        cpu: 'Intel Core i5',
        ram: '16GB',
        storage: '512GB SSD',
        gpu: 'Integrated Graphics'
      })
    },
    {
      name: 'Test Computer 2',
      type: 'computer',
      status: 'MAINTENANCE',
      location: 'Test Lab 1',
      description: JSON.stringify({
        cpu: 'Intel Core i7',
        ram: '32GB',
        storage: '1TB SSD',
        gpu: 'NVIDIA GTX 1660'
      })
    },
    {
      name: 'Test Gaming Console 1',
      type: 'gaming',
      status: 'AVAILABLE',
      location: 'Test Gaming Room',
      description: JSON.stringify({
        console: 'PlayStation 5',
        games: ['Test Game 1', 'Test Game 2'],
        accessories: ['Controller 1', 'Controller 2']
      })
    },
    {
      name: 'Test Study Area 1',
      type: 'study_area',
      status: 'AVAILABLE',
      location: 'Test Study Hall',
      description: JSON.stringify({
        capacity: 4,
        amenities: ['Desk', 'Chair', 'Lamp', 'Power Outlet'],
        noiseLevel: 'Quiet'
      })
    }
  ]

  for (const equipment of testEquipment) {
    await prisma.equipment.create({
      data: equipment
    })
  }

  // Create test books
  const testBooks = [
    {
      accession_no: 'TEST-BOOK-001',
      title: 'Test Programming Book',
      author: 'Test Author',
      isbn: '978-0-123456-78-9',
      category: 'Programming',
      status: 'AVAILABLE',
      location: 'Test Library - Section A',
      year: 2023,
      total_copies: 1,
      available_copies: 1
    },
    {
      accession_no: 'TEST-BOOK-002',
      title: 'Test Science Book',
      author: 'Science Author',
      isbn: '978-0-987654-32-1',
      category: 'Science',
      status: 'CHECKED_OUT',
      location: 'Test Library - Section B',
      year: 2022,
      total_copies: 1,
      available_copies: 0
    },
    {
      accession_no: 'TEST-BOOK-003',
      title: 'Test Fiction Book',
      author: 'Fiction Author',
      isbn: '978-0-555555-55-5',
      category: 'Fiction',
      status: 'AVAILABLE',
      location: 'Test Library - Section C',
      year: 2021,
      total_copies: 2,
      available_copies: 2
    }
  ]

  for (const book of testBooks) {
    await prisma.books.create({
      data: book
    })
  }

  // Create system configuration
  await prisma.system_config.createMany({
    data: [
      {
        key: 'library_name',
        value: 'Test Integration Library',
        description: 'Library name for testing'
      },
      {
        key: 'max_borrow_duration',
        value: '14',
        description: 'Maximum book borrowing duration in days'
      },
      {
        key: 'max_equipment_duration',
        value: '2',
        description: 'Maximum equipment usage duration in hours'
      },
      {
        key: 'auto_backup_enabled',
        value: 'true',
        description: 'Enable automatic backups'
      }
    ]
  })

  console.log('Initial test data seeded successfully')
}