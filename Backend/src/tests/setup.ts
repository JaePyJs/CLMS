import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'

// Test database setup
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./test.db'
    }
  }
})

// Global test setup
beforeAll(async () => {
  // Reset database
  execSync('npx prisma migrate reset --force --skip-seed', {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || 'file:./test.db' }
  })
  
  // Run migrations
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || 'file:./test.db' }
  })
  
  // Connect to test database
  await prisma.$connect()
})

// Global test teardown
afterAll(async () => {
  // Disconnect from test database
  await prisma.$disconnect()
})

// Clean up database before each test
beforeEach(async () => {
  // Clean up all tables
  const tablenames = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_migrations';`
  
  for (const { name } of tablenames as { name: string }[]) {
    if (name !== '_prisma_migrations') {
      await prisma.$executeRawUnsafe(`DELETE FROM "${name}";`)
    }
  }
})

// Export prisma client for use in tests
export { prisma }