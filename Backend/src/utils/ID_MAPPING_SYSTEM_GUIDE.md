# ID Mapping System Documentation

## Overview

The ID Mapping System is a comprehensive solution for managing bidirectional ID mappings between external identifiers (from imports, external systems) and internal database UUIDs. It provides efficient caching, bulk operations, analytics, and validation capabilities.

## Features

- **Bidirectional ID Lookups**: Convert between external IDs and internal UUIDs
- **Redis Caching**: Fast lookups with automatic fallback to in-memory cache
- **Database Persistence**: Long-term storage with MySQL
- **Bulk Operations**: Efficient batch processing for import scenarios
- **Analytics & Reporting**: Usage statistics and performance metrics
- **Validation & Integrity**: Detect and resolve mapping conflicts
- **Automatic Cleanup**: Remove stale mappings based on usage patterns
- **Type Safety**: Full TypeScript support with strict typing

## Architecture

### Core Components

1. **IDMappingManager** (`idMappingSystem.ts`)
   - Core mapping operations and cache management
   - Database interactions and Redis integration
   - Performance monitoring and logging

2. **IDMappingService** (`idMappingService.ts`)
   - Business logic wrapper around the manager
   - Entity-specific convenience methods
   - Integration points for repositories and controllers

3. **Database Schema** (`schema.prisma`)
   - `id_mappings` table with optimized indexes
   - Support for metadata and access tracking

### Entity Types

The system supports the following entity types:

- **STUDENT**: `student_id` ↔ internal UUID
- **BOOK**: `accession_no` ↔ internal UUID  
- **EQUIPMENT**: `equipment_id` ↔ internal UUID
- **USER**: `username` ↔ internal UUID
- **CHECKOUT**: `checkout_id` ↔ internal UUID

## Usage

### Basic Operations

```typescript
import { getIDMappingService } from '../services/idMappingService';

// Initialize the service
const mappingService = await getIDMappingService();

// Create a student mapping
await mappingService.createStudentMapping('20230187', 'uuid-here', {
  source: 'csv_import',
  importDate: new Date()
});

// Get internal ID from external ID
const internalId = await mappingService.getStudentInternalId('20230187');

// Get external ID from internal ID
const externalId = await mappingService.getStudentExternalId('uuid-here');
```

### Bulk Operations

```typescript
// Bulk create student mappings (for imports)
const mappings = [
  { studentId: '20230187', internalId: 'uuid-1' },
  { studentId: '20230188', internalId: 'uuid-2' },
  // ... more mappings
];

const result = await mappingService.bulkCreateStudentMappings(mappings);
console.log(`Created ${result.success} mappings, ${result.failed} failed`);
```

### Analytics and Reporting

```typescript
// Get statistics for all entity types
const allStats = await mappingService.getAllMappingStats();
console.log('Student mappings:', allStats.student);
console.log('Book mappings:', allStats.book);

// Validate all mappings
const validationResults = await mappingService.validateAllMappings();
for (const [entityType, result] of Object.entries(validationResults)) {
  if (!result.isValid) {
    console.log(`Issues found in ${entityType}:`, result.issues);
  }
}
```

## Configuration

### IDMappingConfig Options

```typescript
interface IDMappingConfig {
  redisKeyPrefix?: string;        // Default: 'id_mapping:'
  defaultTTL?: number;           // Default: 24 hours (ms)
  enableAnalytics?: boolean;     // Default: true
  enableValidation?: boolean;    // Default: true
  cleanupInterval?: number;      // Default: 1 hour (ms)
  maxCacheSize?: number;         // Default: 10000
  batchSize?: number;            // Default: 100
  enableMetrics?: boolean;       // Default: true
}
```

### Example Configuration

```typescript
const config = {
  redisKeyPrefix: 'clms:mapping:',
  defaultTTL: 12 * 60 * 60 * 1000, // 12 hours
  enableAnalytics: true,
  enableValidation: true,
  cleanupInterval: 30 * 60 * 1000, // 30 minutes
  batchSize: 200,
  enableMetrics: true
};

const mappingService = await getIDMappingService(config);
```

## Storage Strategy

### Redis Caching

- **Key Structure**: `{prefix}{entityType}:external:{externalId}` and `{prefix}{entityType}:internal:{internalId}`
- **TTL**: Configurable (default 24 hours)
- **Fallback**: Automatic switch to in-memory cache if Redis unavailable
- **Performance**: Sub-millisecond lookups for frequently accessed mappings

### Database Persistence

- **Table**: `id_mappings`
- **Indexes**: Optimized for entity type, external ID, internal ID, and access patterns
- **Metadata**: JSON field for additional information
- **Access Tracking**: Last accessed timestamp and access count

### Cache Invalidation

- Automatic expiration based on TTL
- Manual cache clearing for entity types
- Cache updates on mapping modifications

## Integration Points

### Repository Integration

```typescript
// In student repository
import { getIDMappingService } from '../services/idMappingService';

export class StudentRepository {
  private mappingService: IDMappingService;

  constructor() {
    this.initializeMappingService();
  }

  private async initializeMappingService() {
    this.mappingService = await getIDMappingService();
  }

  async findByStudentId(studentId: string) {
    // Convert external ID to internal UUID
    const internalId = await this.mappingService.getStudentInternalId(studentId);
    if (!internalId) {
      return null;
    }

    // Use internal ID for database query
    return await prisma.student.findUnique({
      where: { id: internalId }
    });
  }

  async create(data: CreateStudentData) {
    // Create student record
    const student = await prisma.student.create({ data });

    // Create mapping
    await this.mappingService.createStudentMapping(
      data.studentId,
      student.id,
      { source: 'manual_creation' }
    );

    return student;
  }
}
```

### Import Service Integration

```typescript
// In import service
import { getIDMappingService } from '../services/idMappingService';

export class ImportService {
  async importStudents(data: StudentImportData[]) {
    const mappingService = await getIDMappingService();
    const mappings = [];

    for (const studentData of data) {
      // Create student record
      const student = await prisma.student.create({
        data: studentData
      });

      // Prepare mapping for bulk creation
      mappings.push({
        studentId: studentData.studentId,
        internalId: student.id,
        metadata: {
          source: 'csv_import',
          importDate: new Date(),
          fileName: studentData._sourceFile
        }
      });
    }

    // Bulk create mappings
    const result = await mappingService.bulkCreateStudentMappings(mappings);
    
    return {
      studentsCreated: data.length,
      mappingsCreated: result.success,
      mappingErrors: result.errors
    };
  }
}
```

### Controller Integration

```typescript
// In controller
import { getIDMappingService } from '../services/idMappingService';

export class StudentController {
  async getStudent(req: Request, res: Response) {
    const { studentId } = req.params;
    const mappingService = await getIDMappingService();

    // Convert external ID to internal UUID
    const internalId = await mappingService.getStudentInternalId(studentId);
    if (!internalId) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get student data
    const student = await studentRepository.findById(internalId);
    res.json(student);
  }
}
```

## Performance Considerations

### Caching Strategy

1. **Redis First**: Always check Redis cache first for fastest lookups
2. **Database Fallback**: Query database only when cache miss occurs
3. **Cache Warm-up**: Pre-load frequently accessed mappings
4. **Lazy Loading**: Load mappings on-demand for memory efficiency

### Batch Processing

1. **Batch Size**: Configure optimal batch size (default: 100)
2. **Parallel Processing**: Process multiple batches concurrently when possible
3. **Transaction Safety**: Use database transactions for consistency
4. **Error Handling**: Continue processing on individual failures

### Memory Management

1. **Cache Limits**: Enforce maximum cache size to prevent memory issues
2. **LRU Eviction**: Use Least Recently Used eviction policy
3. **Automatic Cleanup**: Remove stale mappings periodically
4. **Memory Monitoring**: Track memory usage and performance metrics

## Monitoring and Analytics

### Access Patterns

- Track most frequently accessed mappings
- Monitor cache hit/miss ratios
- Identify performance bottlenecks
- Analyze usage patterns over time

### Validation Metrics

- Detect duplicate mappings
- Identify orphaned mappings
- Monitor data integrity
- Track validation results

### Performance Metrics

- Lookup latency (average, p95, p99)
- Cache effectiveness ratio
- Database query performance
- Bulk operation throughput

## Error Handling

### Common Scenarios

1. **Missing Mappings**: Graceful handling with null returns
2. **Redis Unavailable**: Automatic fallback to database
3. **Duplicate Mappings**: Conflict resolution with logging
4. **Invalid Entity Types**: Validation with descriptive errors

### Recovery Strategies

1. **Automatic Retry**: Retry failed operations with exponential backoff
2. **Circuit Breaker**: Stop operations when failure rate exceeds threshold
3. **Graceful Degradation**: Continue with reduced functionality
4. **Data Consistency**: Ensure mapping integrity during failures

## Security Considerations

### Access Control

- Restrict mapping creation/updates to authorized users
- Audit trail for all mapping operations
- Role-based access control for different entity types

### Data Protection

- Encrypt sensitive mapping metadata
- Secure Redis connections with TLS
- Regular backup of mapping data
- Data retention policies for stale mappings

## Best Practices

### Performance

1. **Use Bulk Operations**: For imports and batch processing
2. **Configure Cache TTL**: Based on access patterns
3. **Monitor Cache Hit Ratio**: Aim for >90% hit ratio
4. **Optimize Batch Size**: Based on system resources

### Data Integrity

1. **Validate Mappings**:定期运行验证检查
2. **Cleanup Stale Mappings**: Automatic cleanup based on usage
3. **Backup Critical Mappings**: Regular backups of mapping data
4. **Test Recovery Procedures**: Regular disaster recovery testing

### Code Organization

1. **Use Service Layer**: Abstract mapping operations
2. **Dependency Injection**: Inject mapping service where needed
3. **Error Handling**: Consistent error handling across all operations
4. **Logging**: Comprehensive logging for debugging and monitoring

## Troubleshooting

### Common Issues

1. **Cache Misses**: Check Redis connectivity and configuration
2. **Slow Lookups**: Monitor database query performance
3. **Memory Issues**: Adjust cache size and cleanup intervals
4. **Mapping Conflicts**: Run validation to identify duplicates

### Debugging Tools

1. **Health Status**: Check system health and statistics
2. **Validation Results**: Run full validation to identify issues
3. **Performance Metrics**: Monitor lookup latency and throughput
4. **Log Analysis**: Review error logs and access patterns

## Migration Guide

### From Legacy System

1. **Export Existing Mappings**: Extract current mapping data
2. **Transform Data**: Convert to new format
3. **Bulk Import**: Use bulk operations for migration
4. **Validate Results**: Run validation to ensure accuracy

### Data Format

```typescript
// Legacy format
{
  'student_id': '20230187',
  'internal_id': 'uuid-here',
  'created_at': '2023-01-01T00:00:00Z'
}

// New format
{
  entityType: 'student',
  externalId: '20230187',
  internalId: 'uuid-here',
  metadata: {
    legacyData: { /* original data */ },
    migrationDate: new Date(),
    migratedBy: 'system'
  }
}
```

## Future Enhancements

### Planned Features

1. **Distributed Caching**: Support for Redis Cluster
2. **Advanced Analytics**: ML-based pattern recognition
3. **Real-time Sync**: Synchronization with external systems
4. **GraphQL Integration**: Direct GraphQL query support

### Performance Improvements

1. **Edge Caching**: CDN-based caching for global deployments
2. **Compression**: Compress cached data for memory efficiency
3. **Sharding**: Horizontal scaling for large datasets
4. **Optimization**: Query optimization for complex scenarios

## API Reference

### IDMappingManager Methods

- `createMapping(entityType, externalId, internalId, metadata?)`
- `getInternalId(entityType, externalId)`
- `getExternalId(entityType, internalId)`
- `bulkCreateMappings(entityType, mappings)`
- `getMappingStats(entityType)`
- `validateMappings(entityType)`
- `cleanupStaleMappings(entityType, olderThan)`

### IDMappingService Methods

- `createStudentMapping(studentId, internalId, metadata?)`
- `getStudentInternalId(studentId)`
- `getStudentExternalId(internalId)`
- `bulkCreateStudentMappings(mappings)`
- `getAllMappingStats()`
- `validateAllMappings()`
- `cleanupAllStaleMappings(olderThan)`
- `getHealthStatus()`

## Support

For issues, questions, or contributions:

1. **Documentation**: Check this guide and code comments
2. **Logging**: Review application logs for detailed error information
3. **Health Checks**: Use built-in health status monitoring
4. **Performance**: Monitor metrics and analytics for optimization opportunities