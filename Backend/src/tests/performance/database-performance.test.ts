import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { measureExecutionTime, runLoadTest, createTestStudent, createTestBook, createTestEquipment, cleanupDatabase } from '../helpers/testUtils';
import { StudentsRepository } from '@/repositories/students.repository';
import { BooksRepository } from '@/repositories/books.repository';
import { EquipmentRepository } from '@/repositories/equipment.repository';
import { cacheManager } from '@/utils/caching';

describe('Database Performance Tests', () => {
  let prisma: PrismaClient;
  let studentsRepo: StudentsRepository;
  let booksRepo: BooksRepository;
  let equipmentRepo: EquipmentRepository;

  beforeAll(async () => {
    // Initialize test database with performance-optimized settings
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.PERF_DATABASE_URL || process.env.DATABASE_URL
        }
      },
      log: ['warn', 'error']
    });

    studentsRepo = new StudentsRepository(prisma);
    booksRepo = new BooksRepository(prisma);
    equipmentRepo = new EquipmentRepository(prisma);

    // Clear cache before tests
    await cacheManager.clear();
  });

  afterAll(async () => {
    await cleanupDatabase();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up before each test to ensure consistent results
    await cleanupDatabase();
    await cacheManager.clear();
  });

  describe('Repository CRUD Performance', () => {
    it('should handle student creation within performance thresholds', async () => {
      const batchSize = 100;
      const students = Array.from({ length: batchSize }, (_, i) => ({
        studentId: `PERF_STU_${String(i).padStart(4, '0')}`,
        firstName: `Test${i}`,
        lastName: 'Student',
        gradeLevel: 'Grade 10',
        gradeCategory: 'JUNIOR_HIGH',
        section: 'A'
      }));

      const { duration } = await measureExecutionTime(async () => {
        for (const student of students) {
          await studentsRepo.create(student);
        }
      });

      const avgTimePerRecord = duration / batchSize;
      
      console.log(`Student creation performance:`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Average time per record: ${avgTimePerRecord.toFixed(2)}ms`);
      console.log(`  Records per second: ${(batchSize / duration * 1000).toFixed(2)}`);

      expect(avgTimePerRecord).toBeLessThan(50); // Each record should take less than 50ms
      expect(duration).toBeLessThan(5000); // Total batch should complete within 5 seconds
    });

    it('should handle student queries with optimal performance', async () => {
      // Create test data
      const testStudents = Array.from({ length: 1000 }, (_, i) => ({
        studentId: `QUERY_STU_${String(i).padStart(4, '0')}`,
        firstName: `Test${i}`,
        lastName: 'Student',
        gradeLevel: `Grade ${((i % 6) + 7)}`,
        gradeCategory: i % 2 === 0 ? 'JUNIOR_HIGH' : 'SENIOR_HIGH',
        section: String.fromCharCode(65 + (i % 4)) // A, B, C, D
      }));

      // Bulk insert for performance
      await prisma.student.createMany({ data: testStudents });

      // Test different query scenarios
      const queryTests = [
        {
          name: 'Simple findMany',
          query: () => studentsRepo.findMany({ take: 50 }),
          expectedMaxTime: 100
        },
        {
          name: 'Paginated query',
          query: () => studentsRepo.findMany({ 
            take: 20, 
            skip: 100,
            orderBy: { studentId: 'asc' }
          }),
          expectedMaxTime: 150
        },
        {
          name: 'Filtered query',
          query: () => studentsRepo.findMany({
            where: { gradeCategory: 'JUNIOR_HIGH' },
            take: 50
          }),
          expectedMaxTime: 200
        },
        {
          name: 'Complex query with multiple filters',
          query: () => studentsRepo.findMany({
            where: {
              gradeCategory: 'JUNIOR_HIGH',
              section: 'A',
              gradeLevel: { contains: 'Grade' }
            },
            orderBy: { studentId: 'asc' },
            take: 25
          }),
          expectedMaxTime: 250
        }
      ];

      for (const test of queryTests) {
        const { duration } = await measureExecutionTime(test.query);
        
        console.log(`${test.name}: ${duration}ms`);
        expect(duration).toBeLessThan(test.expectedMaxTime);
      }
    });

    it('should handle concurrent database operations efficiently', async () => {
      const concurrency = 20;
      const operationsPerWorker = 10;

      const concurrentOperation = async (workerId: number) => {
        const results = [];
        
        for (let i = 0; i < operationsPerWorker; i++) {
          const studentId = `CONCURRENT_${workerId}_${i}`;
          
          // Create
          const createStart = Date.now();
          await studentsRepo.create({
            studentId,
            firstName: `Worker${workerId}`,
            lastName: `Test${i}`,
            gradeLevel: 'Grade 10',
            gradeCategory: 'JUNIOR_HIGH',
            section: 'A'
          });
          const createTime = Date.now() - createStart;

          // Read
          const readStart = Date.now();
          await studentsRepo.findByStudentId(studentId);
          const readTime = Date.now() - readStart;

          // Update
          const updateStart = Date.now();
          await studentsRepo.updateByStudentId(studentId, {
            firstName: `Updated${workerId}`
          });
          const updateTime = Date.now() - updateStart;

          results.push({ createTime, readTime, updateTime });
        }

        return results;
      };

      const { duration } = await measureExecutionTime(async () => {
        const promises = Array.from({ length: concurrency }, (_, i) => concurrentOperation(i));
        await Promise.all(promises);
      });

      const totalOperations = concurrency * operationsPerWorker * 3; // 3 operations per iteration
      const avgTimePerOperation = duration / totalOperations;

      console.log(`Concurrent operations performance:`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Total operations: ${totalOperations}`);
      console.log(`  Average time per operation: ${avgTimePerOperation.toFixed(2)}ms`);
      console.log(`  Operations per second: ${(totalOperations / duration * 1000).toFixed(2)}`);

      expect(avgTimePerOperation).toBeLessThan(30); // Each operation should be very fast
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Bulk Operations Performance', () => {
    it('should handle bulk student creation efficiently', async () => {
      const batchSizes = [100, 500, 1000];
      
      for (const batchSize of batchSizes) {
        const students = Array.from({ length: batchSize }, (_, i) => ({
          studentId: `BULK_STU_${batchSize}_${String(i).padStart(4, '0')}`,
          firstName: `Bulk${i}`,
          lastName: 'Test',
          gradeLevel: 'Grade 10',
          gradeCategory: 'JUNIOR_HIGH',
          section: 'A'
        }));

        const { duration } = await measureExecutionTime(async () => {
          await prisma.student.createMany({ data: students });
        });

        const avgTimePerRecord = duration / batchSize;
        const recordsPerSecond = batchSize / duration * 1000;

        console.log(`Bulk creation (${batchSize} records):`);
        console.log(`  Total time: ${duration}ms`);
        console.log(`  Average time per record: ${avgTimePerRecord.toFixed(2)}ms`);
        console.log(`  Records per second: ${recordsPerSecond.toFixed(2)}`);

        expect(avgTimePerRecord).toBeLessThan(10); // Bulk operations should be very fast
        expect(recordsPerSecond).toBeGreaterThan(100); // Should handle at least 100 records/second
      }
    });

    it('should handle bulk updates efficiently', async () => {
      // Create initial data
      const students = Array.from({ length: 500 }, (_, i) => ({
        studentId: `BULK_UPDATE_${String(i).padStart(4, '0')}`,
        firstName: `Test${i}`,
        lastName: 'Student',
        gradeLevel: 'Grade 10',
        gradeCategory: 'JUNIOR_HIGH',
        section: 'A'
      }));

      await prisma.student.createMany({ data: students });

      // Perform bulk updates
      const { duration } = await measureExecutionTime(async () => {
        const updatePromises = students.map((student, i) =>
          prisma.student.update({
            where: { studentId: student.studentId },
            data: { firstName: `Updated${i}` }
          })
        );
        
        await Promise.all(updatePromises);
      });

      const avgTimePerUpdate = duration / students.length;

      console.log(`Bulk updates performance:`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Average time per update: ${avgTimePerUpdate.toFixed(2)}ms`);
      console.log(`  Updates per second: ${(students.length / duration * 1000).toFixed(2)}`);

      expect(avgTimePerUpdate).toBeLessThan(50); // Each update should be reasonably fast
    });
  });

  describe('Query Optimization Performance', () => {
    it('should benefit from proper indexing', async () => {
      // Create indexed test data
      const students = Array.from({ length: 2000 }, (_, i) => ({
        studentId: `INDEX_STU_${String(i).padStart(4, '0')}`,
        firstName: `Test${i}`,
        lastName: 'Student',
        gradeLevel: `Grade ${((i % 6) + 7)}`,
        gradeCategory: i % 2 === 0 ? 'JUNIOR_HIGH' : 'SENIOR_HIGH',
        section: String.fromCharCode(65 + (i % 4)) // A, B, C, D
      }));

      await prisma.student.createMany({ data: students });

      // Test indexed vs non-indexed queries
      const indexedQuery = async () => {
        return prisma.student.findMany({
          where: { studentId: 'INDEX_STU_0001' }
        });
      };

      const nonIndexedQuery = async () => {
        return prisma.student.findMany({
          where: { firstName: 'Test1' }
        });
      };

      const indexedResult = await measureExecutionTime(indexedQuery);
      const nonIndexedResult = await measureExecutionTime(nonIndexedQuery);

      console.log(`Indexed query: ${indexedResult.duration}ms`);
      console.log(`Non-indexed query: ${nonIndexedResult.duration}ms`);

      // Indexed queries should be faster
      expect(indexedResult.duration).toBeLessThan(nonIndexedResult.duration);
      expect(indexedResult.duration).toBeLessThan(50);
    });

    it('should handle complex joins efficiently', async () => {
      // Create related test data
      const student = await createTestStudent();
      
      // Create activities for the student
      const activities = Array.from({ length: 50 }, (_, i) => ({
        studentId: student.id,
        activityType: i % 3 === 0 ? 'LIBRARY_VISIT' : 'COMPUTER_USE',
        checkInTime: new Date(Date.now() - i * 1000 * 60), // Different times
        status: 'ACTIVE'
      }));

      await prisma.studentActivity.createMany({ data: activities });

      // Test complex join query
      const complexQuery = async () => {
        return prisma.student.findUnique({
          where: { id: student.id },
          include: {
            activities: {
              orderBy: { checkInTime: 'desc' },
              take: 10
            }
          }
        });
      };

      const { duration } = await measureExecutionTime(complexQuery);

      console.log(`Complex join query: ${duration}ms`);
      expect(duration).toBeLessThan(200); // Even complex queries should be fast
    });
  });

  describe('Transaction Performance', () => {
    it('should handle transactions efficiently', async () => {
      const transactionSize = 50;

      const transactionOperation = async () => {
        return prisma.$transaction(async (tx) => {
          const results = [];
          
          for (let i = 0; i < transactionSize; i++) {
            const student = await tx.student.create({
              data: {
                studentId: `TX_STU_${Date.now()}_${i}`,
                firstName: `Transaction${i}`,
                lastName: 'Test',
                gradeLevel: 'Grade 10',
                gradeCategory: 'JUNIOR_HIGH',
                section: 'A'
              }
            });
            
            results.push(student);
          }

          return results;
        });
      };

      const { duration } = await measureExecutionTime(transactionOperation);
      const avgTimePerRecord = duration / transactionSize;

      console.log(`Transaction performance (${transactionSize} records):`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Average time per record: ${avgTimePerRecord.toFixed(2)}ms`);

      expect(avgTimePerRecord).toBeLessThan(30); // Transactions should be efficient
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle rollback efficiently', async () => {
      const rollbackOperation = async () => {
        try {
          await prisma.$transaction(async (tx) => {
            // Create some records
            for (let i = 0; i < 20; i++) {
              await tx.student.create({
                data: {
                  studentId: `ROLLBACK_${Date.now()}_${i}`,
                  firstName: `Rollback${i}`,
                  lastName: 'Test',
                  gradeLevel: 'Grade 10',
                  gradeCategory: 'JUNIOR_HIGH',
                  section: 'A'
                }
              });
            }

            // Force an error to trigger rollback
            throw new Error('Intentional rollback');
          });
        } catch (error) {
          // Expected error
        }
      };

      const { duration } = await measureExecutionTime(rollbackOperation);

      console.log(`Rollback performance: ${duration}ms`);
      expect(duration).toBeLessThan(1000); // Rollbacks should be fast

      // Verify no data was created
      const count = await prisma.student.count({
        where: { studentId: { startsWith: 'ROLLBACK_' } }
      });
      expect(count).toBe(0);
    });
  });

  describe('Repository Performance with Caching', () => {
    it('should demonstrate cache performance benefits', async () => {
      const student = await createTestStudent({
        studentId: `CACHE_STU_${Date.now()}`
      });

      // First query (cache miss)
      const firstQuery = await measureExecutionTime(async () => {
        return studentsRepo.findByStudentId(student.studentId);
      });

      // Cache the result
      await cacheManager.set(
        `student:${student.studentId}`,
        firstQuery.result,
        { ttl: 300 }
      );

      // Second query (cache hit)
      const cachedQuery = await measureExecutionTime(async () => {
        return cacheManager.get(`student:${student.studentId}`);
      });

      console.log(`Database query: ${firstQuery.duration}ms`);
      console.log(`Cache query: ${cachedQuery.duration}ms`);
      console.log(`Performance improvement: ${(firstQuery.duration / cachedQuery.duration).toFixed(2)}x`);

      expect(cachedQuery.duration).toBeLessThan(firstQuery.duration);
      expect(cachedQuery.duration).toBeLessThan(10); // Cache should be very fast
      expect(firstQuery.duration / cachedQuery.duration).toBeGreaterThan(5); // At least 5x faster
    });

    it('should handle cache invalidation efficiently', async () => {
      // Create multiple cached entries
      const cacheKeys = [];
      
      for (let i = 0; i < 100; i++) {
        const key = `perf:test:${i}`;
        await cacheManager.set(key, { data: i }, { ttl: 300 });
        cacheKeys.push(key);
      }

      // Measure cache invalidation performance
      const { duration } = await measureExecutionTime(async () => {
        for (const key of cacheKeys) {
          await cacheManager.delete(key);
        }
      });

      const avgInvalidationTime = duration / cacheKeys.length;

      console.log(`Cache invalidation performance:`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Average time per invalidation: ${avgInvalidationTime.toFixed(2)}ms`);

      expect(avgInvalidationTime).toBeLessThan(5); // Cache invalidation should be very fast
    });
  });

  describe('Resource Usage Under Load', () => {
    it('should maintain reasonable memory usage during large operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const batchSize = 1000;

      // Create large batch of students
      const students = Array.from({ length: batchSize }, (_, i) => ({
        studentId: `MEMORY_STU_${String(i).padStart(4, '0')}`,
        firstName: `Memory${i}`,
        lastName: 'Test',
        gradeLevel: 'Grade 10',
        gradeCategory: 'JUNIOR_HIGH',
        section: 'A'
      }));

      await measureExecutionTime(async () => {
        await prisma.student.createMany({ data: students });
      });

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      console.log(`Memory usage during large operation:`);
      console.log(`  Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Memory increase: ${memoryIncrease.toFixed(2)}MB`);

      // Memory increase should be reasonable for this operation
      expect(memoryIncrease).toBeLessThan(50); // Less than 50MB increase
    });

    it('should handle connection pooling efficiently', async () => {
      const concurrency = 50;
      const operationsPerConnection = 5;

      const connectionTest = async () => {
        const promises = Array.from({ length: concurrency }, async (_, i) => {
          const results = [];
          
          for (let j = 0; j < operationsPerConnection; j++) {
            const start = Date.now();
            await prisma.student.count();
            results.push(Date.now() - start);
          }

          return results;
        });

        return Promise.all(promises);
      };

      const { duration } = await measureExecutionTime(connectionTest);
      const totalOperations = concurrency * operationsPerConnection;
      const avgTimePerOperation = duration / totalOperations;

      console.log(`Connection pooling performance:`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Total operations: ${totalOperations}`);
      console.log(`  Average time per operation: ${avgTimePerOperation.toFixed(2)}ms`);
      console.log(`  Operations per second: ${(totalOperations / duration * 1000).toFixed(2)}`);

      expect(avgTimePerOperation).toBeLessThan(100); // Should handle concurrent operations efficiently
    });
  });
});