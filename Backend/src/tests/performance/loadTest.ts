import { describe, it, expect } from 'vitest';
import {
  runLoadTest,
  measureExecutionTime,
  createTestStudent,
  createTestEquipment,
  createTestActivity,
  cleanupDatabase,
  prisma
} from '../helpers/testUtils';
import QueryOptimizer from '../../utils/queryOptimizer';
import { cacheManager } from '../../utils/caching';

describe('Performance Load Tests', () => {
  const queryOptimizer = new QueryOptimizer(prisma, {
    enableCache: true,
    cacheTTL: 300,
    slowQueryThreshold: 1000
  });

  describe('Database Query Performance', () => {
    it('should query students efficiently', async () => {
      // Create 100 students
      const students = Array.from({ length: 100 }, (_, i) => ({
        studentId: `STU${String(i).padStart(4, '0')}`,
        firstName: `Student${i}`,
        lastName: 'Test',
        gradeLevel: 'Grade 5',
        gradeCategory: 'GRADE_SCHOOL'
      }));

      await prisma.student.createMany({ data: students });

      const { duration } = await measureExecutionTime(async () => {
        await prisma.student.findMany({
          take: 50,
          orderBy: { createdAt: 'desc' }
        });
      });

      expect(duration).toBeLessThan(500); // Should complete within 500ms
    });

    it('should handle complex queries with joins', async () => {
      const student = await createTestStudent();
      
      // Create multiple activities
      for (let i = 0; i < 20; i++) {
        await createTestActivity(student.id);
      }

      const { duration } = await measureExecutionTime(async () => {
        await prisma.student.findUnique({
          where: { id: student.id },
          include: {
            activities: {
              orderBy: { checkInTime: 'desc' },
              take: 10
            },
            equipmentSessions: {
              orderBy: { startTime: 'desc' },
              take: 10
            }
          }
        });
      });

      expect(duration).toBeLessThan(300); // Should complete within 300ms
    });

    it('should benefit from query caching', async () => {
      const student = await createTestStudent();

      // First query (uncached)
      const { duration: firstDuration } = await measureExecutionTime(async () => {
        await queryOptimizer.getStudentWithActivities(student.id);
      });

      // Second query (cached)
      const { duration: secondDuration } = await measureExecutionTime(async () => {
        await queryOptimizer.getStudentWithActivities(student.id);
      });

      expect(secondDuration).toBeLessThan(firstDuration);
      expect(secondDuration).toBeLessThan(50); // Cached queries should be very fast
    });

    it('should handle batch operations efficiently', async () => {
      const students = Array.from({ length: 50 }, (_, i) => ({
        studentId: `STU${String(i).padStart(4, '0')}`,
        firstName: `Student${i}`,
        lastName: 'Test',
        gradeLevel: 'Grade 5',
        gradeCategory: 'GRADE_SCHOOL'
      }));

      const { duration } = await measureExecutionTime(async () => {
        await prisma.student.createMany({ data: students });
      });

      expect(duration).toBeLessThan(2000); // Batch insert should be fast
    });
  });

  describe('Cache Performance', () => {
    it('should cache and retrieve quickly', async () => {
      const testData = { test: 'data', number: 123, array: [1, 2, 3] };

      // Set cache
      const { duration: setDuration } = await measureExecutionTime(async () => {
        await cacheManager.set('test-key', testData);
      });

      // Get from cache
      const { duration: getDuration } = await measureExecutionTime(async () => {
        await cacheManager.get('test-key');
      });

      expect(setDuration).toBeLessThan(100);
      expect(getDuration).toBeLessThan(50);
    });

    it('should handle cache invalidation efficiently', async () => {
      // Set multiple cached items with tags
      for (let i = 0; i < 20; i++) {
        await cacheManager.set(`key-${i}`, { data: i }, {
          tags: ['test-tag'],
          ttl: 300
        });
      }

      const { duration } = await measureExecutionTime(async () => {
        await cacheManager.invalidateByTag('test-tag');
      });

      expect(duration).toBeLessThan(500);
    });
  });

  describe('API Load Tests', () => {
    it('should handle concurrent student queries', async () => {
      // Create test data
      const students = Array.from({ length: 50 }, (_, i) => ({
        studentId: `STU${String(i).padStart(4, '0')}`,
        firstName: `Student${i}`,
        lastName: 'Test',
        gradeLevel: 'Grade 5',
        gradeCategory: 'GRADE_SCHOOL'
      }));

      await prisma.student.createMany({ data: students });

      const testFn = async () => {
        await prisma.student.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' }
        });
      };

      const results = await runLoadTest(testFn, 100, 10);

      expect(results.successRate).toBe(100);
      expect(results.averageTime).toBeLessThan(500);
      expect(results.maxTime).toBeLessThan(2000);
    });

    it('should handle concurrent write operations', async () => {
      let counter = 0;

      const testFn = async () => {
        await createTestStudent({
          studentId: `STU${String(counter++).padStart(4, '0')}`
        });
      };

      const results = await runLoadTest(testFn, 50, 5);

      expect(results.successRate).toBe(100);
      expect(results.averageTime).toBeLessThan(1000);
    });

    it('should handle mixed read/write operations', async () => {
      const students = Array.from({ length: 20 }, (_, i) => ({
        studentId: `STU${String(i).padStart(4, '0')}`,
        firstName: `Student${i}`,
        lastName: 'Test',
        gradeLevel: 'Grade 5',
        gradeCategory: 'GRADE_SCHOOL'
      }));

      await prisma.student.createMany({ data: students });

      const testFn = async () => {
        // Random read or write
        if (Math.random() > 0.5) {
          await prisma.student.findMany({ take: 10 });
        } else {
          const studentId = `STU${String(Math.floor(Math.random() * 20)).padStart(4, '0')}`;
          await prisma.student.findUnique({ where: { studentId } });
        }
      };

      const results = await runLoadTest(testFn, 100, 10);

      expect(results.successRate).toBeGreaterThan(95);
      expect(results.averageTime).toBeLessThan(300);
    });
  });

  describe('Search Performance', () => {
    beforeEach(async () => {
      // Create 200 students for search tests
      const students = Array.from({ length: 200 }, (_, i) => ({
        studentId: `STU${String(i).padStart(4, '0')}`,
        firstName: i % 3 === 0 ? 'John' : i % 3 === 1 ? 'Jane' : 'Jack',
        lastName: `Test${i}`,
        gradeLevel: 'Grade 5',
        gradeCategory: 'GRADE_SCHOOL',
        email: `student${i}@test.com`
      }));

      await prisma.student.createMany({ data: students });
    });

    it('should search by name efficiently', async () => {
      const { duration } = await measureExecutionTime(async () => {
        await queryOptimizer.searchStudents('John', 20);
      });

      expect(duration).toBeLessThan(500);
    });

    it('should search by email efficiently', async () => {
      const { duration } = await measureExecutionTime(async () => {
        await prisma.student.findMany({
          where: {
            email: { contains: 'student1', mode: 'insensitive' }
          },
          take: 20
        });
      });

      expect(duration).toBeLessThan(500);
    });

    it('should handle wildcard searches', async () => {
      const { duration } = await measureExecutionTime(async () => {
        await prisma.student.findMany({
          where: {
            OR: [
              { firstName: { contains: 'J', mode: 'insensitive' } },
              { lastName: { contains: 'T', mode: 'insensitive' } }
            ]
          },
          take: 50
        });
      });

      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Memory Usage', () => {
    it('should handle large result sets without memory issues', async () => {
      // Create 1000 students
      const students = Array.from({ length: 1000 }, (_, i) => ({
        studentId: `STU${String(i).padStart(4, '0')}`,
        firstName: `Student${i}`,
        lastName: 'Test',
        gradeLevel: 'Grade 5',
        gradeCategory: 'GRADE_SCHOOL'
      }));

      await prisma.student.createMany({ data: students });

      const before = process.memoryUsage().heapUsed;

      // Query in batches
      for (let i = 0; i < 10; i++) {
        await prisma.student.findMany({
          skip: i * 100,
          take: 100
        });
      }

      const after = process.memoryUsage().heapUsed;
      const memoryIncrease = (after - before) / 1024 / 1024; // MB

      expect(memoryIncrease).toBeLessThan(50); // Should use less than 50MB
    });

    it('should properly clean up connections', async () => {
      const { duration } = await measureExecutionTime(async () => {
        for (let i = 0; i < 100; i++) {
          await prisma.student.findMany({ take: 1 });
        }
      });

      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Real-time Performance', () => {
    it('should handle WebSocket message broadcasting efficiently', async () => {
      const mockMessages = Array.from({ length: 100 }, (_, i) => ({
        type: 'student:update',
        payload: { studentId: `STU${i}`, action: 'updated' },
        timestamp: new Date()
      }));

      const { duration } = await measureExecutionTime(async () => {
        // Simulate broadcasting
        for (const message of mockMessages) {
          // Mock broadcast logic
          await Promise.resolve(message);
        }
      });

      expect(duration).toBeLessThan(1000);
    });

    it('should process scanner input quickly', async () => {
      const student = await createTestStudent();

      const { duration } = await measureExecutionTime(async () => {
        // Simulate scanner detection
        const found = await prisma.student.findFirst({
          where: {
            OR: [
              { studentId: student.studentId },
              { qrCode: student.qrCode },
              { barcode: student.barcode }
            ]
          }
        });

        // Process result
        if (found) {
          await prisma.studentActivity.create({
            data: {
              studentId: found.id,
              activityType: 'LIBRARY_VISIT',
              checkInTime: new Date(),
              status: 'ACTIVE'
            }
          });
        }
      });

      expect(duration).toBeLessThan(200); // Scanner should respond quickly
    });
  });

  describe('Query Optimization Stats', () => {
    it('should track query performance', async () => {
      // Perform various queries
      await queryOptimizer.getActiveStudents();
      await queryOptimizer.getDashboardStats();
      await queryOptimizer.getAvailableEquipment();

      const stats = queryOptimizer.getQueryStats();

      expect(stats.totalQueries).toBeGreaterThan(0);
      expect(stats.averageDuration).toBeGreaterThan(0);
      expect(stats.slowQueries).toBeDefined();
    });

    it('should identify slow queries', async () => {
      // Create complex query that might be slow
      const students = Array.from({ length: 100 }, (_, i) => ({
        studentId: `STU${String(i).padStart(4, '0')}`,
        firstName: `Student${i}`,
        lastName: 'Test',
        gradeLevel: 'Grade 5',
        gradeCategory: 'GRADE_SCHOOL'
      }));

      await prisma.student.createMany({ data: students });

      // Run a complex query
      await prisma.student.findMany({
        include: {
          activities: true,
          equipmentSessions: true
        }
      });

      const stats = queryOptimizer.getQueryStats();
      expect(stats).toBeDefined();
    });
  });
});
