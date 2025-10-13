import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createTestStudent,
  cleanupDatabase,
  generateMockStudents,
  assertValidStudent,
  prisma
} from '../helpers/testUtils';

describe('StudentService Unit Tests', () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  describe('Student Creation', () => {
    it('should create a student with valid data', async () => {
      const studentData = {
        studentId: 'STU001',
        firstName: 'John',
        lastName: 'Doe',
        gradeLevel: 'Grade 5',
        gradeCategory: 'GRADE_SCHOOL'
      };

      const student = await createTestStudent(studentData);

      expect(student).toBeDefined();
      expect(student.studentId).toBe('STU001');
      expect(student.firstName).toBe('John');
      expect(student.lastName).toBe('Doe');
      assertValidStudent(student);
    });

    it('should create student with default values', async () => {
      const student = await createTestStudent();

      expect(student.isActive).toBe(true);
      expect(student.gradeCategory).toBeDefined();
    });

    it('should reject duplicate student IDs', async () => {
      await createTestStudent({ studentId: 'STU001' });

      await expect(
        createTestStudent({ studentId: 'STU001' })
      ).rejects.toThrow();
    });

    it('should validate required fields', async () => {
      await expect(
        prisma.student.create({
          data: {
            // Missing required fields
            firstName: 'John'
          } as any
        })
      ).rejects.toThrow();
    });
  });

  describe('Student Retrieval', () => {
    it('should find student by ID', async () => {
      const created = await createTestStudent({ studentId: 'STU001' });

      const found = await prisma.student.findUnique({
        where: { id: created.id }
      });

      expect(found).toBeDefined();
      expect(found?.studentId).toBe('STU001');
    });

    it('should find student by student ID', async () => {
      await createTestStudent({ studentId: 'STU001' });

      const found = await prisma.student.findUnique({
        where: { studentId: 'STU001' }
      });

      expect(found).toBeDefined();
      expect(found?.studentId).toBe('STU001');
    });

    it('should return null for non-existent student', async () => {
      const found = await prisma.student.findUnique({
        where: { studentId: 'NONEXISTENT' }
      });

      expect(found).toBeNull();
    });

    it('should find multiple students', async () => {
      const students = generateMockStudents(5);
      await prisma.student.createMany({ data: students });

      const found = await prisma.student.findMany();

      expect(found).toHaveLength(5);
    });

    it('should filter active students', async () => {
      await createTestStudent({ isActive: true });
      await createTestStudent({ isActive: true });
      await createTestStudent({ isActive: false });

      const activeStudents = await prisma.student.findMany({
        where: { isActive: true }
      });

      expect(activeStudents).toHaveLength(2);
    });
  });

  describe('Student Update', () => {
    it('should update student information', async () => {
      const student = await createTestStudent({
        firstName: 'John',
        lastName: 'Doe'
      });

      const updated = await prisma.student.update({
        where: { id: student.id },
        data: { firstName: 'Jane' }
      });

      expect(updated.firstName).toBe('Jane');
      expect(updated.lastName).toBe('Doe');
    });

    it('should update student status', async () => {
      const student = await createTestStudent({ isActive: true });

      const updated = await prisma.student.update({
        where: { id: student.id },
        data: { isActive: false }
      });

      expect(updated.isActive).toBe(false);
    });

    it('should update multiple fields', async () => {
      const student = await createTestStudent();

      const updated = await prisma.student.update({
        where: { id: student.id },
        data: {
          firstName: 'Updated',
          gradeLevel: 'Grade 6',
          email: 'updated@test.com'
        }
      });

      expect(updated.firstName).toBe('Updated');
      expect(updated.gradeLevel).toBe('Grade 6');
      expect(updated.email).toBe('updated@test.com');
    });
  });

  describe('Student Deletion', () => {
    it('should delete student', async () => {
      const student = await createTestStudent();

      await prisma.student.delete({
        where: { id: student.id }
      });

      const found = await prisma.student.findUnique({
        where: { id: student.id }
      });

      expect(found).toBeNull();
    });

    it('should throw error when deleting non-existent student', async () => {
      await expect(
        prisma.student.delete({
          where: { id: 'nonexistent' }
        })
      ).rejects.toThrow();
    });
  });

  describe('Student Search', () => {
    beforeEach(async () => {
      const students = [
        { firstName: 'John', lastName: 'Doe', studentId: 'STU001' },
        { firstName: 'Jane', lastName: 'Smith', studentId: 'STU002' },
        { firstName: 'Bob', lastName: 'Johnson', studentId: 'STU003' }
      ];

      for (const student of students) {
        await createTestStudent(student);
      }
    });

    it('should search by first name', async () => {
      const results = await prisma.student.findMany({
        where: {
          firstName: { contains: 'John', mode: 'insensitive' }
        }
      });

      expect(results).toHaveLength(1);
      expect(results[0].firstName).toBe('John');
    });

    it('should search by last name', async () => {
      const results = await prisma.student.findMany({
        where: {
          lastName: { contains: 'Smith', mode: 'insensitive' }
        }
      });

      expect(results).toHaveLength(1);
      expect(results[0].lastName).toBe('Smith');
    });

    it('should search by student ID', async () => {
      const results = await prisma.student.findMany({
        where: {
          studentId: { contains: 'STU002', mode: 'insensitive' }
        }
      });

      expect(results).toHaveLength(1);
      expect(results[0].studentId).toBe('STU002');
    });

    it('should perform case-insensitive search', async () => {
      const results = await prisma.student.findMany({
        where: {
          firstName: { contains: 'john', mode: 'insensitive' }
        }
      });

      expect(results).toHaveLength(1);
    });

    it('should support OR search', async () => {
      const results = await prisma.student.findMany({
        where: {
          OR: [
            { firstName: { contains: 'John' } },
            { lastName: { contains: 'Smith' } }
          ]
        }
      });

      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Student Filtering', () => {
    beforeEach(async () => {
      await createTestStudent({
        gradeLevel: 'Grade 5',
        gradeCategory: 'GRADE_SCHOOL',
        isActive: true
      });
      await createTestStudent({
        gradeLevel: 'Grade 8',
        gradeCategory: 'JUNIOR_HIGH',
        isActive: true
      });
      await createTestStudent({
        gradeLevel: 'Grade 11',
        gradeCategory: 'SENIOR_HIGH',
        isActive: false
      });
    });

    it('should filter by grade category', async () => {
      const gradeSchool = await prisma.student.findMany({
        where: { gradeCategory: 'GRADE_SCHOOL' }
      });

      expect(gradeSchool).toHaveLength(1);
      expect(gradeSchool[0].gradeCategory).toBe('GRADE_SCHOOL');
    });

    it('should filter by status', async () => {
      const inactive = await prisma.student.findMany({
        where: { isActive: false }
      });

      expect(inactive).toHaveLength(1);
    });

    it('should support multiple filters', async () => {
      const results = await prisma.student.findMany({
        where: {
          gradeCategory: 'JUNIOR_HIGH',
          isActive: true
        }
      });

      expect(results).toHaveLength(1);
      expect(results[0].gradeCategory).toBe('JUNIOR_HIGH');
    });
  });

  describe('Student Sorting', () => {
    beforeEach(async () => {
      await createTestStudent({ firstName: 'Charlie', studentId: 'STU003' });
      await createTestStudent({ firstName: 'Alice', studentId: 'STU001' });
      await createTestStudent({ firstName: 'Bob', studentId: 'STU002' });
    });

    it('should sort by first name ascending', async () => {
      const students = await prisma.student.findMany({
        orderBy: { firstName: 'asc' }
      });

      expect(students[0].firstName).toBe('Alice');
      expect(students[1].firstName).toBe('Bob');
      expect(students[2].firstName).toBe('Charlie');
    });

    it('should sort by student ID descending', async () => {
      const students = await prisma.student.findMany({
        orderBy: { studentId: 'desc' }
      });

      expect(students[0].studentId).toBe('STU003');
      expect(students[2].studentId).toBe('STU001');
    });
  });

  describe('Student Pagination', () => {
    beforeEach(async () => {
      const students = generateMockStudents(25);
      await prisma.student.createMany({ data: students });
    });

    it('should return first page', async () => {
      const students = await prisma.student.findMany({
        take: 10,
        skip: 0
      });

      expect(students).toHaveLength(10);
    });

    it('should return second page', async () => {
      const students = await prisma.student.findMany({
        take: 10,
        skip: 10
      });

      expect(students).toHaveLength(10);
    });

    it('should return correct total count', async () => {
      const count = await prisma.student.count();

      expect(count).toBe(25);
    });

    it('should handle last page with fewer items', async () => {
      const students = await prisma.student.findMany({
        take: 10,
        skip: 20
      });

      expect(students).toHaveLength(5);
    });
  });

  describe('Student Relations', () => {
    it('should include activities', async () => {
      const student = await createTestStudent();
      await prisma.studentActivity.create({
        data: {
          studentId: student.id,
          activityType: 'LIBRARY_VISIT',
          checkInTime: new Date(),
          status: 'ACTIVE'
        }
      });

      const withActivities = await prisma.student.findUnique({
        where: { id: student.id },
        include: { activities: true }
      });

      expect(withActivities?.activities).toHaveLength(1);
    });

    it('should count related records', async () => {
      const student = await createTestStudent();
      await prisma.studentActivity.createMany({
        data: [
          {
            studentId: student.id,
            activityType: 'LIBRARY_VISIT',
            checkInTime: new Date(),
            status: 'COMPLETED'
          },
          {
            studentId: student.id,
            activityType: 'BOOK_CHECKOUT',
            checkInTime: new Date(),
            status: 'COMPLETED'
          }
        ]
      });

      const withCount = await prisma.student.findUnique({
        where: { id: student.id },
        include: {
          _count: {
            select: { activities: true }
          }
        }
      });

      expect(withCount?._count.activities).toBe(2);
    });
  });

  describe('Batch Operations', () => {
    it('should create multiple students', async () => {
      const students = generateMockStudents(10);
      const result = await prisma.student.createMany({
        data: students
      });

      expect(result.count).toBe(10);
    });

    it('should skip duplicates', async () => {
      const students = [
        { studentId: 'STU001', firstName: 'John', lastName: 'Doe', gradeLevel: 'Grade 5', gradeCategory: 'GRADE_SCHOOL' },
        { studentId: 'STU001', firstName: 'Jane', lastName: 'Doe', gradeLevel: 'Grade 5', gradeCategory: 'GRADE_SCHOOL' }
      ];

      const result = await prisma.student.createMany({
        data: students,
        skipDuplicates: true
      });

      expect(result.count).toBe(1);
    });

    it('should update multiple students', async () => {
      const students = generateMockStudents(5);
      await prisma.student.createMany({ data: students });

      const updated = await prisma.student.updateMany({
        where: { gradeCategory: 'GRADE_SCHOOL' },
        data: { isActive: false }
      });

      expect(updated.count).toBeGreaterThan(0);
    });

    it('should delete multiple students', async () => {
      const students = generateMockStudents(5);
      await prisma.student.createMany({ data: students });

      const deleted = await prisma.student.deleteMany({
        where: { gradeCategory: 'PRIMARY' }
      });

      expect(deleted.count).toBeGreaterThan(0);
    });
  });
});
