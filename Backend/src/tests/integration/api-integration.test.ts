import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import TestDatabaseManager from '../utils/testDatabase';
import AuthTestHelper from '../utils/authHelpers';
import MockDataGenerator from '../utils/mockDataGenerator';

describe('API Integration Tests', () => {
  let testDb: TestDatabaseManager;
  let authHelper: AuthTestHelper;
  let mockDataGenerator: MockDataGenerator;
  let mockData: any;

  beforeAll(async () => {
    // Initialize test database
    testDb = new TestDatabaseManager({
      databaseUrl: process.env.DATABASE_URL || '',
      resetBeforeEachTest: false,
      seedTestData: false
    });

    await testDb.setup();

    // Initialize helpers
    authHelper = new AuthTestHelper();
    mockDataGenerator = MockDataGenerator.getInstance();

    // Generate comprehensive mock data
    mockData = await mockDataGenerator.generateMockData({
      studentsCount: 20,
      booksCount: 30,
      equipmentCount: 10,
      activitiesCount: 50,
      checkoutsCount: 40,
      usersCount: 5
    });

    // Insert mock data into test database
    await insertMockData();
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  beforeEach(async () => {
    // Clear any caches
    authHelper.clearTokenCache();
  });

  /**
   * Insert mock data into test database
   */
  async function insertMockData(): Promise<void> {
    const prisma = testDb.getPrismaClient();

    await Promise.all([
      // Insert users
      prisma.users.createMany({ data: mockData.users }),
      // Insert students
      prisma.students.createMany({ data: mockData.students }),
      // Insert books
      prisma.books.createMany({ data: mockData.books }),
      // Insert equipment
      prisma.equipment.createMany({ data: mockData.equipment }),
      // Insert activities
      prisma.student_activities.createMany({ data: mockData.activities }),
      // Insert checkouts
      prisma.book_checkouts.createMany({ data: mockData.checkouts }),
      // Insert notifications
      prisma.notifications.createMany({ data: mockData.notifications })
    ]);
  }

  describe('Authentication Endpoints', () => {
    it('should test login scenarios', async () => {
      const { results, passed } = await authHelper.testLoginScenarios();

      console.log('Login test results:', results);

      expect(passed).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // Check that valid logins succeed
      const validLogins = results.filter(r => r.name.includes('Valid login') && r.passed);
      expect(validLogins.length).toBeGreaterThan(0);
    });

    it('should test token validation', async () => {
      const { results, passed } = await authHelper.testTokenValidation();

      console.log('Token validation results:', results);

      expect(passed).toBe(true);
      expect(results.length).toBe(5);

      // Valid token should work
      const validTokenResult = results.find(r => r.name === 'Valid token');
      expect(validTokenResult?.passed).toBe(true);
    });

    it('should test refresh token functionality', async () => {
      const { results, passed } = await authHelper.testRefreshToken();

      console.log('Refresh token results:', results);

      expect(passed).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // Valid refresh should work
      const validRefreshResult = results.find(r => r.name === 'Valid refresh token');
      expect(validRefreshResult?.passed).toBe(true);
    });

    it('should test logout functionality', async () => {
      const { results, passed } = await authHelper.testLogout();

      console.log('Logout test results:', results);

      expect(passed).toBe(true);
      expect(results.length).toBe(2);

      // Logout should succeed
      const logoutResult = results.find(r => r.name === 'Valid logout');
      expect(logoutResult?.passed).toBe(true);
    });

    it('should protect endpoints without authentication', async () => {
      const protectedEndpoints = [
        { method: 'get', url: '/api/auth/me' },
        { method: 'get', url: '/api/students' },
        { method: 'get', url: '/api/books' },
        { method: 'get', url: '/api/equipment' },
        { method: 'get', url: '/api/analytics/metrics' }
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(app)[endpoint.method](endpoint.url);
        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('Students API', () => {
    let adminTokens: any;

    beforeEach(async () => {
      adminTokens = await authHelper.loginAsRole('ADMIN');
    });

    it('should get all students', async () => {
      const response = await authHelper.authenticatedRequest('get', '/api/students', adminTokens);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('students');
      expect(Array.isArray(response.body.data.students)).toBe(true);
      expect(response.body.data.students.length).toBeGreaterThan(0);
    });

    it('should get student by ID', async () => {
      const student = mockData.students[0];
      const response = await authHelper.authenticatedRequest('get', `/api/students/${student.id}`, adminTokens);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(student.id);
      expect(response.body.data.firstName).toBe(student.firstName);
    });

    it('should create a new student', async () => {
      const newStudent = {
        studentId: '2024-999',
        firstName: 'Test',
        lastName: 'Student',
        gradeLevel: 'Grade 10',
        gradeCategory: 'JUNIOR_HIGH',
        section: 'Z'
      };

      const response = await authHelper.authenticatedRequest('post', '/api/students', adminTokens, newStudent);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.firstName).toBe(newStudent.firstName);
      expect(response.body.data.studentId).toBe(newStudent.studentId);
    });

    it('should update a student', async () => {
      const student = mockData.students[0];
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name'
      };

      const response = await authHelper.authenticatedRequest('put', `/api/students/${student.id}`, adminTokens, updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.firstName).toBe(updateData.firstName);
      expect(response.body.data.lastName).toBe(updateData.lastName);
    });

    it('should delete a student', async () => {
      const student = mockData.students[mockData.students.length - 1];
      const response = await authHelper.authenticatedRequest('delete', `/api/students/${student.id}`, adminTokens);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');
    });

    it('should scan student barcode', async () => {
      const student = mockData.students[0];
      const response = await authHelper.authenticatedRequest('post', '/api/students/scan', adminTokens, {
        barcode: student.studentId
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(student.id);
    });

    it('should get student activities', async () => {
      const response = await authHelper.authenticatedRequest('get', '/api/students/activities/all', adminTokens);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('activities');
      expect(Array.isArray(response.body.data.activities)).toBe(true);
    });

    it('should get active sessions', async () => {
      const response = await authHelper.authenticatedRequest('get', '/api/students/activities/active', adminTokens);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should create student activity', async () => {
      const student = mockData.students[0];
      const activity = {
        studentId: student.id,
        activityType: 'COMPUTER_USE',
        timeLimitMinutes: 60,
        notes: 'Test activity'
      };

      const response = await authHelper.authenticatedRequest('post', '/api/students/activities', adminTokens, activity);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.studentId).toBe(student.id);
      expect(response.body.data.activityType).toBe(activity.activityType);
    });

    it('should respect role-based access control', async () => {
      const { results, passed } = await authHelper.testRoleBasedAccess('/api/students', 'get', [], ['STUDENTS_VIEW']);

      console.log('Students RBAC results:', results);

      expect(passed).toBe(true);

      // All roles should have view access
      const viewerResult = results.find(r => r.role === 'VIEWER');
      expect(viewerResult?.actualStatus).toBe(200);
    });
  });

  describe('Books API', () => {
    let librarianTokens: any;

    beforeEach(async () => {
      librarianTokens = await authHelper.loginAsRole('LIBRARIAN');
    });

    it('should get all books', async () => {
      const response = await authHelper.authenticatedRequest('get', '/api/books', librarianTokens);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('books');
      expect(Array.isArray(response.body.data.books)).toBe(true);
      expect(response.body.data.books.length).toBeGreaterThan(0);
    });

    it('should get book by ID', async () => {
      const book = mockData.books[0];
      const response = await authHelper.authenticatedRequest('get', `/api/books/${book.id}`, librarianTokens);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(book.id);
      expect(response.body.data.title).toBe(book.title);
    });

    it('should create a new book', async () => {
      const newBook = {
        accessionNo: 'ACC-TEST-001',
        title: 'Test Book for Integration',
        author: 'Test Author',
        category: 'Fiction',
        subcategory: 'Test Fiction',
        location: 'TEST-001',
        totalCopies: 2,
        availableCopies: 2,
        isbn: '9780123456789'
      };

      const response = await authHelper.authenticatedRequest('post', '/api/books', librarianTokens, newBook);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(newBook.title);
      expect(response.body.data.accessionNo).toBe(newBook.accessionNo);
    });

    it('should update a book', async () => {
      const book = mockData.books[0];
      const updateData = {
        title: 'Updated Book Title',
        author: 'Updated Author Name'
      };

      const response = await authHelper.authenticatedRequest('put', `/api/books/${book.id}`, librarianTokens, updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updateData.title);
      expect(response.body.data.author).toBe(updateData.author);
    });

    it('should scan book barcode', async () => {
      const book = mockData.books[0];
      const response = await authHelper.authenticatedRequest('post', '/api/books/scan', librarianTokens, {
        barcode: book.accessionNo
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(book.id);
    });

    it('should checkout a book', async () => {
      const book = mockData.books.find(b => b.availableCopies > 0);
      const student = mockData.students[0];

      if (book) {
        const checkoutData = {
          bookId: book.id,
          studentId: student.id,
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 2 weeks from now
          notes: 'Test checkout'
        };

        const response = await authHelper.authenticatedRequest('post', '/api/books/checkout', librarianTokens, checkoutData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.bookId).toBe(book.id);
        expect(response.body.data.studentId).toBe(student.id);
      }
    });

    it('should get book checkouts', async () => {
      const response = await authHelper.authenticatedRequest('get', '/api/books/checkouts/all', librarianTokens);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('checkouts');
      expect(Array.isArray(response.body.data.checkouts)).toBe(true);
    });

    it('should get overdue books', async () => {
      const response = await authHelper.authenticatedRequest('get', '/api/books/checkouts/overdue', librarianTokens);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Equipment API', () => {
    let adminTokens: any;

    beforeEach(async () => {
      adminTokens = await authHelper.loginAsRole('ADMIN');
    });

    it('should get all equipment', async () => {
      const response = await authHelper.authenticatedRequest('get', '/api/equipment', adminTokens);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('equipment');
      expect(Array.isArray(response.body.data.equipment)).toBe(true);
      expect(response.body.data.equipment.length).toBeGreaterThan(0);
    });

    it('should get equipment by ID', async () => {
      const equipment = mockData.equipment[0];
      const response = await authHelper.authenticatedRequest('get', `/api/equipment/${equipment.id}`, adminTokens);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(equipment.id);
      expect(response.body.data.name).toBe(equipment.name);
    });

    it('should create new equipment', async () => {
      const newEquipment = {
        equipmentId: 'TEST-001',
        name: 'Test Equipment for Integration',
        type: 'COMPUTER',
        location: 'Test Lab',
        maxTimeMinutes: 60,
        requiresSupervision: false,
        description: 'Test equipment description'
      };

      const response = await authHelper.authenticatedRequest('post', '/api/equipment', adminTokens, newEquipment);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(newEquipment.name);
      expect(response.body.data.equipmentId).toBe(newEquipment.equipmentId);
    });

    it('should scan equipment barcode', async () => {
      const equipment = mockData.equipment[0];
      const response = await authHelper.authenticatedRequest('post', '/api/equipment/scan', adminTokens, {
        barcode: equipment.equipmentId
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(equipment.id);
    });

    it('should use equipment', async () => {
      const equipment = mockData.equipment.find(e => e.status === 'AVAILABLE');
      const student = mockData.students[0];

      if (equipment) {
        const useData = {
          equipmentId: equipment.id,
          studentId: student.id,
          activityType: 'COMPUTER_USE',
          timeLimitMinutes: 60,
          notes: 'Test equipment use'
        };

        const response = await authHelper.authenticatedRequest('post', '/api/equipment/use', adminTokens, useData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.equipmentId).toBe(equipment.id);
        expect(response.body.data.studentId).toBe(student.id);
      }
    });

    it('should get equipment usage history', async () => {
      const response = await authHelper.authenticatedRequest('get', '/api/equipment/usage/history', adminTokens);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('usageHistory');
      expect(Array.isArray(response.body.data.usageHistory)).toBe(true);
    });

    it('should get equipment statistics', async () => {
      const response = await authHelper.authenticatedRequest('get', '/api/equipment/statistics', adminTokens);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(typeof response.body.data).toBe('object');
    });
  });

  describe('Analytics API', () => {
    let superAdminTokens: any;

    beforeEach(async () => {
      superAdminTokens = await authHelper.loginAsRole('SUPER_ADMIN');
    });

    it('should get dashboard metrics', async () => {
      const response = await authHelper.authenticatedRequest('get', '/api/analytics/metrics', superAdminTokens);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overview');
      expect(response.body.data).toHaveProperty('equipment');
      expect(response.body.data).toHaveProperty('books');
      expect(response.body.data).toHaveProperty('usage');
      expect(response.body.data).toHaveProperty('system');
    });

    it('should get activity timeline', async () => {
      const response = await authHelper.authenticatedRequest('get', '/api/analytics/timeline', superAdminTokens, null, {
        limit: '10'
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('timeline');
      expect(Array.isArray(response.body.data.timeline)).toBe(true);
    });

    it('should get system notifications', async () => {
      const response = await authHelper.authenticatedRequest('get', '/api/analytics/notifications', superAdminTokens);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('notifications');
      expect(Array.isArray(response.body.data.notifications)).toBe(true);
    });

    it('should get predictive insights', async () => {
      const response = await authHelper.authenticatedRequest('get', '/api/analytics/insights', superAdminTokens, null, {
        timeframe: 'week'
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('insights');
    });

    it('should get usage heatmap data', async () => {
      const response = await authHelper.authenticatedRequest('get', '/api/analytics/heatmap', superAdminTokens, null, {
        timeframe: 'week'
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('heatMapData');
    });

    it('should get analytics summary', async () => {
      const response = await authHelper.authenticatedRequest('get', '/api/analytics/summary', superAdminTokens, null, {
        timeframe: 'week'
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('timeframe');
      expect(response.body.data).toHaveProperty('insights');
      expect(response.body.data).toHaveProperty('baseMetrics');
    });
  });

  describe('Automation API', () => {
    let superAdminTokens: any;

    beforeEach(async () => {
      superAdminTokens = await authHelper.loginAsRole('SUPER_ADMIN');
    });

    it('should get all automation jobs', async () => {
      const response = await authHelper.authenticatedRequest('get', '/api/automation/jobs', superAdminTokens);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should get queue status', async () => {
      const response = await authHelper.authenticatedRequest('get', '/api/automation/queues/status', superAdminTokens);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(typeof response.body.data).toBe('object');
    });

    it('should test Google Sheets connection', async () => {
      const response = await authHelper.authenticatedRequest('get', '/api/automation/google-sheets/test', superAdminTokens);

      expect(response.status).toBe(200);
      expect(response.body.success).toBeDefined();
      expect(response.body.data).toHaveProperty('connected');
    });

    it('should generate daily report', async () => {
      const response = await authHelper.authenticatedRequest('get', '/api/automation/reports/daily', superAdminTokens, null, {
        date: new Date().toISOString().split('T')[0]
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(typeof response.body.data).toBe('object');
    });
  });

  describe('Error Handling', () => {
    let librarianTokens: any;

    beforeEach(async () => {
      librarianTokens = await authHelper.loginAsRole('LIBRARIAN');
    });

    it('should handle 404 errors gracefully', async () => {
      const response = await authHelper.authenticatedRequest('get', '/api/students/nonexistent-id', librarianTokens);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle validation errors', async () => {
      const response = await authHelper.authenticatedRequest('post', '/api/students', librarianTokens, {
        // Missing required fields
        firstName: 'Test'
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${librarianTokens.accessToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
    });

    it('should respect rate limiting (if implemented)', async () => {
      // Make multiple rapid requests to test rate limiting
      const promises = Array(10).fill(null).map(() =>
        authHelper.authenticatedRequest('get', '/api/students', librarianTokens)
      );

      const responses = await Promise.all(promises);

      // At least some requests should succeed
      const successResponses = responses.filter(r => r.status === 200);
      expect(successResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Input Validation and Security', () => {
    let adminTokens: any;

    beforeEach(async () => {
      adminTokens = await authHelper.loginAsRole('ADMIN');
    });

    it('should prevent SQL injection attempts', async () => {
      const maliciousInput = {
        studentId: "'; DROP TABLE students; --",
        firstName: '<script>alert("xss")</script>',
        lastName: "admin'; UPDATE users SET role = 'SUPER_ADMIN' WHERE username = 'test'; --"
      };

      const response = await authHelper.authenticatedRequest('post', '/api/students', adminTokens, maliciousInput);

      // Should either reject with validation error or sanitize input
      expect([400, 422, 201]).toContain(response.status);

      if (response.status === 201) {
        // If created, ensure malicious content was sanitized
        expect(response.body.data.firstName).not.toContain('<script>');
      }
    });

    it('should validate data types and formats', async () => {
      const invalidData = {
        studentId: 123, // Should be string
        firstName: '', // Should not be empty
        gradeLevel: 'Invalid Grade',
        gradeCategory: 'INVALID_CATEGORY'
      };

      const response = await authHelper.authenticatedRequest('post', '/api/students', adminTokens, invalidData);

      expect([400, 422]).toContain(response.status);
      expect(response.body.success).toBe(false);
    });

    it('should handle large payloads appropriately', async () => {
      const largeData = {
        studentId: '2024-LARGE',
        firstName: 'A'.repeat(10000), // Very long name
        lastName: 'Test',
        gradeLevel: 'Grade 10',
        gradeCategory: 'JUNIOR_HIGH',
        notes: 'B'.repeat(50000) // Very long notes
      };

      const response = await authHelper.authenticatedRequest('post', '/api/students', adminTokens, largeData);

      // Should either accept with truncation or reject with appropriate error
      expect([201, 400, 413]).toContain(response.status);
    });
  });

  describe('Data Consistency and Integrity', () => {
    let adminTokens: any;

    beforeEach(async () => {
      adminTokens = await authHelper.loginAsRole('ADMIN');
    });

    it('should maintain foreign key constraints', async () => {
      // Try to create activity with non-existent student
      const activityData = {
        studentId: 'non-existent-student-id',
        activityType: 'COMPUTER_USE',
        timeLimitMinutes: 60
      };

      const response = await authHelper.authenticatedRequest('post', '/api/students/activities', adminTokens, activityData);

      expect([400, 404, 422]).toContain(response.status);
    });

    it('should prevent duplicate unique constraints', async () => {
      const existingStudent = mockData.students[0];

      const duplicateStudent = {
        studentId: existingStudent.studentId, // Same ID
        firstName: 'Different',
        lastName: 'Name',
        gradeLevel: 'Grade 10',
        gradeCategory: 'JUNIOR_HIGH'
      };

      const response = await authHelper.authenticatedRequest('post', '/api/students', adminTokens, duplicateStudent);

      expect([400, 409]).toContain(response.status);
      expect(response.body.success).toBe(false);
    });

    it('should handle concurrent operations safely', async () => {
      const student = mockData.students[0];

      // Create multiple concurrent activities for the same student
      const activityData = {
        studentId: student.id,
        activityType: 'COMPUTER_USE',
        timeLimitMinutes: 60
      };

      const promises = Array(5).fill(null).map(() =>
        authHelper.authenticatedRequest('post', '/api/students/activities', adminTokens, activityData)
      );

      const responses = await Promise.all(promises);

      // All should either succeed or fail gracefully
      responses.forEach(response => {
        expect([201, 400, 422]).toContain(response.status);
      });
    });
  });

  describe('Performance and Load Testing', () => {
    let adminTokens: any;

    beforeEach(async () => {
      adminTokens = await authHelper.loginAsRole('ADMIN');
    });

    it('should handle reasonable load within acceptable time', async () => {
      const startTime = Date.now();
      const requestCount = 50;

      const promises = Array(requestCount).fill(null).map(() =>
        authHelper.authenticatedRequest('get', '/api/students', adminTokens, null, { limit: '10' })
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      const successResponses = responses.filter(r => r.status === 200);
      expect(successResponses.length).toBe(requestCount);

      // Should complete within reasonable time (5 seconds for 50 requests)
      expect(totalTime).toBeLessThan(5000);

      // Average response time should be reasonable
      const avgResponseTime = totalTime / requestCount;
      expect(avgResponseTime).toBeLessThan(200); // 200ms per request
    });

    it('should handle large dataset queries efficiently', async () => {
      const startTime = Date.now();

      const response = await authHelper.authenticatedRequest('get', '/api/students', adminTokens, null, {
        limit: '1000'
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe('API Response Format Consistency', () => {
    let adminTokens: any;

    beforeEach(async () => {
      adminTokens = await authHelper.loginAsRole('ADMIN');
    });

    it('should maintain consistent response format for successful requests', async () => {
      const endpoints = [
        { method: 'get', url: '/api/students' },
        { method: 'get', url: '/api/books' },
        { method: 'get', url: '/api/equipment' },
        { method: 'get', url: '/api/analytics/metrics' }
      ];

      for (const endpoint of endpoints) {
        const response = await authHelper.authenticatedRequest(endpoint.method as any, endpoint.url, adminTokens);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('timestamp');
        expect(typeof new Date(response.body.timestamp).getTime()).toBe('number');
      }
    });

    it('should maintain consistent error response format', async () => {
      // Test various error scenarios
      const errorScenarios = [
        { request: () => authHelper.authenticatedRequest('get', '/api/students/nonexistent', adminTokens), expectedStatus: 404 },
        { request: () => authHelper.authenticatedRequest('post', '/api/students', adminTokens, {}), expectedStatus: 400 },
        { request: () => request(app).get('/api/students'), expectedStatus: 401 }
      ];

      for (const scenario of errorScenarios) {
        const response = await scenario.request();

        expect(response.status).toBe(scenario.expectedStatus);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('timestamp');
      }
    });
  });
});