import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export const prisma = new PrismaClient();

// Test data factories
export const createTestUser = async (overrides = {}) => {
  const defaultUser = {
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: await bcrypt.hash('Test123!@#', 10),
    role: 'LIBRARIAN',
    isActive: true,
    ...overrides
  };

  return prisma.user.create({
    data: defaultUser
  });
};

export const createTestStudent = async (overrides = {}) => {
  const defaultStudent = {
    studentId: `STU${Date.now()}`,
    firstName: 'Test',
    lastName: 'Student',
    gradeLevel: 'Grade 5',
    gradeCategory: 'GRADE_SCHOOL',
    isActive: true,
    ...overrides
  };

  return prisma.student.create({
    data: defaultStudent
  });
};

export const createTestBook = async (overrides = {}) => {
  const defaultBook = {
    title: `Test Book ${Date.now()}`,
    author: 'Test Author',
    isbn: `ISBN${Date.now()}`,
    accessionNumber: `ACC${Date.now()}`,
    status: 'AVAILABLE',
    category: 'Fiction',
    ...overrides
  };

  return prisma.book.create({
    data: defaultBook
  });
};

export const createTestEquipment = async (overrides = {}) => {
  const defaultEquipment = {
    equipmentId: `EQ${Date.now()}`,
    name: `Test Equipment ${Date.now()}`,
    type: 'COMPUTER',
    status: 'AVAILABLE',
    ...overrides
  };

  return prisma.equipment.create({
    data: defaultEquipment
  });
};

export const createTestActivity = async (studentId: string, overrides = {}) => {
  const defaultActivity = {
    studentId,
    activityType: 'LIBRARY_VISIT',
    checkInTime: new Date(),
    status: 'ACTIVE',
    ...overrides
  };

  return prisma.studentActivity.create({
    data: defaultActivity
  });
};

export const createTestEquipmentSession = async (
  equipmentId: string,
  studentId: string,
  overrides = {}
) => {
  const defaultSession = {
    equipmentId,
    studentId,
    startTime: new Date(),
    timeLimitMinutes: 30,
    status: 'ACTIVE',
    ...overrides
  };

  return prisma.equipmentSession.create({
    data: defaultSession
  });
};

// Authentication helpers
export const generateTestToken = (userId: string, role: string = 'LIBRARIAN') => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

export const getAuthHeaders = (token: string) => {
  return {
    Authorization: `Bearer ${token}`
  };
};

// Database cleanup
export const cleanupDatabase = async () => {
  // Delete in correct order to respect foreign key constraints
  await prisma.equipmentSession.deleteMany({});
  await prisma.studentActivity.deleteMany({});
  await prisma.book.deleteMany({});
  await prisma.equipment.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.user.deleteMany({});
};

// Wait for condition
export const waitFor = async (
  condition: () => Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error('Timeout waiting for condition');
};

// Mock data generators
export const generateMockStudents = (count: number) => {
  const gradeCategories = ['PRIMARY', 'GRADE_SCHOOL', 'JUNIOR_HIGH', 'SENIOR_HIGH'];
  const gradeLevels = ['Grade 1', 'Grade 3', 'Grade 5', 'Grade 7', 'Grade 9', 'Grade 11'];

  return Array.from({ length: count }, (_, i) => ({
    studentId: `STU${String(i + 1).padStart(4, '0')}`,
    firstName: `Student${i + 1}`,
    lastName: `Test${i + 1}`,
    gradeLevel: gradeLevels[i % gradeLevels.length],
    gradeCategory: gradeCategories[i % gradeCategories.length],
    email: `student${i + 1}@test.com`,
    isActive: true
  }));
};

export const generateMockBooks = (count: number) => {
  const categories = ['Fiction', 'Non-Fiction', 'Science', 'History', 'Mathematics'];
  
  return Array.from({ length: count }, (_, i) => ({
    title: `Test Book ${i + 1}`,
    author: `Author ${i + 1}`,
    isbn: `ISBN${String(i + 1).padStart(13, '0')}`,
    accessionNumber: `ACC${String(i + 1).padStart(6, '0')}`,
    category: categories[i % categories.length],
    status: 'AVAILABLE'
  }));
};

export const generateMockEquipment = (count: number) => {
  const types = ['COMPUTER', 'GAMING', 'AVR', 'TABLET'];
  
  return Array.from({ length: count }, (_, i) => ({
    equipmentId: `EQ${String(i + 1).padStart(3, '0')}`,
    name: `Equipment ${i + 1}`,
    type: types[i % types.length],
    status: 'AVAILABLE'
  }));
};

// Performance testing helpers
export const measureExecutionTime = async <T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> => {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  
  return { result, duration };
};

export const runLoadTest = async (
  testFn: () => Promise<void>,
  iterations: number = 100,
  concurrency: number = 10
): Promise<{
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  successRate: number;
}> => {
  const times: number[] = [];
  let successCount = 0;

  const start = Date.now();

  // Run in batches for concurrency
  for (let i = 0; i < iterations; i += concurrency) {
    const batch = Math.min(concurrency, iterations - i);
    const promises = Array.from({ length: batch }, async () => {
      const iterStart = Date.now();
      try {
        await testFn();
        successCount++;
        return Date.now() - iterStart;
      } catch (error) {
        return Date.now() - iterStart;
      }
    });

    const batchTimes = await Promise.all(promises);
    times.push(...batchTimes);
  }

  const totalTime = Date.now() - start;

  return {
    totalTime,
    averageTime: times.reduce((a, b) => a + b, 0) / times.length,
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
    successRate: (successCount / iterations) * 100
  };
};

// Assertion helpers
export const assertDatesClose = (
  date1: Date,
  date2: Date,
  toleranceMs: number = 1000
) => {
  const diff = Math.abs(date1.getTime() - date2.getTime());
  if (diff > toleranceMs) {
    throw new Error(
      `Dates differ by ${diff}ms, expected within ${toleranceMs}ms`
    );
  }
};

export const assertValidStudent = (student: any) => {
  if (!student.studentId) throw new Error('Student missing studentId');
  if (!student.firstName) throw new Error('Student missing firstName');
  if (!student.lastName) throw new Error('Student missing lastName');
  if (!student.gradeLevel) throw new Error('Student missing gradeLevel');
  if (!student.gradeCategory) throw new Error('Student missing gradeCategory');
};

export const assertValidBook = (book: any) => {
  if (!book.title) throw new Error('Book missing title');
  if (!book.author) throw new Error('Book missing author');
  if (!book.accessionNumber) throw new Error('Book missing accessionNumber');
  if (!book.status) throw new Error('Book missing status');
};

// Snapshot testing helpers
export const createSnapshot = (data: any) => {
  return JSON.stringify(data, null, 2);
};

export const compareSnapshots = (snapshot1: string, snapshot2: string) => {
  return snapshot1 === snapshot2;
};

// Test lifecycle hooks
export const setupTestDatabase = async () => {
  await cleanupDatabase();
  console.log('Test database cleaned');
};

export const teardownTestDatabase = async () => {
  await cleanupDatabase();
  await prisma.$disconnect();
  console.log('Test database disconnected');
};

// Export all utilities
export default {
  prisma,
  createTestUser,
  createTestStudent,
  createTestBook,
  createTestEquipment,
  createTestActivity,
  createTestEquipmentSession,
  generateTestToken,
  getAuthHeaders,
  cleanupDatabase,
  waitFor,
  generateMockStudents,
  generateMockBooks,
  generateMockEquipment,
  measureExecutionTime,
  runLoadTest,
  assertDatesClose,
  assertValidStudent,
  assertValidBook,
  createSnapshot,
  compareSnapshots,
  setupTestDatabase,
  teardownTestDatabase
};
