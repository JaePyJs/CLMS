# Mock Factories for CLMS Testing

This directory contains comprehensive mock factories for generating valid test data for the CLMS (Comprehensive Library Management System). The factories are designed to create realistic, interconnected data that matches the database schema and supports various testing scenarios.

## Overview

The factory system includes:

- **BaseFactory**: Core functionality and utilities
- **StudentFactory**: Generates valid student data with grade categories
- **BookFactory**: Creates books with valid ISBNs and categories
- **EquipmentFactory**: Produces equipment with specifications and maintenance data
- **CheckoutFactory**: Manages book checkout records with fines and due dates
- **UserFactory**: Creates user accounts with roles and permissions
- **RelationshipFactory**: Builds interconnected data with realistic relationships

## Quick Start

```typescript
import { factories, TestScenarios } from '@/tests/factories';

// Create a quick dataset for testing
const testData = await factories.createQuickDataset();

// Create specific test scenarios
const apiTestData = await TestScenarios.createAPITestData();
const uiTestData = await TestScenarios.createUITestData();
const performanceData = await TestScenarios.createPerformanceData('medium');
```

## Individual Factory Usage

### StudentFactory

```typescript
import { StudentFactory } from '@/tests/factories';

const studentFactory = new StudentFactory();

// Create single student
const student = studentFactory.create();

// Create multiple students
const students = studentFactory.createMany(10);

// Create students with specific grade level
const grade7Students = studentFactory.createWithGradeLevel('Grade 7', 5);

// Create students with equipment bans
const bannedStudents = studentFactory.createWithEquipmentBan(3);

// Create diverse student population
const diverseStudents = studentFactory.createDiverseSet(50);
```

### BookFactory

```typescript
import { BookFactory } from '@/tests/factories';

const bookFactory = new BookFactory();

// Create single book
const book = bookFactory.create();

// Create books in specific category
const fictionBooks = bookFactory.createWithCategory('Fiction', 10);

// Create available books
const availableBooks = bookFactory.createAvailable(15);

// Create reference books
const referenceBooks = bookFactory.createReferenceBooks(5);

// Create diverse collection
const collection = bookFactory.createDiverseCollection(100);
```

### EquipmentFactory

```typescript
import { EquipmentFactory } from '@/tests/factories';

const equipmentFactory = new EquipmentFactory();

// Create single equipment
const equipment = equipmentFactory.create();

// Create computers
const computers = equipmentFactory.createComputers(10);

// Create equipment under maintenance
const maintenanceEquipment = equipmentFactory.createUnderMaintenance(3);

// Create diverse inventory
const inventory = equipmentFactory.createDiverseInventory(30);
```

### CheckoutFactory

```typescript
import { CheckoutFactory } from '@/tests/factories';

const checkoutFactory = new CheckoutFactory();

// Create single checkout
const checkout = checkoutFactory.create();

// Create active checkouts
const activeCheckouts = checkoutFactory.createActive(10);

// Create overdue checkouts
const overdueCheckouts = checkoutFactory.createOverdue(5);

// Create realistic history
const history = checkoutFactory.createRealisticHistory(50);
```

### UserFactory

```typescript
import { UserFactory } from '@/tests/factories';

const userFactory = new UserFactory();

// Create single user
const user = await userFactory.create();

// Create users with specific roles
const admins = await userFactory.createWithRole('ADMIN', 3);
const librarians = await userFactory.createLibrarians(5);

// Create test user with known credentials
const testUser = await userFactory.createTestUser('testuser', 'password123');

// Create complete user hierarchy
const hierarchy = await userFactory.createCompleteHierarchy();
```

## Relationship-Aware Testing

The RelationshipFactory creates interconnected data with realistic relationships:

```typescript
import { RelationshipFactory } from '@/tests/factories';

const relationshipFactory = new RelationshipFactory();

// Create complete ecosystem
const ecosystem = await relationshipFactory.createCompleteEcosystem({
  studentCount: 50,
  bookCount: 100,
  equipmentCount: 30,
  userCount: 10,
  checkoutCount: 75
});

// Create library workflow scenario
const workflow = await relationshipFactory.createLibraryWorkflowScenario();

// Create stress test data
const stressData = await relationshipFactory.createStressTestData('large');

// Create edge case scenarios
const edgeCases = await relationshipFactory.createEdgeCaseScenarios();
```

## Predefined Test Scenarios

### API Testing
```typescript
const apiData = await TestScenarios.createAPITestData();
// Returns: users, students, books, equipment, checkouts
```

### UI Testing
```typescript
const uiData = await TestScenarios.createUITestData();
// Returns: dashboard scenario, analytics data, report data
```

### Performance Testing
```typescript
const perfData = await TestScenarios.createPerformanceData('medium');
// Returns: scaled dataset with relationships
```

### Edge Case Testing
```typescript
const edgeData = await TestScenarios.createEdgeCaseData();
// Returns: banned students, damaged books, maintenance scenarios
```

## Data Validation

The factories include built-in validation:

```typescript
import { DataValidation } from '@/tests/factories';

// Validate individual entities
const isValidStudent = DataValidation.validateStudent(student);
const isValidBook = DataValidation.validateBook(book);

// Validate relationships
const validation = DataValidation.validateRelationships(data);
if (!validation.valid) {
  console.log('Validation errors:', validation.errors);
}
```

## Factory Features

### Realistic Data Generation
- **Faker.js Integration**: Uses Faker.js for realistic names, addresses, and data
- **Cultural Context**: Filipino names and local context where appropriate
- **Business Logic**: Grade categories, checkout periods, fine calculations
- **ISBN Validation**: Generates valid ISBN-13 numbers for books

### Configurable Overrides
```typescript
// Override specific fields
const customStudent = studentFactory.create({
  first_name: 'John',
  last_name: 'Doe',
  grade_level: 'Grade 10'
});

// Override multiple entities
const customBooks = bookFactory.createMany(5, {
  category: 'Science',
  publisher: 'Oxford University Press'
});
```

### Bulk Generation Methods
```typescript
// Generate with variations
const variedStudents = studentFactory.createManyWithVariations(
  20,
  [
    { grade_category: 'JUNIOR_HIGH' },
    { grade_category: 'SENIOR_HIGH' },
    { equipment_ban: true }
  ]
);
```

### Time-Based Scenarios
```typescript
// Create data with specific time patterns
const timeScenarios = studentFactory.createWithTimeScenarios();
// Returns: newStudents, existingStudents, graduatingStudents

const checkoutPatterns = checkoutFactory.createWithTimePatterns();
// Returns: today, thisWeek, thisMonth, lastMonth, older
```

## Resetting Factories

For consistent test results, reset factory counters:

```typescript
import { factories } from '@/tests/factories';

// Reset all counters
factories.resetAll();

// Or use individual factory
const studentFactory = new StudentFactory();
BaseFactory.resetAllCounters();
```

## Development Data Seeding

Quick seed development environment:

```typescript
const seedData = await factories.seedDevelopmentData();
console.log(`Seeded ${JSON.stringify(seedData.counts)} records`);
```

## Best Practices

### 1. Use Appropriate Factory for Test Type
- **Unit Tests**: Use individual factories
- **Integration Tests**: Use RelationshipFactory
- **E2E Tests**: Use TestScenarios
- **Performance Tests**: Use stress test data

### 2. Reset Between Tests
```typescript
beforeEach(() => {
  factories.resetAll();
});
```

### 3. Validate Generated Data
```typescript
const students = studentFactory.createMany(10);
students.forEach(student => {
  expect(DataValidation.validateStudent(student)).toBe(true);
});
```

### 4. Use Realistic Relationships
```typescript
// Instead of creating separate entities
const student = studentFactory.create();
const book = bookFactory.create();
const checkout = checkoutFactory.create({ student_id: student.id, book_id: book.id });

// Use relationship factory for interconnected data
const { students, books, checkouts } = await relationshipFactory.createCompleteEcosystem();
```

## File Structure

```
Backend/src/tests/factories/
├── index.ts              # Main exports and FactoryManager
├── BaseFactory.ts        # Core factory functionality
├── StudentFactory.ts     # Student data generation
├── BookFactory.ts        # Book data generation
├── EquipmentFactory.ts   # Equipment data generation
├── CheckoutFactory.ts    # Checkout record generation
├── UserFactory.ts        # User account generation
├── RelationshipFactory.ts # Interconnected data generation
└── README.md            # This documentation
```

## Schema Compliance

All factories generate data that complies with the Prisma schema:

- **Required Fields**: All required fields are populated
- **Data Types**: Correct data types for all fields
- **Constraints**: Unique constraints and foreign keys respected
- **Enums**: Valid enum values used
- **Defaults**: Appropriate default values applied

## Performance Considerations

- **Batch Generation**: Use `createMany()` for multiple entities
- **Memory Usage**: Be mindful with large datasets
- **Async Operations**: UserFactory uses async for password hashing
- **Reset Counters**: Reset between test runs for consistency

## Troubleshooting

### Common Issues

1. **Missing Required Fields**
   ```typescript
   // Factory validates required fields automatically
   // If validation fails, check the error message for missing fields
   ```

2. **Duplicate IDs**
   ```typescript
   // Reset counters between test runs
   factories.resetAll();
   ```

3. **Invalid Relationships**
   ```typescript
   // Use RelationshipFactory for interconnected data
   // Or validate relationships manually
   const validation = DataValidation.validateRelationships(data);
   ```

4. **Performance Issues**
   ```typescript
   // Use smaller batches for large datasets
   const students = [];
   for (let i = 0; i < 1000; i += 100) {
     students.push(...studentFactory.createMany(100));
   }
   ```

## Contributing

When adding new factories:

1. Extend BaseFactory for common functionality
2. Include comprehensive validation
3. Add realistic data generation
4. Support bulk operations
5. Document with examples
6. Update the main index file

## Examples

### Complete Test Setup
```typescript
import { factories, TestScenarios, DataValidation } from '@/tests/factories';

describe('Library Management', () => {
  let testData: any;

  beforeEach(async () => {
    factories.resetAll();
    testData = await TestScenarios.createAPITestData();
  });

  it('should create valid data', () => {
    expect(DataValidation.validateStudent(testData.students[0])).toBe(true);
    expect(DataValidation.validateBook(testData.books[0])).toBe(true);
    expect(DataValidation.validateUser(testData.users.librarian)).toBe(true);
  });

  it('should maintain data relationships', () => {
    const validation = DataValidation.validateRelationships(testData);
    expect(validation.valid).toBe(true);
  });
});
```

This comprehensive factory system provides everything needed for robust testing of the CLMS application with realistic, validated, and interconnected test data.