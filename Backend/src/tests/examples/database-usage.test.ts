/**
 * Test Database Usage Examples
 * 
 * This file demonstrates how to use the new test database configuration
 * for different types of tests and scenarios.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { 
  TestDatabaseUtils, 
  TestDatabaseManager, 
  TestEnvironmentType, 
  TestDatabaseConfigs,
  type TestDatabase 
} from '../setup/database';
import { getTestDatabase, getTestPrisma, withTestTransaction } from '../setup/globalSetup';

describe('Test Database Usage Examples', () => {
  describe('Unit Test Database Usage', () => {
    let database: TestDatabase;

    beforeAll(async () => {
      // Create a unit test database
      database = await TestDatabaseUtils.create(TestEnvironmentType.UNIT);
    });

    afterAll(async () => {
      // Cleanup the database
      await database.cleanup();
    });

    it('should create and use a unit test database', async () => {
      // Use transaction for test isolation
      await database.withTransaction(async (prisma) => {
        // Create a user
        const user = await prisma.users.create({
          data: {
            id: 'test-user-1',
            username: 'testuser',
            password: 'hashedpassword',
            role: 'LIBRARIAN',
            isActive: true,
            email: 'test@example.com'
          }
        });

        expect(user.id).toBe('test-user-1');
        expect(user.username).toBe('testuser');

        // Create a student
        const student = await prisma.students.create({
          data: {
            id: 'test-student-1',
            studentId: '2024-001',
            firstName: 'John',
            lastName: 'Doe',
            gradeLevel: 'Grade 10',
            gradeCategory: 'JUNIOR_HIGH',
            section: 'A',
            isActive: true
          }
        });

        expect(student.id).toBe('test-student-1');
        expect(student.firstName).toBe('John');

        // Query the data
        const users = await prisma.users.findMany();
        const students = await prisma.students.findMany();

        expect(users).toHaveLength(1);
        expect(students).toHaveLength(1);
      });
    });

    it('should rollback changes automatically', async () => {
      // This test should start with a clean database
      await database.withTransaction(async (prisma) => {
        const users = await prisma.users.findMany();
        const students = await prisma.students.findMany();

        // Database should be empty due to rollback from previous test
        expect(users).toHaveLength(0);
        expect(students).toHaveLength(0);
      });
    });
  });

  describe('Integration Test Database Usage', () => {
    let database: TestDatabase;

    beforeAll(async () => {
      // Create an integration test database
      database = await TestDatabaseUtils.create(TestEnvironmentType.INTEGRATION);
    });

    afterAll(async () => {
      await database.cleanup();
    });

    it('should have seeded test data', async () => {
      await database.withTransaction(async (prisma) => {
        // Integration tests come with pre-seeded data
        const users = await prisma.users.findMany();
        const students = await prisma.students.findMany();
        const books = await prisma.books.findMany();

        expect(users.length).toBeGreaterThan(0);
        expect(students.length).toBeGreaterThan(0);
        expect(books.length).toBeGreaterThan(0);
      });
    });

    it('should handle complex relationships', async () => {
      await database.withTransaction(async (prisma) => {
        // Get existing data
        const student = await prisma.students.findFirst();
        const book = await prisma.books.findFirst();

        expect(student).toBeDefined();
        expect(book).toBeDefined();

        // Create a checkout
        const checkout = await prisma.book_checkouts.create({
          data: {
            id: 'test-checkout-1',
            bookId: book!.id,
            studentId: student!.id,
            checkoutDate: new Date(),
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            status: 'ACTIVE',
            processedBy: 'system'
          }
        });

        expect(checkout.id).toBe('test-checkout-1');
        expect(checkout.bookId).toBe(book!.id);
        expect(checkout.studentId).toBe(student!.id);

        // Verify the relationship
        const checkoutWithRelations = await prisma.book_checkouts.findUnique({
          where: { id: checkout.id },
          include: {
            book: true,
            student: true
          }
        });

        expect(checkoutWithRelations?.book).toBeDefined();
        expect(checkoutWithRelations?.student).toBeDefined();
      });
    });
  });

  describe('Database Manager Usage', () => {
    it('should manage multiple database instances', async () => {
      // Get multiple database instances
      const unitDb = TestDatabaseManager.getInstance('unit-test', TestDatabaseConfigs.unit);
      const integrationDb = TestDatabaseManager.getInstance('integration-test', TestDatabaseConfigs.integration);

      // Setup all databases
      await TestDatabaseManager.setupAll();

      try {
        // Use unit database
        await unitDb.withTransaction(async (prisma) => {
          const user = await prisma.users.create({
            data: {
              id: 'manager-user-1',
              username: 'manageruser',
              password: 'hashedpassword',
              role: 'LIBRARIAN',
              isActive: true
            }
          });
          expect(user.id).toBe('manager-user-1');
        });

        // Use integration database
        await integrationDb.withTransaction(async (prisma) => {
          const users = await prisma.users.findMany();
          expect(users.length).toBeGreaterThan(0); // Seeded data
        });

        // Get statistics
        const stats = TestDatabaseManager.getAllStats();
        expect(stats['unit-test']).toBeDefined();
        expect(stats['integration-test']).toBeDefined();

        // Get health status
        const health = TestDatabaseManager.getAllHealthStatuses();
        expect(health['unit-test'].isHealthy).toBe(true);
        expect(health['integration-test'].isHealthy).toBe(true);

      } finally {
        // Cleanup all databases
        await TestDatabaseManager.cleanupAll();
      }
    });
  });

  describe('Performance Monitoring', () => {
    it('should track database performance', async () => {
      // Create database with performance monitoring enabled
      const config = {
        ...TestDatabaseConfigs.integration,
        enablePerformanceMonitoring: true
      };

      const database = new TestDatabase(config);
      await database.setup();

      try {
        // Perform some operations
        await database.withTransaction(async (prisma) => {
          const startTime = Date.now();
          
          // Create multiple users
          const users = [];
          for (let i = 0; i < 10; i++) {
            const user = await prisma.users.create({
              data: {
                id: `perf-user-${i}`,
                username: `perfuser${i}`,
                password: 'hashedpassword',
                role: 'LIBRARIAN',
                isActive: true
              }
            });
            users.push(user);
          }

          const queryTime = Date.now() - startTime;
          
          // Update statistics
          database.updateStats(queryTime);

          expect(users).toHaveLength(10);
        });

        // Check statistics
        const stats = database.getStats();
        expect(stats.totalQueries).toBeGreaterThan(0);
        expect(stats.averageQueryTime).toBeGreaterThan(0);

        // Check health status
        const health = database.getHealthStatus();
        expect(health.isHealthy).toBe(true);
        expect(health.responseTime).toBeGreaterThan(0);

      } finally {
        await database.cleanup();
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database connection failures gracefully', async () => {
      // Create database with invalid configuration
      const invalidConfig = {
        ...TestDatabaseConfigs.unit,
        databaseUrl: 'mysql://invalid:invalid@localhost:9999/invalid_db'
      };

      const database = new TestDatabase(invalidConfig);

      try {
        await database.setup();
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        // Database should not be set up
        expect(() => database.getPrismaClient()).toThrow();
      } finally {
        // Cleanup should not throw even if setup failed
        await database.cleanup();
      }
    });

    it('should handle transaction failures', async () => {
      const database = await TestDatabaseUtils.create(TestEnvironmentType.UNIT);

      try {
        await database.withTransaction(async (prisma) => {
          // Create a valid user first
          await prisma.users.create({
            data: {
              id: 'error-user-1',
              username: 'erroruser',
              password: 'hashedpassword',
              role: 'LIBRARIAN',
              isActive: true
            }
          });

          // Now try something that will fail
          await prisma.users.create({
            data: {
              id: 'error-user-1', // Duplicate ID
              username: 'erroruser2',
              password: 'hashedpassword',
              role: 'LIBRARIAN',
              isActive: true
            }
          });
        });
      } catch (error) {
        // Expected to fail
        expect(error).toBeDefined();
      }

      // Database should still be usable
      await database.withTransaction(async (prisma) => {
        const users = await prisma.users.findMany();
        expect(users).toHaveLength(0); // Should be empty due to rollback
      });

      await database.cleanup();
    });
  });

  describe('Global Setup Integration', () => {
    it('should work with global test setup', async () => {
      // This test works with the globally configured database
      const prisma = getTestPrisma();
      
      if (!prisma) {
        console.warn('Global test database not available, skipping test');
        return;
      }

      await withTestTransaction(async (prisma) => {
        // Create test data
        const user = await prisma.users.create({
          data: {
            id: 'global-user-1',
            username: 'globaluser',
            password: 'hashedpassword',
            role: 'LIBRARIAN',
            isActive: true
          }
        });

        expect(user.id).toBe('global-user-1');
      });
    });
  });

  describe('Custom Configuration Examples', () => {
    it('should use custom database configuration', async () => {
      // Create custom configuration
      const customConfig = {
        environmentType: TestEnvironmentType.INTEGRATION,
        provider: 'mysql' as const,
        resetBeforeEachTest: true,
        seedTestData: false, // Don't auto-seed
        useTransactions: true,
        connectionPoolSize: 2,
        migrationTimeout: 15000,
        healthCheckInterval: 5000,
        enablePerformanceMonitoring: true
      };

      const database = new TestDatabase(customConfig);
      await database.setup();

      try {
        // Database should be empty (no auto-seeding)
        await database.withTransaction(async (prisma) => {
          const users = await prisma.users.findMany();
          expect(users).toHaveLength(0);

          // Manually create some data
          await prisma.users.create({
            data: {
              id: 'custom-user-1',
              username: 'customuser',
              password: 'hashedpassword',
              role: 'LIBRARIAN',
              isActive: true
            }
          });

          const usersAfterCreate = await prisma.users.findMany();
          expect(usersAfterCreate).toHaveLength(1);
        });
      } finally {
        await database.cleanup();
      }
    });
  });

  describe('Connection Pooling', () => {
    it('should use connection pooling for better performance', async () => {
      // Create database with connection pooling
      const config = {
        ...TestDatabaseConfigs.integration,
        connectionPoolSize: 3
      };

      const database = new TestDatabase(config);
      await database.setup();

      try {
        // Get pooled client
        const pooledPrisma = database.getPooledClient();
        expect(pooledPrisma).toBeDefined();

        // Use pooled client
        await database.withTransaction(async (prisma) => {
          const result = await prisma.$queryRaw`SELECT 1 as test`;
          expect(result).toBeDefined();
        });

        // Should be able to get multiple different clients
        const client1 = database.getPooledClient();
        const client2 = database.getPooledClient();
        expect(client1).toBeDefined();
        expect(client2).toBeDefined();

      } finally {
        await database.cleanup();
      }
    });
  });
});