# Test Database Configuration

This directory contains comprehensive test-specific database configurations that provide isolated test environments with proper setup, teardown, and data management capabilities.

## Overview

The test database system provides:

- **Isolated test databases** for different test suites
- **Connection pooling** for test efficiency
- **Support for multiple database providers** (MySQL, PostgreSQL, SQLite)
- **Automatic database migration** before tests
- **Data seeding utilities** using mock factories
- **Cleanup mechanisms** for test isolation
- **Transaction wrappers** for automatic rollback
- **Database health checks** for test environments

## Files

- [`database.ts`](./database.ts) - Main test database configuration and utilities

## Quick Start

```typescript
import { TestDatabaseUtils, TestEnvironmentType } from './setup/database';

// Create a unit test database
const database = await TestDatabaseUtils.create(TestEnvironmentType.UNIT);

// Use the database
const prisma = database.getPrismaClient();
const users = await prisma.users.findMany();

// Cleanup automatically
await database.cleanup();
```

## Test Environment Types

### 1. Unit Tests
- **Database**: SQLite (in-memory)
- **Setup**: Minimal configuration
- **Data**: Basic test data
- **Transactions**: Enabled with auto-rollback
- **Performance Monitoring**: Disabled

```typescript
const database = await TestDatabaseUtils.create(TestEnvironmentType.UNIT);
```

### 2. Integration Tests
- **Database**: MySQL with test schema
- **Setup**: Full schema with migrations
- **Data**: Comprehensive test dataset
- **Transactions**: Enabled with auto-rollback
- **Performance Monitoring**: Enabled

```typescript
const database = await TestDatabaseUtils.create(TestEnvironmentType.INTEGRATION);
```

### 3. E2E Tests
- **Database**: MySQL with realistic data
- **Setup**: Full database with realistic data
- **Data**: Large, realistic dataset
- **Transactions**: Disabled (maintain state)
- **Performance Monitoring**: Enabled

```typescript
const database = await TestDatabaseUtils.create(TestEnvironmentType.E2E);
```

### 4. Performance Tests
- **Database**: MySQL optimized for large datasets
- **Setup**: Optimized configuration
- **Data**: Large performance test dataset
- **Transactions**: Disabled
- **Performance Monitoring**: Enabled

```typescript
const database = await TestDatabaseUtils.create(TestEnvironmentType.PERFORMANCE);
```

## Advanced Usage

### Database Manager

Manage multiple test database instances:

```typescript
import { TestDatabaseManager } from './setup/database';

// Get or create instances
const unitDb = TestDatabaseManager.getInstance('unit', TestDatabaseConfigs.unit);
const integrationDb = TestDatabaseManager.getInstance('integration', TestDatabaseConfigs.integration);

// Setup all databases
await TestDatabaseManager.setupAll();

// Reset all databases
await TestDatabaseManager.resetAll();

// Cleanup all databases
await TestDatabaseManager.cleanupAll();
```

### Transaction Wrappers

Execute operations with automatic rollback:

```typescript
// Auto-rollback for test isolation
await database.withTransaction(async (prisma) => {
  await prisma.users.create({ data: userData });
  await prisma.students.create({ data: studentData });
  // Automatically rolled back
});

// No rollback for E2E tests
await database.withTransaction(async (prisma) => {
  return await prisma.users.findMany();
}, false);
```

### Connection Pooling

Use pooled connections for better performance:

```typescript
// Get a random connection from the pool
const pooledPrisma = database.getPooledClient();
const result = await pooledPrisma.users.findMany();
```

### Health Monitoring

Monitor database health during tests:

```typescript
// Check health status
const health = database.getHealthStatus();
console.log('Database healthy:', health.isHealthy);
console.log('Response time:', health.responseTime);

// Wait for database to be ready
await database.waitForReady(30000);
```

### Statistics

Track database performance and usage:

```typescript
const stats = database.getStats();
console.log('Total queries:', stats.totalQueries);
console.log('Average query time:', stats.averageQueryTime);
console.log('Setup time:', stats.setupTime);
```

## Configuration

### Custom Configuration

Create custom database configurations:

```typescript
const customConfig: TestDatabaseConfig = {
  environmentType: TestEnvironmentType.INTEGRATION,
  provider: DatabaseProvider.POSTGRESQL,
  resetBeforeEachTest: true,
  seedTestData: true,
  useTransactions: true,
  connectionPoolSize: 5,
  migrationTimeout: 30000,
  healthCheckInterval: 10000,
  enablePerformanceMonitoring: true
};

const database = new TestDatabase(customConfig);
await database.setup();
```

### Environment Variables

The test database system respects these environment variables:

- `DATABASE_URL` - Primary database connection string
- `NODE_ENV` - Environment (should be 'test' for testing)
- `TEST_DATABASE_URL` - Override for test database
- `TEST_REDIS_HOST` - Redis host for tests
- `TEST_REDIS_PORT` - Redis port for tests

## Data Seeding

### Factory Integration

The test database integrates with the mock factories:

```typescript
// Automatic seeding based on test type
await database.setup(); // Automatically seeds based on environment type

// Manual seeding
await database.seedTestData();
```

### Seed Data by Environment

- **Unit Tests**: 1 user, 1 student, 1 book
- **Integration Tests**: 5 users, 20 students, 40 books, 15 equipment
- **E2E Tests**: 8 users, 50 students, 100 books, 25 equipment, 75 checkouts
- **Performance Tests**: Large dataset for performance testing

## Migration Management

### Automatic Migrations

Migrations are automatically run during setup:

```typescript
await database.setup(); // Runs migrations automatically
```

### Manual Migration Control

```typescript
// Run migrations manually
await database.runMigrations();

// Custom migration timeout
const config = {
  ...TestDatabaseConfigs.integration,
  migrationTimeout: 60000 // 60 seconds
};
```

## Error Handling

### Graceful Degradation

The system handles errors gracefully:

```typescript
try {
  await database.setup();
} catch (error) {
  console.error('Setup failed:', error);
  await database.cleanup(); // Automatic cleanup on failure
}
```

### Retry Logic

Built-in retry logic for connection failures:

```typescript
// Wait for database to be ready with timeout
await database.waitForReady(30000);
```

## Best Practices

### 1. Test Isolation

Always use transactions for test isolation:

```typescript
await database.withTransaction(async (prisma) => {
  // Test code here
});
```

### 2. Cleanup

Always cleanup after tests:

```typescript
afterAll(async () => {
  await database.cleanup();
});
```

### 3. Environment-Specific Configurations

Use appropriate configurations for different test types:

```typescript
// Unit tests - SQLite, minimal setup
const unitDb = await TestDatabaseUtils.create(TestEnvironmentType.UNIT);

// Integration tests - MySQL, full setup
const integrationDb = await TestDatabaseUtils.create(TestEnvironmentType.INTEGRATION);
```

### 4. Performance Monitoring

Enable performance monitoring for integration and E2E tests:

```typescript
const config = {
  ...TestDatabaseConfigs.integration,
  enablePerformanceMonitoring: true
};
```

## Integration with Test Frameworks

### Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./src/tests/setup/database.ts'],
    globalSetup: ['./src/tests/setup/globalSetup.ts'],
    environment: 'node'
  }
});
```

### Jest

```typescript
// jest.config.js
module.exports = {
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup/database.ts'],
  testEnvironment: 'node'
};
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check DATABASE_URL environment variable
   - Ensure database server is running
   - Verify credentials

2. **Migration Timeout**
   - Increase migrationTimeout in configuration
   - Check database server performance
   - Verify schema complexity

3. **Transaction Rollback Issues**
   - Ensure useTransactions is enabled
   - Check for long-running transactions
   - Verify transaction nesting

### Debug Mode

Enable debug logging:

```typescript
const config = {
  ...TestDatabaseConfigs.integration,
  enablePerformanceMonitoring: true,
  healthCheckInterval: 1000
};
```

## Examples

### Basic Unit Test

```typescript
import { TestDatabaseUtils, TestEnvironmentType } from '../setup/database';

describe('User Service', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await TestDatabaseUtils.create(TestEnvironmentType.UNIT);
  });

  afterAll(async () => {
    await database.cleanup();
  });

  it('should create a user', async () => {
    await database.withTransaction(async (prisma) => {
      const user = await prisma.users.create({
        data: {
          username: 'testuser',
          password: 'hashedpassword',
          role: 'LIBRARIAN'
        }
      });

      expect(user.id).toBeDefined();
      expect(user.username).toBe('testuser');
    });
  });
});
```

### Integration Test Example

```typescript
import { TestDatabaseUtils, TestEnvironmentType } from '../setup/database';

describe('Book Checkout Integration', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await TestDatabaseUtils.create(TestEnvironmentType.INTEGRATION);
  });

  afterAll(async () => {
    await database.cleanup();
  });

  it('should checkout a book', async () => {
    await database.withTransaction(async (prisma) => {
      const book = await prisma.books.findFirst();
      const student = await prisma.students.findFirst();

      const checkout = await prisma.book_checkouts.create({
        data: {
          bookId: book.id,
          studentId: student.id,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });

      expect(checkout.id).toBeDefined();
      expect(checkout.status).toBe('ACTIVE');
    });
  });
});
```

## Migration from Existing Test Database

If you're migrating from the existing test database system:

1. Replace imports:
   ```typescript
   // Old
   import TestDatabaseManager from '../utils/testDatabase';
   
   // New
   import { TestDatabaseUtils, TestEnvironmentType } from './setup/database';
   ```

2. Update setup:
   ```typescript
   // Old
   const testDb = new TestDatabaseManager(config);
   await testDb.setup();
   
   // New
   const testDb = await TestDatabaseUtils.create(TestEnvironmentType.INTEGRATION);
   ```

3. Update transaction usage:
   ```typescript
   // Old
   await prisma.$transaction(async (tx) => {
     // Test code
   });
   
   // New
   await database.withTransaction(async (prisma) => {
     // Test code
   });
   ```

## Performance Considerations

- Use SQLite for unit tests (faster setup)
- Enable connection pooling for integration tests
- Use transactions for test isolation
- Monitor performance during test runs
- Cleanup resources promptly

## Security Considerations

- Use separate test databases
- Never use production credentials
- Rotate test database passwords
- Limit test database permissions
- Sanitize test data