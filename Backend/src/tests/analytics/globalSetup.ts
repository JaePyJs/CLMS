import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'mysql://clms_user:clms_password@localhost:3308/clms_analytics_test'
    }
  }
})

export default async function globalSetup() {
  console.log('Starting global analytics test setup...')

  try {
    // Ensure database connection
    await prisma.$connect()

    // Clean up all data before analytics tests
    await cleanupAnalyticsTestDatabase()

    // Create analytics test database schema
    await ensureAnalyticsDatabaseSchema()

    // Seed comprehensive analytics test data
    await seedAnalyticsTestData()

    console.log('Global analytics test setup completed successfully')
  } catch (error) {
    console.error('Global analytics test setup failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

async function cleanupAnalyticsTestDatabase() {
  console.log('Cleaning up analytics test database...')

  // Delete all data for analytics tests
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

async function ensureAnalyticsDatabaseSchema() {
  console.log('Ensuring analytics test database schema...')

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
    console.log('Analytics test database schema ensured')
  } catch (error) {
    console.error('Failed to ensure analytics test database schema:', error)
    throw error
  }
}

async function seedAnalyticsTestData() {
  console.log('Seeding comprehensive analytics test data...')

  // Create analytics test users
  const analyticsTestUsers = [
    {
      username: 'analytics-super-admin',
      password: await bcrypt.hash('analytics-test-password-123', 12),
      role: 'SUPER_ADMIN',
      is_active: true,
      email: 'analytics-superadmin@test.com',
      first_name: 'Analytics Super',
      last_name: 'Admin'
    },
    {
      username: 'analytics-admin',
      password: await bcrypt.hash('analytics-test-password-123', 12),
      role: 'ADMIN',
      is_active: true,
      email: 'analytics-admin@test.com',
      first_name: 'Analytics',
      last_name: 'Admin'
    },
    {
      username: 'analytics-librarian',
      password: await bcrypt.hash('analytics-test-password-123', 12),
      role: 'LIBRARIAN',
      is_active: true,
      email: 'analytics-librarian@test.com',
      first_name: 'Analytics',
      last_name: 'Librarian'
    },
    {
      username: 'analytics-staff',
      password: await bcrypt.hash('analytics-test-password-123', 12),
      role: 'STAFF',
      is_active: true,
      email: 'analytics-staff@test.com',
      first_name: 'Analytics',
      last_name: 'Staff'
    },
    {
      username: 'analytics-viewer',
      password: await bcrypt.hash('analytics-test-password-123', 12),
      role: 'VIEWER',
      is_active: true,
      email: 'analytics-viewer@test.com',
      first_name: 'Analytics',
      last_name: 'Viewer'
    }
  ]

  for (const user of analyticsTestUsers) {
    await prisma.users.create({
      data: user
    })
  }

  // Create diverse student population for analytics
  console.log('Creating diverse student population...')
  await createStudentPopulation()

  // Create comprehensive equipment inventory
  console.log('Creating equipment inventory...')
  await createEquipmentInventory()

  // Create extensive book collection
  console.log('Creating book collection...')
  await createBookCollection()

  // Create historical activity data
  console.log('Creating historical activity data...')
  await createHistoricalActivityData()

  // Create book checkout history
  console.log('Creating book checkout history...')
  await createBookCheckoutHistory()

  // Create system configuration
  console.log('Creating system configuration...')
  await createAnalyticsSystemConfig()

  console.log('Comprehensive analytics test data seeded successfully')
}

async function createStudentPopulation() {
  // Create students with realistic distribution
  const studentData = []

  // Primary students (Grade 1-6)
  for (let grade = 1; grade <= 6; grade++) {
    const studentsPerGrade = 20 + Math.floor(Math.random() * 10)
    for (let i = 1; i <= studentsPerGrade; i++) {
      studentData.push({
        student_id: `ANA-P${String(grade).padStart(2, '0')}${String(i).padStart(3, '0')}`,
        first_name: `Primary Student ${grade}-${i}`,
        last_name: 'Analytics',
        grade_level: `Grade ${grade}`,
        grade_category: 'PRIMARY',
        section: `${grade}-${['A', 'B', 'C'][i % 3]}`,
        is_active: Math.random() > 0.05 // 95% active
      })
    }
  }

  // Junior high students (Grade 7-10)
  for (let grade = 7; grade <= 10; grade++) {
    const studentsPerGrade = 25 + Math.floor(Math.random() * 15)
    for (let i = 1; i <= studentsPerGrade; i++) {
      studentData.push({
        student_id: `ANA-J${String(grade).padStart(2, '0')}${String(i).padStart(3, '0')}`,
        first_name: `Junior Student ${grade}-${i}`,
        last_name: 'Analytics',
        grade_level: `Grade ${grade}`,
        grade_category: 'JUNIOR_HIGH',
        section: `${grade}-${['A', 'B', 'C', 'D'][i % 4]}`,
        is_active: Math.random() > 0.03 // 97% active
      })
    }
  }

  // Senior high students (Grade 11-12)
  for (let grade = 11; grade <= 12; grade++) {
    const studentsPerGrade = 30 + Math.floor(Math.random() * 20)
    for (let i = 1; i <= studentsPerGrade; i++) {
      studentData.push({
        student_id: `ANA-S${String(grade).padStart(2, '0')}${String(i).padStart(3, '0')}`,
        first_name: `Senior Student ${grade}-${i}`,
        last_name: 'Analytics',
        grade_level: `Grade ${grade}`,
        grade_category: 'SENIOR_HIGH',
        section: `${grade}-${['A', 'B', 'C', 'D', 'E'][i % 5]}`,
        is_active: Math.random() > 0.02 // 98% active
      })
    }
  }

  // Batch insert for performance
  for (let i = 0; i < studentData.length; i += 50) {
    const batch = studentData.slice(i, i + 50)
    await prisma.students.createMany({
      data: batch,
      skipDuplicates: true
    })
  }

  console.log(`Created ${studentData.length} students`)
}

async function createEquipmentInventory() {
  const equipmentData = []

  // Computers with different specifications
  const computerSpecs = [
    { cpu: 'Intel Core i3', ram: '8GB', storage: '256GB SSD', gpu: 'Integrated' },
    { cpu: 'Intel Core i5', ram: '16GB', storage: '512GB SSD', gpu: 'Integrated' },
    { cpu: 'Intel Core i7', ram: '32GB', storage: '1TB SSD', gpu: 'NVIDIA GTX 1660' },
    { cpu: 'Intel Core i9', ram: '64GB', storage: '2TB SSD', gpu: 'NVIDIA RTX 3070' }
  ]

  for (let i = 1; i <= 40; i++) {
    const spec = computerSpecs[Math.floor(Math.random() * computerSpecs.length)]
    const status = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OCCUPIED'][Math.floor(Math.random() * 4)]

    equipmentData.push({
      name: `Analytics Computer ${i}`,
      type: 'computer',
      status,
      location: `Analytics Lab ${Math.ceil(i / 10)}`,
      description: JSON.stringify(spec)
    })
  }

  // Gaming consoles
  for (let i = 1; i <= 15; i++) {
    const status = ['AVAILABLE', 'IN_USE', 'MAINTENANCE'][Math.floor(Math.random() * 3)]

    equipmentData.push({
      name: `Analytics Gaming Console ${i}`,
      type: 'gaming',
      status,
      location: 'Analytics Gaming Room',
      description: JSON.stringify({
        console: i <= 8 ? 'PlayStation 5' : 'Xbox Series X',
        games: [`Game ${i * 10}`, `Game ${i * 10 + 1}`, `Game ${i * 10 + 2}`],
        accessories: ['Controller 1', 'Controller 2', 'Headset']
      })
    })
  }

  // Study areas
  for (let i = 1; i <= 12; i++) {
    const status = ['AVAILABLE', 'OCCUPIED', 'RESERVED'][Math.floor(Math.random() * 3)]

    equipmentData.push({
      name: `Analytics Study Area ${i}`,
      type: 'study_area',
      status,
      location: 'Analytics Study Hall',
      description: JSON.stringify({
        capacity: 2 + Math.floor(Math.random() * 6),
        amenities: ['Desk', 'Chair', 'Lamp', 'Power Outlet', 'Whiteboard'],
        noiseLevel: ['Quiet', 'Moderate'][Math.floor(Math.random() * 2)]
      })
    })
  }

  // Batch insert
  for (let i = 0; i < equipmentData.length; i += 20) {
    const batch = equipmentData.slice(i, i + 20)
    await prisma.equipment.createMany({
      data: batch,
      skipDuplicates: true
    })
  }

  console.log(`Created ${equipmentData.length} equipment items`)
}

async function createBookCollection() {
  const bookData = []
  const categories = [
    'Fiction', 'Non-Fiction', 'Science', 'Technology', 'Mathematics',
    'History', 'Literature', 'Arts', 'Philosophy', 'Reference',
    'Children\'s Books', 'Young Adult', 'Biography', 'Travel', 'Cooking'
  ]

  for (let i = 1; i <= 200; i++) {
    const status = Math.random() > 0.3 ? 'AVAILABLE' : 'CHECKED_OUT'
    const totalCopies = 1 + Math.floor(Math.random() * 3)

    bookData.push({
      accession_no: `ANA-BOOK-${String(i).padStart(4, '0')}`,
      title: `Analytics Test Book ${i}`,
      author: `Author ${Math.floor(i / 10) + 1}`,
      isbn: `978-0-${String(i).padStart(8, '0')}-${i % 10}`,
      category: categories[i % categories.length],
      status,
      location: `Analytics Library - Section ${['A', 'B', 'C', 'D', 'E', 'F'][i % 6]}`,
      year: 2015 + (i % 8),
      total_copies,
      available_copies: status === 'AVAILABLE' ? totalCopies : Math.floor(Math.random() * totalCopies)
    })
  }

  // Batch insert
  for (let i = 0; i < bookData.length; i += 30) {
    const batch = bookData.slice(i, i + 30)
    await prisma.books.createMany({
      data: batch,
      skipDuplicates: true
    })
  }

  console.log(`Created ${bookData.length} books`)
}

async function createHistoricalActivityData() {
  const activityData = []
  const activityTypes = ['COMPUTER_USE', 'GAMING', 'STUDY', 'BOOK_BORROW', 'BOOK_RETURN', 'RESEARCH']
  const now = new Date()

  // Create activities for the past 90 days
  for (let day = 0; day < 90; day++) {
    const date = new Date(now.getTime() - day * 24 * 60 * 60 * 1000)
    const activitiesOnDay = 50 + Math.floor(Math.random() * 100) // 50-150 activities per day

    for (let activity = 0; activity < activitiesOnDay; activity++) {
      // Activities happen during library hours (8 AM - 6 PM)
      const hour = 8 + Math.floor(Math.random() * 10)
      const minute = Math.floor(Math.random() * 60)
      const startTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute)

      // Duration varies by activity type
      const activityType = activityTypes[Math.floor(Math.random() * activityTypes.length)]
      let duration
      switch (activityType) {
        case 'COMPUTER_USE':
          duration = 30 + Math.floor(Math.random() * 150) // 30-180 minutes
          break
        case 'GAMING':
          duration = 45 + Math.floor(Math.random() * 135) // 45-180 minutes
          break
        case 'STUDY':
          duration = 60 + Math.floor(Math.random() * 240) // 60-300 minutes
          break
        case 'BOOK_BORROW':
        case 'BOOK_RETURN':
          duration = 5 + Math.floor(Math.random() * 15) // 5-20 minutes
          break
        case 'RESEARCH':
          duration = 90 + Math.floor(Math.random() * 210) // 90-300 minutes
          break
        default:
          duration = 60
      }

      const endTime = new Date(startTime.getTime() + duration * 60 * 1000)

      // Skip if end time is in the future
      if (endTime > now) continue

      activityData.push({
        student_id: `ANA-${['P', 'J', 'S'][Math.floor(Math.random() * 3)]}${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}${String(Math.floor(Math.random() * 30) + 1).padStart(3, '0')}`,
        activity_type,
        equipment_id: ['COMPUTER_USE', 'GAMING', 'STUDY'].includes(activityType) ? Math.floor(Math.random() * 67) + 1 : null,
        book_id: ['BOOK_BORROW', 'BOOK_RETURN'].includes(activityType) ? Math.floor(Math.random() * 200) + 1 : null,
        start_time,
        end_time,
        status: 'COMPLETED',
        notes: Math.random() > 0.8 ? `Analytics note for activity ${activity}` : null
      })
    }
  }

  // Batch insert in chunks
  for (let i = 0; i < activityData.length; i += 100) {
    const batch = activityData.slice(i, i + 100)
    await prisma.student_activities.createMany({
      data: batch,
      skipDuplicates: true
    })
  }

  console.log(`Created ${activityData.length} historical activities`)
}

async function createBookCheckoutHistory() {
  const checkoutData = []
  const now = new Date()

  // Create checkouts for the past 6 months
  for (let day = 0; day < 180; day++) {
    const date = new Date(now.getTime() - day * 24 * 60 * 60 * 1000)
    const checkoutsOnDay = 10 + Math.floor(Math.random() * 30) // 10-40 checkouts per day

    for (let checkout = 0; checkout < checkoutsOnDay; checkout++) {
      const hour = 9 + Math.floor(Math.random() * 9) // 9 AM - 6 PM
      const minute = Math.floor(Math.random() * 60)
      const checkoutDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute)

      const dueDate = new Date(checkoutDate.getTime() + 14 * 24 * 60 * 60 * 1000) // 14 days due

      // Determine if book is returned
      const isReturned = Math.random() > 0.2 // 80% returned
      let returnDate = null
      let status = 'CHECKED_OUT'
      let fineAmount = 0

      if (isReturned) {
        const returnDays = 1 + Math.floor(Math.random() * 21) // 1-21 days to return
        returnDate = new Date(checkoutDate.getTime() + returnDays * 24 * 60 * 60 * 1000)

        if (returnDate > dueDate) {
          status = 'OVERDUE'
          const overdueDays = Math.floor((returnDate.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000))
          fineAmount = overdueDays * 0.50 // $0.50 per day
        } else {
          status = 'RETURNED'
        }
      }

      // Skip if due date is in the future
      if (dueDate > now) continue

      checkoutData.push({
        student_id: `ANA-${['P', 'J', 'S'][Math.floor(Math.random() * 3)]}${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}${String(Math.floor(Math.random() * 30) + 1).padStart(3, '0')}`,
        book_id: Math.floor(Math.random() * 200) + 1,
        checkout_date,
        due_date,
        return_date,
        status,
        fine_amount
      })
    }
  }

  // Batch insert
  for (let i = 0; i < checkoutData.length; i += 50) {
    const batch = checkoutData.slice(i, i + 50)
    await prisma.book_checkouts.createMany({
      data: batch,
      skipDuplicates: true
    })
  }

  console.log(`Created ${checkoutData.length} book checkout records`)
}

async function createAnalyticsSystemConfig() {
  const configData = [
    {
      key: 'analytics_enabled',
      value: 'true',
      description: 'Enable advanced analytics features'
    },
    {
      key: 'analytics_data_retention_days',
      value: '365',
      description: 'Number of days to retain analytics data'
    },
    {
      key: 'predictive_analytics_enabled',
      value: 'true',
      description: 'Enable predictive analytics and forecasting'
    },
    {
      key: 'real_time_analytics_enabled',
      value: 'true',
      description: 'Enable real-time analytics updates'
    },
    {
      key: 'analytics_refresh_interval_minutes',
      value: '15',
      description: 'Analytics data refresh interval in minutes'
    },
    {
      key: 'performance_monitoring_enabled',
      value: 'true',
      description: 'Enable system performance monitoring'
    },
    {
      key: 'usage_pattern_analysis_enabled',
      value: 'true',
      description: 'Enable usage pattern analysis'
    },
    {
      key: 'resource_optimization_enabled',
      value: 'true',
      description: 'Enable resource optimization recommendations'
    }
  ]

  await prisma.system_config.createMany({
    data: configData,
    skipDuplicates: true
  })

  console.log('Created analytics system configuration')
}