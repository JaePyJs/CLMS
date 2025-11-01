import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {
  waitFor,
  generateMockStudents,
  generateMockBooks,
  generateMockEquipment,
  measureExecutionTime,
  createSnapshot,
  compareSnapshots
} from '@/utils/common';

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

  return prisma.users.create({
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

  return prisma.students.create({
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

  return prisma.books.create({
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

  return prisma.student_activities.create({
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

  return prisma.equipment_sessions.create({
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
  await prisma.audit_logs.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.user.deleteMany({});
};

// Re-export utilities from common
export {
  waitFor,
  generateMockStudents,
  generateMockBooks,
  generateMockEquipment,
  measureExecutionTime,
  createSnapshot,
  compareSnapshots
};

// Load testing helper (specific to test utilities)
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
