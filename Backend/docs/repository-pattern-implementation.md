# Repository Pattern Implementation

This document provides a comprehensive guide to the Repository Pattern implementation in the CLMS backend services, including TypeScript enhancements and flexible ID handling capabilities.

## Overview

The Repository Pattern has been implemented to abstract database operations and provide a clean separation between business logic and data access. This pattern improves code maintainability, testability, and allows for easier swapping of data sources if needed.

### 🚀 Enhanced Features in Version 2.0 (October 2025)

- **Full TypeScript Support**: Complete type safety with advanced generic patterns
- **Flexible ID Resolution**: Support for multiple identifier types through a unified interface
- **Enhanced Error Handling**: Comprehensive error management with detailed reporting
- **Performance Optimization**: Improved query efficiency with better caching
- **Advanced Type Inference**: Smart type deduction for better developer experience

## Implementation Details

### Base Repository

A `BaseRepository` class has been created to provide common functionality for all repositories:
- Automatic field population (timestamps, IDs)
- Error handling with consistent logging
- Flexible ID handling for both database IDs and external identifiers
- Standard CRUD operations (Create, Read, Update, Delete)
- Upsert operations for ideal import scenarios

### Implemented Repositories

1. **StudentsRepository** (`Backend/src/repositories/students.repository.ts`)
   - Handles student-related operations
   - Supports flexible ID handling with `student_id` as external identifier
   - Includes specialized methods for grade category operations
   - Provides bulk operations for student imports

2. **BooksRepository** (`Backend/src/repositories/books.repository.ts`)
   - Handles book-related operations
   - Supports flexible ID handling with `accession_no` as external identifier
   - Includes methods for availability management
   - Provides bulk operations for book imports

3. **EquipmentRepository** (`Backend/src/repositories/equipment.repository.ts`)
   - Handles equipment-related operations
   - Supports flexible ID handling with `equipment_id` as external identifier
   - Includes methods for status management and usage tracking
   - Provides bulk operations for equipment imports

4. **UsersRepository** (`Backend/src/repositories/users.repository.ts`)
   - Handles user-related operations
   - Supports flexible ID handling with `username` as external identifier
   - Includes methods for password management and statistics
   - Provides secure operations with password field sanitization

5. **NotificationsRepository** (`Backend/src/repositories/notifications.repository.ts`)
   - Handles notification-related operations
   - Includes methods for bulk notification operations
   - Provides methods for managing read/unread status
   - Includes cleanup operations for expired notifications

### Updated Services

The following services have been updated to use the repository pattern:

1. **StudentService** (`Backend/src/services/studentService.ts`)
   - Now uses `StudentsRepository` for student operations
   - Maintains backward compatibility with existing interfaces
   - Continues to use direct Prisma for student activities (cross-model operations)

2. **BookService** (`Backend/src/services/bookService.ts`)
   - Now uses `BooksRepository` for book operations
   - Maintains backward compatibility with existing interfaces
   - Continues to use direct Prisma for book checkouts (cross-model operations)

3. **EquipmentService** (`Backend/src/services/equipmentService.ts`)
   - Now uses `EquipmentRepository` for equipment operations
   - Maintains backward compatibility with existing interfaces
   - Continues to use direct Prisma for student activities (cross-model operations)

4. **UserService** (`Backend/src/services/user.service.ts`)
   - Now uses `UsersRepository` for user operations
   - Maintains backward compatibility with existing interfaces
   - Includes proper error handling for duplicate usernames/emails

5. **NotificationService** (`Backend/src/services/notification.service.ts`)
   - Now uses `NotificationsRepository` for notification operations
   - Maintains backward compatibility with existing interfaces
   - Continues to use direct Prisma for system config (cross-model operations)

6. **ReportService** (`Backend/src/services/reportingService.ts`)
   - Now uses repositories for basic entity operations
   - Continues to use direct Prisma for complex analytics queries
   - Maintains backward compatibility with existing interfaces

## Benefits

1. **Separation of Concerns**: Business logic is now separated from data access logic
2. **Testability**: Services can now be easily tested with repository mocks
3. **Maintainability**: Database operations are centralized and easier to maintain
4. **Consistency**: Standardized error handling and logging across all repositories
5. **Flexibility**: Easier to modify data access logic without affecting business logic

## TypeScript Implementation Details

### Generic Repository Interface

The repository pattern is built on a strong TypeScript foundation with generic interfaces:

```typescript
// Base repository interface with generics
interface IRepository<T, K = string> {
  findById(id: K): Promise<T | null>;
  findByExternalId(externalId: string): Promise<T | null>;
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: K, data: Partial<T>): Promise<T>;
  delete(id: K): Promise<boolean>;
  findMany(filter?: Partial<T>): Promise<T[]>;
}

// Enhanced repository with flexible ID handling
interface IEnhancedRepository<T, K = string> extends IRepository<T, K> {
  findByAnyId(identifier: K | string): Promise<T | null>;
  upsert(data: Partial<T> & { externalId: string }): Promise<T>;
  bulkCreate(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<T[]>;
  getAllIdentifiers(id: K): Promise<IdentifierSet>;
}

// Identifier set for flexible ID handling
interface IdentifierSet {
  databaseId: string;
  externalId?: string;
  barcode?: string;
  qrCode?: string;
  isbn?: string;
}
```

### Base Repository Implementation

The `BaseRepository` class provides common functionality with type safety:

```typescript
// Generic base repository with TypeScript 5.0+ features
abstract class BaseRepository<T extends BaseEntity, K = string> implements IEnhancedRepository<T, K> {
  protected constructor(
    protected prisma: any,
    protected entityName: string,
    protected logger: Logger
  ) {}

  // Generic method with type inference
  async findById(id: K): Promise<T | null> {
    try {
      const result = await this.prisma[this.entityName].findUnique({
        where: { id }
      });
      
      if (!result) {
        this.logger.warn(`${this.entityName} not found: ${id}`);
        return null;
      }
      
      return this.mapToEntity(result) as T;
    } catch (error) {
      this.logger.error(`Error finding ${this.entityName} by ID: ${id}`, error);
      throw new RepositoryError(`Failed to find ${this.entityName}`, error);
    }
  }

  // Generic method with conditional types
  async create<R extends Omit<T, 'id' | 'createdAt' | 'updatedAt'>>(
    data: R
  ): Promise<T> {
    try {
      const entityData = this.prepareEntityData(data) as T;
      const result = await this.prisma[this.entityName].create({
        data: entityData
      });
      
      this.logger.info(`Created ${this.entityName}: ${result.id}`);
      return this.mapToEntity(result) as T;
    } catch (error) {
      this.logger.error(`Error creating ${this.entityName}`, error);
      throw new RepositoryError(`Failed to create ${this.entityName}`, error);
    }
  }

  // Flexible ID resolution with type guards
  async findByAnyId(identifier: K | string): Promise<T | null> {
    // Try to resolve by database ID
    if (this.isDatabaseId(identifier)) {
      return await this.findById(identifier);
    }

    // Try to resolve by external ID
    let result = await this.findByExternalId(identifier);
    if (result) return result;

    // Try to resolve by barcode
    if (this.supportsBarcode()) {
      result = await this.findByBarcode(identifier);
      if (result) return result;
    }

    return null;
  }

  // Protected abstract methods for implementation-specific logic
  protected abstract mapToEntity(data: any): T;
  protected abstract prepareEntityData(data: any): any;
  protected abstract isDatabaseId(identifier: any): identifier is K;
  protected abstract supportsBarcode(): boolean;
  protected abstract findByBarcode(barcode: string): Promise<T | null>;
  protected abstract generateId(): K;
}
```

### Flexible ID Handling with Branded Types

The repository pattern uses branded types for type-safe ID handling:

```typescript
// Branded types for type safety
type StudentID = string & { readonly __brand: unique symbol };
type BookID = string & { readonly __brand: unique symbol };
type EquipmentID = string & { readonly __brand: unique symbol };

// Type guards for ID validation
function isStudentID(id: string): id is StudentID {
  return /^STU\d{3,}$/.test(id);
}

function isBookID(id: string): id is BookID {
  return /^ACC-\d{3,}$/.test(id);
}

function isEquipmentID(id: string): id is EquipmentID {
  return /^(PC|PS|VR)\d{3,}$/.test(id);
}

// Specific repository implementations with branded types
class StudentsRepository extends BaseRepository<Student, StudentID> {
  // Implementation with type safety
  async findByStudentId(studentId: string): Promise<Student | null> {
    if (!isStudentID(studentId)) {
      throw new ValidationError(`Invalid student ID format: ${studentId}`);
    }
    
    return await this.findByExternalId(studentId);
  }

  protected override isDatabaseId(identifier: any): identifier is StudentID {
    return typeof identifier === 'string' &&
           /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
  }

  protected override supportsBarcode(): boolean {
    return true;
  }

  protected override generateId(): StudentID {
    return generateUUID() as StudentID;
  }
}
```

## Advanced Repository Features

### Caching Layer

The repository pattern includes an intelligent caching layer:

```typescript
// Repository with caching
abstract class CachedRepository<T extends BaseEntity, K = string> extends BaseRepository<T, K> {
  private cache: Map<string, CacheEntry<T>>;
  private cacheConfig: CacheConfig;

  // Method with cache integration
  async findById(id: K): Promise<T | null> {
    const cacheKey = `${this.entityName}:${id}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const entry = this.cache.get(cacheKey)!;
      if (Date.now() < entry.expiry) {
        this.logger.debug(`Cache hit: ${cacheKey}`);
        return entry.data;
      }
    }

    // Fetch from database
    const result = await super.findById(id);
    
    // Cache the result
    if (result) {
      this.setCache(cacheKey, result);
    }
    
    return result;
  }

  private setCache(key: string, data: T): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.cacheConfig.ttl
    });
    
    // Cleanup expired entries
    this.cleanupCache();
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

interface CacheConfig {
  ttl: number;
  maxSize: number;
}
```

### Transaction Support

The repository pattern provides transaction support for complex operations:

```typescript
// Transaction manager
class RepositoryTransactionManager {
  constructor(private prisma: any) {}

  async executeInTransaction<T>(
    operations: (tx: any) => Promise<T>
  ): Promise<T> {
    return await this.prisma.$transaction(async (tx) => {
      return await operations(tx);
    });
  }

  async executeMultipleOperations<T>(
    operations: Array<(tx: any) => Promise<any>>
  ): Promise<T[]> {
    return await this.prisma.$transaction(async (tx) => {
      const results: T[] = [];
      for (const operation of operations) {
        results.push(await operation(tx));
      }
      return results;
    });
  }
}

// Usage in service layer
class StudentService {
  constructor(
    private studentsRepository: StudentsRepository,
    private activitiesRepository: ActivitiesRepository,
    private transactionManager: RepositoryTransactionManager
  ) {}

  async createStudentWithActivity(
    studentData: CreateStudentData,
    activityData: CreateActivityData
  ): Promise<{ student: Student; activity: StudentActivity }> {
    return await this.transactionManager.executeInTransaction(async (tx) => {
      // Create student with transaction context
      const student = await this.studentsRepository.createWithTransaction(
        studentData,
        tx
      );

      // Create activity with transaction context
      const activity = await this.activitiesRepository.createWithTransaction(
        {
          ...activityData,
          studentId: student.id
        },
        tx
      );

      return { student, activity };
    });
  }
}
```

## Usage Examples

### Basic Repository Operations

```typescript
// Initialize repository
const studentsRepository = new StudentsRepository(prisma, logger);

// Find by any identifier type
const student = await studentsRepository.findByAnyId('STU001');
// Works with database IDs, external IDs, barcodes, etc.

// Create with type safety
const newStudent = await studentsRepository.create({
  studentId: 'STU002',
  firstName: 'Jane',
  lastName: 'Smith',
  gradeLevel: 'Grade 8',
  gradeCategory: 'JUNIOR_HIGH',
  section: '8-B'
});

// Get all identifiers for an entity
const identifiers = await studentsRepository.getAllIdentifiers(student.id);
/*
{
  databaseId: "550e8400-e29b-41d4-a716-446655440000",
  externalId: "STU002",
  barcode: "STU002",
  qrCode: "{\"type\":\"student\",\"id\":\"STU002\"}"
}
*/
```

### Bulk Operations

```typescript
// Bulk create with progress tracking
async function bulkCreateStudents(
  studentsData: CreateStudentData[],
  options: BulkOperationOptions
): Promise<BulkOperationResult<Student>> {
  const startTime = Date.now();
  const batchSize = options.batchSize || 100;
  const results: Student[] = [];
  const errors: BulkOperationError[] = [];

  // Process in batches
  for (let i = 0; i < studentsData.length; i += batchSize) {
    const batch = studentsData.slice(i, i + batchSize);
    
    try {
      const batchResults = await studentsRepository.bulkCreate(batch);
      results.push(...batchResults);
      
      // Report progress
      options.onProgress?.({
        processed: results.length,
        total: studentsData.length,
        percentage: Math.round((results.length / studentsData.length) * 100)
      });
    } catch (error) {
      errors.push({
        batchIndex: Math.floor(i / batchSize),
        error: error.message,
        batchSize: batch.length
      });
    }
  }

  return {
    results,
    errors,
    totalProcessed: results.length,
    totalErrors: errors.length,
    duration: Date.now() - startTime
  };
}

// Usage
const result = await bulkCreateStudents(studentsData, {
  batchSize: 50,
  onProgress: (progress) => {
    console.log(`Progress: ${progress.percentage}% (${progress.processed}/${progress.total})`);
  }
});
```

### Custom Repository Extensions

```typescript
// Extended repository with custom methods
class EnhancedStudentsRepository extends StudentsRepository {
  // Custom method with complex query
  async findStudentsByGradeCategory(
    gradeCategory: GradeCategory,
    options: QueryOptions = {}
  ): Promise<Student[]> {
    const query = {
      where: {
        gradeCategory,
        isActive: true
      },
      orderBy: options.sortBy || { lastName: 'asc' },
      take: options.limit,
      skip: options.offset
    };

    const results = await this.prisma.student.findMany(query);
    return results.map(student => this.mapToEntity(student));
  }

  // Custom method with aggregation
  async getStudentStatistics(): Promise<StudentStatistics> {
    const stats = await this.prisma.student.groupBy({
      by: ['gradeCategory'],
      _count: { id: true },
      where: { isActive: true }
    });

    return {
      totalStudents: stats.reduce((sum, stat) => sum + stat._count.id, 0),
      gradeDistribution: stats.map(stat => ({
        gradeCategory: stat.gradeCategory,
        count: stat._count.id
      }))
    };
  }

  // Custom method with full-text search
  async searchStudents(query: string): Promise<Student[]> {
    return await this.prisma.student.findMany({
      where: {
        OR: [
          {
            first_name: {
              contains: query,
              mode: 'insensitive'
            }
          },
          {
            last_name: {
              contains: query,
              mode: 'insensitive'
            }
          },
          {
            student_id: {
              contains: query,
              mode: 'insensitive'
            }
          }
        ],
        isActive: true
      },
      orderBy: { lastName: 'asc' }
    });
  }
}
```

## Testing the Repository Pattern

### Unit Testing with Mocks

```typescript
// Repository mock for testing
class MockStudentsRepository implements IStudentsRepository {
  private students: Student[] = [];
  private nextId = 1;

  async findById(id: string): Promise<Student | null> {
    return this.students.find(student => student.id === id) || null;
  }

  async findByStudentId(studentId: string): Promise<Student | null> {
    return this.students.find(student => student.studentId === studentId) || null;
  }

  async create(data: CreateStudentData): Promise<Student> {
    const student: Student = {
      id: `student-${this.nextId++}`,
      studentId: data.studentId,
      firstName: data.firstName,
      lastName: data.lastName,
      gradeLevel: data.gradeLevel,
      gradeCategory: data.gradeCategory,
      section: data.section,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.students.push(student);
    return student;
  }

  async bulkCreate(data: CreateStudentData[]): Promise<Student[]> {
    const students: Student[] = [];
    for (const studentData of data) {
      students.push(await this.create(studentData));
    }
    return students;
  }

  // Add other methods as needed
}

// Service test with mocked repository
describe('StudentService', () => {
  let studentService: StudentService;
  let mockRepository: MockStudentsRepository;

  beforeEach(() => {
    mockRepository = new MockStudentsRepository();
    studentService = new StudentService(mockRepository);
  });

  describe('createStudent', () => {
    it('should create a new student', async () => {
      const studentData: CreateStudentData = {
        studentId: 'STU001',
        firstName: 'John',
        lastName: 'Doe',
        gradeLevel: 'Grade 7',
        gradeCategory: 'JUNIOR_HIGH',
        section: '7-A'
      };

      const result = await studentService.createStudent(studentData);

      expect(result).toBeDefined();
      expect(result.studentId).toBe(studentData.studentId);
      expect(result.firstName).toBe(studentData.firstName);
    });

    it('should throw error for duplicate student ID', async () => {
      const studentData: CreateStudentData = {
        studentId: 'STU001',
        firstName: 'John',
        lastName: 'Doe',
        gradeLevel: 'Grade 7',
        gradeCategory: 'JUNIOR_HIGH',
        section: '7-A'
      };

      // Create first student
      await studentService.createStudent(studentData);

      // Try to create duplicate
      await expect(studentService.createStudent(studentData))
        .rejects.toThrow('Student with ID STU001 already exists');
    });
  });

  describe('findByAnyId', () => {
    it('should find student by database ID', async () => {
      const studentData: CreateStudentData = {
        studentId: 'STU001',
        firstName: 'John',
        lastName: 'Doe',
        gradeLevel: 'Grade 7',
        gradeCategory: 'JUNIOR_HIGH',
        section: '7-A'
      };

      const createdStudent = await studentService.createStudent(studentData);
      const foundStudent = await studentService.findByAnyId(createdStudent.id);

      expect(foundStudent).toBeDefined();
      expect(foundStudent?.id).toBe(createdStudent.id);
    });

    it('should find student by external ID', async () => {
      const studentData: CreateStudentData = {
        studentId: 'STU001',
        firstName: 'John',
        lastName: 'Doe',
        gradeLevel: 'Grade 7',
        gradeCategory: 'JUNIOR_HIGH',
        section: '7-A'
      };

      await studentService.createStudent(studentData);
      const foundStudent = await studentService.findByAnyId('STU001');

      expect(foundStudent).toBeDefined();
      expect(foundStudent?.studentId).toBe('STU001');
    });
  });
});
```

### Integration Testing with Test Database

```typescript
// Integration test setup
describe('StudentsRepository Integration', () => {
  let repository: StudentsRepository;
  let prisma: PrismaClient;

  beforeAll(async () => {
    // Setup test database
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL
        }
      }
    });

    // Clean database
    await prisma.student.deleteMany();

    // Initialize repository
    repository = new StudentsRepository(prisma, logger);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up before each test
    await prisma.student.deleteMany();
  });

  describe('CRUD Operations', () => {
    it('should create and retrieve student', async () => {
      const studentData: CreateStudentData = {
        studentId: 'STU001',
        firstName: 'John',
        lastName: 'Doe',
        gradeLevel: 'Grade 7',
        gradeCategory: 'JUNIOR_HIGH',
        section: '7-A'
      };

      const created = await repository.create(studentData);
      expect(created).toBeDefined();
      expect(created.id).toBeDefined();

      const retrieved = await repository.findById(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.studentId).toBe(studentData.studentId);
    });

    it('should handle bulk operations', async () => {
      const studentsData: CreateStudentData[] = [
        {
          studentId: 'STU001',
          firstName: 'John',
          lastName: 'Doe',
          gradeLevel: 'Grade 7',
          gradeCategory: 'JUNIOR_HIGH',
          section: '7-A'
        },
        {
          studentId: 'STU002',
          firstName: 'Jane',
          lastName: 'Smith',
          gradeLevel: 'Grade 8',
          gradeCategory: 'JUNIOR_HIGH',
          section: '8-B'
        }
      ];

      const created = await repository.bulkCreate(studentsData);
      expect(created).toHaveLength(2);

      const all = await repository.findMany();
      expect(all).toHaveLength(2);
    });
  });

  describe('Flexible ID Resolution', () => {
    it('should resolve student by any identifier', async () => {
      const studentData: CreateStudentData = {
        studentId: 'STU001',
        firstName: 'John',
        lastName: 'Doe',
        gradeLevel: 'Grade 7',
        gradeCategory: 'JUNIOR_HIGH',
        section: '7-A'
      };

      const created = await repository.create(studentData);

      // Test database ID
      const byDbId = await repository.findByAnyId(created.id);
      expect(byDbId?.id).toBe(created.id);

      // Test external ID
      const byExternalId = await repository.findByAnyId('STU001');
      expect(byExternalId?.studentId).toBe('STU001');

      // Test barcode (defaults to student ID)
      const byBarcode = await repository.findByAnyId('STU001');
      expect(byBarcode?.studentId).toBe('STU001');
    });
  });
});
```

### Performance Testing

```typescript
// Performance test for repository operations
describe('Repository Performance', () => {
  let repository: StudentsRepository;

  beforeAll(async () => {
    repository = new StudentsRepository(prisma, logger);
  });

  it('should handle bulk create efficiently', async () => {
    const studentsData: CreateStudentData[] = Array.from({ length: 1000 }, (_, i) => ({
      studentId: `STU${String(i + 1).padStart(3, '0')}`,
      firstName: `Student${i + 1}`,
      lastName: `Test${i + 1}`,
      gradeLevel: 'Grade 7',
      gradeCategory: 'JUNIOR_HIGH',
      section: '7-A'
    }));

    const startTime = Date.now();
    await repository.bulkCreate(studentsData);
    const duration = Date.now() - startTime;

    console.log(`Bulk create 1000 students: ${duration}ms`);
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
  });

  it('should handle bulk reads efficiently', async () => {
    const startTime = Date.now();
    const students = await repository.findMany({ take: 1000 });
    const duration = Date.now() - startTime;

    console.log(`Bulk read 1000 students: ${duration}ms`);
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
    expect(students.length).toBe(1000);
  });
});
```

## Future Considerations

1. **Transaction Handling**: Complex transactions spanning multiple repositories may need special handling
2. **Testing**: Service tests should be updated to use repository mocks
3. **Performance**: Monitor for any performance impacts from the abstraction layer
4. **Additional Repositories**: Consider creating repositories for other models as needed

## Migration Notes

- All existing service interfaces remain unchanged to ensure backward compatibility
- Cross-model operations (operations involving multiple databases tables) still use direct Prisma queries
- Error messages and logging formats have been maintained for consistency
- No breaking changes were introduced to the public API