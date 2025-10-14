import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';

// Import routes and middleware
import authRoutes from '@/routes/auth';
import studentRoutes from '@/routes/students';
import bookRoutes from '@/routes/books';
import equipmentRoutes from '@/routes/equipment';
import { authMiddleware } from '@/middleware/auth';
import { errorHandler } from '@/middleware/errorMiddleware';
import { requestLogger } from '@/middleware/requestLogger';
import { rateLimit } from 'express-rate-limit';

// Test utilities
import { TestDataFactory, createTestPrisma, mockPrisma } from '../factories/TestDataFactory';
import { createMockHttpContext, measurePerformance } from '../setup-comprehensive';

describe('Full Stack Integration Tests - Student Management', () => {
  let app: express.Application;
  let server: any;

  beforeEach(async () => {
    TestDataFactory.resetCounter();

    // Create Express app with all middleware
    app = express();

    // Security and performance middleware
    app.use(helmet());
    app.use(compression());
    app.use(cors({
      origin: 'http://localhost:3000',
      credentials: true
    }));
    app.use(cookieParser());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    app.use(rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // Limit each IP to 1000 requests per windowMs
      message: 'Too many requests from this IP'
    }));

    // Request logging
    app.use(requestLogger);

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // API routes
    app.use('/api/auth', authRoutes);
    app.use('/api/students', studentRoutes);
    app.use('/api/books', bookRoutes);
    app.use('/api/equipment', equipmentRoutes);

    // Error handling
    app.use(errorHandler);

    // Mock authentication for tests
    vi.mock('@/middleware/auth', () => ({
      authMiddleware: vi.fn().mockImplementation((req, res, next) => {
        req.user = {
          id: 'test-user-id',
          username: 'test-user',
          role: 'LIBRARIAN'
        };
        next();
      })
    }));

    // Mock JWT for tests
    vi.mock('@/utils/jwt', () => ({
      generateToken: vi.fn().mockReturnValue('mock-jwt-token'),
      verifyToken: vi.fn().mockReturnValue({
        id: 'test-user-id',
        username: 'test-user',
        role: 'LIBRARIAN'
      })
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (server) {
      server.close();
    }
  });

  describe('Student CRUD Operations', () => {
    beforeEach(() => {
      // Setup mock data
      const testStudents = TestDataFactory.createStudents(10);
      const testActivities = TestDataFactory.createStudentActivities(20);

      mockPrisma.students.findMany.mockResolvedValue(testStudents as any);
      mockPrisma.students.count.mockResolvedValue(testStudents.length);
      mockPrisma.students.findUnique.mockResolvedValue(testStudents[0] as any);
      mockPrisma.students.create.mockResolvedValue(testStudents[0] as any);
      mockPrisma.students.update.mockResolvedValue(testStudents[0] as any);
      mockPrisma.students.delete.mockResolvedValue(testStudents[0] as any);
      mockPrisma.student_activities.findMany.mockResolvedValue(testActivities as any);
      mockPrisma.student_activities.count.mockResolvedValue(testActivities.length);
    });

    it('should get all students with pagination', async () => {
      const response = await request(app)
        .get('/api/students?page=1&limit=5')
        .expect(200);

      expect(response.body).toHaveProperty('students');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 5,
        total: 10,
        pages: 2
      });
      expect(Array.isArray(response.body.students)).toBe(true);
    });

    it('should get student by ID', async () => {
      const testStudent = TestDataFactory.createStudent();
      mockPrisma.students.findUnique.mockResolvedValue(testStudent as any);

      const response = await request(app)
        .get(`/api/students/${testStudent.id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testStudent.id,
        student_id: testStudent.student_id,
        first_name: testStudent.first_name,
        last_name: testStudent.last_name
      });
    });

    it('should create a new student', async () => {
      const newStudentData = {
        student_id: '2023001',
        first_name: 'John',
        last_name: 'Doe',
        grade_level: 'Grade 7',
        grade_category: 'GRADE_7',
        section: '7-A'
      };

      const createdStudent = TestDataFactory.createStudent(newStudentData);
      mockPrisma.students.findUnique.mockResolvedValue(null); // No existing student
      mockPrisma.students.create.mockResolvedValue(createdStudent as any);

      const response = await request(app)
        .post('/api/students')
        .send(newStudentData)
        .expect(201);

      expect(response.body).toMatchObject(newStudentData);
      expect(mockPrisma.students.create).toHaveBeenCalledWith({
        data: newStudentData
      });
    });

    it('should reject duplicate student ID', async () => {
      const existingStudent = TestDataFactory.createStudent();
      const duplicateData = {
        student_id: existingStudent.student_id,
        first_name: 'Jane',
        last_name: 'Smith',
        grade_level: 'Grade 8',
        grade_category: 'GRADE_8',
        section: '8-B'
      };

      mockPrisma.students.findUnique.mockResolvedValue(existingStudent as any);

      const response = await request(app)
        .post('/api/students')
        .send(duplicateData)
        .expect(400);

      expect(response.body.message).toContain('Student ID already exists');
    });

    it('should update student information', async () => {
      const existingStudent = TestDataFactory.createStudent();
      const updateData = {
        first_name: 'Johnathan',
        last_name: 'Doe Updated',
        grade_level: 'Grade 8',
        grade_category: 'GRADE_8'
      };

      const updatedStudent = { ...existingStudent, ...updateData };
      mockPrisma.students.findUnique.mockResolvedValue(existingStudent as any);
      mockPrisma.students.update.mockResolvedValue(updatedStudent as any);

      const response = await request(app)
        .put(`/api/students/${existingStudent.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject(updateData);
    });

    it('should delete a student', async () => {
      const existingStudent = TestDataFactory.createStudent();
      mockPrisma.students.findUnique.mockResolvedValue(existingStudent as any);
      mockPrisma.students.delete.mockResolvedValue(existingStudent as any);

      const response = await request(app)
        .delete(`/api/students/${existingStudent.id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: existingStudent.id,
        student_id: existingStudent.student_id
      });
    });

    it('should return 404 for non-existent student', async () => {
      mockPrisma.students.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/students/non-existent-id')
        .expect(404);

      expect(response.body.message).toContain('Student not found');
    });
  });

  describe('Student Activities', () => {
    beforeEach(() => {
      const testActivities = TestDataFactory.createStudentActivities(5);
      mockPrisma.student_activities.findMany.mockResolvedValue(testActivities as any);
      mockPrisma.student_activities.count.mockResolvedValue(testActivities.length);
    });

    it('should get student activities with filters', async () => {
      const response = await request(app)
        .get('/api/students/activities?activity_type=CHECK_IN&status=ACTIVE&page=1&limit=10')
        .expect(200);

      expect(response.body).toHaveProperty('activities');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.activities)).toBe(true);
      expect(mockPrisma.student_activities.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            activity_type: 'CHECK_IN',
            status: 'ACTIVE'
          })
        })
      );
    });

    it('should create new student activity', async () => {
      const testStudent = TestDataFactory.createStudent();
      const activityData = {
        student_id: testStudent.student_id,
        activity_type: 'CHECK_IN',
        equipment_id: 'equipment-1',
        time_limit_minutes: 60,
        notes: 'Test check-in'
      };

      const createdActivity = TestDataFactory.createStudentActivity(activityData);
      mockPrisma.students.findUnique.mockResolvedValue(testStudent as any);
      mockPrisma.student_activities.create.mockResolvedValue(createdActivity as any);

      const response = await request(app)
        .post('/api/students/activities')
        .send(activityData)
        .expect(201);

      expect(response.body).toMatchObject({
        student_id: testStudent.id,
        activity_type: activityData.activity_type,
        equipment_id: activityData.equipment_id,
        time_limit_minutes: activityData.time_limit_minutes,
        notes: activityData.notes,
        status: 'ACTIVE'
      });
    });

    it('should end student activity', async () => {
      const testActivity = TestDataFactory.createStudentActivity({ status: 'ACTIVE' });
      const endedActivity = { ...testActivity, status: 'COMPLETED', end_time: new Date() };

      mockPrisma.student_activities.update.mockResolvedValueOnce(testActivity as any);
      mockPrisma.student_activities.update.mockResolvedValueOnce(endedActivity as any);

      const response = await request(app)
        .put(`/api/students/activities/${testActivity.id}/end`)
        .expect(200);

      expect(response.body.status).toBe('COMPLETED');
      expect(response.body.end_time).toBeDefined();
    });
  });

  describe('Authentication Integration', () => {
    it('should protect student endpoints with authentication', async () => {
      // Temporarily restore real auth middleware for this test
      vi.doUnmock('@/middleware/auth');
      vi.resetModules();

      const { authMiddleware: realAuthMiddleware } = await import('@/middleware/auth');

      // Remove mock and use real middleware
      app.use('/api/students', realAuthMiddleware, studentRoutes);

      const response = await request(app)
        .get('/api/students')
        .expect(401);

      expect(response.body.message).toContain('Authentication required');
    });

    it('should allow access with valid JWT token', async () => {
      // Mock successful token verification
      vi.mock('@/utils/jwt', () => ({
        verifyToken: vi.fn().mockReturnValue({
          id: 'test-user-id',
          username: 'test-user',
          role: 'LIBRARIAN'
        })
      }));

      const response = await request(app)
        .get('/api/students')
        .set('Authorization', 'Bearer valid-jwt-token')
        .expect(200);

      expect(response.body).toHaveProperty('students');
    });

    it('should reject access with invalid JWT token', async () => {
      vi.mock('@/utils/jwt', () => ({
        verifyToken: vi.fn().mockImplementation(() => {
          throw new Error('Invalid token');
        })
      }));

      const response = await request(app)
        .get('/api/students')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.message).toContain('Invalid or expired token');
    });
  });

  describe('Input Validation and Error Handling', () => {
    it('should validate student creation data', async () => {
      const invalidData = {
        student_id: '', // Empty student ID
        first_name: '', // Empty first name
        last_name: '', // Empty last name
        grade_level: '', // Empty grade level
        grade_category: 'INVALID_GRADE' // Invalid grade category
      };

      const response = await request(app)
        .post('/api/students')
        .send(invalidData)
        .expect(400);

      expect(response.body.errors).toBeDefined();
      expect(Array.isArray(response.body.errors)).toBe(true);
    });

    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/students')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}') // Malformed JSON
        .expect(400);

      expect(response.body.message).toContain('Invalid JSON');
    });

    it('should rate limit excessive requests', async () => {
      // Mock rate limiter to trigger quickly for testing
      const mockRateLimit = vi.fn().mockImplementation((req, res, next) => {
        res.status(429).json({ message: 'Too many requests' });
      });

      app.use('/api/students', mockRateLimit, studentRoutes);

      const response = await request(app)
        .get('/api/students')
        .expect(429);

      expect(response.body.message).toBe('Too many requests');
    });

    it('should handle database connection errors', async () => {
      mockPrisma.students.findMany.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/students')
        .expect(500);

      expect(response.body.message).toContain('Internal server error');
    });
  });

  describe('Performance Tests', () => {
    it('should handle large datasets efficiently', async () => {
      const largeStudentList = TestDataFactory.createStudents(1000);
      mockPrisma.students.findMany.mockResolvedValue(largeStudentList.slice(0, 50) as any);
      mockPrisma.students.count.mockResolvedValue(1000);

      const { result, duration } = await measurePerformance(async () => {
        return request(app)
          .get('/api/students?page=1&limit=50')
          .expect(200);
      }, 'Get 1000 students');

      expect(duration).toBeLessThan(500); // Should complete in less than 500ms
      expect(result.body.students).toHaveLength(50);
      expect(result.body.pagination.total).toBe(1000);
    });

    it('should handle concurrent requests', async () => {
      const testStudents = TestDataFactory.createStudents(10);
      mockPrisma.students.findMany.mockResolvedValue(testStudents as any);
      mockPrisma.students.count.mockResolvedValue(testStudents.length);

      const startTime = performance.now();

      // Make 10 concurrent requests
      const promises = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .get('/api/students')
          .expect(200)
      );

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // Should handle 10 concurrent requests in < 1s
    });

    it('should implement caching for frequently accessed data', async () => {
      const testStudent = TestDataFactory.createStudent();
      mockPrisma.students.findUnique.mockResolvedValue(testStudent as any);

      // First request
      const response1 = await request(app)
        .get(`/api/students/${testStudent.id}`)
        .expect(200);

      // Second request (should use cache)
      const response2 = await request(app)
        .get(`/api/students/${testStudent.id}`)
        .expect(200);

      // Both responses should be identical
      expect(response1.body).toEqual(response2.body);

      // Database should only be called once due to caching
      expect(mockPrisma.students.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('Security Tests', () => {
    it('should prevent SQL injection attempts', async () => {
      const maliciousInput = "'; DROP TABLE students; --";

      const response = await request(app)
        .get(`/api/students/${maliciousInput}`)
        .expect(404); // Should return 404, not crash

      expect(response.body.message).toContain('Student not found');
    });

    it('should sanitize XSS attempts', async () => {
      const xssPayload = '<script>alert("xss")</script>';
      const maliciousData = {
        student_id: 'XSS001',
        first_name: xssPayload,
        last_name: 'Test',
        grade_level: 'Grade 7',
        grade_category: 'GRADE_7',
        section: '7-A'
      };

      mockPrisma.students.findUnique.mockResolvedValue(null);
      mockPrisma.students.create.mockResolvedValue({
        ...maliciousData,
        id: 'xss-test-id'
      } as any);

      const response = await request(app)
        .post('/api/students')
        .send(maliciousData)
        .expect(201);

      // Response should not contain the script tag
      expect(response.body.first_name).not.toContain('<script>');
    });

    it('should validate content-type headers', async () => {
      const response = await request(app)
        .post('/api/students')
        .set('Content-Type', 'text/plain') // Wrong content type
        .send('not json')
        .expect(400);

      expect(response.body.message).toContain('Content-Type must be application/json');
    });

    it('should implement CORS headers correctly', async () => {
      const response = await request(app)
        .options('/api/students')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });

    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api/students')
        .expect(200);

      // Check for security headers
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
      expect(response.headers['strict-transport-security']).toBeDefined();
    });
  });

  describe('Real-time Features', () => {
    it('should support WebSocket connections for live updates', async () => {
      // Mock WebSocket server
      const mockWebSocketServer = {
        on: vi.fn(),
        clients: new Set(),
        broadcast: vi.fn()
      };

      // Mock WebSocket integration
      vi.mock('@/websocket/websocketServer', () => ({
        default: mockWebSocketServer
      }));

      // Test WebSocket endpoint
      const response = await request(app)
        .get('/api/students/live-updates')
        .set('Connection', 'Upgrade')
        .set('Upgrade', 'websocket')
        .expect(101);

      expect(response.status).toBe(101); // Switching Protocols
    });

    it('should emit events for student data changes', async () => {
      const testStudent = TestDataFactory.createStudent();
      const mockWebSocketServer = {
        broadcast: vi.fn()
      };

      vi.mock('@/websocket/websocketServer', () => ({
        default: mockWebSocketServer
      }));

      mockPrisma.students.create.mockResolvedValue(testStudent as any);

      const response = await request(app)
        .post('/api/students')
        .send({
          student_id: testStudent.student_id,
          first_name: testStudent.first_name,
          last_name: testStudent.last_name,
          grade_level: testStudent.grade_level,
          grade_category: testStudent.grade_category
        })
        .expect(201);

      // Should broadcast change to WebSocket clients
      expect(mockWebSocketServer.broadcast).toHaveBeenCalledWith('student:created', expect.objectContaining({
        id: testStudent.id,
        student_id: testStudent.student_id
      }));
    });
  });

  describe('File Upload Integration', () => {
    it('should handle CSV file uploads for bulk student import', async () => {
      const csvContent = `student_id,first_name,last_name,grade_category,section
2023001,John,Doe,GRADE_7,7-A
2023002,Jane,Smith,GRADE_8,8-B`;

      const mockStudents = TestDataFactory.createStudents(2);
      mockPrisma.students.createMany.mockResolvedValue({ count: 2 } as any);

      const response = await request(app)
        .post('/api/students/import')
        .attach('file', Buffer.from(csvContent), 'students.csv')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Import completed successfully',
        imported: 2,
        errors: 0
      });
    });

    it('should validate file upload formats', async () => {
      const response = await request(app)
        .post('/api/students/import')
        .attach('file', Buffer.from('invalid content'), 'students.txt')
        .expect(400);

      expect(response.body.message).toContain('Only CSV files are allowed');
    });

    it('should handle large file uploads', async () => {
      const largeCsvContent = 'student_id,first_name,last_name\n'.repeat(10000); // Large file

      const response = await request(app)
        .post('/api/students/import')
        .attach('file', Buffer.from(largeCsvContent), 'large-students.csv')
        .expect(413); // Payload Too Large

      expect(response.body.message).toContain('File too large');
    });
  });

  describe('API Documentation and Contract Testing', () => {
    it('should maintain consistent API response structure', async () => {
      const testStudent = TestDataFactory.createStudent();
      mockPrisma.students.findUnique.mockResolvedValue(testStudent as any);

      const response = await request(app)
        .get(`/api/students/${testStudent.id}`)
        .expect(200);

      // Verify response structure matches API contract
      expect(response.body).toMatchObject({
        id: expect.any(String),
        student_id: expect.any(String),
        first_name: expect.any(String),
        last_name: expect.any(String),
        grade_level: expect.any(String),
        grade_category: expect.any(String),
        section: expect.any(String),
        is_active: expect.any(Boolean),
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });
    });

    it('should include proper HTTP status codes', async () => {
      // Success cases
      await request(app).get('/api/students').expect(200);

      // Creation success
      mockPrisma.students.create.mockResolvedValue(TestDataFactory.createStudent() as any);
      await request(app)
        .post('/api/students')
        .send({
          student_id: 'TEST001',
          first_name: 'Test',
          last_name: 'Student',
          grade_level: 'Grade 7',
          grade_category: 'GRADE_7'
        })
        .expect(201);

      // Not found
      mockPrisma.students.findUnique.mockResolvedValue(null);
      await request(app).get('/api/students/nonexistent').expect(404);

      // Bad request
      await request(app)
        .post('/api/students')
        .send({ invalid: 'data' })
        .expect(400);
    });

    it('should provide meaningful error messages', async () => {
      const testCases = [
        {
          endpoint: '/api/students',
          method: 'GET',
          mockError: new Error('Database connection failed'),
          expectedStatus: 500,
          expectedMessage: 'Internal server error'
        },
        {
          endpoint: '/api/students/invalid-id',
          method: 'GET',
          mockError: new Error('Invalid student ID format'),
          expectedStatus: 400,
          expectedMessage: 'Invalid student ID'
        }
      ];

      for (const testCase of testCases) {
        mockPrisma.students.findUnique.mockRejectedValue(testCase.mockError);

        const response = await request(app)
          [testCase.method.toLowerCase() as 'get'](testCase.endpoint)
          .expect(testCase.expectedStatus);

        expect(response.body.message).toContain(testCase.expectedMessage);
      }
    });
  });
});