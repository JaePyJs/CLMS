import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { prismaMiddleware } from '@/middleware/prisma.middleware';

describe('Prisma Middleware', () => {
  let prisma: PrismaClient;
  let middlewareCalls: any[] = [];

  beforeEach(() => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: ['error'],
    });

    // Apply middleware and capture calls for testing
    middlewareCalls = [];
    const originalMiddleware = prismaMiddleware();
    
    prisma.$use(async (params, next) => {
      middlewareCalls.push(params);
      return originalMiddleware(params, next);
    });
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('ID Generation', () => {
    it('should generate ID for new student if not provided', async () => {
      const studentData = {
        student_id: `TEST_${Date.now()}`,
        first_name: 'Test',
        last_name: 'Student',
        grade_level: '10',
        grade_category: 'JUNIOR_HIGH',
        updated_at: new Date(),
      };

      const createdStudent = await prisma.students.create({
        data: studentData,
      });

      expect(createdStudent.id).toBeDefined();
      expect(createdStudent.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(createdStudent.student_id).toBe(studentData.student_id);
    });

    it('should not override ID if provided', async () => {
      const providedId = crypto.randomUUID();
      const studentData = {
        id: providedId,
        student_id: `TEST_${Date.now()}`,
        first_name: 'Test',
        last_name: 'Student',
        grade_level: '10',
        grade_category: 'JUNIOR_HIGH',
        updated_at: new Date(),
      };

      const createdStudent = await prisma.students.create({
        data: studentData,
      });

      expect(createdStudent.id).toBe(providedId);
    });

    it('should generate IDs for bulk create operations', async () => {
      const studentsData = [
        {
          student_id: `TEST_${Date.now()}_1`,
          first_name: 'Test',
          last_name: 'Student 1',
          grade_level: '10',
          grade_category: 'JUNIOR_HIGH',
          updated_at: new Date(),
        },
        {
          student_id: `TEST_${Date.now()}_2`,
          first_name: 'Test',
          last_name: 'Student 2',
          grade_level: '11',
          grade_category: 'JUNIOR_HIGH',
          updated_at: new Date(),
        },
      ];

      const createdStudents = await prisma.students.createMany({
        data: studentsData,
      });

      // Note: createMany doesn't return the created records, so we need to query them
      const retrievedStudents = await prisma.students.findMany({
        where: {
          student_id: {
            in: [studentsData[0].student_id, studentsData[1].student_id],
          },
        },
      });

      expect(retrievedStudents).toHaveLength(2);
      retrievedStudents.forEach(student => {
        expect(student.id).toBeDefined();
        expect(student.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      });
    });
  });

  describe('Timestamp Management', () => {
    it('should set created_at and updated_at for new records', async () => {
      const beforeCreate = new Date();
      
      const studentData = {
        student_id: `TEST_${Date.now()}`,
        first_name: 'Test',
        last_name: 'Student',
        grade_level: '10',
        grade_category: 'JUNIOR_HIGH',
        updated_at: new Date(),
      };

      const createdStudent = await prisma.students.create({
        data: studentData,
      });

      const afterCreate = new Date();

      expect(createdStudent.created_at).toBeDefined();
      expect(createdStudent.updated_at).toBeDefined();
      expect(createdStudent.created_at.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(createdStudent.created_at.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
      expect(createdStudent.updated_at.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(createdStudent.updated_at.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    });

    it('should update updated_at for update operations', async () => {
      // Create a student first
      const student = await prisma.students.create({
        data: {
          student_id: `TEST_${Date.now()}`,
          first_name: 'Test',
          last_name: 'Student',
          grade_level: '10',
          grade_category: 'JUNIOR_HIGH',
          updated_at: new Date(),
        },
      });

      const originalUpdatedAt = student.updated_at;
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update the student
      const beforeUpdate = new Date();
      const updatedStudent = await prisma.students.update({
        where: { id: student.id },
        data: { first_name: 'Updated' },
      });
      const afterUpdate = new Date();

      expect(updatedStudent.updated_at).toBeDefined();
      expect(updatedStudent.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
      expect(updatedStudent.updated_at.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
      expect(updatedStudent.updated_at.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
      expect(updatedStudent.first_name).toBe('Updated');
    });

    it('should not override provided timestamps', async () => {
      const customCreatedAt = new Date('2023-01-01T00:00:00Z');
      const customUpdatedAt = new Date('2023-01-01T00:00:00Z');

      const studentData = {
        student_id: `TEST_${Date.now()}`,
        first_name: 'Test',
        last_name: 'Student',
        grade_level: '10',
        grade_category: 'JUNIOR_HIGH',
        created_at: customCreatedAt,
        updated_at: customUpdatedAt,
      };

      const createdStudent = await prisma.students.create({
        data: studentData,
      });

      expect(createdStudent.created_at).toEqual(customCreatedAt);
      expect(createdStudent.updated_at).toEqual(customUpdatedAt);
    });
  });

  describe('Upsert Operations', () => {
    it('should handle create case in upsert', async () => {
      const studentId = `TEST_${Date.now()}`;
      
      const upsertedStudent = await prisma.students.upsert({
        where: { student_id: studentId },
        create: {
          student_id: studentId,
          first_name: 'Test',
          last_name: 'Student',
          grade_level: '10',
          grade_category: 'JUNIOR_HIGH',
        },
        update: {
          first_name: 'Updated',
        },
      });

      expect(upsertedStudent.id).toBeDefined();
      expect(upsertedStudent.created_at).toBeDefined();
      expect(upsertedStudent.updated_at).toBeDefined();
      expect(upsertedStudent.first_name).toBe('Test');
    });

    it('should handle update case in upsert', async () => {
      // Create a student first
      const studentId = `TEST_${Date.now()}`;
      await prisma.students.create({
        data: {
          student_id: studentId,
          first_name: 'Test',
          last_name: 'Student',
          grade_level: '10',
          grade_category: 'JUNIOR_HIGH',
          updated_at: new Date(),
        },
      });

      const originalUpdatedAt = new Date();
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const upsertedStudent = await prisma.students.upsert({
        where: { student_id: studentId },
        create: {
          student_id: studentId,
          first_name: 'Test',
          last_name: 'Student',
          grade_level: '10',
          grade_category: 'JUNIOR_HIGH',
        },
        update: {
          first_name: 'Updated',
        },
      });

      expect(upsertedStudent.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
      expect(upsertedStudent.first_name).toBe('Updated');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid data gracefully', async () => {
      const invalidData = {
        student_id: '', // Invalid empty student_id
        first_name: 'Test',
        last_name: 'Student',
        grade_level: '10',
        grade_category: 'JUNIOR_HIGH',
        updated_at: new Date(),
      };

      await expect(
        prisma.students.create({
          data: invalidData,
        })
      ).rejects.toThrow();
    });
  });

  describe('Performance Monitoring', () => {
    it('should log slow operations', async () => {
      // This test is more for ensuring the monitoring code path is executed
      // In a real scenario, we'd need to mock the logger or use a test database
      const studentData = {
        student_id: `TEST_${Date.now()}`,
        first_name: 'Test',
        last_name: 'Student',
        grade_level: '10',
        grade_category: 'JUNIOR_HIGH',
        updated_at: new Date(),
      };

      const startTime = Date.now();
      await prisma.students.create({
        data: studentData,
      });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete quickly
    });
  });
});