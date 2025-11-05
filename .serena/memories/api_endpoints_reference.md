# CLMS API Endpoints Complete Reference

**Last Updated**: November 5, 2025  
**Total Endpoints**: 193+  
**Route Modules**: 28

## Authentication & Authorization

### Auth Routes (`/api/auth`)
- POST /api/auth/login - User login (returns JWT + refresh token)
- POST /api/auth/register - User registration (admin only)
- POST /api/auth/refresh - Refresh access token
- POST /api/auth/logout - User logout
- GET /api/auth/me - Get current user profile
- PUT /api/auth/profile - Update user profile
- PUT /api/auth/password - Change password

**Security**: Public (login/register), JWT protected (others)

---

## User Management

### User Routes (`/api/users`)
- GET /api/users - List all users (admin only)
- POST /api/users - Create user (admin only)
- GET /api/users/:id - Get user by ID
- PUT /api/users/:id - Update user
- DELETE /api/users/:id - Delete user (admin only)
- PUT /api/users/:id/role - Update user role (admin only)
- PUT /api/users/:id/status - Enable/disable user (admin only)

**Security**: JWT + RBAC (ADMIN, LIBRARIAN)

---

## Student Management (PHASE 1)

### Student Routes (`/api/students`)
- GET /api/students - List all students (pagination, search, filter)
- POST /api/students - Create new student
- GET /api/students/:id - Get student by ID
- PUT /api/students/:id - Update student
- DELETE /api/students/:id - Delete student (soft delete)
- GET /api/students/search - Search students (name, ID, barcode)
- GET /api/students/barcode/:code - Get student by barcode
- POST /api/students/check-in - Student check-in via barcode
- POST /api/students/check-out - Student check-out via barcode
- GET /api/students/:id/activities - Get student activities
- GET /api/students/:id/checkouts - Get student book checkouts
- PUT /api/students/:id/photo - Upload student photo
- POST /api/students/:id/barcode - Generate barcode for student

**Query Parameters**:
- page, limit - Pagination
- search - Text search (name, ID)
- gradeLevel - Filter by grade
- isActive - Filter by status

**Security**: JWT + RBAC (ADMIN, LIBRARIAN)

---

## Book Catalog (PHASE 2)

### Book Routes (`/api/books`)
- GET /api/books - List all books (pagination, search, filter)
- POST /api/books - Create new book
- GET /api/books/:id - Get book by ID
- PUT /api/books/:id - Update book
- DELETE /api/books/:id - Delete book (soft delete)
- GET /api/books/search - Search books (title, author, ISBN)
- GET /api/books/isbn/:isbn - Get book by ISBN
- GET /api/books/accession/:accessionNo - Get book by accession number
- GET /api/books/:id/availability - Check book availability
- GET /api/books/category/:category - Get books by category
- PUT /api/books/:id/copies - Update copy counts
- GET /api/books/popular - Get most borrowed books
- POST /api/books/:id/barcode - Generate barcode for book

**Query Parameters**:
- page, limit - Pagination
- search - Text search (title, author)
- category - Filter by category
- isActive - Filter by status
- available - Filter by availability

**Security**: JWT + RBAC (ADMIN, LIBRARIAN)

---

## Checkout/Borrow System (PHASE 2)

### Borrow Routes (`/api/borrows`)
- GET /api/borrows - List all checkouts (pagination, filter)
- POST /api/borrows - Check out book to student
- GET /api/borrows/:id - Get checkout by ID
- PUT /api/borrows/:id/return - Return book
- PUT /api/borrows/:id/renew - Renew checkout
- GET /api/borrows/overdue - Get overdue checkouts
- GET /api/borrows/student/:studentId - Get student checkouts
- GET /api/borrows/book/:bookId - Get book checkout history
- PUT /api/borrows/:id/fine - Update fine amount
- PUT /api/borrows/:id/fine/pay - Mark fine as paid
- GET /api/borrows/statistics - Checkout statistics

**Query Parameters**:
- page, limit - Pagination
- status - Filter by status (CHECKED_OUT, RETURNED, OVERDUE)
- studentId - Filter by student
- bookId - Filter by book
- startDate, endDate - Date range

**Security**: JWT + RBAC (ADMIN, LIBRARIAN)

---

## Equipment Management (PHASE 3)

### Equipment Routes (`/api/equipment`)
- GET /api/equipment - List all equipment
- POST /api/equipment - Create new equipment
- GET /api/equipment/:id - Get equipment by ID
- PUT /api/equipment/:id - Update equipment
- DELETE /api/equipment/:id - Delete equipment
- GET /api/equipment/search - Search equipment
- GET /api/equipment/available - Get available equipment
- PUT /api/equipment/:id/status - Update equipment status
- GET /api/equipment/category/:category - Get by category
- POST /api/equipment/:id/session/start - Start equipment session
- PUT /api/equipment/:id/session/end - End equipment session
- GET /api/equipment/:id/sessions - Get equipment sessions
- POST /api/equipment/:id/maintenance - Schedule maintenance
- GET /api/equipment/:id/maintenance - Get maintenance history

**Query Parameters**:
- page, limit - Pagination
- search - Text search
- category - Filter by category
- status - Filter by status (AVAILABLE, IN_USE, MAINTENANCE)

**Security**: JWT + RBAC (ADMIN, LIBRARIAN)

---

## Equipment Automation (PHASE 3)

### Equipment Automation Routes (`/api/equipment/automation`)
- GET /api/equipment/automation/statistics - Get equipment statistics
- GET /api/equipment/automation/overdue - Get overdue equipment
- GET /api/equipment/automation/maintenance - Get maintenance schedule
- GET /api/equipment/automation/analytics - Get usage analytics
- POST /api/equipment/automation/notifications/overdue - Send overdue notifications
- POST /api/equipment/automation/maintenance/schedule - Schedule maintenance
- POST /api/equipment/automation/auto-return - Auto-return overdue
- POST /api/equipment/automation/run-cycle - Run automation cycle

**Background Jobs**:
- Check equipment session timeouts (every 5 minutes)
- Send overdue notifications (every 15 minutes)
- Calculate usage statistics (daily)

**Security**: JWT + RBAC (ADMIN, LIBRARIAN)

---

## Analytics & Reporting (PHASE 3)

### Analytics Routes (`/api/analytics`)
- GET /api/analytics/dashboard - Dashboard summary statistics
- GET /api/analytics/students - Student analytics
  - Total students, active students
  - Grade distribution
  - Activity patterns
- GET /api/analytics/books - Book analytics
  - Total books, available books
  - Category distribution
  - Popular books
- GET /api/analytics/borrows - Borrow analytics
  - Total checkouts, active checkouts
  - Overdue rate
  - Average checkout duration
  - Fine statistics
- GET /api/analytics/equipment - Equipment analytics
  - Total equipment, available equipment
  - Usage patterns
  - Maintenance statistics
- GET /api/analytics/trends - Trend analysis
  - Weekly/monthly trends
  - Growth rates
  - Peak usage times

**Query Parameters**:
- startDate, endDate - Date range for analytics
- groupBy - Group by period (day, week, month)
- category - Filter by category (for books/equipment)
- gradeLevel - Filter by grade (for students)

**Security**: JWT + RBAC (ADMIN, LIBRARIAN)

---

## Self-Service Scanning

### Self-Service Routes (`/api/self-service`)
- GET /api/self-service/status/:barcode - Check student status
- POST /api/self-service/check-in - Check in with barcode
- POST /api/self-service/check-out - Check out with barcode
- GET /api/self-service/statistics - Get scan statistics
- POST /api/self-service/scan - Process generic scan

**Features**:
- Real-time barcode validation
- 10-minute cooldown enforcement (configurable)
- Activity logging
- WebSocket notifications

**Security**: JWT + RBAC (ADMIN, LIBRARIAN, STAFF)

---

## Settings & Configuration

### Settings Routes (`/api/settings`)
- GET /api/settings - Get all settings
- GET /api/settings/:key - Get setting by key
- PUT /api/settings - Update settings (batch)
- PUT /api/settings/:key - Update single setting
- DELETE /api/settings/:key - Delete setting (admin only)

**Setting Categories**:
- general - General system settings
- attendance - Attendance rules
  - min_check_in_interval_minutes (default: 10)
  - default_session_time_minutes (default: 30)
- notifications - Notification preferences
- security - Security settings
- automation - Automation job settings

**Security**: JWT + RBAC (ADMIN for updates)

---

## Attendance Export

### Attendance Export Routes (`/api/attendance-export`)
- GET /api/attendance-export/data - Get attendance data (JSON)
- GET /api/attendance-export/export/csv - Export to CSV (download)
- GET /api/attendance-export/summary - Get attendance summary statistics
- GET /api/attendance-export/google-sheets - Get Google Sheets format (clipboard)

**Query Parameters**:
- startDate - Start date (YYYY-MM-DD)
- endDate - End date (YYYY-MM-DD)
- format - Export format (csv, excel, google-sheets)

**Response Formats**:
- CSV: Comma-separated values file
- Excel: CSV format compatible with Excel
- Google Sheets: Tab-separated for clipboard

**Security**: JWT + RBAC (ADMIN, LIBRARIAN)

---

## Import/Export

### Import Routes (`/api/import`)
- POST /api/import/students - Import students from CSV/Excel
- POST /api/import/books - Import books from CSV/Excel
- GET /api/import/template/:type - Download import template
- GET /api/import/history - Get import history
- GET /api/import/:id/errors - Get import errors

**Supported Formats**:
- CSV (.csv)
- Excel (.xlsx, .xls)

**Security**: JWT + RBAC (ADMIN, LIBRARIAN)

---

## Notifications

### Notification Routes (`/api/notifications`)
- GET /api/notifications - List user notifications
- GET /api/notifications/:id - Get notification by ID
- PUT /api/notifications/:id/read - Mark as read
- PUT /api/notifications/read-all - Mark all as read
- DELETE /api/notifications/:id - Delete notification
- POST /api/notifications/send - Send notification (admin only)

**Notification Types**:
- OVERDUE_BOOK - Book overdue reminder
- OVERDUE_EQUIPMENT - Equipment overdue reminder
- FINE_DUE - Fine payment reminder
- SYSTEM - System notifications
- MAINTENANCE - Maintenance alerts

**Security**: JWT protected

---

## Error Logging

### Error Log Routes (`/api/logs`)
- GET /api/logs - List error logs (admin only)
- GET /api/logs/:id - Get error log by ID
- DELETE /api/logs/:id - Delete error log
- DELETE /api/logs/clear - Clear old logs (admin only)

**Log Levels**: error, warn, info, debug

**Security**: JWT + RBAC (ADMIN only)

---

## Auto-Update System

### Update Routes (`/api/update`)
- GET /api/update/check - Check for updates
- POST /api/update/start - Start update process (admin only)
- GET /api/update/status - Get update status
- GET /api/update/history - Get update history

**Features**:
- One-click update system
- Automatic backup before update
- Rollback capability
- Version tracking

**Security**: JWT + RBAC (ADMIN only)

---

## Health & Monitoring

### System Routes (`/api`)
- GET /api/health - System health check
  - Response: { status, timestamp, uptime, memory }
- GET /api/info - API information
  - Response: { name, version, environment, endpoints, features }

**Security**: Public endpoints

---

## WebSocket Events

### Real-Time Events
**Connection**: `ws://localhost:3001` or `wss://your-domain.com`

**Events Emitted**:
- `activity:new` - New student activity logged
- `notification:new` - New notification created
- `job:complete` - Background job finished
- `equipment:session:started` - Equipment session began
- `equipment:session:ended` - Equipment session ended
- `student:updated` - Student record modified
- `book:updated` - Book record modified
- `checkout:new` - New book checkout
- `checkout:returned` - Book returned

**Events Received**:
- `join:room` - Join specific room (e.g., 'dashboard', 'students')
- `leave:room` - Leave room

**Security**: JWT authentication required for WebSocket connection

---

## Rate Limiting

**Configuration**:
- Window: 15 minutes (900,000 ms)
- Max Requests: 100 per window
- Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset

**Exceptions**:
- Health check endpoint (/api/health)
- Info endpoint (/api/info)

---

## Error Response Format

**Standard Error Response**:
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {} // Optional additional details
}
```

**Common Error Codes**:
- UNAUTHORIZED - Authentication required
- FORBIDDEN - Insufficient permissions
- NOT_FOUND - Resource not found
- VALIDATION_ERROR - Input validation failed
- DUPLICATE_ENTRY - Unique constraint violation
- INTERNAL_ERROR - Server error

**HTTP Status Codes**:
- 200 - Success
- 201 - Created
- 400 - Bad Request
- 401 - Unauthorized
- 403 - Forbidden
- 404 - Not Found
- 409 - Conflict
- 429 - Too Many Requests
- 500 - Internal Server Error

---

## Pagination

**Query Parameters**:
- page - Page number (default: 1)
- limit - Items per page (default: 10, max: 100)
- sort - Sort field (e.g., 'created_at')
- order - Sort order ('asc' or 'desc')

**Response Format**:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

This reference provides complete API endpoint documentation for CLMS development and integration.
