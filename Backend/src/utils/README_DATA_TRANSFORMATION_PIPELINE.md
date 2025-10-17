# Data Transformation Pipeline

A comprehensive, flexible data transformation pipeline for importing CSV/Excel data with automatic type inference, field mapping, validation, and rollback capabilities.

## Overview

The Data Transformation Pipeline is designed to handle complex import scenarios for the CLMS system, providing:
- Automatic type inference and conversion
- Flexible field mapping with fuzzy matching
- Comprehensive data validation
- Batch processing for large datasets
- Transaction management with rollback capabilities
- Progress tracking and error reporting
- Support for multiple entity types (students, books, equipment)

## Architecture

The pipeline consists of three main components:

1. **DataTransformationPipeline** - Core transformation engine
2. **ImportTransactionManager** - Transaction management and rollback
3. **ImportPipelineService** - High-level service layer

## Features

### 🔄 Pipeline Stages

1. **File Parsing** - CSV and Excel file support
2. **Header Detection** - Automatic normalization of column names
3. **Type Inference** - Automatic detection of data types
4. **Field Mapping** - Intelligent mapping to repository schemas
5. **Data Validation** - Customizable validation rules
6. **Data Transformation** - Conversion to repository format
7. **Batch Preparation** - Optimized for large datasets

### 🎯 Type Inference

Automatically detects and converts:
- `string` - Text values
- `number` - Numeric values with decimal support
- `integer` - Whole numbers
- `date` - Date values in multiple formats
- `datetime` - Date and time values
- `boolean` - True/false values
- `enum` - Limited categorical values
- `email` - Email addresses
- `phone` - Phone numbers
- `url` - Web URLs
- `id` - Identifier fields

### 🔗 Field Mapping

- **Automatic Mapping** - Fuzzy matching between source and target fields
- **Custom Mappings** - User-defined field mappings
- **Schema Integration** - Direct integration with repository schemas
- **Confidence Scoring** - Quality assessment of mappings

### ✅ Data Validation

- **Required Fields** - Mandatory field validation
- **Type Validation** - Data type checking
- **Length Constraints** - Min/max length validation
- **Pattern Matching** - Regex-based validation
- **Custom Validators** - User-defined validation logic

### 🔄 Rollback Capabilities

- **Transaction Management** - Database transactions for atomicity
- **Batch Rollback** - Partial rollback capabilities
- **Error Recovery** - Automatic rollback on high error rates
- **Audit Trail** - Complete transaction history

## Quick Start

### Basic Usage

```typescript
import { importPipelineService } from '@/services/importPipelineService';

const importOptions = {
  entityType: 'students',
  filePath: './data/students.csv',
  enableRollback: true,
  dryRun: false
};

const job = await importPipelineService.startImport(importOptions);
```

### Advanced Usage

```typescript
import { DataTransformationPipeline } from '@/utils/dataTransformationPipeline';

const pipeline = new DataTransformationPipeline({
  batchSize: 100,
  strictMode: true,
  logLevel: 'info'
});

const result = await pipeline.processFile(
  './data/books.xlsx',
  'books',
  {
    customMappings: {
      'Book Title': 'title',
      'Author Name': 'author',
      'Accession Number': 'accession_no'
    },
    validationRules: [
      {
        field: 'title',
        required: true,
        maxLength: 500
      }
    ]
  }
);
```

## Configuration

### Pipeline Configuration

```typescript
interface PipelineConfig {
  stages: PipelineStage[];
  batchSize: number;
  maxErrors: number;
  skipInvalidRows: boolean;
  strictMode: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  customFieldMappings?: Record<string, Record<string, string>>;
  validationRules?: Record<string, ValidationRule[]>;
}
```

### Validation Rules

```typescript
interface ValidationRule {
  field: string;
  required: boolean;
  type?: InferredType;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: any) => boolean | string;
}
```

## Entity Schemas

### Students

```typescript
{
  student_id: { type: 'id', required: true, unique: true },
  first_name: { type: 'string', required: true, maxLength: 255 },
  last_name: { type: 'string', required: true, maxLength: 255 },
  grade_level: { type: 'string', required: true },
  grade_category: { 
    type: 'enum', 
    required: true, 
    enumValues: ['GRADE_7', 'GRADE_8', 'GRADE_9', 'GRADE_10', 'GRADE_11', 'GRADE_12']
  },
  section: { type: 'string', required: false },
  is_active: { type: 'boolean', required: false }
}
```

### Books

```typescript
{
  accession_no: { type: 'id', required: true, unique: true },
  title: { type: 'string', required: true, maxLength: 500 },
  author: { type: 'string', required: true, maxLength: 500 },
  isbn: { type: 'string', required: false },
  publisher: { type: 'string', required: false },
  category: { type: 'string', required: true },
  subcategory: { type: 'string', required: false },
  location: { type: 'string', required: false },
  total_copies: { 
    type: 'integer', 
    required: false, 
    transform: (value) => parseInt(value) || 1 
  },
  available_copies: { 
    type: 'integer', 
    required: false, 
    transform: (value) => parseInt(value) || 1 
  },
  cost_price: { 
    type: 'number', 
    required: false, 
    transform: (value) => parseFloat(value) || null 
  },
  year: { 
    type: 'integer', 
    required: false, 
    transform: (value) => parseInt(value) || null 
  }
}
```

### Equipment

```typescript
{
  equipment_id: { type: 'id', required: true, unique: true },
  name: { type: 'string', required: true },
  type: { 
    type: 'enum', 
    required: true, 
    enumValues: ['COMPUTER', 'GAMING', 'AVR', 'PRINTER', 'SCANNER', 'OTHER']
  },
  location: { type: 'string', required: true },
  status: { 
    type: 'enum', 
    required: false, 
    enumValues: ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OUT_OF_ORDER']
  },
  description: { type: 'string', required: false },
  max_time_minutes: { 
    type: 'integer', 
    required: true, 
    transform: (value) => parseInt(value) || 60 
  },
  requires_supervision: { type: 'boolean', required: false },
  purchase_date: { type: 'date', required: false },
  purchase_cost: { 
    type: 'number', 
    required: false, 
    transform: (value) => parseFloat(value) || null 
  },
  serial_number: { type: 'string', required: false },
  asset_tag: { type: 'string', required: false }
}
```

## Error Handling

### Error Types

1. **Parsing Errors** - File format or structure issues
2. **Type Conversion Errors** - Data type mismatches
3. **Validation Errors** - Rule violations
4. **Mapping Errors** - Field mapping failures
5. **Transaction Errors** - Database operation failures

### Error Recovery

- **Skip Invalid Rows** - Continue processing valid records
- **Partial Import** - Import valid records, report errors
- **Automatic Rollback** - Rollback on high error rates
- **Manual Rollback** - Explicit rollback operations

## Performance Optimization

### Batch Processing

- Configurable batch sizes (default: 100 records)
- Memory-efficient processing for large files
- Progress tracking for long-running operations

### Memory Management

- Streaming file processing
- Garbage collection of processed data
- Efficient data structures

## Monitoring and Logging

### Progress Tracking

```typescript
const progress = pipeline.getProgress();
console.log(`Stage: ${progress.stage}`);
console.log(`Progress: ${progress.processedRows}/${progress.totalRows}`);
```

### Logging

Configurable log levels:
- `debug` - Detailed processing information
- `info` - General operation information
- `warn` - Non-critical issues
- `error` - Error conditions

## Examples

### Simple CSV Import

```typescript
const job = await importPipelineService.startImport({
  entityType: 'students',
  filePath: './data/students.csv',
  enableRollback: true
});
```

### Excel Import with Custom Mappings

```typescript
const job = await importPipelineService.startImport({
  entityType: 'books',
  filePath: './data/books.xlsx',
  customMappings: {
    'Book Title': 'title',
    'Author Name': 'author',
    'Accession Number': 'accession_no'
  },
  enableRollback: true,
  batchSize: 100
});
```

### Validation Rules

```typescript
const job = await importPipelineService.startImport({
  entityType: 'equipment',
  filePath: './data/equipment.csv',
  validationRules: [
    {
      field: 'equipment_id',
      required: true,
      pattern: /^[A-Z0-9\-_]+$/
    },
    {
      field: 'max_time_minutes',
      required: true,
      customValidator: (value) => {
        const num = parseInt(value);
        return (num > 0 && num <= 480) || 'Must be between 1 and 480 minutes';
      }
    }
  ]
});
```

### Dry Run

```typescript
const job = await importPipelineService.startImport({
  entityType: 'students',
  filePath: './data/students.csv',
  dryRun: true,
  strictMode: true
});
```

### Rollback

```typescript
const rollbackResult = await importPipelineService.rollbackImport(jobId);
if (rollbackResult.success) {
  console.log(`Rollback successful: ${rollbackResult.recordsDeleted} records deleted`);
}
```

## Best Practices

### File Preparation

1. **Consistent Headers** - Use clear, consistent column names
2. **Data Quality** - Clean data before import
3. **File Format** - Use UTF-8 encoding for CSV files
4. **Sample Testing** - Test with small samples first

### Performance

1. **Batch Sizes** - Adjust batch size based on data complexity
2. **Memory Limits** - Monitor memory usage for large files
3. **Error Thresholds** - Set appropriate error limits
4. **Progress Monitoring** - Monitor long-running operations

### Error Handling

1. **Validation Rules** - Define comprehensive validation
2. **Rollback Strategy** - Plan rollback procedures
3. **Logging** - Enable appropriate logging levels
4. **Testing** - Test with various data scenarios

## API Reference

### DataTransformationPipeline

```typescript
class DataTransformationPipeline {
  constructor(config?: Partial<PipelineConfig>);
  
  async processFile(
    filePath: string,
    entityType: EntityType,
    options?: {
      customMappings?: Record<string, string>;
      validationRules?: ValidationRule[];
      dryRun?: boolean;
    }
  ): Promise<TransformationResult>;
  
  getProgress(): PipelineProgress;
}
```

### ImportPipelineService

```typescript
class ImportPipelineService {
  async startImport(options: ImportOptions): Promise<ImportJob>;
  getJob(jobId: string): ImportJob | null;
  getActiveJobs(): ImportJob[];
  async cancelJob(jobId: string): Promise<boolean>;
  async rollbackImport(jobId: string): Promise<RollbackResult | null>;
  cleanupJobs(olderThanHours?: number): number;
  getPipelineStatistics(): PipelineStatistics;
}
```

### ImportTransactionManager

```typescript
class ImportTransactionManager {
  createTransaction(
    entityType: EntityType,
    totalRecords: number,
    metadata?: Record<string, any>
  ): ImportTransaction;
  
  async processTransaction(
    transactionId: string,
    transformationResult: TransformationResult,
    batchSize?: number
  ): Promise<ImportTransaction>;
  
  async rollbackTransaction(transactionId: string): Promise<RollbackResult>;
  getTransaction(transactionId: string): ImportTransaction | null;
  cleanupTransactions(olderThanHours?: number): number;
}
```

## Integration Points

### Repository Integration

The pipeline integrates seamlessly with the repository pattern:
- **BaseRepository** - Automatic field population
- **StudentsRepository** - Student-specific operations
- **BooksRepository** - Book-specific operations
- **EquipmentRepository** - Equipment-specific operations

### Type Inference Integration

Built-in integration with the type inference system:
- **Automatic Type Detection** - Smart type inference
- **Field Mappings** - Intelligent field mapping
- **Data Conversion** - Type-safe conversions

## Troubleshooting

### Common Issues

1. **File Not Found** - Check file path and permissions
2. **Memory Issues** - Reduce batch size or file size
3. **Type Conversion Errors** - Check data format consistency
4. **Mapping Failures** - Verify field names and custom mappings
5. **Validation Errors** - Review validation rules and data quality

### Debugging

1. **Enable Debug Logging** - Set logLevel to 'debug'
2. **Use Dry Run** - Test without importing data
3. **Check Progress** - Monitor pipeline stages
4. **Review Errors** - Analyze error messages and contexts

## Future Enhancements

- **Real-time Processing** - WebSocket-based progress updates
- **Advanced Mapping** - AI-powered field mapping
- **Data Profiling** - Automatic data quality assessment
- **Import Templates** - Predefined import configurations
- **Scheduled Imports** - Automated import scheduling