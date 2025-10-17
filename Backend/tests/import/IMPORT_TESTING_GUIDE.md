# Flexible Import Functionality Testing Guide

## Overview

This guide documents the comprehensive testing approach for the flexible import functionality implemented in the CLMS system. The testing covers various ID formats, data types, edge cases, and error handling scenarios.

## Test Scope

### 1. Student Import Tests
- Various student_id formats (numeric, alphanumeric, with special characters)
- Different grade level formats (8, Grade 8, G8, etc.)
- Different grade category formats (junior high, JUNIOR_HIGH, Jr High, etc.)
- Missing or invalid data handling

### 2. Book Import Tests
- Various accession_no formats (numeric, alphanumeric, with prefixes)
- Different ISBN formats (ISBN-10, ISBN-13, with/without hyphens)
- Different publication dates (various formats)
- Missing or invalid data handling

### 3. Equipment Import Tests
- Various equipment_id formats
- Different equipment types and statuses
- Different condition ratings
- Missing or invalid data handling

### 4. Type Inference Tests
- Various numeric formats (integers, decimals, with commas)
- Various date formats (MM/DD/YYYY, YYYY-MM-DD, etc.)
- Various boolean formats (true/false, yes/no, 1/0)
- Edge cases and error handling

### 5. Data Transformation Tests
- Field name variations (camelCase, snake_case, etc.)
- Missing fields handling
- Extra fields handling
- Data type conversions

## Test Files

### CSV Test Files
1. `test_students_various_ids.csv` - Student data with various ID formats
2. `test_books_various_ids.csv` - Book data with various accession numbers
3. `test_equipment_various_ids.csv` - Equipment data with various ID formats
4. `test_edge_cases.csv` - Edge cases and error scenarios
5. `test_large_dataset.csv` - Large dataset for performance testing

### Excel Test Files
1. `test_mixed_data_types.xlsx` - Mixed data types in Excel format
2. `test_enum_validation.xlsx` - Enum validation test cases

## Test Scenarios

### Student Import Scenarios

#### Valid Student ID Formats
- `STU001` - Standard alphanumeric
- `2024-001` - Year-based with dash
- `STU_2024_001` - With underscores
- `12345` - Pure numeric
- `ABC123XYZ` - Mixed alphanumeric
- `STU-001-2024` - Multiple separators

#### Grade Level Formats
- `8`, `9`, `10`, `11`, `12` - Numeric only
- `Grade 8`, `Grade 9` - With prefix
- `G8`, `G9` - Abbreviated
- `8th Grade`, `9th Grade` - With suffix
- `Grade-8`, `Grade-9` - With dash

#### Grade Category Formats
- `junior high` - Lowercase
- `JUNIOR_HIGH` - Uppercase with underscore
- `Jr High` - Abbreviated
- `Junior High` - Title case
- `SENIOR_HIGH` - Uppercase

#### Name Formats
- `Smith, John` - Standard format
- `Smith, John A` - With middle initial
- `Smith, John Andrew` - With full middle name
- `Smith-Jones, John` - Hyphenated last name
- `De La Cruz, Juan` - Multi-word last name

### Book Import Scenarios

#### Accession Number Formats
- `ACC001` - Standard alphanumeric
- `2024-BOOK-001` - Year-based
- `LIB-001-2024` - Library prefix
- `12345` - Pure numeric
- `BOOK-001-2024-ED1` - Complex format
- `ACC_2024_001` - With underscores

#### ISBN Formats
- `978-3-16-148410-0` - ISBN-13 with hyphens
- `9783161484100` - ISBN-13 without hyphens
- `0-306-40615-2` - ISBN-10 with hyphens
- `0306406152` - ISBN-10 without hyphens
- `ISBN 978-3-16-148410-0` - With prefix

#### Publication Date Formats
- `2024` - Year only
- `2024-01` - Year-month
- `01/15/2024` - MM/DD/YYYY
- `15/01/2024` - DD/MM/YYYY
- `2024-01-15` - ISO format
- `Jan 2024` - Month year

### Equipment Import Scenarios

#### Equipment ID Formats
- `EQ001` - Standard alphanumeric
- `LAB-001-2024` - Location-based
- `COMP-001` - Type-based
- `12345` - Pure numeric
- `LAB_001_2024` - With underscores
- `EQ-001-ROOM101` - With location

#### Equipment Types
- `computer` - Lowercase
- `COMPUTER` - Uppercase
- `Computer` - Title case
- `LAB_EQUIPMENT` - With underscores
- `lab-equipment` - With dashes

#### Status Formats
- `available` - Lowercase
- `AVAILABLE` - Uppercase
- `Available` - Title case
- `in_use` - With underscore
- `in-use` - With dash

### Type Inference Scenarios

#### Numeric Formats
- `123` - Integer
- `123.45` - Decimal
- `1,234` - With comma
- `1,234.56` - With comma and decimal
- `$123.45` - Currency
- `123%` - Percentage

#### Date Formats
- `01/15/2024` - MM/DD/YYYY
- `15/01/2024` - DD/MM/YYYY
- `2024-01-15` - ISO format
- `Jan 15, 2024` - Long format
- `15-Jan-2024` - Day-month-year
- `2024` - Year only

#### Boolean Formats
- `true`, `false` - Standard
- `yes`, `no` - Yes/No
- `1`, `0` - Numeric
- `y`, `n` - Single letter
- `on`, `off` - On/Off
- `active`, `inactive` - Status-based

### Error Handling Scenarios

#### Missing Required Fields
- Student without name
- Book without title
- Equipment without type

#### Invalid Data Types
- Text in numeric field
- Invalid date format
- Invalid email format

#### Constraint Violations
- Duplicate student IDs
- Invalid grade levels
- Invalid enum values

## Test Execution

### Running Tests

```bash
# Run all import tests
npm run test:import

# Run specific test categories
npm run test:import:students
npm run test:import:books
npm run test:import:equipment

# Run performance tests
npm run test:import:performance

# Run edge case tests
npm run test:import:edge-cases
```

### Test Reports

Test results are generated in:
- `Backend/tests/import/reports/` - HTML reports
- `Backend/tests/import/logs/` - Detailed logs
- `Backend/tests/import/metrics/` - Performance metrics

## Expected Outcomes

### Successful Import Characteristics
- All valid records are imported
- Flexible ID formats are accepted
- Type inference works correctly
- Enum validation with fallback works
- Error handling is graceful

### Error Handling Characteristics
- Invalid records are skipped with clear error messages
- Partial imports are supported
- Rollback functionality works
- Progress tracking is accurate

### Performance Characteristics
- Large datasets (1000+ records) are processed efficiently
- Memory usage is optimized
- Import completion time is reasonable
- Concurrent imports are supported

## Troubleshooting

### Common Issues

1. **ID Format Validation Errors**
   - Check if ID contains invalid characters
   - Verify ID length constraints
   - Ensure ID uniqueness

2. **Type Inference Failures**
   - Verify data format consistency
   - Check for mixed data types in columns
   - Review date format patterns

3. **Enum Validation Issues**
   - Check enum value spelling
   - Verify case sensitivity settings
   - Review fallback value configuration

4. **Performance Issues**
   - Monitor memory usage
   - Check batch size configuration
   - Review database indexing

### Debug Mode

Enable debug logging for detailed troubleshooting:

```typescript
const importService = new ImportService({
  logLevel: 'debug',
  strictMode: false
});
```

## Best Practices

### Data Preparation
1. Use consistent column naming
2. Validate data before import
3. Use standard date formats when possible
4. Clean special characters in IDs

### Import Process
1. Preview data before import
2. Start with small test batches
3. Monitor import progress
4. Review error logs

### Error Recovery
1. Fix data issues in source file
2. Use rollback for failed imports
3. Re-import corrected data
4. Validate results

## Continuous Testing

### Automated Tests
- Unit tests for type inference
- Integration tests for import pipeline
- Performance tests for large datasets
- Edge case tests for error handling

### Regression Testing
- Test new data formats
- Verify error handling improvements
- Check performance impact
- Validate compatibility updates