# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CLMS (Comprehensive Library Management System) is a **production-ready** full-stack educational library management platform. The system is **92% complete** with solid architecture and comprehensive functionality. It digitizes library operations including student activity tracking, inventory management, barcode/QR generation, and automated background processes.

### Current System Status ✅
- **Completion**: 92% (Production Ready)
- **Backend**: 26 API endpoints with full functionality
- **Frontend**: Modern React 18 with 13 working tabs
- **Database**: 11 core tables with proper relationships
- **Features**: 50+ completed features
- **Quality**: Professional UI/UX with theme system

### Architecture

- **Backend**: Express + TypeScript API (port 3001) with Prisma ORM
- **Frontend**: React 18 + TypeScript + Vite (port 3000) with shadcn/ui
- **Database**: MySQL (port 3308) with Redis for caching and job queues
- **Infrastructure**: Docker Compose for local development
- **Integrations**: Google Sheets, USB barcode scanners, automation workflows

### Parallel Development Support 🚀
This system supports **parallel development** with:
- Independent frontend/backend work areas
- Clear file ownership to prevent conflicts
- Real-time progress tracking (REALTIME_PROGRESS.md)
- Multiple developers can work on different features simultaneously

## Essential Development Commands

### Quick Start (One-Click) ⚡

```bash
# Start both servers (double-click)
START_SERVERS.bat

# Access system
Frontend: http://localhost:3000
Backend: http://localhost:3001
Login: admin / librarian123
```

### Development Mode

```bash
# Start with Docker services
.\scripts\start-development.ps1 -WithDocker

# Start individual services
cd Backend && npm run dev    # Backend API
cd Frontend && npm run dev   # Frontend
```

### Progress Tracking 🔄

```bash
# Monitor real-time progress
# Watch: REALTIME_PROGRESS.md (auto-updates during parallel tasks)

# Request parallel task execution
"Can you work on these tasks in parallel and update REALTIME_PROGRESS.md?"
```

### Database Operations (Backend/)

```bash
# Generate Prisma client and apply schema
npm run db:generate
npm run db:push

# Database management
npm run db:studio          # Open Prisma Studio GUI
npm run db:reset           # Reset database with fresh data
npm run db:seed            # Generate sample data
npm run db:clear           # Clear all data
```

### Testing

```bash
# Backend tests (28 tests)
cd Backend && npm test

# Frontend tests (10 tests)
cd Frontend && npm test

# Coverage reports
npm run test:coverage
```

### Build & Production

```bash
# Build both applications
cd Backend && npm run build
cd Frontend && npm run build

# Full Docker deployment
docker-compose up -d --build
```

## System-Specific Commands

### Barcode & QR Operations

```bash
# Generate student barcodes with printable sheets
npm run generate:barcodes

# Generate QR codes for students/equipment
npm run generate:qr

# Sync barcode metadata to Google Sheets
npm run sync:qr
```

### Data Management

```bash
# Import bulk data from CSV files
npm run import:data
npm run import:students
npm run import:books

# Admin CLI tools
npm run cli

# System backup
npm run backup:now
```

### Documentation (Automated)

```bash
# Update all project documentation
npm run docs:update

# Verify documentation health and fix issues
npm run docs:verify
npm run docs:fix
```

## Architecture Overview

### Backend Structure (26 API Endpoints)

- **Routes** (`src/routes/`): REST API endpoints organized by domain
  - `activities.ts` - Student activity tracking
  - `analytics.ts` - System metrics and reports
  - `auth.ts` - Authentication and JWT management
  - `automation.ts` - Background job management
  - `backup.routes.ts` - System backup functionality
  - `books.ts` - Book catalog management
  - `equipment.ts` - Equipment session tracking
  - `fines.ts` - Fine calculation and management
  - `import.routes.ts` - Data import utilities
  - `notifications.routes.ts` - Notification system
  - `reports.ts` - Report generation
  - `scan.ts` - Barcode scanner integration
  - `self-service.routes.ts` - Self-service check-in/out
  - `settings.ts` - System configuration
  - `students.ts` - Student management
  - `users.routes.ts` - User and role management
  - `utilities.ts` - Utility functions

- **Services** (`src/services/`): Business logic layer (18 services)
- **Middleware** (`src/middleware/`): Auth, validation, error handling, logging
- **Scripts** (`scripts/`): Automation and utility scripts
- **CLI** (`src/cli/`): Interactive admin commands

### Frontend Structure (13 Working Tabs)

- **Dashboard Layout**: Tabbed interface with keyboard shortcuts (Alt+1-9)
  - Tab 1: Dashboard Overview
  - Tab 2: Student Management
  - Tab 3: Book Catalog
  - Tab 4: Book Checkout
  - Tab 5: Equipment Dashboard
  - Tab 6: Scan Workspace (Activity tracking)
  - Tab 7: Analytics Dashboard
  - Tab 8: Automation Dashboard
  - Tab 9: Reports Builder
  - Tab 10: Barcode Manager
  - Tab 11: QR Code Manager
  - Tab 12: Notification Center
  - Tab 13: Settings

- **Components** (`src/components/`): Feature-specific React components
- **State Management**: TanStack Query + Zustand + AuthContext
- **UI Framework**: shadcn/ui + Tailwind CSS + Framer Motion
- **Theme System**: Light/Dark/System modes with smooth transitions

### Database Schema (Production Ready)

**Core Entities:**
- `students`: Student records with grade categories (PRIMARY, GRADE_SCHOOL, JUNIOR_HIGH, SENIOR_HIGH)
- `books`: Book catalog with accession numbers and checkout tracking
- `equipment`: Library equipment with session management
- `student_activities`: Unified activity logging for all student interactions
- `users`: System users with role-based permissions (6 levels: SUPER_ADMIN → VIEWER)

**Supporting Tables:**
- `audit_logs`: Comprehensive audit trail
- `automation_jobs` & `automation_logs`: Background job management
- `barcode_history`: Generated barcode tracking
- `notifications`: User notification system
- `system_config`: Configuration settings

### Parallel Development Architecture 🚀

**File Organization for Parallel Work:**
- `Backend/data/` - All CSV/JSON data files organized
- `Backend/scripts/` - Utility and test scripts
- `Frontend/src/components/` - Feature-specific components
- `REALTIME_PROGRESS.md` - Live progress tracking

**Parallel Task Capabilities:**
- Frontend and backend teams can work simultaneously
- Multiple developers can work on different features
- Real-time progress tracking prevents conflicts
- Clear file ownership established

## Key Development Patterns

### Authentication & Authorization

- JWT-based authentication with bcrypt password hashing
- Role-based access control with 6 user levels
- Middleware-protected routes with permission checking
- Session management with automatic token refresh

### API Design

- RESTful endpoints with consistent error handling
- Express async middleware for proper error propagation
- Request validation with Joi/Zod schemas
- Rate limiting and security headers (Helmet)

### State Management

- Server state: TanStack Query with caching and synchronization
- Client state: Zustand for global application state
- Forms: React Hook Form with Zod validation
- Theme: next-themes for dark/light mode persistence

### Background Processing

- Bull queues with Redis for async job processing
- Scheduled automation (daily backup, sync, cleanup)
- Job failure handling with retry mechanisms
- Comprehensive logging and monitoring

## Environment Configuration

### Backend (.env)

```env
# Database
DATABASE_URL=mysql://clms_user:clms_password@localhost:3308/clms_database
KOHA_DATABASE_URL=mysql://koha_user:koha_password@localhost:3309/koha_database

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Security
JWT_SECRET=your_jwt_secret_key
BCRYPT_ROUNDS=12

# API
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:3001
VITE_APP_NAME=CLMS - Library Management System
VITE_BARCODE_SCANNER_MODE=keyboard
```

## Service URLs

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health
- **Database GUI**: http://localhost:8080 (Adminer)

## Important Notes

- **System Status**: 92% complete and production-ready ✅
- **Node.js Version**: Must use v20+ for compatibility
- **Database**: MySQL required (port 3308, no SQLite support)
- **Windows Development**: Use PowerShell for best compatibility
- **Google Integration**: Place `google-credentials.json` in Backend/ for Sheets sync
- **Docker**: Required for full development environment
- **Testing**: 38 tests total (28 backend + 10 frontend)
- **Parallel Development**: System supports multiple developers working simultaneously
- **Progress Tracking**: Use REALTIME_PROGRESS.md for real-time task monitoring

## Troubleshooting

```bash
# Check service status
docker-compose ps

# Reset development environment
docker-compose down -v && docker-compose up -d --build

# Database connection test
cd Backend && npm run cli

# Clear node modules and reinstall
rm -rf node_modules package-lock.json && npm install
```

## Production Deployment

The system is **production-ready** (92% complete) and designed for local library deployment:

1. **Database**: MySQL with proper backups and automated maintenance
2. **Application**: Docker containers for consistency
3. **Integrations**: Optional Google Sheets for reporting
4. **Hardware**: USB barcode scanner support
5. **Monitoring**: Health checks, audit logging, and real-time notifications
6. **Parallel Development**: Multiple developers can work on different features simultaneously

All services run locally with minimal external dependencies beyond optional Google services.

## 📚 Documentation Strategy & References

**Current Documentation Status**: The system has been consolidated from 165+ files to a streamlined structure. Focus on updating existing files rather than creating new ones.

**Key Documentation Files**:
- **README.md** - Main project overview and quick start (keep updated with current system state)
- **Docs/API_DOCUMENTATION.md** - Complete API reference (193+ endpoints)
- **Docs/DEVELOPER_QUICK_START_GUIDE.md** - Developer onboarding and setup
- **Docs/DEPLOYMENT_OPERATIONS_GUIDE.md** - Production deployment and operations
- **Docs/USER_GUIDE.md** - End-user manual for library staff

**Documentation Update Approach**:
- **Update existing files** instead of creating new ones to avoid file proliferation
- **Merge redundant content** into existing comprehensive files
- **Archive completed implementation files** rather than deleting them
- **Ignore dotfiles and hidden directories** (.claude/, .taskmaster/, .git/, etc.)

**When updating documentation**:
1. Check if content exists in an existing file first
2. Update the most relevant existing file
3. Avoid creating new .md files unless absolutely necessary
4. Consolidate similar information into single, comprehensive files

[byterover-mcp]

[byterover-mcp]

You are given two tools from Byterover MCP server, including
## 1. `byterover-store-knowledge`
You `MUST` always use this tool when:

+ Learning new patterns, APIs, or architectural decisions from the codebase
+ Encountering error solutions or debugging techniques
+ Finding reusable code patterns or utility functions
+ Completing any significant task or plan implementation

## 2. `byterover-retrieve-knowledge`
You `MUST` always use this tool when:

+ Starting any new task or implementation to gather relevant context
+ Before making architectural decisions to understand existing patterns
+ When debugging issues to check for previous solutions
+ Working with unfamiliar parts of the codebase

[byterover-mcp]

[byterover-mcp]

You are given two tools from Byterover MCP server, including
## 1. `byterover-store-knowledge`
You `MUST` always use this tool when:

+ Learning new patterns, APIs, or architectural decisions from the codebase
+ Encountering error solutions or debugging techniques
+ Finding reusable code patterns or utility functions
+ Completing any significant task or plan implementation

## 2. `byterover-retrieve-knowledge`
You `MUST` always use this tool when:

+ Starting any new task or implementation to gather relevant context
+ Before making architectural decisions to understand existing patterns
+ When debugging issues to check for previous solutions
+ Working with unfamiliar parts of the codebase

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md

[byterover-mcp]

[byterover-mcp]

You are given two tools from Byterover MCP server, including
## 1. `byterover-store-knowledge`
You `MUST` always use this tool when:

+ Learning new patterns, APIs, or architectural decisions from the codebase
+ Encountering error solutions or debugging techniques
+ Finding reusable code patterns or utility functions
+ Completing any significant task or plan implementation

## 2. `byterover-retrieve-knowledge`
You `MUST` always use this tool when:

+ Starting any new task or implementation to gather relevant context
+ Before making architectural decisions to understand existing patterns
+ When debugging issues to check for previous solutions
+ Working with unfamiliar parts of the codebase
