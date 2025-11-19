# Data Model: Production-Ready CLMS System

**Feature**: 001-production-readiness  
**Date**: 2025-11-05  
**Purpose**: Document existing data model and validation requirements

## Overview

This feature **does not modify** the existing database schema. Instead, it documents the current data model and adds/enhances validation rules to ensure production-readiness. All entities below reference existing Prisma models in `Backend/prisma/schema.prisma`.

---

## Entity Catalog

### 1. Users

**Purpose**: Authentication and authorization for library staff

**Prisma Model**: `users`

**Fields**:
| Field | Type | Validation | Notes |
|-------|------|------------|-------|
| id | String (cuid) | Auto-generated | Primary key |
| username | String | Unique, 3-20 chars | Login identifier |
| email | String | Unique, valid email | Contact |
| password | String | Bcrypt hashed, 12 rounds | Never exposed in API |
| role | Enum | ADMIN \| LIBRARIAN \| STAFF | RBAC role |
| first_name | String | 1-50 chars | Display name |
| last_name | String | 1-50 chars | Display name |
| full_name | String | Auto-computed | `${first_name} ${last_name}` |
| is_active | Boolean | Default true | Soft delete |
| last_login_at | DateTime | Optional | Track activity |
| created_at | DateTime | Auto-set | Audit trail |
| updated_at | DateTime | Auto-update | Audit trail |

**Relationships**:

- Has many: `audit_logs` (created_by)
- Has many: `system_settings` (updated_by)

**Validation Schema** (Enhanced for Production):

```typescript
import { z } from "zod";

export const userCreateSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email().max(100),
  password: z
    .string()
    .min(8)
    .max(100)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Must contain uppercase, lowercase, and number"
    ),
  role: z.enum(["ADMIN", "LIBRARIAN", "STAFF"]).default("LIBRARIAN"),
  first_name: z.string().min(1).max(50),
  last_name: z.string().min(1).max(50),
});

export const userUpdateSchema = userCreateSchema
  .partial()
  .omit({ password: true });

export const userLoginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(8),
});
```

**Indexes**:

- `username` (unique)
- `email` (unique)
- `is_active` (for filtering active users)

---

### 2. Students

**Purpose**: Student records for library access and checkout

**Prisma Model**: `students`

**Fields**:
| Field | Type | Validation | Notes |
|-------|------|------------|-------|
| id | String (cuid) | Auto-generated | Primary key |
| student_id | String | Unique, 3-20 chars | School ID number |
| first_name | String | 1-50 chars | Required |
| last_name | String | 1-50 chars | Required |
| grade_level | Int | 1-12 | K-12 system |
| grade_category | String | Elementary/Middle/High | Auto-computed |
| section | String | 1-20 chars | Class section |
| email | String | Optional, valid email | Contact |
| phone | String | Optional, 10-15 digits | Contact |
| barcode | String | Unique, auto-generated | For scanning |
| photo_url | String | Optional URL | Student photo |
| is_active | Boolean | Default true | Enrollment status |
| created_at | DateTime | Auto-set | Audit trail |
| updated_at | DateTime | Auto-update | Audit trail |

**Relationships**:

- Has many: `book_checkouts`
- Has many: `student_activities`
- Has many: `equipment_sessions`

**Validation Schema**:

```typescript
export const studentSchema = z.object({
  student_id: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[A-Z0-9-]+$/),
  first_name: z.string().min(1).max(50).trim(),
  last_name: z.string().min(1).max(50).trim(),
  grade_level: z.number().int().min(1).max(12),
  section: z.string().min(1).max(20).trim(),
  email: z.string().email().max(100).optional().or(z.literal("")),
  phone: z
    .string()
    .regex(/^\d{10,15}$/)
    .optional()
    .or(z.literal("")),
  barcode: z.string().optional(), // Auto-generated if not provided
});
```

**Indexes**:

- `student_id` (unique)
- `barcode` (unique)
- `grade_level` (for filtering)
- `section` (for filtering)
- `[grade_level, section]` (composite for combined filters)

---

### 3. Books

**Purpose**: Library catalog and inventory management

**Prisma Model**: `books`

**Fields**:
| Field | Type | Validation | Notes |
|-------|------|------------|-------|
| id | String (cuid) | Auto-generated | Primary key |
| isbn | String | Unique, valid ISBN | International standard |
| title | String | 1-200 chars | Book title |
| author | String | 1-100 chars | Author name |
| publisher | String | 1-100 chars | Publisher name |
| year | Int | 1800-current year | Publication year |
| category | String | 1-50 chars | Genre/subject |
| accession_no | String | Unique | Library tracking number |
| total_copies | Int | Min 1 | Total inventory |
| available_copies | Int | Min 0 | Current available |
| location | String | 1-50 chars | Shelf location |
| description | String | Optional | Book description |
| is_active | Boolean | Default true | Catalog status |
| created_at | DateTime | Auto-set | Audit trail |
| updated_at | DateTime | Auto-update | Audit trail |

**Relationships**:

- Has many: `book_checkouts`

**Business Rules**:

- `available_copies <= total_copies` (enforced in service layer)
- Decrement `available_copies` on checkout, increment on return

**Validation Schema**:

```typescript
export const bookSchema = z.object({
  isbn: z
    .string()
    .regex(
      /^(?:ISBN(?:-1[03])?:? )?(?=[0-9X]{10}$|(?=(?:[0-9]+[- ]){3})[- 0-9X]{13}$|97[89][0-9]{10}$|(?=(?:[0-9]+[- ]){4})[- 0-9]{17}$)(?:97[89][- ]?)?[0-9]{1,5}[- ]?[0-9]+[- ]?[0-9]+[- ]?[0-9X]$/
    ),
  title: z.string().min(1).max(200).trim(),
  author: z.string().min(1).max(100).trim(),
  publisher: z.string().min(1).max(100).trim(),
  year: z.number().int().min(1800).max(new Date().getFullYear()),
  category: z.string().min(1).max(50).trim(),
  accession_no: z.string().min(1).max(50).trim(),
  total_copies: z.number().int().min(1),
  location: z.string().min(1).max(50).trim(),
  description: z.string().max(1000).optional().or(z.literal("")),
});
```

**Indexes**:

- `isbn` (unique)
- `accession_no` (unique)
- `category` (for filtering)
- `author` (for searching)
- `title` (for searching - full-text index if MySQL 8.0+)

---

### 4. Book Checkouts

**Purpose**: Track book borrowing and returns

**Prisma Model**: `book_checkouts`

**Fields**:
| Field | Type | Validation | Notes |
|-------|------|------------|-------|
| id | String (cuid) | Auto-generated | Primary key |
| book_id | String | Foreign key | Reference to books.id |
| student_id | String | Foreign key | Reference to students.id |
| checkout_date | DateTime | Auto-set | Borrow date |
| due_date | DateTime | Required | Return deadline |
| return_date | DateTime | Optional | Actual return date |
| status | Enum | CHECKED_OUT \| RETURNED \| OVERDUE | Current status |
| fine_amount | Decimal | Default 0 | Calculated fine |
| fine_paid | Boolean | Default false | Payment status |
| notes | String | Optional | Additional info |
| created_at | DateTime | Auto-set | Audit trail |
| updated_at | DateTime | Auto-update | Audit trail |

**Relationships**:

- Belongs to: `books` (book_id)
- Belongs to: `students` (student_id)

**Business Rules**:

- Checkout: `status = CHECKED_OUT`, `available_copies--`
- Return: `status = RETURNED`, `available_copies++`, `return_date = now`
- Overdue: `status = OVERDUE` if `due_date < now && !return_date`
- Fine calculation: `(days_overdue * fine_per_day)` from system settings

**Validation Schema**:

```typescript
export const checkoutSchema = z.object({
  book_id: z.string().cuid(),
  student_id: z.string().cuid(),
  due_date: z.date().min(new Date(), "Due date must be in future"),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export const returnSchema = z.object({
  checkout_id: z.string().cuid(),
  return_date: z.date().max(new Date(), "Return date cannot be in future"),
  fine_paid: z.boolean().default(false),
});
```

**Indexes**:

- `book_id` (foreign key)
- `student_id` (foreign key)
- `status` (for filtering)
- `due_date` (for overdue queries)
- `[student_id, status]` (composite for student checkouts)

---

### 5. Equipment

**Purpose**: Library equipment inventory (computers, tablets, etc.)

**Prisma Model**: `equipment`

**Fields**:
| Field | Type | Validation | Notes |
|-------|------|------------|-------|
| id | String (cuid) | Auto-generated | Primary key |
| name | String | 1-100 chars | Equipment name |
| category | String | 1-50 chars | Type (Computer, Tablet, etc.) |
| status | Enum | AVAILABLE \| IN_USE \| MAINTENANCE | Current status |
| serial_number | String | Unique | Manufacturer serial |
| purchase_date | DateTime | Optional | Acquisition date |
| warranty_expiry | DateTime | Optional | Warranty end date |
| location | String | 1-50 chars | Physical location |
| created_at | DateTime | Auto-set | Audit trail |
| updated_at | DateTime | Auto-update | Audit trail |

**Relationships**:

- Has many: `equipment_sessions` (usage tracking)

**Validation Schema**:

```typescript
export const equipmentSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  category: z.string().min(1).max(50).trim(),
  status: z.enum(["AVAILABLE", "IN_USE", "MAINTENANCE"]).default("AVAILABLE"),
  serial_number: z.string().min(1).max(100).trim(),
  purchase_date: z.date().optional(),
  warranty_expiry: z.date().optional(),
  location: z.string().min(1).max(50).trim(),
});
```

**Indexes**:

- `serial_number` (unique)
- `category` (for filtering)
- `status` (for filtering)

---

### 6. Student Activities

**Purpose**: Log student library activities for attendance tracking

**Prisma Model**: `student_activities`

**Fields**:
| Field | Type | Validation | Notes |
|-------|------|------------|-------|
| id | String (cuid) | Auto-generated | Primary key |
| student_id | String | Foreign key | Reference to students.id |
| activity_type | Enum | CHECK_IN \| CHECK_OUT \| BOOK_BORROW \| BOOK_RETURN \| EQUIPMENT_USE | Activity category |
| activity_date | DateTime | Auto-set | Activity timestamp |
| notes | String | Optional | Additional context |
| created_at | DateTime | Auto-set | Audit trail |

**Relationships**:

- Belongs to: `students` (student_id)

**Validation Schema**:

```typescript
export const activitySchema = z.object({
  student_id: z.string().cuid(),
  activity_type: z.enum([
    "CHECK_IN",
    "CHECK_OUT",
    "BOOK_BORROW",
    "BOOK_RETURN",
    "EQUIPMENT_USE",
  ]),
  activity_date: z.date().default(() => new Date()),
  notes: z.string().max(500).optional().or(z.literal("")),
});
```

**Indexes**:

- `student_id` (foreign key)
- `activity_date` (for time-based queries)
- `[student_id, activity_date]` (composite for student activity history)

---

### 7. System Settings

**Purpose**: Configurable system parameters

**Prisma Model**: `system_settings`

**Fields**:
| Field | Type | Validation | Notes |
|-------|------|------------|-------|
| id | String (cuid) | Auto-generated | Primary key |
| key | String | Unique | Setting identifier |
| value | String | Required | Setting value (JSON string) |
| description | String | Optional | Human-readable description |
| category | String | Default 'general' | Grouping |
| updated_by | String | Foreign key | Last modifier |
| created_at | DateTime | Auto-set | Audit trail |
| updated_at | DateTime | Auto-update | Audit trail |

**Common Settings**:

- `fine_per_day`: Overdue fine rate (decimal)
- `max_checkout_days`: Default checkout duration (int)
- `max_books_per_student`: Checkout limit (int)
- `library_hours`: Operating hours (JSON)
- `attendance_export_schedule`: Auto-export schedule (cron)

**Validation Schema**:

```typescript
export const settingSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z_]+$/),
  value: z.string().min(1),
  description: z.string().max(500).optional().or(z.literal("")),
  category: z.string().min(1).max(50).default("general"),
});
```

**Indexes**:

- `key` (unique)
- `category` (for filtering)

---

### 8. Audit Logs

**Purpose**: Track all state-changing operations for compliance

**Prisma Model**: `audit_logs`

**Fields**:
| Field | Type | Validation | Notes |
|-------|------|------------|-------|
| id | String (cuid) | Auto-generated | Primary key |
| user_id | String | Foreign key | User who performed action |
| action | String | 1-100 chars | Action description |
| entity_type | String | 1-50 chars | Affected entity type |
| entity_id | String | Optional | Affected entity ID |
| old_values | String | Optional | JSON of old values |
| new_values | String | Optional | JSON of new values |
| ip_address | String | Optional | User IP address |
| user_agent | String | Optional | Browser info |
| created_at | DateTime | Auto-set | Action timestamp |

**Validation Schema**:

```typescript
export const auditLogSchema = z.object({
  user_id: z.string().cuid(),
  action: z.string().min(1).max(100),
  entity_type: z.string().min(1).max(50),
  entity_id: z.string().cuid().optional(),
  old_values: z.record(z.any()).optional(),
  new_values: z.record(z.any()).optional(),
  ip_address: z.string().ip().optional(),
  user_agent: z.string().max(500).optional(),
});
```

**Indexes**:

- `user_id` (foreign key)
- `entity_type` (for filtering)
- `created_at` (for time-based queries)
- `[entity_type, entity_id]` (composite for entity history)

---

## Validation Enhancement Strategy

### Frontend Validation (UX)

**Purpose**: Provide immediate feedback to users

**Implementation**:

```typescript
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

const form = useForm<Student>({
  resolver: zodResolver(studentSchema),
  mode: "onBlur", // Validate on blur for better UX
});
```

**Benefits**:

- Instant field-level error messages
- Prevents invalid form submission
- Reduces server load

### Backend Validation (Security)

**Purpose**: Never trust client input, validate all data

**Implementation**:

```typescript
app.post("/api/students", async (req, res) => {
  const result = studentSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: result.error.flatten(),
    });
  }

  // Process validated data
  const student = await prisma.student.create({
    data: result.data,
  });

  res.json(student);
});
```

**Benefits**:

- Prevents malicious input
- Consistent error responses
- Type-safe request handling

---

## Database Migration Strategy

### No Schema Changes Required

This feature does NOT modify the database schema. All entities listed above already exist in `Backend/prisma/schema.prisma`.

### Validation-Only Changes

The production-readiness effort adds/enhances Zod validation schemas without altering database structure. Future schema changes would follow this process:

1. Update `Backend/prisma/schema.prisma`
2. Generate migration: `npx prisma migrate dev --name migration_name`
3. Review migration SQL
4. Test migration in development
5. Apply to staging
6. Apply to production (during maintenance window)

---

## Summary

The existing CLMS data model is well-designed with:

- ✅ Proper relationships (foreign keys)
- ✅ Appropriate indexes
- ✅ Audit trail fields (created_at, updated_at)
- ✅ Soft delete support (is_active)
- ✅ RBAC support (user roles)

**Production-Readiness Enhancements**:

1. Add comprehensive Zod validation schemas
2. Implement frontend validation with react-hook-form
3. Ensure backend validation on all endpoints
4. Standardize error responses
5. Add additional indexes for performance (if needed after profiling)

**No blockers identified.** Data model supports all production-readiness requirements.
