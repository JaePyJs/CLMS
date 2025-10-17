# Flexible Import System Guide

## Overview

The CLMS Flexible Import System is a revolutionary data import framework that simplifies the process of importing data from external systems. It provides automatic field mapping, comprehensive validation, progress tracking, and rollback capabilities to ensure data integrity and ease of use.

## Key Features

### 🔄 Flexible Field Mapping
- **Automatic Field Detection**: Automatically maps common field names
- **Custom Mapping Support**: Define custom field mappings for any data source
- **Multiple Format Support**: CSV, Excel, JSON, and custom delimited formats
- **Case-Insensitive Matching**: Smart field name matching regardless of case

### ✅ Comprehensive Validation
- **Schema Validation**: Validates data against entity schemas
- **Business Logic Validation**: Enforces business rules and constraints
- **Duplicate Detection**: Identifies and handles duplicate records
- **Relationship Validation**: Validates foreign key relationships

### 📊 Progress Tracking
- **Real-time Updates**: Live progress tracking during import operations
- **Detailed Statistics**: Comprehensive import statistics and metrics
- **Error Reporting**: Detailed error reports with row-level information
- **Performance Metrics**: Execution time and processing speed metrics

### 🔄 Rollback Capabilities
- **Transaction Safety**: All imports run in database transactions
- **Automatic Rollback**: Failed imports are automatically rolled back
- **Manual Rollback**: Ability to rollback specific import operations
- **Partial Recovery**: Recover from partial failures with minimal data loss

## Supported Entity Types

### Students
```typescript
interface StudentImportData {
  studentId: string;          // External student identifier
  firstName: string;          // First name
  lastName: string;           // Last name
  gradeLevel: string;         // Grade level
  gradeCategory: string;      // Grade category (PRIMARY, GRADE_SCHOOL, JUNIOR_HIGH, SENIOR_HIGH)
  section: string;            // Section/class
  barcode?: string;           // Optional barcode
  isActive?: boolean;         // Active status (default: true)
}
```

### Books
```typescript
interface BookImportData {
  accessionNo: string;        // Accession number
  title: string;              // Book title
  author: string;             // Author name
  isbn?: string;              // ISBN number
  publisher?: string;         // Publisher
  publicationYear?: number;   // Publication year
  category?: string;          // Book category
  location?: string;          // Physical location
  status?: string;            // Book status (default: "available")
}
```

### Equipment
```typescript
interface EquipmentImportData {
  equipmentId: string;        // Equipment identifier
  name: string;               // Equipment name
  type: string;               // Equipment type
  location?: string;          // Physical location
  maxTimeMinutes?: number;    // Maximum usage time
  requiresSupervision?: boolean; // Supervision requirement
  status?: string;            // Equipment status (default: "available")
}
```

## Import API Endpoints

### 1. Validate Import Data
Validate data without processing to identify issues before import.

**Endpoint:** `POST /api/import/validate`

**Request:**
```json
{
  "entityType": "students",
  "data": [
    {
      "student_id": "STU001",
      "first_name": "John",
      "last_name": "Doe",
      "grade_level": "Grade 7",
      "grade_category": "JUNIOR_HIGH",
      "section": "7-A"
    }
  ],
  "options": {
    "fieldMapping": {
      "student_id": "studentId",
      "first_name": "firstName",
      "last_name": "lastName"
    },
    "strictValidation": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "totalRecords": 1,
    "validRecords": 1,
    "invalidRecords": 0,
    "warnings": [],
    "errors": [],
    "fieldMapping": {
      "student_id": "studentId",
      "first_name": "firstName",
      "last_name": "lastName"
    }
  }
}
```

### 2. Execute Import
Process the actual import with validation and error handling.

**Endpoint:** `POST /api/import/:entityType`

**Request:**
```json
{
  "data": [
    {
      "studentId": "STU001",
      "firstName": "John",
      "lastName": "Doe",
      "gradeLevel": "Grade 7",
      "gradeCategory": "JUNIOR_HIGH",
      "section": "7-A"
    }
  ],
  "options": {
    "skipDuplicates": true,
    "updateExisting": false,
    "validateOnly": false,
    "fieldMapping": {},
    "batchSize": 100,
    "timeout": 30000
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "importId": "import_12345",
    "status": "completed",
    "totalRecords": 100,
    "processedRecords": 95,
    "failedRecords": 5,
    "duplicatesSkipped": 10,
    "updatedRecords": 5,
    "errors": [
      {
        "row": 5,
        "field": "gradeCategory",
        "value": "INVALID",
        "message": "Invalid grade category value",
        "allowedValues": ["PRIMARY", "GRADE_SCHOOL", "JUNIOR_HIGH", "SENIOR_HIGH"]
      }
    ],
    "warnings": [
      {
        "row": 10,
        "field": "section",
        "message": "Section format may be inconsistent"
      }
    ],
    "duration": 2500,
    "startTime": "2025-10-17T01:30:00Z",
    "endTime": "2025-10-17T01:32:30Z"
  }
}
```

### 3. Check Import Status
Monitor the progress of long-running import operations.

**Endpoint:** `GET /api/import/status/:importId`

**Response:**
```json
{
  "success": true,
  "data": {
    "importId": "import_12345",
    "status": "processing",
    "progress": 45,
    "totalRecords": 1000,
    "processedRecords": 450,
    "failedRecords": 5,
    "startTime": "2025-10-17T01:30:00Z",
    "estimatedCompletion": "2025-10-17T01:35:00Z",
    "currentBatch": 5,
    "totalBatches": 10,
    "errors": []
  }
}
```

### 4. Rollback Import
Rollback a failed or unwanted import operation.

**Endpoint:** `POST /api/import/rollback`

**Request:**
```json
{
  "importId": "import_12345",
  "reason": "Data validation errors found",
  "confirm": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "importId": "import_12345",
    "rollbackStatus": "completed",
    "recordsRolledBack": 95,
    "rollbackTime": "2025-10-17T01:33:00Z",
    "reason": "Data validation errors found"
  }
}
```

## Field Mapping Configuration

### Automatic Field Mapping
The system automatically maps common field variations:

| Source Field | Target Field | Entity Types |
|--------------|--------------|--------------|
| student_id, StudentID, student-id | studentId | Students |
| first_name, firstName, First_Name | firstName | Students, Users |
| last_name, lastName, Last_Name | lastName | Students, Users |
| accession_no, AccessionNumber | accessionNo | Books |
| equipment_id, EquipmentID | equipmentId | Equipment |

### Custom Field Mapping
Define custom mappings for unique data sources:

```json
{
  "fieldMapping": {
    "custom_student_id": "studentId",
    "pupil_name": "firstName",
    "family_name": "lastName",
    "class_section": "section",
    "year_level": "gradeLevel"
  }
}
```

### Field Mapping Rules
1. **Case Insensitive**: Field names are matched regardless of case
2. **Character Normalization**: Special characters are normalized (underscores, hyphens)
3. **Partial Matching**: Partial field name matching for common variations
4. **Custom Priority**: Custom mappings take precedence over automatic mappings

## Validation Rules

### Student Validation
- **Required Fields**: studentId, firstName, lastName, gradeLevel, gradeCategory
- **Grade Categories**: Must be one of PRIMARY, GRADE_SCHOOL, JUNIOR_HIGH, SENIOR_HIGH
- **Student ID**: Must be unique within the system
- **Name Fields**: Cannot be empty and must contain valid characters

### Book Validation
- **Required Fields**: accessionNo, title, author
- **Accession Number**: Must be unique within the system
- **ISBN**: Must be valid ISBN format if provided
- **Publication Year**: Must be a valid year if provided

### Equipment Validation
- **Required Fields**: equipmentId, name, type
- **Equipment ID**: Must be unique within the system
- **Type**: Must be one of predefined equipment types
- **Max Time**: Must be positive number if provided

## Error Handling

### Error Types
| Error Code | Description | Severity |
|------------|-------------|----------|
| `VALIDATION_ERROR` | Field validation failed | High |
| `DUPLICATE_RECORD` | Duplicate record found | Medium |
| `RELATIONSHIP_ERROR` | Invalid relationship reference | High |
| `FORMAT_ERROR` | Invalid data format | Medium |
| `CONSTRAINT_VIOLATION` | Database constraint violation | High |
| `PROCESSING_ERROR` | General processing error | High |

### Error Response Format
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "timestamp": "2025-10-17T01:30:00.000Z",
  "details": {
    "row": 5,
    "field": "gradeCategory",
    "value": "INVALID",
    "message": "Invalid grade category value",
    "allowedValues": ["PRIMARY", "GRADE_SCHOOL", "JUNIOR_HIGH", "SENIOR_HIGH"],
    "suggestions": [
      "Use JUNIOR_HIGH for grade 7-10",
      "Use SENIOR_HIGH for grade 11-12"
    ]
  }
}
```

## Best Practices

### 1. Data Preparation
- **Clean Data**: Remove unnecessary characters and formatting
- **Consistent Formatting**: Ensure consistent data formats across all records
- **Validate First**: Always use the validation endpoint before importing
- **Test with Small Batch**: Test with a small batch before large imports

### 2. Field Mapping
- **Use Standard Names**: Use standard field names when possible
- **Document Custom Mappings**: Keep a record of custom field mappings
- **Test Mappings**: Validate field mappings with sample data
- **Backup Original Data**: Keep original data files for reference

### 3. Import Strategy
- **Batch Processing**: Use appropriate batch sizes for large datasets
- **Monitor Progress**: Monitor import progress for large operations
- **Handle Errors**: Review and fix errors before re-importing
- **Rollback Testing**: Test rollback procedures with sample data

### 4. Performance Optimization
- **Optimal Batch Size**: Use batch sizes between 100-1000 records
- **Concurrent Processing**: Enable concurrent processing for large datasets
- **Timeout Configuration**: Set appropriate timeouts for large imports
- **Resource Monitoring**: Monitor system resources during large imports

## Integration Examples

### JavaScript/TypeScript Client
```typescript
class CLMSImportClient {
  async validateImport(entityType: string, data: any[], options: any) {
    const response = await fetch(`/api/import/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType, data, options })
    });
    return response.json();
  }

  async executeImport(entityType: string, data: any[], options: any) {
    const response = await fetch(`/api/import/${entityType}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, options })
    });
    return response.json();
  }

  async checkImportStatus(importId: string) {
    const response = await fetch(`/api/import/status/${importId}`);
    return response.json();
  }

  async rollbackImport(importId: string, reason: string) {
    const response = await fetch(`/api/import/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ importId, reason, confirm: true })
    });
    return response.json();
  }
}
```

### Python Client
```python
class CLMSImportClient:
    def __init__(self, base_url: str):
        self.base_url = base_url
    
    def validate_import(self, entity_type: str, data: list, options: dict):
        response = requests.post(
            f"{self.base_url}/api/import/validate",
            json={"entityType": entity_type, "data": data, "options": options}
        )
        return response.json()
    
    def execute_import(self, entity_type: str, data: list, options: dict):
        response = requests.post(
            f"{self.base_url}/api/import/{entity_type}",
            json={"data": data, "options": options}
        )
        return response.json()
    
    def check_import_status(self, import_id: str):
        response = requests.get(f"{self.base_url}/api/import/status/{import_id}")
        return response.json()
    
    def rollback_import(self, import_id: str, reason: str):
        response = requests.post(
            f"{self.base_url}/api/import/rollback",
            json={"importId": import_id, "reason": reason, "confirm": True}
        )
        return response.json()
```

## Troubleshooting

### Common Issues

#### 1. Validation Failures
**Problem**: Large number of validation errors
**Solution**: 
- Check field mapping configuration
- Validate data format and consistency
- Review error messages for specific issues
- Use validation endpoint before importing

#### 2. Performance Issues
**Problem**: Slow import processing
**Solution**:
- Reduce batch size
- Check system resources
- Optimize data format
- Consider concurrent processing

#### 3. Memory Issues
**Problem**: Out of memory errors during large imports
**Solution**:
- Use smaller batch sizes
- Enable streaming for large files
- Monitor memory usage
- Consider file splitting

#### 4. Timeout Issues
**Problem**: Import operations timing out
**Solution**:
- Increase timeout configuration
- Use smaller batch sizes
- Check network connectivity
- Monitor server performance

### Debug Information

Enable debug logging for detailed import information:

```json
{
  "options": {
    "debug": true,
    "logLevel": "verbose",
    "saveIntermediateResults": true
  }
}
```

## Security Considerations

### Data Privacy
- **FERPA Compliance**: All student data handling complies with FERPA regulations
- **Data Encryption**: Data is encrypted during transmission and at rest
- **Access Control**: Import operations require appropriate permissions
- **Audit Logging**: All import operations are logged for audit purposes

### Input Validation
- **Schema Validation**: All input data is validated against schemas
- **SQL Injection Prevention**: Parameterized queries prevent SQL injection
- **File Upload Security**: Uploaded files are scanned and validated
- **Rate Limiting**: Import operations are rate-limited to prevent abuse

## Future Enhancements

### Planned Features
- **Real-time Validation**: WebSocket-based real-time validation feedback
- **Advanced Mapping**: AI-powered field mapping suggestions
- **Template System**: Import templates for common data sources
- **Scheduled Imports**: Automated scheduled import operations
- **Data Transformation**: Built-in data transformation capabilities

### API Evolution
- **GraphQL Support**: GraphQL endpoints for complex import queries
- **Webhook Integration**: Webhook notifications for import events
- **Bulk Operations**: Enhanced bulk operation capabilities
- **Streaming Support**: Streaming import for very large datasets

---

This guide provides comprehensive documentation for the CLMS Flexible Import System. For additional information or support, refer to the API documentation or contact the development team.