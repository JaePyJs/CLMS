# Database Schema Documentation

## Overview

The CLMS database uses MySQL 8.0 with Prisma ORM for type-safe database access. The schema consists of **13 core tables** with comprehensive indexes, foreign key relationships, and cascade behaviors for data integrity.

### Schema Statistics
- **Total Tables**: 13
- **Total Enums**: 10
- **Total Indexes**: 35+
- **Relation Mode**: Prisma (managed by ORM)
- **Character Set**: utf8mb4_unicode_ci

---

## Core Entities

### 1. students
**Purpose**: Student registry with grade-based categorization for time limits and permissions

**Key Fields**:
- `student_id`: Unique school-issued identifier
- `grade_category`: Determines time limits (PRIMARY, GRADE_SCHOOL, JUNIOR_HIGH, SENIOR_HIGH)
- `barcode_image`: Generated barcode for scanner integration
- `is_active`: Soft delete flag

**Relationships**:
- Has many: `student_activities`, `book_checkouts`, `equipment_sessions`, `barcode_history`
- Cascade: Deleting a student cascades to activities and barcode history
- Restrict: Cannot delete student with active book checkouts or equipment sessions

**Indexes**:
- `student_id` (unique)
- `grade_category`
- `is_active`

---

### 2. books
**Purpose**: Library book catalog with inventory and barcode tracking

**Key Fields**:
- `accession_no`: Unique library catalog number
- `isbn`: International Standard Book Number
- `total_copies` / `available_copies`: Inventory management
- `category` / `subcategory`: Classification system
- `location`: Physical shelf location

**Relationships**:
- Has many: `book_checkouts`, `barcode_history`
- Restrict: Cannot delete book with active checkouts (data preservation)

**Indexes**:
- `accession_no` (unique)
- `category`
- `is_active`

---

### 3. equipment
**Purpose**: Library equipment inventory (computers, gaming stations, AVR equipment)

**Key Fields**:
- `equipment_id`: Unique equipment identifier
- `type`: Equipment category (COMPUTER, GAMING, AVR, PRINTER, SCANNER, OTHER)
- `status`: Availability (AVAILABLE, IN_USE, MAINTENANCE, OUT_OF_ORDER)
- `max_time_minutes`: Session duration limit
- `requires_supervision`: Safety flag

**Relationships**:
- Has many: `equipment_sessions`, `student_activities`
- Cascade: Deleting equipment removes all session history

**Indexes**:
- `equipment_id` (unique)
- `status`
- `type`

---

### 4. student_activities
**Purpose**: Unified activity log for all student library interactions

**Key Fields**:
- `activity_type`: Type of activity (COMPUTER_USE, GAMING_SESSION, BOOK_CHECKOUT, GENERAL_VISIT, etc.)
- `start_time` / `end_time`: Activity duration tracking
- `time_limit_minutes`: Grade-based time limit
- `google_synced`: Google Sheets sync status
- `status`: Activity state (ACTIVE, COMPLETED, EXPIRED, CANCELLED)

**Relationships**:
- Belongs to: `students` (cascade), `equipment` (set null)
- Cascade: Deleted with student
- Set Null: Equipment deletion doesn't remove activity, just clears equipment_id

**Indexes**:
- `student_id`
- `activity_type`
- `status`
- `start_time`
- `google_synced`
- `grade_category`

---

### 5. book_checkouts
**Purpose**: Book checkout/return transactions with fine management

**Key Fields**:
- `checkout_date` / `due_date` / `return_date`: Loan period tracking
- `status`: Checkout state (ACTIVE, RETURNED, OVERDUE, LOST, DAMAGED)
- `overdue_days`: Calculated overdue period
- `fine_amount` / `fine_paid`: Fine tracking (Decimal 10,2)

**Relationships**:
- Belongs to: `students`, `books`
- Restrict: Cannot delete student or book with active checkouts

**Indexes**:
- `student_id`
- `book_id`
- `status`
- `due_date`
- `overdue_days`

---

### 6. equipment_sessions
**Purpose**: Equipment usage sessions with time tracking and extensions

**Key Fields**:
- `session_start` / `session_end`: Session time range
- `planned_end`: Calculated end time based on max_time_minutes
- `actual_duration`: Completed session duration
- `extensions`: Number of time extensions granted
- `status`: Session state (ACTIVE, COMPLETED, EXPIRED, EXTENDED, TERMINATED)

**Relationships**:
- Belongs to: `students` (restrict), `equipment` (cascade)
- Cascade: Deleted with equipment
- Restrict: Cannot delete student with active sessions

**Indexes**:
- `student_id`
- `equipment_id`
- `status`
- `session_start`

---

### 7. users
**Purpose**: System users with role-based access control (RBAC)

**Key Fields**:
- `username`: Unique login identifier
- `password`: Bcrypt hashed password (12 rounds)
- `role`: Permission level (SUPER_ADMIN, ADMIN, LIBRARIAN, ASSISTANT, TEACHER, VIEWER)
- `permissions`: JSON object for fine-grained permission overrides
- `last_login_at`: Session tracking

**Relationships**:
- None (standalone entity)

**Indexes**:
- `username` (unique)
- `email` (unique)
- `role`
- `is_active`

---

## Supporting Tables

### 8. audit_logs
**Purpose**: Comprehensive audit trail for all system changes

**Key Fields**:
- `entity` / `entity_id`: Target entity reference
- `action`: Operation performed (CREATE, UPDATE, DELETE, etc.)
- `old_values` / `new_values`: JSON change tracking
- `performed_by`: User who made the change
- `ip_address` / `user_agent`: Request metadata

**Indexes**: entity, entity_id, action, performed_by, created_at

---

### 9. automation_jobs
**Purpose**: Scheduled background tasks (backups, sync, cleanup)

**Key Fields**:
- `type`: Job category (DAILY_BACKUP, GOOGLE_SHEETS_SYNC, SESSION_EXPIRY_CHECK, etc.)
- `schedule`: Cron expression for job timing
- `status`: Job state (IDLE, RUNNING, COMPLETED, FAILED)
- `config`: JSON job configuration
- `success_count` / `failure_count` / `average_duration_ms`: Performance metrics

**Relationships**:
- Has many: `automation_logs` (cascade delete)

**Indexes**: type, status, is_enabled, next_run_at

---

### 10. automation_logs
**Purpose**: Execution history and logs for automation jobs

**Key Fields**:
- `execution_id`: Unique run identifier
- `started_at` / `completed_at` / `duration_ms`: Performance tracking
- `success`: Boolean result
- `error_message` / `error_details`: Failure information
- `records_processed`: Processing statistics

**Relationships**:
- Belongs to: `automation_jobs` (cascade delete)

**Indexes**: job_id, status, success, started_at

---

### 11. barcode_history
**Purpose**: Tracking of all generated barcodes for audit purposes

**Key Fields**:
- `entity_type` / `entity_id`: Reference to student/book/equipment
- `format`: Barcode format (CODE128, EAN13, etc.)
- `barcode_data`: Encoded barcode value
- `generated_by`: User who generated barcode

**Relationships**:
- Belongs to: `students`, `books` (cascade delete)

**Indexes**: entity_type, entity_id, student_id, book_id

---

### 12. notifications
**Purpose**: System notifications for librarians and administrators

**Key Fields**:
- `type`: Notification category (OVERDUE_BOOK, FINE_ADDED, EQUIPMENT_EXPIRING, etc.)
- `priority`: Urgency level (LOW, NORMAL, HIGH, URGENT)
- `read` / `read_at`: Read status tracking
- `action_url`: Quick action link
- `metadata`: JSON additional context
- `expires_at`: Auto-deletion timestamp

**Indexes**: user_id, type, read, created_at

---

### 13. system_config
**Purpose**: System-wide configuration key-value store

**Key Fields**:
- `key`: Configuration identifier (unique)
- `value`: Configuration value (encrypted if is_secret=true)
- `category`: Config grouping (LIBRARY, SECURITY, FEATURES)
- `is_secret`: Sensitive data flag

**Indexes**: key (unique), category

---

## Enums

### Grade Categories
- `PRIMARY`: Elementary students
- `GRADE_SCHOOL`: Primary to intermediate grades
- `JUNIOR_HIGH`: Grades 7-10
- `SENIOR_HIGH`: Grades 11-12

### User Roles (Permission Hierarchy)
1. `SUPER_ADMIN`: Full system access
2. `ADMIN`: Administrative functions
3. `LIBRARIAN`: Daily operations
4. `ASSISTANT`: Limited operations
5. `TEACHER`: Read-mostly access
6. `VIEWER`: Read-only access

### Activity Types
- `COMPUTER_USE`, `GAMING_SESSION`, `AVR_SESSION`
- `BOOK_CHECKOUT`, `BOOK_RETURN`
- `GENERAL_VISIT`, `RECREATION`, `STUDY`, `OTHER`

### Equipment Types
- `COMPUTER`, `GAMING`, `AVR`, `PRINTER`, `SCANNER`, `OTHER`

### Status Enums
- **Book Checkouts**: ACTIVE, RETURNED, OVERDUE, LOST, DAMAGED
- **Equipment Sessions**: ACTIVE, COMPLETED, EXPIRED, EXTENDED, TERMINATED
- **Student Activities**: ACTIVE, COMPLETED, EXPIRED, CANCELLED, EXTENDED
- **Automation Jobs**: IDLE, RUNNING, COMPLETED, FAILED, CANCELLED, RETRYING
- **Equipment Status**: AVAILABLE, IN_USE, MAINTENANCE, OUT_OF_ORDER

### Notification Types
- `OVERDUE_BOOK`, `FINE_ADDED`, `FINE_WAIVED`, `BOOK_DUE_SOON`
- `EQUIPMENT_EXPIRING`, `SYSTEM_ALERT`
- `INFO`, `WARNING`, `ERROR`, `SUCCESS`

### Notification Priorities
- `LOW`, `NORMAL`, `HIGH`, `URGENT`

---

## Cascade Behaviors

### Cascade Delete (Parent deletion removes children)
- `automation_jobs` → `automation_logs`
- `equipment` → `equipment_sessions`
- `students` → `student_activities`
- `students` → `barcode_history`
- `books` → `barcode_history`

### Restrict Delete (Cannot delete parent with children)
- `students` → `book_checkouts`
- `students` → `equipment_sessions`
- `books` → `book_checkouts`

### Set Null (Parent deletion clears foreign key)
- `equipment` → `student_activities.equipment_id`

---

## Index Strategy

### Performance Indexes
- **Foreign Keys**: All foreign key columns indexed
- **Lookup Fields**: student_id, equipment_id, book_id
- **Status Fields**: All status enums indexed for filtering
- **Time Fields**: created_at, start_time, due_date for range queries
- **Category Fields**: grade_category, activity_type, equipment_type

### Unique Constraints
- `students.student_id`
- `books.accession_no`
- `equipment.equipment_id`
- `users.username`
- `users.email`
- `system_config.key`
- `automation_jobs.name`
- `automation_logs.execution_id`

---

## Migration Status

### Current State
- ✅ Schema defined with 13 tables
- ✅ All relationships configured with cascade behaviors
- ✅ 35+ indexes for query optimization
- ✅ Comprehensive documentation comments
- ✅ Schema pushed to database (using `prisma db push`)
- ⚠️ Formal migrations not yet created (requires shadow database permissions)

### Database Sync
```bash
# Current schema is synced via:
npx prisma db push

# To create formal migrations (requires DB privileges):
npx prisma migrate dev --name initial_schema
```

### Prisma Client Generation
```bash
# Generate TypeScript client:
npm run db:generate

# Note: Stop running servers first to avoid file locks
```

---

## Data Integrity Rules

1. **Referential Integrity**: Enforced at Prisma ORM level with `relationMode = "prisma"`
2. **Soft Deletes**: `is_active` flags on students, books, users
3. **Audit Trail**: All major operations logged in `audit_logs`
4. **Cascade Protection**: Restrict on financial/checkout records, Cascade on activity logs
5. **Time Tracking**: Automated timestamps on all tables (created_at, updated_at)

---

## Schema Maintenance

### Regular Tasks
- **Backup**: Daily automated backups via `automation_jobs`
- **Cleanup**: Weekly removal of old notifications and expired sessions
- **Integrity Check**: Monthly validation of referential integrity
- **Performance Review**: Quarterly index analysis and optimization

### Schema Updates
1. Modify `prisma/schema.prisma`
2. Run `npx prisma db push` (development) or `npx prisma migrate dev` (production)
3. Update documentation
4. Regenerate Prisma client
5. Test all relationships and indexes

---

## ER Diagram Generation

To generate visual ER diagrams, install prisma-erd-generator:

```bash
npm install -D prisma-erd-generator @mermaid-js/mermaid-cli

# Add to schema.prisma:
generator erd {
  provider = "prisma-erd-generator"
  output   = "../docs/ERD.svg"
}

# Generate:
npx prisma generate
```

---

## Related Documentation

- **API Documentation**: `Docs/API_DOCUMENTATION.md`
- **Deployment Guide**: `Docs/PRODUCTION_DEPLOYMENT_GUIDE.md`
- **Developer Guide**: `Docs/DEVELOPER_QUICK_START_GUIDE.md`
- **Prisma Schema**: `Backend/prisma/schema.prisma`

---

**Last Updated**: Task #2 - Database Schema Finalization  
**Schema Version**: 1.0.0 (Production Ready)  
**Prisma Version**: 5.22.0
