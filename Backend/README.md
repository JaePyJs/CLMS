# CLMS Backend API

This is the backend API for the Centralized Library Management System (CLMS). It provides a robust, scalable, and secure REST API for managing library operations including students, books, equipment, activities, and more.

## Features

- **Student Management**: Complete student lifecycle management with activity tracking
- **Book Management**: Library catalog management with checkout/return workflows
- **Equipment Management**: Computer and equipment tracking with reservation system
- **Activity Tracking**: Comprehensive audit logging and activity monitoring
- **Barcode Generation**: Automated barcode and QR code generation for students and books
- **Google Sheets Integration**: Real-time synchronization with Google Sheets
- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **Automation Jobs**: Scheduled tasks for data sync, cleanup, and reporting
- **Import/Export**: Bulk data operations with CSV and Excel support
- **Real-time Communication**: WebSocket support for live updates
- **Security Monitoring**: Advanced security features with FERPA compliance

## Tech Stack

- **Node.js 20+** with TypeScript
- **Express.js** for the REST API framework
- **Prisma** as the ORM for MySQL database
- **JWT** for authentication and authorization
- **Redis** for caching and job queues
- **Bull** for background job processing
- **Winston** for structured logging
- **Socket.io** for WebSocket communication
- **Vitest** for comprehensive testing
- **Docker** for containerization

## API Architecture

### Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    API Routes                           │
│  (Express Router with middleware and validation)        │
├─────────────────────────────────────────────────────────┤
│                  Service Layer                          │
│     (Business logic and data transformation)            │
├─────────────────────────────────────────────────────────┤
│                 Data Access Layer                       │
│        (Prisma ORM with MySQL database)                │
├─────────────────────────────────────────────────────────┤
│              Infrastructure Layer                       │
│     (Redis, WebSocket, Background Jobs, Logging)       │
└─────────────────────────────────────────────────────────┘
```

### Key Components

- **Routes**: API endpoint definitions with validation
- **Services**: Business logic and external service integrations
- **Middleware**: Authentication, authorization, error handling
- **Utils**: Helper functions and shared utilities
- **Config**: Environment-specific configuration
- **WebSocket**: Real-time communication handlers
- **Workers**: Background job processors

## Quick Start

### Prerequisites

- Node.js 20 or higher
- MySQL 8.0 or higher
- Redis 6.0 or higher
- Docker (optional, for local development)

### Installation

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd Backend
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set up database**:
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Run database migrations
   npm run db:migrate
   
   # Seed database (optional)
   npm run db:seed
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3001`.

### Docker Development

```bash
# Start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f backend
```

## API Documentation

### Base URL
- Development: `http://localhost:3001`
- Production: `https://your-domain.com/api`

### Authentication

Most endpoints require authentication. Include the JWT token in the Authorization header:

```bash
Authorization: Bearer <your-jwt-token>
```

### Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "timestamp": "2025-10-16T17:00:00.000Z"
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-10-16T17:00:00.000Z"
}
```

### Core Endpoints

#### Authentication
```bash
POST /api/auth/login          # User login
POST /api/auth/logout         # User logout
GET  /api/auth/me            # Get current user
PUT  /api/auth/password      # Change password
```

#### Students
```bash
GET    /api/students         # List students (paginated)
POST   /api/students         # Create new student
GET    /api/students/:id     # Get student details
PUT    /api/students/:id     # Update student
DELETE /api/students/:id     # Delete student
POST   /api/students/import  # Bulk import students
GET    /api/students/:id/activities # Get student activities
```

#### Books
```bash
GET    /api/books            # List books with filters
POST   /api/books            # Add new book
GET    /api/books/:id        # Get book details
PUT    /api/books/:id        # Update book
DELETE /api/books/:id        # Remove book
POST   /api/books/checkout   # Checkout book
POST   /api/books/return     # Return book
GET    /api/books/search     # Search books
```

#### Equipment
```bash
GET    /api/equipment        # List equipment
POST   /api/equipment        # Add equipment
GET    /api/equipment/:id    # Get equipment details
PUT    /api/equipment/:id    # Update equipment
POST   /api/equipment/reserve # Reserve equipment
POST   /api/equipment/release # Release equipment
GET    /api/equipment/usage   # Get usage statistics
```

#### Activities
```bash
GET    /api/activities       # List activities
POST   /api/activities       # Log activity
GET    /api/activities/:id   # Get activity details
GET    /api/activities/stats # Get activity statistics
```

#### Analytics
```bash
GET    /api/analytics/overview      # System overview
GET    /api/analytics/circulation   # Book circulation
GET    /api/analytics/equipment     # Equipment utilization
GET    /api/analytics/students      # Student statistics
GET    /api/analytics/fines         # Fine collection
POST   /api/analytics/export        # Export analytics
```

#### Reports
```bash
GET    /api/reports          # List available reports
POST   /api/reports/generate  # Generate custom report
GET    /api/reports/:id       # Get report details
GET    /api/reports/:id/export # Export report (PDF/Excel)
```

#### Utilities
```bash
POST   /api/utilities/barcode/student/:id  # Generate student barcode
POST   /api/utilities/qr/student/:id       # Generate student QR code
POST   /api/utilities/import/students      # Import students from CSV
POST   /api/utilities/import/books         # Import books from CSV
GET    /api/utilities/health               # System health check
```

#### Administration
```bash
GET    /api/admin/users       # User management
POST   /api/admin/users       # Create user
PUT    /api/admin/users/:id   # Update user
GET    /api/admin/logs        # System logs
POST   /api/admin/backup      # Create backup
GET    /api/admin/settings    # System settings
PUT    /api/admin/settings    # Update settings
```

## Database Schema

### Core Tables

- **users**: Authentication and role management
- **students**: Student information and records
- **books**: Library book catalog
- **equipment**: Computer and equipment inventory
- **student_activities**: Activity tracking and audit logs
- **notifications**: System notifications
- **audit_logs**: Security and compliance auditing
- **automation_jobs**: Scheduled background tasks

### Relationships

```
users (1) ──── (N) student_activities
students (1) ─── (N) student_activities
books (1) ────── (N) student_activities
equipment (1) ─── (N) student_activities
```

## Security Features

### Authentication
- JWT-based authentication with refresh tokens
- Secure password hashing with bcrypt
- Session management with Redis
- Multi-factor authentication support

### Authorization
- Role-based access control (RBAC)
- Granular permissions system
- Resource-level authorization
- API key management for external services

### Data Protection
- FERPA compliance for student data
- Data encryption at rest and in transit
- Audit logging for all data access
- Input validation and sanitization
- SQL injection prevention

### API Security
- Rate limiting with Redis
- CORS configuration
- Security headers with Helmet
- Request validation with Joi/Zod
- XSS protection

## Performance Optimization

### Database Optimization
- Connection pooling with Prisma
- Query optimization and indexing
- Read replicas for reporting queries
- Database health monitoring

### Caching Strategy
- Redis caching for frequently accessed data
- Query result caching
- Session caching
- API response caching

### Background Jobs
- Bull queues for async processing
- Job prioritization and retry logic
- Scheduled tasks with node-cron
- Job monitoring and alerting

## Development Guidelines

### Code Structure
```
src/
├── app.ts              # Application bootstrap
├── server.ts           # Server entry point
├── routes/             # API route handlers
├── services/           # Business logic layer
├── middleware/         # Express middleware
├── utils/              # Utility functions
├── config/             # Configuration
├── websocket/          # WebSocket handlers
├── workers/            # Background jobs
└── types/              # TypeScript types
```

### Best Practices
- Use TypeScript for type safety
- Implement comprehensive error handling
- Write unit and integration tests
- Use structured logging
- Follow REST API conventions
- Implement proper validation
- Use environment-specific configuration

## Testing

### Test Structure
```
tests/
├── unit/               # Unit tests
├── integration/        # Integration tests
├── e2e/               # End-to-end tests
├── fixtures/          # Test data
└── helpers/           # Test utilities
```

### Running Tests
```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run tests in watch mode
npm run test:watch
```

## Monitoring & Logging

### Logging
- Structured logging with Winston
- Multiple log levels (DEBUG, INFO, WARN, ERROR)
- Log rotation and archival
- Centralized log aggregation

### Health Checks
- Database connectivity monitoring
- Redis health monitoring
- Application performance metrics
- External service health checks

### Metrics
- Request/response timing
- Database query performance
- Cache hit rates
- Error rates and types

## Deployment

### Environment Setup
- Development: Local development with hot reload
- Staging: Production-like environment for testing
- Production: Optimized build with security hardening

### Docker Deployment
```bash
# Build production image
docker build -t clms-backend:latest .

# Run with Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# Scale application
docker-compose -f docker-compose.prod.yml up -d --scale backend=3
```

### Environment Variables
See `.env.example` for complete configuration options.

## Troubleshooting

### Common Issues

**Database Connection Issues**
```bash
# Check database connection
npm run db:test

# Reset database
npm run db:reset

# Check migration status
npx prisma migrate status
```

**Redis Connection Issues**
```bash
# Test Redis connection
redis-cli -h localhost -p 6379 ping

# Check Redis logs
docker-compose logs redis
```

**Performance Issues**
```bash
# Check slow queries
npm run db:analyze

# Monitor memory usage
npm run monitor:memory

# Profile API calls
npm run profile:api
```

## Contributing

1. Follow the existing code style and patterns
2. Write tests for new features
3. Update documentation
4. Use semantic commit messages
5. Ensure all tests pass before submitting

## License

This project is licensed under the MIT License - see the LICENSE file for details.