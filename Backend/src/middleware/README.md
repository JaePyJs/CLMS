# Prisma Middleware for Automatic ID and Timestamp Management

This directory contains middleware components for the Prisma ORM, including automatic ID generation and timestamp management.

## Overview

The `prisma.middleware.ts` file provides a comprehensive middleware solution that automatically handles:

1. **ID Generation**: Automatically generates UUIDs for new records if an ID is not provided
2. **Timestamp Management**: Automatically sets `created_at` and `updated_at` timestamps
3. **Performance Monitoring**: Logs slow database operations for performance analysis
4. **Error Handling**: Provides detailed error logging with sanitized data

## Features

### Automatic ID Generation

- Uses `crypto.randomUUID()` for secure, unique ID generation
- Only generates IDs if they're not provided in the input data
- Works with single record creation and bulk operations
- Compatible with all Prisma models that use String IDs

### Timestamp Management

- **Created Records**: Automatically sets `created_at` and `updated_at` for new records
- **Updated Records**: Automatically updates `updated_at` for existing records
- **Upsert Operations**: Handles both create and update cases appropriately
- **Custom Timestamps**: Respects manually provided timestamps when specified

### Performance Monitoring

- Logs operations taking more than 1 second
- Provides detailed performance metrics
- Helps identify slow database operations
- Includes operation context and sanitized arguments

### Security & Privacy

- Sanitizes sensitive data (passwords, tokens, secrets) from logs
- Prevents accidental exposure of confidential information
- Maintains audit trail while protecting privacy

## Usage

### Automatic Setup

The middleware is automatically applied to the Prisma client in two locations:

1. **Main Prisma Client** (`Backend/src/utils/prisma.ts`):
```typescript
import { applyMiddlewareToClient } from '@/middleware/prisma.middleware';

// Middleware is automatically applied
applyMiddlewareToClient(prisma);
```

2. **Optimized Database Client** (`Backend/src/config/database.ts`):
```typescript
import { applyMiddlewareToClient } from '@/middleware/prisma.middleware';

// Applied to the optimized client as well
applyMiddlewareToClient(client);
```

### Manual Application

If you need to apply the middleware to a custom Prisma client instance:

```typescript
import { applyMiddlewareToClient } from '@/middleware/prisma.middleware';

const customPrisma = new PrismaClient({
  // your configuration
});

applyMiddlewareToClient(customPrisma);
```

### Direct Middleware Access

For advanced use cases, you can access the middleware directly:

```typescript
import { createPrismaMiddleware } from '@/middleware/prisma.middleware';

const middleware = createPrismaMiddleware();
prisma.$use(middleware);
```

## Supported Models

The middleware supports all models defined in the Prisma schema that have:

- **ID Fields**: All models with `id` fields of type String
- **Timestamp Fields**: Models with `created_at` and/or `updated_at` fields

Currently supported models:
- `audit_logs`
- `automation_jobs`
- `automation_logs`
- `barcode_history`
- `book_checkouts`
- `books`
- `equipment`
- `equipment_condition_reports`
- `equipment_maintenance`
- `equipment_reports`
- `equipment_reservations`
- `equipment_sessions`
- `equipment_usage_stats`
- `notifications`
- `student_activities`
- `students`
- `system_config`
- `users`

## Examples

### Creating Records

```typescript
// ID will be automatically generated
const student = await prisma.students.create({
  data: {
    student_id: 'STU001',
    first_name: 'John',
    last_name: 'Doe',
    grade_level: '10',
    grade_category: 'JUNIOR_HIGH',
    // created_at and updated_at will be set automatically
  },
});
```

### Updating Records

```typescript
// updated_at will be automatically updated
const updatedStudent = await prisma.students.update({
  where: { id: 'student-id' },
  data: {
    first_name: 'Jane',
    // updated_at is set automatically
  },
});
```

### Bulk Operations

```typescript
// IDs and timestamps are handled for bulk operations
const newStudents = await prisma.students.createMany({
  data: [
    {
      student_id: 'STU001',
      first_name: 'John',
      last_name: 'Doe',
      grade_level: '10',
      grade_category: 'JUNIOR_HIGH',
    },
    {
      student_id: 'STU002',
      first_name: 'Jane',
      last_name: 'Smith',
      grade_level: '11',
      grade_category: 'JUNIOR_HIGH',
    },
  ],
});
```

### Upsert Operations

```typescript
// Handles both create and update cases
const student = await prisma.students.upsert({
  where: { student_id: 'STU001' },
  create: {
    student_id: 'STU001',
    first_name: 'John',
    last_name: 'Doe',
    grade_level: '10',
    grade_category: 'JUNIOR_HIGH',
  },
  update: {
    first_name: 'Jane',
  },
});
```

## Configuration

### Performance Threshold

The middleware logs operations taking more than 1 second by default. This threshold can be modified by editing the middleware file:

```typescript
if (duration > 1000) { // 1 second threshold
  logger.warn('Slow database operation detected', {
    model,
    action,
    duration,
    args: sanitizeArgs(args),
  });
}
```

### Sensitive Fields

Sensitive fields are automatically redacted from logs. The list can be extended:

```typescript
const sensitiveFields = ['password', 'token', 'secret', 'key'];
// Add more fields as needed
```

## Testing

The middleware includes comprehensive tests in `Backend/src/tests/middleware/prisma-middleware.test.ts`. To run the tests:

```bash
npm test -- Backend/src/tests/middleware/prisma-middleware.test.ts
```

## Logging

The middleware uses the application's logger for:
- Information about middleware initialization
- Warnings about slow operations
- Error details for failed operations
- Performance metrics

Logs include:
- Model and action being performed
- Operation duration
- Sanitized arguments (sensitive data redacted)
- Error messages (when applicable)

## Migration from Manual ID/Timestamp Handling

When migrating existing code to use the middleware:

1. **Remove manual ID generation**:
```typescript
// Before
const data = {
  id: crypto.randomUUID(),
  // other fields
};

// After
const data = {
  // ID will be generated automatically
  // other fields
};
```

2. **Remove manual timestamp setting**:
```typescript
// Before
const data = {
  created_at: new Date(),
  updated_at: new Date(),
  // other fields
};

// After
const data = {
  // Timestamps will be set automatically
  // other fields
};
```

3. **Keep custom timestamps when needed**:
```typescript
// If you need specific timestamps, the middleware respects them
const data = {
  created_at: customDate,
  updated_at: customDate,
  // other fields
};
```

## Troubleshooting

### Common Issues

1. **Middleware not applied**: Ensure the middleware is imported and applied before using the Prisma client
2. **IDs not generated**: Check that the model is in the supported models list
3. **Timestamps not set**: Verify the model has the appropriate timestamp fields
4. **Performance issues**: Check the logs for slow operations and consider database optimization

### Debug Mode

For debugging, you can enable detailed logging by setting the environment:

```bash
NODE_ENV=development
```

This will enable query-level logging in Prisma, allowing you to see the exact operations being performed.

## Contributing

When adding new models to the middleware:

1. Add the model name to the appropriate arrays in `hasIdField`, `hasCreatedAtField`, and `hasUpdatedAtField` functions
2. Update the supported models list in this documentation
3. Add tests for the new model if necessary
4. Consider the impact on performance and security

## Security Considerations

- The middleware automatically redacts sensitive data from logs
- UUID generation uses cryptographically secure random values
- No sensitive data is stored or cached by the middleware
- All operations are logged for audit purposes while maintaining privacy