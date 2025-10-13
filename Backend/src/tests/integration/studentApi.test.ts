import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import {
  createTestUser,
  createTestStudent,
  generateTestToken,
  cleanupDatabase,
  assertValidStudent
} from '../helpers/testUtils';

describe('Student API Integration Tests', () => {
  let authToken: string;
  let testUser: any;
  let appInstance: any;

  beforeAll(async () => {
    // Initialize app
    appInstance = (app as any).getApp();
    
    // Create test user and get auth token
    testUser = await createTestUser({ role: 'ADMIN' });
    authToken = generateTestToken(testUser.id, testUser.role);
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  beforeEach(async () => {
    // Clean students but keep user
    await cleanupDatabase();
    testUser = await createTestUser({ role: 'ADMIN' });
    authToken = generateTestToken(testUser.id, testUser.role);
  });

  describe('GET /api/students', () => {
    it('should return empty array when no students exist', async () => {
      const response = await request(appInstance)
        .get('/api/students')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.students).toEqual([]);
      expect(response.body.total).toBe(0);
    });

    it('should return all students', async () => {
      await createTestStudent({ firstName: 'John', lastName: 'Doe' });
      await createTestStudent({ firstName: 'Jane', lastName: 'Smith' });

      const response = await request(appInstance)
        .get('/api/students')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.students).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });

    it('should require authentication', async () => {
      await request(appInstance)
        .get('/api/students')
        .expect(401);
    });

    it('should support pagination', async () => {
      // Create 15 students
      for (let i = 0; i < 15; i++) {
        await createTestStudent({ studentId: `STU${String(i).padStart(3, '0')}` });
      }

      const response = await request(appInstance)
        .get('/api/students?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.students).toHaveLength(10);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.pagination.total).toBe(15);
    });

    it('should support search', async () => {
      await createTestStudent({ firstName: 'John', lastName: 'Doe' });
      await createTestStudent({ firstName: 'Jane', lastName: 'Smith' });

      const response = await request(appInstance)
        .get('/api/students?search=John')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.students).toHaveLength(1);
      expect(response.body.students[0].firstName).toBe('John');
    });

    it('should filter by status', async () => {
      await createTestStudent({ isActive: true });
      await createTestStudent({ isActive: false });

      const response = await request(appInstance)
        .get('/api/students?status=active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.students).toHaveLength(1);
      expect(response.body.students[0].isActive).toBe(true);
    });

    it('should filter by grade category', async () => {
      await createTestStudent({ gradeCategory: 'GRADE_SCHOOL' });
      await createTestStudent({ gradeCategory: 'JUNIOR_HIGH' });

      const response = await request(appInstance)
        .get('/api/students?gradeCategory=GRADE_SCHOOL')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.students).toHaveLength(1);
      expect(response.body.students[0].gradeCategory).toBe('GRADE_SCHOOL');
    });
  });

  describe('GET /api/students/:id', () => {
    it('should return student by ID', async () => {
      const student = await createTestStudent({ firstName: 'John', lastName: 'Doe' });

      const response = await request(appInstance)
        .get(`/api/students/${student.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.student.id).toBe(student.id);
      expect(response.body.student.firstName).toBe('John');
      assertValidStudent(response.body.student);
    });

    it('should return 404 for non-existent student', async () => {
      await request(appInstance)
        .get('/api/students/nonexistent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should include activities when requested', async () => {
      const student = await createTestStudent();

      const response = await request(appInstance)
        .get(`/api/students/${student.id}?include=activities`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.student).toHaveProperty('activities');
    });
  });

  describe('POST /api/students', () => {
    it('should create new student', async () => {
      const studentData = {
        studentId: 'STU001',
        firstName: 'John',
        lastName: 'Doe',
        gradeLevel: 'Grade 5',
        gradeCategory: 'GRADE_SCHOOL',
        email: 'john.doe@test.com'
      };

      const response = await request(appInstance)
        .post('/api/students')
        .set('Authorization', `Bearer ${authToken}`)
        .send(studentData)
        .expect(201);

      expect(response.body.student.studentId).toBe('STU001');
      expect(response.body.student.firstName).toBe('John');
      assertValidStudent(response.body.student);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        firstName: 'John'
        // Missing required fields
      };

      await request(appInstance)
        .post('/api/students')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);
    });

    it('should reject duplicate student ID', async () => {
      await createTestStudent({ studentId: 'STU001' });

      const studentData = {
        studentId: 'STU001',
        firstName: 'Jane',
        lastName: 'Smith',
        gradeLevel: 'Grade 5',
        gradeCategory: 'GRADE_SCHOOL'
      };

      await request(appInstance)
        .post('/api/students')
        .set('Authorization', `Bearer ${authToken}`)
        .send(studentData)
        .expect(409);
    });

    it('should set default values', async () => {
      const studentData = {
        studentId: 'STU002',
        firstName: 'John',
        lastName: 'Doe',
        gradeLevel: 'Grade 5',
        gradeCategory: 'GRADE_SCHOOL'
      };

      const response = await request(appInstance)
        .post('/api/students')
        .set('Authorization', `Bearer ${authToken}`)
        .send(studentData)
        .expect(201);

      expect(response.body.student.isActive).toBe(true);
    });
  });

  describe('PUT /api/students/:id', () => {
    it('should update student', async () => {
      const student = await createTestStudent({ firstName: 'John' });

      const updateData = {
        firstName: 'Jane',
        email: 'jane.doe@test.com'
      };

      const response = await request(appInstance)
        .put(`/api/students/${student.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.student.firstName).toBe('Jane');
      expect(response.body.student.email).toBe('jane.doe@test.com');
    });

    it('should return 404 for non-existent student', async () => {
      await request(appInstance)
        .put('/api/students/nonexistent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Jane' })
        .expect(404);
    });

    it('should not update student ID', async () => {
      const student = await createTestStudent({ studentId: 'STU001' });

      const response = await request(appInstance)
        .put(`/api/students/${student.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ studentId: 'STU999' })
        .expect(200);

      // Student ID should remain unchanged
      expect(response.body.student.studentId).toBe('STU001');
    });
  });

  describe('DELETE /api/students/:id', () => {
    it('should delete student', async () => {
      const student = await createTestStudent();

      await request(appInstance)
        .delete(`/api/students/${student.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify student is deleted
      await request(appInstance)
        .get(`/api/students/${student.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent student', async () => {
      await request(appInstance)
        .delete('/api/students/nonexistent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should require admin role', async () => {
      const librarian = await createTestUser({ role: 'LIBRARIAN' });
      const librarianToken = generateTestToken(librarian.id, 'LIBRARIAN');
      const student = await createTestStudent();

      await request(appInstance)
        .delete(`/api/students/${student.id}`)
        .set('Authorization', `Bearer ${librarianToken}`)
        .expect(403);
    });
  });

  describe('POST /api/students/bulk', () => {
    it('should create multiple students', async () => {
      const students = [
        {
          studentId: 'STU001',
          firstName: 'John',
          lastName: 'Doe',
          gradeLevel: 'Grade 5',
          gradeCategory: 'GRADE_SCHOOL'
        },
        {
          studentId: 'STU002',
          firstName: 'Jane',
          lastName: 'Smith',
          gradeLevel: 'Grade 6',
          gradeCategory: 'GRADE_SCHOOL'
        }
      ];

      const response = await request(appInstance)
        .post('/api/students/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ students })
        .expect(201);

      expect(response.body.created).toBe(2);
      expect(response.body.failed).toBe(0);
    });

    it('should handle partial failures', async () => {
      await createTestStudent({ studentId: 'STU001' });

      const students = [
        {
          studentId: 'STU001', // Duplicate
          firstName: 'John',
          lastName: 'Doe',
          gradeLevel: 'Grade 5',
          gradeCategory: 'GRADE_SCHOOL'
        },
        {
          studentId: 'STU002',
          firstName: 'Jane',
          lastName: 'Smith',
          gradeLevel: 'Grade 6',
          gradeCategory: 'GRADE_SCHOOL'
        }
      ];

      const response = await request(appInstance)
        .post('/api/students/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ students })
        .expect(207); // Multi-status

      expect(response.body.created).toBe(1);
      expect(response.body.failed).toBe(1);
    });

    it('should validate bulk limit', async () => {
      const students = Array(1001).fill(null).map((_, i) => ({
        studentId: `STU${i}`,
        firstName: `Student${i}`,
        lastName: 'Test',
        gradeLevel: 'Grade 5',
        gradeCategory: 'GRADE_SCHOOL'
      }));

      await request(appInstance)
        .post('/api/students/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ students })
        .expect(400);
    });
  });

  describe('GET /api/students/:id/activities', () => {
    it('should return student activities', async () => {
      const student = await createTestStudent();
      
      // Create some activities
      await createTestActivity(student.id, { activityType: 'LIBRARY_VISIT' });
      await createTestActivity(student.id, { activityType: 'BOOK_CHECKOUT' });

      const response = await request(appInstance)
        .get(`/api/students/${student.id}/activities`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.activities).toHaveLength(2);
    });

    it('should support activity filtering', async () => {
      const student = await createTestStudent();
      
      await createTestActivity(student.id, { activityType: 'LIBRARY_VISIT' });
      await createTestActivity(student.id, { activityType: 'BOOK_CHECKOUT' });

      const response = await request(appInstance)
        .get(`/api/students/${student.id}/activities?type=LIBRARY_VISIT`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.activities).toHaveLength(1);
      expect(response.body.activities[0].activityType).toBe('LIBRARY_VISIT');
    });
  });

  describe('Performance Tests', () => {
    it('should handle large result sets efficiently', async () => {
      // Create 100 students
      const students = Array(100).fill(null).map((_, i) => ({
        studentId: `STU${String(i).padStart(4, '0')}`,
        firstName: `Student${i}`,
        lastName: 'Test',
        gradeLevel: 'Grade 5',
        gradeCategory: 'GRADE_SCHOOL'
      }));

      await prisma.student.createMany({ data: students });

      const start = Date.now();
      const response = await request(appInstance)
        .get('/api/students?limit=100')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const duration = Date.now() - start;

      expect(response.body.students).toHaveLength(100);
      expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds
    });
  });
});
