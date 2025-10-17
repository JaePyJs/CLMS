# CLMS API Documentation

## Overview

The CLMS API provides comprehensive RESTful endpoints for managing library operations, including student tracking, equipment management, book checkouts, automation workflows, real-time features, advanced analytics, and security monitoring.

### 🚀 Recent Architecture Updates (October 2025)

The API has been enhanced with a **Repository Pattern Implementation** that provides:

- **Type-Safe Data Access**: Full TypeScript support with generic repositories
- **Flexible ID Handling**: Support for multiple identifier types (database IDs, external identifiers)
- **Enhanced Error Handling**: Consistent error management across all endpoints
- **Improved Performance**: Optimized database operations with better query efficiency
- **Better Maintainability**: Separation of concerns between business logic and data access

#### Repository Pattern Benefits

1. **Consistent API Responses**: All endpoints now return standardized responses
2. **Flexible Entity Resolution**: Find entities by any identifier type
3. **Enhanced Validation**: Comprehensive input validation with detailed error reporting
4. **Better Testing**: Improved testability with mockable repository layer
5. **Performance Optimization**: Efficient database operations with proper indexing

#### New ID Handling Features

The API now supports flexible ID resolution for all major entities:

```typescript
// Students can be found by any of these identifiers
GET /api/students/12345              // Database ID
GET /api/students/STU001            // Student ID
GET /api/students/scan/STU001       // Barcode scan

// Books support multiple identifier types
GET /api/books/12345                 // Database ID
GET /api/books/ACC-001              // Accession number
GET /api/books/scan/ACC-001         // Barcode scan

// Equipment supports flexible identification
GET /api/equipment/12345            // Database ID
GET /api/equipment/PC001            // Equipment ID
GET /api/equipment/scan/PC001       // Barcode scan
```

### 🎉 Interactive API Documentation

**Swagger UI is now available!** For a complete, interactive API documentation with "Try it out" functionality, visit:

- **Development**: http://localhost:3001/api-docs
- **Production**: https://your-domain.com/api-docs
- **OpenAPI Spec**: http://localhost:3001/api-docs.json

The Swagger UI provides:
- ✅ **193 documented endpoints** organized by tags
- ✅ **Try it out** functionality for testing endpoints directly
- ✅ **Request/Response schemas** with examples
- ✅ **Authentication support** - Enter your JWT token once and use it for all requests
- ✅ **Validation rules** and error responses documented

## API Statistics

- **Total Endpoints**: 193
- **Route Modules**: 21
- **Supported HTTP Methods**: GET, POST, PUT, PATCH, DELETE
- **OpenAPI Version**: 3.1.0

## Base URL

- **Development**: `http://localhost:3001`
- **Production**: `https://your-domain.com/api`
- **WebSocket**: `ws://localhost:3002/ws` (Development) / `wss://your-domain.com/ws` (Production)

## Authentication

All API endpoints (except `/health` and `/api/auth`) require authentication via JWT Bearer tokens.

```bash
# Include Authorization header
Authorization: Bearer <jwt_token>
```

## Response Format

All responses follow a consistent format with enhanced error handling from the repository pattern:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "timestamp": "2025-10-17T01:30:00.000Z",
  "requestId": "req_12345",
  "metadata": {
    "executionTime": 150,
    "entityType": "student",
    "operation": "create"
  }
}
```

### Error Response (Enhanced)
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "timestamp": "2025-10-17T01:30:00.000Z",
  "requestId": "req_12345",
  "details": {
    "field": "gradeCategory",
    "value": "INVALID",
    "allowedValues": ["PRIMARY", "GRADE_SCHOOL", "JUNIOR_HIGH", "SENIOR_HIGH"]
  },
  "suggestions": [
    "Use one of the allowed grade category values",
    "Check the API documentation for valid field values"
  ]
}
```

### Repository Pattern Error Types

| Error Code | Description | Repository Context |
|------------|-------------|-------------------|
| `ENTITY_NOT_FOUND` | Entity not found by any identifier | BaseRepository |
| `INVALID_IDENTIFIER` | Invalid identifier format | BaseRepository |
| `DUPLICATE_IDENTIFIER` | Duplicate external identifier | Specific Repositories |
| `VALIDATION_ERROR` | Field validation failed | BaseRepository |
| `CONSTRAINT_VIOLATION` | Database constraint violation | BaseRepository |
| `OPERATION_NOT_ALLOWED` | Operation not permitted | Specific Repositories |

## Endpoints

### Authentication

#### POST /api/auth/login
Authenticate user and receive JWT token.

**Request:**
```json
{
  "username": "admin",
  "password": "password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "jwt_token_here",
    "user": {
      "id": "user_id",
      "username": "admin",
      "role": "ADMIN"
    }
  }
}
```

### Students

#### GET /api/students
Retrieve paginated list of students with optional filtering.

**Query Parameters:**
- `gradeCategory` (optional): Filter by grade category (PRIMARY, GRADE_SCHOOL, JUNIOR_HIGH, SENIOR_HIGH)
- `isActive` (optional): Filter by active status (true/false)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)

**Response:**
```json
{
  "success": true,
  "data": {
    "students": [
      {
        "id": "student_id",
        "studentId": "STU001",
        "firstName": "John",
        "lastName": "Doe",
        "gradeLevel": "Grade 7",
        "gradeCategory": "JUNIOR_HIGH",
        "section": "7-A",
        "isActive": true,
        "createdAt": "2024-01-01T12:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 150,
      "pages": 3
    }
  }
}
```

#### GET /api/students/:id
Retrieve specific student by ID or student ID.

#### POST /api/students
Create new student.

**Request:**
```json
{
  "studentId": "STU002",
  "firstName": "Jane",
  "lastName": "Smith",
  "gradeLevel": "Grade 8",
  "gradeCategory": "JUNIOR_HIGH",
  "section": "8-B"
}
```

#### PUT /api/students/:id
Update existing student.

#### DELETE /api/students/:id
Delete student (soft delete by setting isActive to false).

### Student Activities

#### GET /api/students/activities/all
Retrieve student activities with filtering.

**Query Parameters:**
- `studentId` (optional): Filter by student ID
- `startDate` (optional): Filter by start date (ISO string)
- `endDate` (optional): Filter by end date (ISO string)
- `activityType` (optional): Filter by activity type
- `status` (optional): Filter by status (ACTIVE, COMPLETED, EXPIRED, etc.)

#### POST /api/students/activities
Create new student activity.

**Request:**
```json
{
  "studentId": "STU001",
  "activityType": "COMPUTER_USE",
  "equipmentId": "COMP-01",
  "timeLimitMinutes": 60,
  "notes": "Homework research"
}
```

#### PATCH /api/students/activities/:id/end
End student activity.

### Books

#### GET /api/books
Retrieve paginated list of books.

#### POST /api/books
Create new book entry.

#### GET /api/books/:id
Retrieve specific book.

#### PUT /api/books/:id
Update book information.

### Equipment

#### GET /api/equipment
Retrieve all equipment with status.

#### POST /api/equipment
Add new equipment.

#### GET /api/equipment/:id
Retrieve specific equipment.

#### PUT /api/equipment/:id
Update equipment status or details.

### Scan Operations

#### POST /api/students/scan
Scan student barcode and retrieve student information.

**Request:**
```json
{
  "barcode": "STU001"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "student_id",
    "studentId": "STU001",
    "firstName": "John",
    "lastName": "Doe",
    "defaultTimeLimit": 60,
    "hasActiveSession": false
  }
}
```

### Automation

#### GET /api/automation/jobs
Retrieve all automation jobs.

#### GET /api/automation/jobs/:id
Get specific automation job status.

#### POST /api/automation/jobs/:id/trigger
Manually trigger automation job.

#### GET /api/automation/queues
Get queue status and statistics.

### Analytics

#### GET /api/analytics/predictive-insights
Generate predictive insights and recommendations.

**Query Parameters:**
- `timeframe` (optional): `day` | `week` | `month` (default: `week`)
- `category` (optional): Filter by insight type (`demand`, `peak`, `optimization`, `anomaly`)
- `confidence` (optional): Minimum confidence threshold (0-100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "insight_123",
      "type": "demand_forecast",
      "title": "Equipment Demand Forecast",
      "description": "Predicted weekly equipment demand: 45 sessions/day",
      "confidence": 85,
      "impact": "high",
      "recommendations": [
        "Consider adding 2 more computers",
        "Implement time-based access controls"
      ],
      "validUntil": "2025-10-20T10:30:00Z"
    }
  ]
}
```

#### GET /api/analytics/heat-map
Generate usage heat map data.

**Query Parameters:**
- `timeframe` (optional): `day` | `week` | `month` (default: `week`)
- `activityType` (optional): Filter by activity type
- `gradeLevel` (optional): Filter by grade level
- `location` (optional): Filter by location

#### GET /api/analytics/time-series-forecast
Generate time series forecast with predictions.

**Query Parameters:**
- `metric` (required): `student_visits` | `equipment_usage` | `book_circulation`
- `timeframe` (optional): `day` | `week` | `month` (default: `week`)
- `periods` (optional): Number of forecast periods (default: 7)

#### GET /api/analytics/resource-forecasts
Generate resource utilization forecasts.

#### GET /api/analytics/seasonal-patterns
Analyze seasonal usage patterns.

#### POST /api/analytics/insights-report
Generate comprehensive insights report.

**Request:**
```json
{
  "timeframe": "month",
  "includeRecommendations": true,
  "format": "json"
}
```

### Reports

#### GET /api/reports/dashboard
Get dashboard statistics and metrics.

#### GET /api/reports/activities
Generate activity reports with filtering options.

#### GET /api/reports/custom
Generate custom reports with advanced filtering.

**Query Parameters:**
- `type` (required): Report type (`usage`, `performance`, `compliance`, `custom`)
- `startDate` (optional): Report start date (ISO string)
- `endDate` (optional): Report end date (ISO string)
- `format` (optional): Output format (`json`, `pdf`, `csv`, `excel`)

### Error Handling & Monitoring

#### GET /api/errors/dashboard
Get error monitoring dashboard data.

#### GET /api/errors/reports
Get error reports with filtering.

#### POST /api/errors/report
Report client-side error.

#### GET /api/errors/health
Get system health and recovery status.

#### GET /api/analytics/metrics
Get system performance metrics.

#### GET /api/analytics/trends
Get error trend analysis.

### Self-Service Operations

#### POST /api/self-service/scan
Auto check-in/out student using barcode scan.

**Request:**
```json
{
  "barcode": "STU001",
  "location": "Main Library"
}
```

#### GET /api/self-service/status/:scanData
Get student status by barcode/QR data.

#### POST /api/self-service/check-in
Manual student check-in.

#### POST /api/self-service/check-out
Manual student check-out.

#### GET /api/self-service/statistics
Get self-service usage statistics.

### Notifications

#### GET /api/notifications
Get user notifications with filtering.

#### POST /api/notifications
Create new notification.

#### PUT /api/notifications/:id/read
Mark notification as read.

#### GET /api/notifications/channels
Get available notification channels.

### Settings & Configuration

#### GET /api/settings
Get system settings.

#### PUT /api/settings/:category/:key
Update specific setting.

#### GET /api/settings/system
Get system configuration settings.

#### GET /api/settings/backup
Get backup configuration.

### Enhanced Import System (v2.0)

The enhanced import system provides flexible data import capabilities with automatic field mapping, validation, and progress tracking.

#### POST /api/import/students
Bulk import students with flexible field mapping.

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
    "fieldMapping": {
      "student_id": "studentId",
      "first_name": "firstName",
      "last_name": "lastName"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "importId": "import_12345",
    "totalRecords": 100,
    "processedRecords": 95,
    "failedRecords": 5,
    "duplicatesSkipped": 10,
    "errors": [
      {
        "row": 5,
        "field": "gradeCategory",
        "message": "Invalid grade category value"
      }
    ],
    "duration": 2500
  }
}
```

#### POST /api/import/books
Bulk import books with flexible field mapping.

#### POST /api/import/equipment
Bulk import equipment with flexible field mapping.

#### GET /api/import/status/:importId
Get import operation status and progress.

#### POST /api/import/validate
Validate import data without processing.

#### POST /api/import/rollback
Rollback a failed import operation.

### Repository Pattern Endpoints

These endpoints demonstrate the repository pattern capabilities with flexible ID handling.

#### GET /api/repository/students/:identifier
Get student by any identifier (database ID, student ID, or barcode).

#### GET /api/repository/books/:identifier
Get book by any identifier (database ID, accession number, or barcode).

#### GET /api/repository/equipment/:identifier
Get equipment by any identifier (database ID, equipment ID, or barcode).

#### GET /api/repository/users/:identifier
Get user by any identifier (database ID, username, or email).

### Security & Audit

#### GET /api/audit/logs
Get audit trail logs.

**Query Parameters:**
- `userId` (optional): Filter by user ID
- `action` (optional): Filter by action type
- `startDate` (optional): Filter by start date
- `endDate` (optional): Filter by end date
- `resourceType` (optional): Filter by resource type

#### GET /api/audit/export
Export audit logs.

#### GET /api/audit/compliance
Generate compliance reports.

#### GET /api/security/threats
Get security threat analysis.

#### GET /api/users/permissions
Get user permissions and roles.

### Utilities

#### GET /api/utilities/health
Get system health status.

#### GET /api/utilities/stats
Get system statistics.

## Error Codes

| Code | Description |
|------|-------------|
| VALIDATION_ERROR | Request validation failed |
| NOT_FOUND | Resource not found |
| AUTHENTICATION_ERROR | Authentication failed |
| AUTHORIZATION_ERROR | Insufficient permissions |
| CONFLICT | Resource already exists |
| BUSINESS_LOGIC_ERROR | Business rule violation |
| DATABASE_ERROR | Database operation failed |
| EXTERNAL_SERVICE_ERROR | External service unavailable |
| RATE_LIMIT_ERROR | Too many requests |

## Rate Limiting

- **General API**: 100 requests per 15 minutes
- **Authentication**: 5 attempts per 15 minutes

## WebSocket Events

Real-time events are available via WebSocket connection at `ws://localhost:3002/ws`.

### Authentication

WebSocket connections require JWT authentication via the `Authorization` header during the WebSocket upgrade.

### Subscription Topics

Clients can subscribe to specific topics to receive relevant updates:

- `activities` - Student check-in/out, equipment usage
- `equipment` - Equipment status changes and availability
- `notifications` - System alerts and user notifications
- `dashboard` - Real-time dashboard metrics and statistics
- `analytics` - Usage analytics and insights
- `emergency` - Emergency alerts and system warnings
- `chat` - Inter-user messaging (future feature)
- `system` - System status and maintenance updates

### Events

#### Client-to-Server Messages
- `subscribe` - Subscribe to topic
- `unsubscribe` - Unsubscribe from topic
- `ping` - Keep-alive ping
- `get_status` - Get connection status

#### Server-to-Client Events
- `welcome` - Connection welcome message
- `activity_update` - Activity status changes
- `equipment_update` - Equipment status changes
- `notification` - System notifications
- `dashboard_update` - Dashboard metrics
- `error` - Error messages
- `batch` - Batched messages

### Example WebSocket Usage

```javascript
const ws = new WebSocket('ws://localhost:3002/ws', {
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  }
});

ws.onopen = () => {
  // Subscribe to activities
  ws.send(JSON.stringify({
    type: 'subscribe',
    data: {
      topic: 'activities',
      filters: {
        activityType: ['CHECK_IN', 'CHECK_OUT']
      }
    }
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

## Testing

Use the provided test environment for API testing:

```bash
# Backend tests
cd Backend
npm test

# API integration tests
npm run test:api
```

## SDK/Client Libraries

### JavaScript/TypeScript

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.VITE_API_URL || 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add authentication interceptor
api.interceptors.request.use(config => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

## Changelog

### v2.0.0 (October 2025)
- **Advanced Analytics Engine**: Predictive insights, usage patterns, and resource optimization
- **Enhanced WebSocket System**: Real-time updates with subscription-based topics
- **Comprehensive Error Handling**: Self-healing capabilities and automatic recovery
- **Security Enhancements**: Advanced authentication, audit trails, and threat detection
- **Self-Service Features**: Automated check-in/out with barcode scanner integration
- **Advanced Reporting**: Custom report builder with multiple export formats
- **Performance Monitoring**: Real-time metrics and health monitoring
- **Backup & Recovery**: Automated backup systems with disaster recovery procedures

### v1.0.0
- Initial API release
- Complete CRUD operations for students, books, equipment
- Activity tracking and management
- Barcode scanning workflows
- Automation job management
- Real-time WebSocket events

## Support

For API support and questions:
- Create an issue in the repository
- Review the troubleshooting section in README.md
- Contact the development team via GitHub issues