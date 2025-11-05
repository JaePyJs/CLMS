# API Validation Contracts

**Feature**: 001-production-readiness  
**Date**: 2025-11-05  
**Purpose**: Define validation requirements for production-ready API endpoints

## Overview

This document specifies validation contracts for CLMS API endpoints. All endpoints (193+) must implement:

1. **Input Validation**: Zod schemas validate request body/query/params
2. **Output Validation**: Response schemas ensure consistent API contracts
3. **Error Responses**: Standardized error format across all endpoints
4. **Type Safety**: Shared types between frontend and backend

---

## Standard Error Response Format

All error responses MUST follow this structure:

```typescript
interface ErrorResponse {
  error: string;      // Human-readable error message
  code: string;       // Machine-readable error code
  details?: unknown;  // Optional error details (validation errors, stack trace in dev)
}

// Example responses:
// 400 Bad Request
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "student_id": ["Must be at least 3 characters"],
    "grade_level": ["Must be between 1 and 12"]
  }
}

// 401 Unauthorized
{
  "error": "Authentication required",
  "code": "UNAUTHORIZED"
}

// 403 Forbidden
{
  "error": "Insufficient permissions",
  "code": "FORBIDDEN",
  "details": { "required_role": "ADMIN", "current_role": "LIBRARIAN" }
}

// 404 Not Found
{
  "error": "Student not found",
  "code": "NOT_FOUND",
  "details": { "student_id": "STU-12345" }
}

// 500 Internal Server Error
{
  "error": "An unexpected error occurred",
  "code": "INTERNAL_ERROR",
  "details": { "message": "Database connection failed" } // Only in development
}
```

---

## Validation Middleware Pattern

All API routes MUST use validation middleware:

```typescript
import { Request, Response, NextFunction } from "express";
import { z } from "zod";

/**
 * Generic validation middleware factory
 */
export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: result.error.flatten().fieldErrors,
      });
    }

    // Attach validated data to request
    req.validated = result.data;
    next();
  };
}

// Usage in routes:
router.post(
  "/students",
  authenticate, // Auth middleware
  authorize(["LIBRARIAN"]), // RBAC middleware
  validate(createStudentRequestSchema), // Validation middleware
  studentController.create // Controller handler
);
```

---

## Endpoint Categories & Validation Requirements

### 1. Authentication Endpoints

**POST /api/auth/login**

Request:

```typescript
const loginRequestSchema = z.object({
  body: z.object({
    username: z.string().min(3).max(20),
    password: z.string().min(8).max(100),
  }),
});
```

Response (200 OK):

```typescript
{
  user: {
    id: string;
    username: string;
    email: string;
    role: "ADMIN" | "LIBRARIAN" | "STAFF";
    full_name: string;
  }
  access_token: string;
  refresh_token: string;
}
```

**POST /api/auth/logout**

Request: No body (uses JWT from cookies)

Response (204 No Content)

**POST /api/auth/refresh**

Request:

```typescript
const refreshRequestSchema = z.object({
  body: z.object({
    refresh_token: z.string(),
  }),
});
```

Response (200 OK):

```typescript
{
  access_token: string;
  refresh_token: string;
}
```

---

### 2. Student Endpoints

**GET /api/students**

Query Parameters:

```typescript
const listStudentsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    grade_level: z.coerce.number().int().min(1).max(12).optional(),
    section: z.string().max(20).optional(),
    search: z.string().max(100).optional(),
    is_active: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
  }),
});
```

Response (200 OK):

```typescript
{
  data: Student[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}
```

**POST /api/students**

Request:

```typescript
const createStudentRequestSchema = z.object({
  body: studentSchema, // From data-model.md
});
```

Response (201 Created):

```typescript
Student; // Full student object with generated id, barcode, timestamps
```

**GET /api/students/:id**

Params:

```typescript
const getStudentParamsSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
});
```

Response (200 OK):

```typescript
Student; // Full student object
```

**PATCH /api/students/:id**

Request:

```typescript
const updateStudentRequestSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
  body: studentSchema.partial(),
});
```

Response (200 OK):

```typescript
Student; // Updated student object
```

**DELETE /api/students/:id**

Params: Same as GET

Response (204 No Content)

---

### 3. Book Endpoints

**GET /api/books**

Query Parameters:

```typescript
const listBooksQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    category: z.string().max(50).optional(),
    author: z.string().max(100).optional(),
    search: z.string().max(100).optional(),
    is_active: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
    available_only: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
  }),
});
```

Response: Paginated list of books

**POST /api/books**

Request:

```typescript
const createBookRequestSchema = z.object({
  body: bookSchema, // From data-model.md
});
```

Response (201 Created): Full book object

**GET /api/books/:id**

Params: `id: cuid()`

Response (200 OK): Full book object

**PATCH /api/books/:id**

Request:

```typescript
const updateBookRequestSchema = z.object({
  params: z.object({ id: z.string().cuid() }),
  body: bookSchema.partial(),
});
```

Response (200 OK): Updated book object

**DELETE /api/books/:id**

Params: `id: cuid()`

Response (204 No Content)

---

### 4. Checkout Endpoints

**POST /api/checkouts**

Request:

```typescript
const createCheckoutRequestSchema = z.object({
  body: z.object({
    book_id: z.string().cuid(),
    student_id: z.string().cuid(),
    due_date: z
      .string()
      .datetime()
      .transform((v) => new Date(v)),
    notes: z.string().max(500).optional(),
  }),
});
```

Response (201 Created):

```typescript
{
  id: string;
  book: Book;           // Populated book object
  student: Student;     // Populated student object
  checkout_date: string;
  due_date: string;
  status: 'CHECKED_OUT';
  fine_amount: number;
  fine_paid: boolean;
  notes?: string;
}
```

**POST /api/checkouts/:id/return**

Request:

```typescript
const returnBookRequestSchema = z.object({
  params: z.object({ id: z.string().cuid() }),
  body: z.object({
    return_date: z
      .string()
      .datetime()
      .transform((v) => new Date(v))
      .default(() => new Date()),
    fine_paid: z.boolean().default(false),
  }),
});
```

Response (200 OK):

```typescript
{
  id: string;
  book: Book;
  student: Student;
  checkout_date: string;
  due_date: string;
  return_date: string;
  status: "RETURNED";
  fine_amount: number;
  fine_paid: boolean;
}
```

**GET /api/checkouts**

Query Parameters:

```typescript
const listCheckoutsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    student_id: z.string().cuid().optional(),
    book_id: z.string().cuid().optional(),
    status: z.enum(["CHECKED_OUT", "RETURNED", "OVERDUE"]).optional(),
    overdue_only: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
  }),
});
```

Response: Paginated list of checkouts with populated book and student

---

### 5. Equipment Endpoints

**GET /api/equipment**

Query Parameters:

```typescript
const listEquipmentQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    category: z.string().max(50).optional(),
    status: z.enum(["AVAILABLE", "IN_USE", "MAINTENANCE"]).optional(),
  }),
});
```

Response: Paginated list of equipment

**POST /api/equipment**

Request:

```typescript
const createEquipmentRequestSchema = z.object({
  body: equipmentSchema, // From data-model.md
});
```

Response (201 Created): Full equipment object

---

### 6. Analytics Endpoints

**GET /api/analytics/dashboard**

Query Parameters:

```typescript
const dashboardAnalyticsQuerySchema = z.object({
  query: z.object({
    start_date: z
      .string()
      .datetime()
      .transform((v) => new Date(v))
      .optional(),
    end_date: z
      .string()
      .datetime()
      .transform((v) => new Date(v))
      .optional(),
  }),
});
```

Response (200 OK):

```typescript
{
  total_students: number;
  active_checkouts: number;
  overdue_books: number;
  available_books: number;
  total_fines: number;
  recent_activities: Activity[];
  checkout_trends: { date: string; count: number }[];
}
```

**GET /api/analytics/reports/:type**

Params:

```typescript
const generateReportParamsSchema = z.object({
  params: z.object({
    type: z.enum(["checkouts", "students", "books", "fines", "activities"]),
  }),
  query: z.object({
    start_date: z
      .string()
      .datetime()
      .transform((v) => new Date(v)),
    end_date: z
      .string()
      .datetime()
      .transform((v) => new Date(v)),
    format: z.enum(["json", "csv", "excel"]).default("json"),
  }),
});
```

Response:

- JSON format: 200 OK with report data
- CSV/Excel format: File download with appropriate headers

---

### 7. Settings Endpoints

**GET /api/settings**

Query Parameters:

```typescript
const listSettingsQuerySchema = z.object({
  query: z.object({
    category: z.string().max(50).optional(),
  }),
});
```

Response (200 OK):

```typescript
Setting[]  // Array of system settings
```

**PATCH /api/settings/:key**

Request:

```typescript
const updateSettingRequestSchema = z.object({
  params: z.object({
    key: z.string().regex(/^[a-z_]+$/),
  }),
  body: z.object({
    value: z.string().min(1),
    description: z.string().max(500).optional(),
  }),
});
```

Response (200 OK): Updated setting object

---

## Validation Testing Requirements

### Contract Tests (Supertest)

All endpoints MUST have contract tests verifying:

1. **Request validation**: Invalid inputs return 400 with proper error details
2. **Response schema**: Successful responses match expected schema
3. **Authentication**: Unauthenticated requests return 401
4. **Authorization**: Unauthorized requests return 403
5. **Error handling**: Server errors return 500 with standardized format

**Example Contract Test**:

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/server";

describe("POST /api/students", () => {
  it("validates request body", async () => {
    const response = await request(app)
      .post("/api/students")
      .send({
        student_id: "ab", // Too short
        grade_level: 13, // Out of range
      })
      .expect(400);

    expect(response.body).toMatchObject({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: {
        student_id: expect.arrayContaining([
          expect.stringContaining("at least 3"),
        ]),
        grade_level: expect.arrayContaining([
          expect.stringContaining("1 and 12"),
        ]),
      },
    });
  });

  it("creates student with valid data", async () => {
    const response = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${validToken}`)
      .send({
        student_id: "STU-12345",
        first_name: "John",
        last_name: "Doe",
        grade_level: 10,
        section: "A",
      })
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      student_id: "STU-12345",
      first_name: "John",
      barcode: expect.any(String),
    });
  });
});
```

---

## Implementation Checklist

For each of the 193+ API endpoints:

- [ ] Zod validation schema defined for request (body/query/params)
- [ ] Validation middleware applied to route
- [ ] Response schema documented
- [ ] Error responses follow standard format
- [ ] Authentication middleware applied (if protected)
- [ ] Authorization middleware applied (with RBAC roles)
- [ ] Contract tests written (Supertest)
- [ ] OpenAPI/Swagger documentation updated
- [ ] Frontend types updated to match API contracts

---

## Summary

**Production-Ready API Validation Requirements**:

1. ✅ All inputs validated with Zod schemas
2. ✅ Standardized error response format
3. ✅ Type-safe request/response contracts
4. ✅ Comprehensive contract tests
5. ✅ Authentication and authorization checks
6. ✅ OpenAPI documentation
7. ✅ Shared types between frontend/backend

**No blockers identified.** All 193+ endpoints can be systematically enhanced with validation using the patterns defined in this document.
