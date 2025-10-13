# CLMS API Integration Testing Guide

## Overview

This guide provides comprehensive documentation for running, developing, and maintaining the API integration tests for the CLMS (Comprehensive Library Management System). The testing framework ensures API reliability, performance, and security across all 26+ endpoints.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Test Suite Architecture](#test-suite-architecture)
3. [Quick Start](#quick-start)
4. [Running Tests](#running-tests)
5. [Test Categories](#test-categories)
6. [Mock Data Management](#mock-data-management)
7. [Performance Testing](#performance-testing)
8. [Authentication Testing](#authentication-testing)
9. [Continuous Integration](#continuous-integration)
10. [Troubleshooting](#troubleshooting)
11. [Best Practices](#best-practices)

## Prerequisites

### Environment Setup

1. **Node.js Version**: v20+ required
2. **Database**: MySQL with test database credentials
3. **Environment Variables**:
   ```env
   NODE_ENV=test
   DATABASE_URL=mysql://test_user:test_password@localhost:3308/clms_test_database
   JWT_SECRET=test-jwt-secret-key-for-testing-only
   BCRYPT_ROUNDS=4
   ```

### Required Dependencies

Ensure these packages are installed in `package.json`:

```json
{
  "devDependencies": {
    "@types/supertest": "^2.0.12",
    "supertest": "^6.3.3",
    "vitest": "^1.0.0",
    "@faker-js/faker": "^8.0.0",
    "commander": "^11.0.0",
    "ts-node": "^10.9.1"
  }
}
```

### Database Setup

1. Create test database:
   ```sql
   CREATE DATABASE clms_test_database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. Grant permissions:
   ```sql
   GRANT ALL PRIVILEGES ON clms_test_database.* TO 'test_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

## Test Suite Architecture

```
Backend/src/tests/
├── integration/
│   ├── api-integration.test.ts      # Main API integration tests
│   └── studentApi.test.ts           # Student-specific API tests
├── performance/
│   └── load-testing.test.ts         # Performance and load tests
├── utils/
│   ├── testDatabase.ts              # Database setup/teardown utilities
│   ├── authHelpers.ts               # Authentication testing helpers
│   └── mockDataGenerator.ts         # Mock data generation
├── setup-api-tests.ts               # Global test setup
├── run-api-tests.ts                 # Test runner script
└── README.md                        # This guide
```

### Key Components

1. **TestDatabaseManager**: Handles test database lifecycle
2. **AuthTestHelper**: Manages authentication and authorization testing
3. **MockDataGenerator**: Creates realistic test data
4. **ApiTestRunner**: Orchestrates test execution and reporting

## Quick Start

### 1. Install Dependencies

```bash
cd Backend
npm install
```

### 2. Run All Tests

```bash
# Using the test runner script
npm run test:api

# Or directly with Vitest
npm run test -- api-integration

# With coverage
npm run test:coverage
```

### 3. Run Specific Test Suite

```bash
# Run only API integration tests
npm run test api-integration

# Run authentication tests
npm run test auth

# Run performance tests
npm run test performance
```

## Running Tests

### Using the Test Runner Script

The `run-api-tests.ts` script provides comprehensive test execution options:

```bash
# Run all test suites
npx ts-node src/tests/run-api-tests.ts run

# Run specific suite
npx ts-node src/tests/run-api-tests.ts run -s integration

# With coverage
npx ts-node src/tests/run-api-tests.ts run --coverage

# Performance tests included
npx ts-node src/tests/run-api-tests.ts run --performance

# Verbose output
npx ts-node src/tests/run-api-tests.ts run --verbose

# Watch mode for development
npx ts-node src/tests/run-api-tests.ts run --watch
```

### Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --suite` | Test suite to run | `all` |
| `-c, --coverage` | Enable code coverage | `false` |
| `-w, --watch` | Enable watch mode | `false` |
| `-v, --verbose` | Verbose logging | `false` |
| `-p, --performance` | Include performance tests | `false` |
| `-b, --bail` | Stop on first failure | `false` |
| `-r, --reporters` | Test reporters | `verbose` |
| `-t, --timeout` | Test timeout (ms) | `10000` |
| `--parallel` | Run tests in parallel | `false` |
| `--max-workers` | Maximum workers | `4` |

### NPM Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:api": "ts-node src/tests/run-api-tests.ts run -s api",
    "test:integration": "ts-node src/tests/run-api-tests.ts run -s integration",
    "test:performance": "ts-node src/tests/run-api-tests.ts run -s performance --performance",
    "test:coverage": "ts-node src/tests/run-api-tests.ts run --coverage",
    "test:watch": "ts-node src/tests/run-api-tests.ts run --watch",
    "test:ci": "ts-node src/tests/run-api-tests.ts run --coverage --bail"
  }
}
```

## Test Categories

### 1. Integration Tests (`api-integration.test.ts`)

**Coverage**: All 26+ API endpoints
- Authentication endpoints (7)
- Student management endpoints (9)
- Book management endpoints (9)
- Equipment endpoints (9)
- Analytics endpoints (8)
- Automation endpoints (6)

**Example Test Structure**:
```typescript
describe('Students API', () => {
  let adminTokens: any;

  beforeEach(async () => {
    adminTokens = await authHelper.loginAsRole('ADMIN');
  });

  it('should get all students', async () => {
    const response = await authHelper.authenticatedRequest(
      'get',
      '/api/students',
      adminTokens
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('students');
  });
});
```

### 2. Authentication Tests (`authHelpers.ts`)

**Features**:
- JWT token validation
- Role-based access control (RBAC)
- Login/logout scenarios
- Token refresh functionality
- Session management

**Test Coverage**:
- Valid authentication
- Invalid credentials
- Token expiration
- Permission levels (6 roles)
- Concurrent sessions

### 3. Performance Tests (`load-testing.test.ts`)

**Metrics Monitored**:
- Response times (avg, P95, P99)
- Throughput (requests per second)
- Error rates
- Memory usage
- Connection pool efficiency

**Test Scenarios**:
- Concurrent user load (10-50 concurrent users)
- Sustained load over time
- Stress testing
- Memory leak detection
- Database connection limits

### 4. Security Tests

**Security Features Tested**:
- SQL injection prevention
- XSS protection
- Input validation
- Rate limiting
- Authentication bypass attempts
- Authorization enforcement

## Mock Data Management

### Data Generation

The `MockDataGenerator` creates realistic test data:

```typescript
// Generate comprehensive mock data
const mockData = await mockDataGenerator.generateMockData({
  studentsCount: 50,
  booksCount: 100,
  equipmentCount: 20,
  activitiesCount: 200,
  checkoutsCount: 150,
  usersCount: 10
});
```

### Test Users

Predefined test users with different roles:

| Role | Username | Permissions |
|------|----------|-------------|
| SUPER_ADMIN | superadmin | Full system access |
| ADMIN | admin | Administrative functions |
| LIBRARIAN | librarian | Library operations |
| ASSISTANT | assistant | Basic operations |
| VIEWER | viewer | Read-only access |

### Data Relationships

Mock data maintains proper foreign key relationships:
- Students → Activities
- Books → Checkouts
- Equipment → Sessions
- Users → Audit logs

## Performance Testing

### Load Testing Scenarios

1. **Basic Load Test**: 50 requests, 20 concurrent users
2. **Stress Test**: 500 requests, 50 concurrent users
3. **Sustained Load**: 10 minutes of continuous requests
4. **Peak Load**: Burst patterns simulating real usage

### Performance Benchmarks

| Metric | Target | Threshold |
|--------|--------|-----------|
| Average Response Time | < 500ms | 1000ms |
| P95 Response Time | < 1000ms | 2000ms |
| Success Rate | > 95% | 90% |
| Throughput | > 10 RPS | 5 RPS |
| Memory Growth | < 10MB/test | 50MB/test |

### Running Performance Tests

```bash
# Basic performance tests
npm run test:performance

# Include load testing
npx ts-node src/tests/run-api-tests.ts run --performance

# With custom configuration
ENABLE_LOAD_TESTS=true npm run test performance
```

## Authentication Testing

### JWT Token Testing

```typescript
// Test various token scenarios
const { results, passed } = await authHelper.testTokenValidation();

// Test role-based access
const rbacResults = await authHelper.testRoleBasedAccess(
  '/api/students',
  'get',
  [],
  ['STUDENTS_VIEW']
);
```

### Permission Matrix

| Endpoint | SUPER_ADMIN | ADMIN | LIBRARIAN | ASSISTANT | VIEWER |
|----------|-------------|-------|-----------|-----------|--------|
| GET /students | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /students | ✅ | ✅ | ✅ | ❌ | ❌ |
| DELETE /students | ✅ | ✅ | ❌ | ❌ | ❌ |
| GET /analytics | ✅ | ✅ | ✅ | ❌ | ❌ |
| POST /users | ✅ | ❌ | ❌ | ❌ | ❌ |

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: API Integration Tests

on:
  push:
    branches: [ master, develop ]
  pull_request:
    branches: [ master ]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: test
          MYSQL_DATABASE: clms_test_database
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run API tests
      run: npm run test:ci
      env:
        DATABASE_URL: mysql://root:test@localhost:3306/clms_test_database
        NODE_ENV: test

    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
```

### Docker Testing

```dockerfile
# Dockerfile.test
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Run tests
CMD ["npm", "run", "test:ci"]
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors

**Problem**: `ECONNREFUSED` database connection error

**Solution**:
```bash
# Check MySQL service
sudo systemctl status mysql

# Start MySQL service
sudo systemctl start mysql

# Verify test database exists
mysql -u root -p -e "SHOW DATABASES LIKE 'clms_test_database';"
```

#### 2. Test Timeouts

**Problem**: Tests timing out after 10 seconds

**Solution**:
```bash
# Increase timeout
npx ts-node src/tests/run-api-tests.ts run --timeout 30000

# Or in vitest.config.ts
export default defineConfig({
  test: {
    timeout: 30000
  }
});
```

#### 3. Memory Issues

**Problem**: Out of memory errors during load testing

**Solution**:
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run test:performance

# Run tests sequentially
npx ts-node src/tests/run-api-tests.ts run --no-parallel
```

#### 4. Permission Errors

**Problem**: Tests failing due to insufficient permissions

**Solution**:
```bash
# Check file permissions
ls -la src/tests/

# Fix permissions
chmod +x src/tests/run-api-tests.ts
```

### Debug Mode

Enable debug logging:
```bash
# Verbose output
npm run test:api -- --verbose

# Enable test logging
TEST_LOGGING=true npm run test:api

# Node.js debug
node --inspect-brk node_modules/.bin/vest run
```

## Best Practices

### Test Writing Guidelines

1. **Arrange-Act-Assert Pattern**:
   ```typescript
   // Arrange
   const testData = generateTestData('student');
   const tokens = await authHelper.loginAsRole('LIBRARIAN');

   // Act
   const response = await authHelper.authenticatedRequest(
     'post',
     '/api/students',
     tokens,
     testData
   );

   // Assert
   expect(response.status).toBe(201);
   expect(response.body.data.firstName).toBe(testData.firstName);
   ```

2. **Use Test Helpers**:
   ```typescript
   // Good: Use helper methods
   const tokens = await authHelper.loginAsRole('ADMIN');

   // Bad: Manual authentication
   const loginResponse = await request(app)
     .post('/api/auth/login')
     .send({ username: 'admin', password: 'password' });
   ```

3. **Test Data Isolation**:
   ```typescript
   beforeEach(async () => {
     // Reset database or use unique test data
     await testDb.reset();
   });
   ```

### Performance Test Guidelines

1. **Realistic Scenarios**: Test with realistic data volumes and user patterns
2. **Gradual Load**: Start with small loads and gradually increase
3. **Multiple Metrics**: Monitor response times, throughput, and resource usage
4. **Baseline Comparison**: Compare results against established benchmarks

### Security Test Guidelines

1. **Input Validation**: Test with malicious inputs
2. **Authorization**: Verify role-based access controls
3. **Authentication**: Test token validation and session management
4. **Data Exposure**: Ensure sensitive data is not leaked

### CI/CD Integration

1. **Fast Feedback**: Run quick tests first, slower tests later
2. **Parallel Execution**: Run tests in parallel when possible
3. **Artifact Collection**: Save test results and coverage reports
4. **Failure Notifications**: Alert on test failures

## Test Coverage Report

After running tests with coverage (`--coverage` flag):

1. **HTML Report**: Open `coverage/index.html` in browser
2. **Console Summary**: Coverage percentages displayed in console
3. **JSON Report**: Available in `test-results/api-test-report.json`

### Coverage Targets

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 85%
- **Lines**: > 80%

## Contributing to Tests

When adding new API endpoints:

1. **Add Integration Tests**: Update `api-integration.test.ts`
2. **Add Authentication Tests**: Update `authHelpers.ts` if needed
3. **Add Performance Tests**: Update `load-testing.test.ts` for critical endpoints
4. **Update Mock Data**: Add new data types to `mockDataGenerator.ts`
5. **Update Documentation**: Update this guide with new test information

### Test File Template

```typescript
describe('[Feature Name] API', () => {
  let tokens: any;

  beforeEach(async () => {
    tokens = await authHelper.loginAsRole('ADMIN');
  });

  describe('GET /api/[endpoint]', () => {
    it('should return list of items', async () => {
      const response = await authHelper.authenticatedRequest(
        'get',
        '/api/[endpoint]',
        tokens
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should handle authentication errors', async () => {
      const response = await request(app).get('/api/[endpoint]');
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/[endpoint]', () => {
    it('should create new item', async () => {
      const newItem = generateTestData('[entity]');

      const response = await authHelper.authenticatedRequest(
        'post',
        '/api/[endpoint]',
        tokens,
        newItem
      );

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should validate input data', async () => {
      const invalidData = { /* invalid data */ };

      const response = await authHelper.authenticatedRequest(
        'post',
        '/api/[endpoint]',
        tokens,
        invalidData
      );

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
```

## Support and Maintenance

### Regular Maintenance Tasks

1. **Update Test Data**: Review and update mock data periodically
2. **Review Performance**: Update benchmarks as the system evolves
3. **Security Testing**: Add new security test scenarios as needed
4. **Coverage Monitoring**: Maintain or improve test coverage
5. **Documentation Updates**: Keep this guide current

### Getting Help

- **Test Issues**: Check troubleshooting section first
- **Performance Problems**: Review system resources and database configuration
- **CI/CD Issues**: Check workflow configuration and environment variables
- **Documentation**: Update this guide for any new patterns or issues

---

This comprehensive testing framework ensures the CLMS API remains reliable, secure, and performant throughout its development lifecycle. Regular execution of these tests helps maintain code quality and prevents regressions.