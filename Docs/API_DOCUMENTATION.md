# CLMS API Documentation

## Overview

The CLMS API provides RESTful endpoints for managing library operations, including student tracking, equipment management, book checkouts, and automation workflows.

## Base URL

- **Development**: `http://localhost:3001`
- **Production**: `https://your-domain.com/api`

## Authentication

All API endpoints (except `/health` and `/api/auth`) require authentication via JWT Bearer tokens.

```bash
# Include Authorization header
Authorization: Bearer <jwt_token>
```

## Response Format

All responses follow a consistent format:

```json
{
  "success": true,
  "data": { ... },
  "message": "Success message",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

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

### Reports

#### GET /api/reports/dashboard
Get dashboard statistics and metrics.

#### GET /api/reports/activities
Generate activity reports with filtering options.

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

Real-time events are available via WebSocket connection at `ws://localhost:3001`.

### Events

- `activity:created` - New activity created
- `activity:ended` - Activity ended
- `equipment:status_changed` - Equipment status updated
- `system:notification` - System notifications

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