# CLMS Integration Testing Guide

This guide provides comprehensive documentation for the CLMS (Comprehensive Library Management System) integration testing suite.

## Table of Contents

1. [Overview](#overview)
2. [Test Architecture](#test-architecture)
3. [Test Types](#test-types)
4. [Running Tests](#running-tests)
5. [Test Configuration](#test-configuration)
6. [Writing Tests](#writing-tests)
7. [Test Data Management](#test-data-management)
8. [CI/CD Integration](#cicd-integration)
9. [Troubleshooting](#troubleshooting)

## Overview

The CLMS integration testing suite provides comprehensive validation of all system components, ensuring that new features work together seamlessly. The testing framework covers:

- **WebSocket real-time functionality** - Validates real-time updates, connections, and message handling
- **Advanced analytics accuracy and performance** - Tests predictive insights, forecasting, and data processing
- **Error handling and recovery mechanisms** - Validates system resilience and error recovery
- **Security controls and authentication flows** - Tests security measures and user authentication
- **Mobile responsiveness** - Validates mobile-friendly UI components and interactions
- **API integration** - Tests all API endpoints and cross-service communication
- **Frontend integration** - Tests real-time dashboard updates and WebSocket connections
- **Performance and load testing** - Validates system performance under various loads

## Test Architecture

### Directory Structure

```
Backend/
├── src/
│   └── tests/
│       ├── integration/          # Integration tests
│       │   ├── setup.ts         # Integration test setup
│       │   ├── globalSetup.ts   # Global integration setup
│       │   └── *.test.ts        # Integration test files
│       ├── websocket/           # WebSocket tests
│       │   ├── setup.ts         # WebSocket test setup
│       │   ├── globalSetup.ts   # Global WebSocket setup
│       │   ├── connection.test.ts
│       │   ├── realtime.test.ts
│       │   └── performance.test.ts
│       ├── analytics/           # Analytics tests
│       │   ├── setup.ts         # Analytics test setup
│       │   ├── globalSetup.ts   # Global analytics setup
│       │   ├── accuracy.test.ts
│       │   └── performance.test.ts
│       ├── security/            # Security tests
│       ├── mobile/              # Mobile responsiveness tests
│       └── e2e/                 # End-to-end tests
├── scripts/
│   ├── test-pipeline.ts         # Automated test execution pipeline
│   └── load-testing.ts          # Load testing suite
├── vitest.integration.config.ts # Integration test configuration
├── vitest.websocket.config.ts    # WebSocket test configuration
├── vitest.analytics.config.ts    # Analytics test configuration
├── vitest.security.config.ts     # Security test configuration
├── vitest.mobile.config.ts       # Mobile test configuration
├── vitest.e2e.config.ts          # E2E test configuration
└── vitest.performance.config.ts  # Performance test configuration
```

### Test Framework Stack

- **Vitest** - Fast unit test framework with TypeScript support
- **Supertest** - HTTP assertion testing
- **WebSocket (ws)** - WebSocket client testing
- **Puppeteer/Playwright** - Browser automation for E2E tests
- **Artillery/Autocannon** - Load testing tools
- **Jest DOM** - DOM testing utilities for frontend components

## Test Types

### 1. WebSocket Real-Time Tests

**Location**: `src/tests/websocket/`

**Purpose**: Validate real-time functionality including:
- Connection authentication and management
- Message broadcasting and subscriptions
- Real-time activity updates
- Equipment status changes
- Analytics updates
- Performance under load

**Key Tests**:
- Connection authentication and authorization
- Message throughput and latency
- Subscription management
- Connection limits and scaling
- Error handling and recovery

**Running**:
```bash
npm run test:websocket
```

### 2. Analytics Accuracy Tests

**Location**: `src/tests/analytics/`

**Purpose**: Validate analytics accuracy and performance including:
- Predictive insights generation
- Time series forecasting
- Usage heat maps
- Seasonal pattern analysis
- Resource forecasting
- Report generation

**Key Tests**:
- Predictive insights accuracy
- Forecast confidence levels
- Data processing performance
- Report completeness
- Statistical calculations

**Running**:
```bash
npm run test:analytics
```

### 3. Integration Tests

**Location**: `src/tests/integration/`

**Purpose**: Validate component integration including:
- API endpoint integration
- Database operations
- Service interactions
- Authentication flows
- Data consistency

**Key Tests**:
- End-to-end API workflows
- Database transaction integrity
- Service layer integration
- Authentication and authorization
- Error propagation

**Running**:
```bash
npm run test:integration
```

### 4. Security Tests

**Location**: `src/tests/security/`

**Purpose**: Validate security controls including:
- Authentication bypass attempts
- SQL injection prevention
- XSS protection
- CSRF protection
- Rate limiting
- Input validation

**Key Tests**:
- Authentication flow security
- Malicious payload handling
- Rate limiting effectiveness
- Security header validation
- Access control verification

**Running**:
```bash
npm run test:security
```

### 5. Mobile Responsiveness Tests

**Location**: `src/tests/mobile/`

**Purpose**: Validate mobile compatibility including:
- Touch interactions
- Viewport handling
- Mobile-specific UI components
- Performance on mobile devices
- Orientation changes

**Key Tests**:
- Mobile viewport rendering
- Touch gesture handling
- Mobile-specific features
- Performance optimization
- Responsive design validation

**Running**:
```bash
npm run test:mobile
```

### 6. Performance Tests

**Location**: `src/tests/performance/`

**Purpose**: Validate system performance including:
- Response time benchmarks
- Memory usage optimization
- CPU efficiency
- Database query performance
- Concurrent request handling

**Key Tests**:
- Response time benchmarks
- Memory leak detection
- CPU usage optimization
- Database performance
- Scalability testing

**Running**:
```bash
npm run test:performance
```

### 7. End-to-End Tests

**Location**: `src/tests/e2e/`

**Purpose**: Validate complete user workflows including:
- Complete user journeys
- Cross-component interactions
- Real-world usage scenarios
- Browser compatibility
- Data flow validation

**Key Tests**:
- User registration and login
- Complete library workflows
- Equipment reservation cycles
- Book checkout processes
- Analytics dashboard usage

**Running**:
```bash
npm run test:e2e
```

## Running Tests

### Individual Test Suites

```bash
# Run all unit tests
npm run test

# Run specific test types
npm run test:integration
npm run test:websocket
npm run test:analytics
npm run test:security
npm run test:mobile
npm run test:e2e
npm run test:performance

# Run with coverage
npm run test:coverage

# Run with UI
npm run test:ui
```

### Automated Test Pipeline

The automated test pipeline executes all test suites in an optimized order:

```bash
# Run complete test pipeline
npm run test:all

# Run pipeline with custom configuration
tsx scripts/test-pipeline.ts

# Run pipeline options
tsx scripts/test-pipeline.ts --no-bail          # Don't stop on critical failures
tsx scripts/test-pipeline.ts --no-reports       # Don't generate reports
tsx scripts/test-pipeline.ts --retries=3       # Retry failed tests 3 times
tsx scripts/test-pipeline.ts --suite websocket  # Run only WebSocket tests
```

### Load Testing

```bash
# Run comprehensive load testing
npm run test:load

# Run load testing with custom configuration
tsx scripts/load-testing.ts --url=http://localhost:3001
```

## Test Configuration

### Environment Variables

Test configurations use specific environment variables:

```bash
# Test database
DATABASE_URL=mysql://clms_user:clms_password@localhost:3308/clms_test_database

# Test Redis
REDIS_HOST=localhost
REDIS_PORT=6380

# Test JWT secrets
JWT_SECRET=test-jwt-secret-key

# Test server ports
TEST_PORT=3003
TEST_WS_PORT=3004
```

### Test Configuration Files

Each test type has its own Vitest configuration:

- `vitest.integration.config.ts` - Integration test configuration
- `vitest.websocket.config.ts` - WebSocket test configuration
- `vitest.analytics.config.ts` - Analytics test configuration
- `vitest.security.config.ts` - Security test configuration
- `vitest.mobile.config.ts` - Mobile test configuration
- `vitest.e2e.config.ts` - E2E test configuration
- `vitest.performance.config.ts` - Performance test configuration

### Custom Configuration

You can customize test behavior by modifying configuration files:

```typescript
// Example: vitest.integration.config.ts
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/tests/integration/setup.ts'],
    globalSetup: ['./src/tests/integration/globalSetup.ts'],
    testTimeout: 30000,
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 2,
        minThreads: 1
      }
    }
  }
})
```

## Writing Tests

### Test Structure

Follow this structure for new tests:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setupTestData, cleanupTestData } from '../setup'

describe('Feature Name', () => {
  beforeEach(async () => {
    await setupTestData()
  })

  afterEach(async () => {
    await cleanupTestData()
  })

  describe('Specific Functionality', () => {
    it('should work correctly', async () => {
      // Test implementation
      expect(result).toBeDefined()
    })
  })
})
```

### Test Data Management

Use the provided utilities for test data:

```typescript
import { generateTestStudent, generateTestEquipment, generateTestBook } from '../setup'

// Generate test data
const student = generateTestStudent('TEST-PREFIX')
const equipment = generateTestEquipment('TEST-PREFIX')
const book = generateTestBook('TEST-PREFIX')
```

### WebSocket Testing

Use the WebSocket test client for real-time testing:

```typescript
import { WebSocketTestClient, generateTestJWT } from '../setup'

const client = new WebSocketTestClient(generateTestJWT('test-user', 'ADMIN'))
await client.connect()
await client.sendMessage({ type: 'subscribe', data: { subscriptions: ['activities'] } })
const response = await client.waitForMessage('subscription_confirmed', 5000)
```

### API Testing

Use Supertest for API testing:

```typescript
import request from 'supertest'
import { app } from '../../app'

const response = await request(app)
  .get('/api/students')
  .set('Authorization', `Bearer ${testToken}`)
  .expect(200)

expect(response.body).toBeInstanceOf(Array)
```

## Test Data Management

### Database Setup

Test databases are automatically created and managed:

- **Integration Tests**: `clms_integration_test`
- **WebSocket Tests**: `clms_websocket_test`
- **Analytics Tests**: `clms_analytics_test`
- **Security Tests**: `clms_security_test`
- **Mobile Tests**: `clms_mobile_test`
- **E2E Tests**: `clms_e2e_test`
- **Performance Tests**: `clms_performance_test`

### Data Seeding

Test data is automatically seeded with:

- **Users**: Different roles (ADMIN, LIBRARIAN, STAFF, VIEWER)
- **Students**: Various grade categories and sections
- **Equipment**: Different types and statuses
- **Books**: Various categories and availability
- **Activities**: Historical activity data for analytics

### Data Cleanup

Each test suite automatically cleans up:

```typescript
beforeEach(async () => {
  // Clean up test data
  await prisma.activity.deleteMany()
  await prisma.equipmentSession.deleteMany()
  // ... other cleanup
})
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test Pipeline

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: clms_test
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
        cache-dependency-path: Backend/package-lock.json

    - name: Install dependencies
      run: |
        cd Backend
        npm ci

    - name: Setup test database
      run: |
        cd Backend
        npx prisma db push --force-reset
        npx prisma db seed

    - name: Run unit tests
      run: |
        cd Backend
        npm run test

    - name: Run integration tests
      run: |
        cd Backend
        npm run test:integration

    - name: Run WebSocket tests
      run: |
        cd Backend
        npm run test:websocket

    - name: Run analytics tests
      run: |
        cd Backend
        npm run test:analytics

    - name: Run security tests
      run: |
        cd Backend
        npm run test:security

    - name: Run mobile tests
      run: |
        cd Backend
        npm run test:mobile

    - name: Run E2E tests
      run: |
        cd Backend
        npm run test:e2e

    - name: Run performance tests
      run: |
        cd Backend
        npm run test:performance

    - name: Generate test reports
      run: |
        cd Backend
        tsx scripts/test-pipeline.ts

    - name: Upload test reports
      uses: actions/upload-artifact@v3
      with:
        name: test-reports
        path: Backend/test-reports/
```

### Docker Testing

```dockerfile
# Dockerfile.test
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Install dependencies for all services
RUN npm run install:all

# Run tests
CMD ["npm", "run", "test:all"]
```

## Troubleshooting

### Common Issues

#### Database Connection Errors

```bash
# Ensure test database exists
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS clms_test_database"

# Check database permissions
mysql -u root -p -e "GRANT ALL PRIVILEGES ON clms_test_database.* TO 'clms_user'@'localhost'"
```

#### WebSocket Connection Failures

```bash
# Check WebSocket server status
curl -I http://localhost:3002/health

# Verify WebSocket port availability
netstat -an | grep 3002
```

#### Test Timeout Issues

```typescript
// Increase test timeout in configuration
testTimeout: 60000, // 60 seconds
```

#### Memory Issues in Tests

```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run test
```

### Debug Mode

Run tests with debug output:

```bash
# Run with verbose output
DEBUG=* npm run test:integration

# Run with Vitest debug
npx vitest run --inspect-brk src/tests/integration/
```

### Test Reports

Test reports are generated in `test-reports/` directory:

- `comprehensive-report-*.json` - Detailed JSON report
- `test-report-*.html` - HTML visualization
- Category-specific reports in subdirectories

### Performance Issues

For performance-related test failures:

1. Check system resources
2. Verify database performance
3. Review test data volume
4. Consider test parallelization
5. Optimize test queries

## Best Practices

### Test Organization

1. **Group related tests** using `describe` blocks
2. **Use descriptive test names** that explain what is being tested
3. **Follow AAA pattern** (Arrange, Act, Assert)
4. **Keep tests independent** and avoid test dependencies
5. **Use appropriate assertions** for the tested functionality

### Test Data Management

1. **Use test data factories** for consistent test data
2. **Clean up test data** after each test
3. **Use realistic data** that mirrors production
4. **Avoid hard-coded values** in tests
5. **Use environment-specific configurations**

### Performance Testing

1. **Test with realistic data volumes**
2. **Monitor system resources** during tests
3. **Use appropriate timeouts** for performance tests
4. **Test edge cases** and stress conditions
5. **Document performance baselines**

### Continuous Integration

1. **Run tests on every commit**
2. **Fail builds on test failures**
3. **Generate test reports** for analysis
4. **Monitor test execution time**
5. **Optimize test pipeline** for CI/CD

## Contributing

When adding new tests:

1. **Follow existing patterns** and conventions
2. **Add appropriate setup** and cleanup
3. **Include both positive and negative test cases**
4. **Document complex test scenarios**
5. **Update this guide** as needed

For questions or issues with the testing framework, please refer to the test files or contact the development team.