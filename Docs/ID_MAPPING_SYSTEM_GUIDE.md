# ID Mapping System Guide

## Overview

The CLMS ID Mapping System is a sophisticated identifier management framework that provides flexible handling of multiple identifier types across different entities. This system enables seamless data integration, import operations, and API interactions by supporting various identifier formats and automatic resolution.

## Key Features

### 🔄 Multiple Identifier Support
- **Database IDs**: Internal unique identifiers (UUIDs, auto-increment)
- **External IDs**: External system identifiers (student IDs, accession numbers)
- **Barcode Values**: Scannable barcode representations
- **QR Code Data**: QR code encoded information
- **Legacy IDs**: Compatibility with legacy system identifiers

### 🧠 Smart Resolution
- **Automatic Detection**: Automatically identifies identifier type
- **Cross-Reference Mapping**: Maintains mapping between different ID types
- **Fallback Mechanisms**: Graceful fallback when primary ID fails
- **Performance Optimization**: Efficient lookup with caching

### 🔧 Type Safety
- **Branded Types**: Type-safe identifier handling
- **Validation Rules**: Comprehensive identifier validation
- **Type Guards**: Runtime type checking and validation
- **Generic Interfaces**: Flexible type-safe operations

## Identifier Types

### Student Identifiers

#### Database ID
```typescript
type StudentDatabaseId = string; // UUID format: "550e8400-e29b-41d4-a716-446655440000"
```

#### Student ID (External)
```typescript
type StudentExternalId = string; // Format: "STU001", "STU002", etc.
```

#### Barcode Value
```typescript
type StudentBarcode = string; // Format: "STU001", matches external ID
```

#### QR Code Data
```typescript
type StudentQRData = string; // JSON encoded: '{"type":"student","id":"STU001"}'
```

### Book Identifiers

#### Database ID
```typescript
type BookDatabaseId = string; // UUID format
```

#### Accession Number
```typescript
type BookAccessionNo = string; // Format: "ACC-001", "ACC-002", etc.
```

#### Barcode Value
```typescript
type BookBarcode = string; // Format: "ACC001", matches accession number
```

#### ISBN
```typescript
type BookISBN = string; // Format: "978-0123456789", "0123456789"
```

### Equipment Identifiers

#### Database ID
```typescript
type EquipmentDatabaseId = string; // UUID format
```

#### Equipment ID
```typescript
type EquipmentExternalId = string; // Format: "PC001", "PS001", "VR001", etc.
```

#### Barcode Value
```typescript
type EquipmentBarcode = string; // Format: "PC001", matches external ID
```

## ID Resolution System

### Resolution Pipeline

```typescript
// ID resolution pipeline
interface IDResolutionPipeline {
  detectType(identifier: string): IdentifierType;
  validate(identifier: string, type: IdentifierType): boolean;
  resolve<T>(identifier: string, type: IdentifierType, entityType: EntityType): Promise<T | null>;
  fallback(identifier: string, entityType: EntityType): Promise<T | null>;
}

// Identifier types
enum IdentifierType {
  DATABASE_ID = 'database_id',
  EXTERNAL_ID = 'external_id',
  BARCODE = 'barcode',
  QR_CODE = 'qr_code',
  ISBN = 'isbn',
  LEGACY_ID = 'legacy_id'
}

// Entity types
enum EntityType {
  STUDENT = 'student',
  BOOK = 'book',
  EQUIPMENT = 'equipment',
  USER = 'user'
}
```

### Resolution Implementation

```typescript
class IDResolver {
  private repositories: Map<EntityType, IRepository<any>>;
  private cache: Map<string, CacheEntry>;
  
  constructor(repositories: Map<EntityType, IRepository<any>>) {
    this.repositories = repositories;
    this.cache = new Map();
  }

  async resolveByIdentifier<T>(
    identifier: string,
    entityType: EntityType
  ): Promise<T | null> {
    // Check cache first
    const cacheKey = `${entityType}:${identifier}`;
    if (this.cache.has(cacheKey)) {
      const entry = this.cache.get(cacheKey)!;
      if (Date.now() < entry.expiry) {
        return entry.data as T;
      }
    }

    // Detect identifier type
    const idType = this.detectIdentifierType(identifier);
    
    // Validate identifier
    if (!this.validateIdentifier(identifier, idType, entityType)) {
      throw new Error(`Invalid ${idType} format for ${entityType}`);
    }

    // Resolve based on type
    let result: T | null = null;
    const repository = this.repositories.get(entityType);
    
    if (!repository) {
      throw new Error(`Repository not found for entity type: ${entityType}`);
    }

    switch (idType) {
      case IdentifierType.DATABASE_ID:
        result = await repository.findById(identifier);
        break;
      case IdentifierType.EXTERNAL_ID:
        result = await repository.findByExternalId(identifier);
        break;
      case IdentifierType.BARCODE:
        result = await repository.findByBarcode(identifier);
        break;
      case IdentifierType.QR_CODE:
        result = await this.resolveQRCode(identifier, entityType);
        break;
      case IdentifierType.ISBN:
        result = await repository.findByISBN(identifier);
        break;
      default:
        result = await this.fallbackResolution(identifier, entityType);
    }

    // Cache the result
    if (result) {
      this.cache.set(cacheKey, {
        data: result,
        expiry: Date.now() + 300000 // 5 minutes
      });
    }

    return result;
  }

  private detectIdentifierType(identifier: string): IdentifierType {
    // UUID pattern
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier)) {
      return IdentifierType.DATABASE_ID;
    }

    // Student ID pattern
    if (/^STU\d{3,}$/i.test(identifier)) {
      return IdentifierType.EXTERNAL_ID;
    }

    // Book accession number pattern
    if (/^ACC-\d{3,}$/i.test(identifier)) {
      return IdentifierType.EXTERNAL_ID;
    }

    // Equipment ID pattern
    if (/^(PC|PS|VR)\d{3,}$/i.test(identifier)) {
      return IdentifierType.EXTERNAL_ID;
    }

    // ISBN pattern
    if (/^(?:ISBN(?:-1[03])?:? )?(?=[0-9X]{10}$|(?=(?:[0-9]+[- ]){3})[- 0-9X]{13}$|97[89][0-9]{10}$|(?=(?:[0-9]+[- ]){4})[- 0-9]{17}$)(?:97[89][- ]?)?[0-9]{1,5}[- ]?[0-9]+[- ]?[0-9]+[- ]?[0-9X]$/i.test(identifier)) {
      return IdentifierType.ISBN;
    }

    // QR code pattern (JSON)
    if (identifier.startsWith('{') && identifier.endsWith('}')) {
      try {
        const parsed = JSON.parse(identifier);
        if (parsed.type && parsed.id) {
          return IdentifierType.QR_CODE;
        }
      } catch {
        // Not valid JSON
      }
    }

    // Default to barcode
    return IdentifierType.BARCODE;
  }

  private validateIdentifier(
    identifier: string,
    type: IdentifierType,
    entityType: EntityType
  ): boolean {
    switch (type) {
      case IdentifierType.DATABASE_ID:
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
      
      case IdentifierType.EXTERNAL_ID:
        switch (entityType) {
          case EntityType.STUDENT:
            return /^STU\d{3,}$/i.test(identifier);
          case EntityType.BOOK:
            return /^ACC-\d{3,}$/i.test(identifier);
          case EntityType.EQUIPMENT:
            return /^(PC|PS|VR)\d{3,}$/i.test(identifier);
          default:
            return false;
        }
      
      case IdentifierType.ISBN:
        return /^(?:ISBN(?:-1[03])?:? )?(?=[0-9X]{10}$|(?=(?:[0-9]+[- ]){3})[- 0-9X]{13}$|97[89][0-9]{10}$|(?=(?:[0-9]+[- ]){4})[- 0-9]{17}$)(?:97[89][- ]?)?[0-9]{1,5}[- ]?[0-9]+[- ]?[0-9]+[- ]?[0-9X]$/i.test(identifier);
      
      case IdentifierType.QR_CODE:
        try {
          const parsed = JSON.parse(identifier);
          return parsed.type === entityType && parsed.id;
        } catch {
          return false;
        }
      
      default:
        return identifier.length > 0;
    }
  }

  private async resolveQRCode<T>(qrData: string, entityType: EntityType): Promise<T | null> {
    try {
      const parsed = JSON.parse(qrData);
      if (parsed.type === entityType && parsed.id) {
        return await this.resolveByIdentifier<T>(parsed.id, entityType);
      }
    } catch {
      // Invalid QR code format
    }
    return null;
  }

  private async fallbackResolution<T>(identifier: string, entityType: EntityType): Promise<T | null> {
    // Try all resolution methods as fallback
    const repository = this.repositories.get(entityType);
    if (!repository) return null;

    // Try as database ID
    let result = await repository.findById(identifier);
    if (result) return result as T;

    // Try as external ID
    result = await repository.findByExternalId(identifier);
    if (result) return result as T;

    // Try as barcode
    result = await repository.findByBarcode(identifier);
    if (result) return result as T;

    return null;
  }
}
```

## Repository Integration

### Enhanced Repository Interface

```typescript
interface EnhancedIDRepository<T> extends IRepository<T> {
  findByIdentifier(identifier: string): Promise<T | null>;
  findByBarcode(barcode: string): Promise<T | null>;
  findByExternalId(externalId: string): Promise<T | null>;
  findByISBN?(isbn: string): Promise<T | null>;
  getAllIdentifiers(id: string): Promise<IdentifierSet>;
}

interface IdentifierSet {
  databaseId: string;
  externalId?: string;
  barcode?: string;
  qrCode?: string;
  isbn?: string;
}
```

### Student Repository Implementation

```typescript
class StudentsRepository extends BaseRepository<Student> implements EnhancedIDRepository<Student> {
  constructor(prisma: any) {
    super(prisma, 'student');
  }

  async findByIdentifier(identifier: string): Promise<Student | null> {
    const resolver = new IDResolver(new Map([[EntityType.STUDENT, this]]));
    return await resolver.resolveByIdentifier<Student>(identifier, EntityType.STUDENT);
  }

  async findByBarcode(barcode: string): Promise<Student | null> {
    return await this.prisma.student.findFirst({
      where: {
        OR: [
          { studentId: barcode },
          { barcode: barcode }
        ]
      }
    });
  }

  async findByExternalId(externalId: string): Promise<Student | null> {
    return await this.prisma.student.findUnique({
      where: { studentId: externalId }
    });
  }

  async getAllIdentifiers(id: string): Promise<IdentifierSet> {
    const student = await this.findById(id);
    if (!student) {
      throw new Error('Student not found');
    }

    return {
      databaseId: student.id,
      externalId: student.studentId,
      barcode: student.barcode || student.studentId,
      qrCode: JSON.stringify({
        type: 'student',
        id: student.studentId
      })
    };
  }

  protected generateId(): string {
    return generateUUID();
  }
}
```

## API Integration

### Flexible ID Endpoints

```typescript
// Express route handler with flexible ID support
router.get('/api/students/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const studentRepository = new StudentsRepository(prisma);
    
    const student = await studentRepository.findByIdentifier(identifier);
    
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found',
        code: 'STUDENT_NOT_FOUND',
        identifier: identifier
      });
    }

    res.json({
      success: true,
      data: student,
      message: 'Student retrieved successfully',
      identifier: identifier,
      identifierType: detectIdentifierType(identifier)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve student',
      code: 'RETRIEVAL_ERROR',
      details: error.message
    });
  }
});

// Scan endpoint for barcode/QR code processing
router.post('/api/scan/:entityType', async (req, res) => {
  try {
    const { entityType } = req.params;
    const { barcode, location } = req.body;
    
    let repository: EnhancedIDRepository<any>;
    
    switch (entityType) {
      case 'student':
        repository = new StudentsRepository(prisma);
        break;
      case 'book':
        repository = new BooksRepository(prisma);
        break;
      case 'equipment':
        repository = new EquipmentRepository(prisma);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid entity type',
          code: 'INVALID_ENTITY_TYPE'
        });
    }

    const entity = await repository.findByIdentifier(barcode);
    
    if (!entity) {
      return res.status(404).json({
        success: false,
        error: 'Entity not found',
        code: 'ENTITY_NOT_FOUND',
        identifier: barcode,
        entityType: entityType
      });
    }

    // Log scan activity
    await logScanActivity(entityType, entity.id, location);

    res.json({
      success: true,
      data: entity,
      message: `${entityType} scanned successfully`,
      identifier: barcode,
      identifierType: detectIdentifierType(barcode),
      location: location
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Scan failed',
      code: 'SCAN_ERROR',
      details: error.message
    });
  }
});
```

## Client-Side Integration

### React Hook for ID Resolution

```typescript
// Custom hook for ID resolution
function useIDResolver<T>(entityType: EntityType) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);

  const resolve = useCallback(async (identifier: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.get(`/api/${entityType}/${identifier}`);
      
      if (response.success && response.data) {
        setData(response.data);
      } else {
        setError(response.error || 'Entity not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [entityType]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    error,
    resolve,
    reset
  };
}

// Usage in component
function StudentScanner() {
  const { data, loading, error, resolve } = useIDResolver<Student>('student');
  const [barcode, setBarcode] = useState('');

  const handleScan = useCallback((scannedValue: string) => {
    setBarcode(scannedValue);
    resolve(scannedValue);
  }, [resolve]);

  return (
    <div>
      <BarcodeScanner onScan={handleScan} />
      {loading && <p>Resolving student...</p>}
      {error && <p>Error: {error}</p>}
      {data && <StudentCard student={data} />}
    </div>
  );
}
```

## ID Generation and Management

### ID Generation Service

```typescript
interface IDGenerator {
  generateDatabaseId(): string;
  generateExternalId(type: EntityType): string;
  generateBarcode(externalId: string): string;
  generateQRCode(entityType: EntityType, externalId: string): string;
  validateId(identifier: string, type: IdentifierType): boolean;
}

class CLMSIDGenerator implements IDGenerator {
  private sequenceCounters: Map<string, number>;

  constructor() {
    this.sequenceCounters = new Map();
  }

  generateDatabaseId(): string {
    return generateUUID();
  }

  generateExternalId(type: EntityType): string {
    const prefix = this.getPrefixForEntityType(type);
    const counter = this.getNextSequence(prefix);
    return `${prefix}${counter.toString().padStart(3, '0')}`;
  }

  generateBarcode(externalId: string): string {
    // Remove special characters for barcode compatibility
    return externalId.replace(/[^a-zA-Z0-9]/g, '');
  }

  generateQRCode(entityType: EntityType, externalId: string): string {
    return JSON.stringify({
      type: entityType,
      id: externalId,
      timestamp: new Date().toISOString(),
      version: '2.0'
    });
  }

  validateId(identifier: string, type: IdentifierType): boolean {
    const resolver = new IDResolver(new Map());
    return resolver.validateIdentifier(identifier, type, EntityType.STUDENT);
  }

  private getPrefixForEntityType(type: EntityType): string {
    switch (type) {
      case EntityType.STUDENT:
        return 'STU';
      case EntityType.BOOK:
        return 'ACC';
      case EntityType.EQUIPMENT:
        return 'PC'; // Default for equipment
      default:
        return 'ID';
    }
  }

  private getNextSequence(prefix: string): number {
    const current = this.sequenceCounters.get(prefix) || 0;
    const next = current + 1;
    this.sequenceCounters.set(prefix, next);
    return next;
  }
}
```

## Performance Optimization

### Caching Strategy

```typescript
interface CacheEntry<T> {
  data: T;
  expiry: number;
  identifierType: IdentifierType;
}

class IDCache {
  private cache: Map<string, CacheEntry<any>>;
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize = 1000, defaultTTL = 300000) { // 5 minutes
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  set<T>(key: string, data: T, identifierType: IdentifierType, ttl?: number): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      expiry: Date.now() + (ttl || this.defaultTTL),
      identifierType
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }
}
```

## Testing and Validation

### ID Resolution Tests

```typescript
describe('ID Resolution System', () => {
  let resolver: IDResolver;
  let mockRepository: jest.Mocked<IRepository<Student>>;

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      findByExternalId: jest.fn(),
      findByBarcode: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn()
    };

    resolver = new IDResolver(new Map([[EntityType.STUDENT, mockRepository]]));
  });

  describe('Identifier Type Detection', () => {
    it('should detect UUID as database ID', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const type = resolver['detectIdentifierType'](uuid);
      expect(type).toBe(IdentifierType.DATABASE_ID);
    });

    it('should detect student ID format', () => {
      const studentId = 'STU001';
      const type = resolver['detectIdentifierType'](studentId);
      expect(type).toBe(IdentifierType.EXTERNAL_ID);
    });

    it('should detect accession number format', () => {
      const accessionNo = 'ACC-001';
      const type = resolver['detectIdentifierType'](accessionNo);
      expect(type).toBe(IdentifierType.EXTERNAL_ID);
    });

    it('should detect QR code format', () => {
      const qrCode = '{"type":"student","id":"STU001"}';
      const type = resolver['detectIdentifierType'](qrCode);
      expect(type).toBe(IdentifierType.QR_CODE);
    });
  });

  describe('ID Resolution', () => {
    it('should resolve student by database ID', async () => {
      const student = { id: 'uuid', studentId: 'STU001', firstName: 'John' };
      mockRepository.findById.mockResolvedValue(student);

      const result = await resolver.resolveByIdentifier('uuid', EntityType.STUDENT);
      expect(result).toEqual(student);
      expect(mockRepository.findById).toHaveBeenCalledWith('uuid');
    });

    it('should resolve student by external ID', async () => {
      const student = { id: 'uuid', studentId: 'STU001', firstName: 'John' };
      mockRepository.findByExternalId.mockResolvedValue(student);

      const result = await resolver.resolveByIdentifier('STU001', EntityType.STUDENT);
      expect(result).toEqual(student);
      expect(mockRepository.findByExternalId).toHaveBeenCalledWith('STU001');
    });

    it('should return null for non-existent student', async () => {
      mockRepository.findById.mockResolvedValue(null);
      mockRepository.findByExternalId.mockResolvedValue(null);
      mockRepository.findByBarcode.mockResolvedValue(null);

      const result = await resolver.resolveByIdentifier('NONEXISTENT', EntityType.STUDENT);
      expect(result).toBeNull();
    });
  });
});
```

## Best Practices

### ID Design Principles
1. **Consistent Formatting**: Use consistent ID formats across entities
2. **Human-Readable**: External IDs should be human-readable when possible
3. **Machine-Scannable**: Barcodes should be easily scannable
4. **Type-Safe**: Use TypeScript branded types for type safety
5. **Versioned**: Include version information in QR codes

### Performance Considerations
1. **Cache Results**: Cache ID resolution results
2. **Optimize Lookups**: Use efficient database queries
3. **Batch Operations**: Batch ID lookups when possible
4. **Index Appropriately**: Ensure proper database indexing
5. **Monitor Performance**: Track resolution performance metrics

### Security Considerations
1. **Validate Input**: Always validate identifier formats
2. **Sanitize Data**: Sanitize identifier data before processing
3. **Rate Limiting**: Rate limit ID resolution endpoints
4. **Audit Logging**: Log ID resolution attempts
5. **Access Control**: Control access to ID resolution APIs

## Troubleshooting

### Common Issues

#### 1. Ambiguous Identifiers
**Problem**: Same identifier format used by different entities
**Solution**: Use entity-specific prefixes or validation patterns
```typescript
// Use different prefixes for different entities
const STUDENT_PREFIX = 'STU';
const BOOK_PREFIX = 'ACC';
const EQUIPMENT_PREFIX = 'PC';
```

#### 2. Performance Issues
**Problem**: Slow ID resolution for large datasets
**Solution**: Implement caching and database indexing
```typescript
// Add database indexes for external identifiers
CREATE INDEX idx_student_external_id ON students(student_id);
CREATE INDEX idx_book_accession_no ON books(accession_no);
```

#### 3. Invalid QR Codes
**Problem**: Malformed or invalid QR code data
**Solution**: Implement robust QR code validation
```typescript
function validateQRCode(data: string): boolean {
  try {
    const parsed = JSON.parse(data);
    return parsed.type && parsed.id && VALID_ENTITY_TYPES.includes(parsed.type);
  } catch {
    return false;
  }
}
```

## Future Enhancements

### Planned Features
- **Advanced QR Codes**: Enhanced QR code capabilities with more data
- **Biometric Integration**: Fingerprint and facial recognition integration
- **NFC Support**: Near Field Communication support for identifiers
- **Blockchain Integration**: Blockchain-based identifier verification
- **AI-Powered Recognition**: AI-powered identifier recognition

### API Evolution
- **GraphQL Support**: GraphQL endpoints for complex ID queries
- **Real-time Updates**: WebSocket support for real-time ID updates
- **Bulk Operations**: Enhanced bulk ID operations
- **Advanced Search**: Advanced search capabilities across identifier types

---

This guide provides comprehensive documentation for the CLMS ID Mapping System. For additional information or support, refer to the API documentation or contact the development team.