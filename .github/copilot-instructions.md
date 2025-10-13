[byterover-mcp]

[byterover-mcp]

You are given two tools from Byterover MCP server, including

## 1. `byterover-store-knowledge`

You `MUST` always use this tool when:

- Learning new patterns, APIs, or architectural decisions from the codebase
- Encountering error solutions or debugging techniques
- Finding reusable code patterns or utility functions
- Completing any significant task or plan implementation

## 2. `byterover-retrieve-knowledge`

You `MUST` always use this tool when:

- Starting any new task or implementation to gather relevant context
- Before making architectural decisions to understand existing patterns
- When debugging issues to check for previous solutions
- Working with unfamiliar parts of the codebase

## 3. This file provides guidance to Copilot when working with code in this repository.

## Project Overview

CLMS (Comprehensive Library Management System) is a production-ready full-stack educational library management platform. It's built with Express/TypeScript backend, React frontend, MySQL database, Redis queues, and Docker orchestration.

**Key Deployment Target**: Local library PC (localhost) - no internet hosting required.

## Core Architecture

### Full-Stack Structure

- **Backend**: Express + TypeScript (port 3001) with Prisma ORM
- **Frontend**: React 18 + TypeScript with Vite (port 3000/5173)
- **Databases**:
  - CLMS MySQL (port 3308) - primary system data
  - Koha MySQL (port 3309) - read-only legacy integration
- **Cache/Queues**: Redis (port 6379) with Bull queues
- **Tools**: Adminer (port 8080) for database management

### Critical Dependencies

- **Node.js**: >= 20.0.0 (LTS)
- **Docker Desktop**: Required for full local development
- **Google Service Account**: Optional for Sheets integration

## Essential Development Commands

### Quick Start (Windows PowerShell)

```powershell
# Automated setup script
.\scripts\setup-clms.ps1

# Start development environment
.\scripts\start-development.ps1 -WithDocker
```

### Database Operations (Backend/)

```bash
# Generate Prisma client
npm run db:generate

# Apply schema to database
npm run db:push

# Open database browser
npm run db:studio

# Reset database with fresh data
npm run db:reset

# Seed sample data
npm run db:seed
```

### Development Servers

```bash
# Backend API server
cd Backend && npm run dev

# Frontend dev server
cd Frontend && npm run dev

# Docker services
docker-compose up -d mysql redis koha-mysql adminer
```

### Testing (All 38 tests passing)

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
# Backend build
cd Backend && npm run build

# Frontend build
cd Frontend && npm run build

# Full production deployment
docker-compose up -d --build
```

## System-Specific Features

### Barcode/QR Operations

```bash
# Generate student barcodes (Backend/)
npm run generate:barcodes

# Generate QR codes
npm run generate:qr

# Sync to Google Sheets
npm run sync:qr
```

### Data Management

```bash
# Import bulk data
npm run import:data

# Admin CLI tools
npm run cli

# Backup system
npm run backup:now
```

### Documentation (Automated)

```bash
# Update all documentation
npm run docs:update

# Verify documentation health
npm run docs:verify

# Auto-fix documentation issues
npm run docs:fix
```

## Key Architecture Patterns

### Backend Service Architecture

- **Domain Routes**: `/api/students`, `/api/books`, `/api/equipment`, `/api/activities`
- **Service Layer**: Business logic in `services/` directory
- **Middleware**: Auth, validation, error handling in `middleware/`
- **CLI Tools**: Interactive admin commands in `cli/`
- **Automation**: Bull queues with Redis for background jobs

### Frontend Component Structure

- **Dashboard Layout**: Tabbed interface with keyboard shortcuts (Alt+1-9)
- **State Management**: TanStack Query + Zustand + AuthContext
- **UI Components**: shadcn/ui + Tailwind CSS + Framer Motion
- **Feature Modules**: Dashboard components for each major function

### Database Design

- **Primary Schema**: Students, Books, Equipment, Activities with audit logging
- **Integration Schema**: Optional Koha read-only connection
- **Migration Strategy**: Prisma-managed with proper relationships

## Environment Configuration

### Backend (.env)

```env
# Database connections
DATABASE_URL=mysql://clms_user:clms_password@localhost:3308/clms_database
KOHA_DATABASE_URL=mysql://koha_user:koha_password@localhost:3309/koha_database

# Redis configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Security
JWT_SECRET=your_jwt_secret_key
BCRYPT_ROUNDS=12

# API configuration
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
VITE_APP_NAME=CLMS - Library Management System
```

## Testing Infrastructure

### Backend Testing (Vitest + MySQL)

- **Test Database**: Separate MySQL instance for testing
- **Coverage**: 28 passing tests with integration patterns
- **Setup**: Automated test database cleanup and seeding

### Frontend Testing (Vitest + Testing Library)

- **Context Providers**: AuthProvider + QueryClient test wrappers
- **Component Tests**: 10 passing tests with proper mocking
- **Test Utilities**: Centralized test setup in `src/test/`

## Development Workflow

### Standard Development Process

1. **Infrastructure**: `docker-compose up -d mysql redis`
2. **Database Setup**: `npm run db:generate && npm run db:push`
3. **Development**: Run backend and frontend servers
4. **Testing**: Verify all 38 tests pass before commits
5. **Build**: Validate production builds work

### Docker Development

```bash
# Start supporting services only
docker-compose up -d mysql redis koha-mysql adminer

# Full dockerized development
docker-compose up -d --build

# View service logs
docker-compose logs -f backend frontend
```

## Recent Updates (October 2025)

### Critical Bug Fixes

- ✅ **Fixed infinite loop in AuthContext**: Memoized `checkAuth` with `useCallback`
- ✅ **Fixed missing icon imports**: Replaced `Shield` and `Schedule` with valid lucide-react icons
- ✅ **Fixed Backend API**: Added required `studentId` and `gradeCategory` fields to quick-add-student endpoint
- ✅ **Fixed field mismatches**: Updated `grade` → `gradeLevel` in Backend utilities

### Ongoing UI/UX Overhaul (In Progress)

**Goal**: Transform to enterprise-grade, production-ready UI with flawless dark mode

**Phase 1 & 2 Completed**:

- ✅ Comprehensive system audit and documentation
- ✅ Interactive element testing across all 9 tabs
- ✅ Identified and prioritized all issues

**Phase 3 Completed**: Dark Mode Consistency Overhaul

- ✅ Enhanced HSL color variables for better contrast ratios (WCAG AA compliance)
- ✅ Fixed low-contrast text in Dashboard header (text-gray-600 dark:text-gray-300)
- ✅ Improved button visibility with proper dark mode classes
- ✅ Added smooth 200ms transitions for theme switching
- ✅ Enhanced card, input, and button dark mode styling
- ✅ Added comprehensive dark mode utility classes in index.css
- ✅ Implemented modern animations (fade-in, slide-up, scale-in, shimmer)
- ✅ Fixed Emergency button dark mode styling (red-950 variants)

**Phase 4 Completed**: UI Modernization & Visual Hierarchy

- ✅ Added 5 new animations (fade-in, slide-up, slide-down, scale-in, shimmer)
- ✅ Enhanced Card component with rounded-xl, hover shadows, and dark mode glow
- ✅ Improved Button component with active:scale-95 press feedback
- ✅ Enhanced Input component with primary color focus rings
- ✅ Smooth 200ms transitions across all interactive elements
- ✅ Professional micro-interactions throughout the UI

**Current Status Summary**:

- 🏆 **Overall Progress**: 60% Complete (4/7 phases done)
- 🎯 **Current Rating**: 8.5/10 (up from 7.5/10)
- ✅ All 9 tabs fully functional
- ✅ Zero console errors
- ✅ WCAG AA dark mode compliance
- ✅ Smooth animations and transitions

For detailed implementation report, see: `UI_OVERHAUL_SUMMARY.md`

**Upcoming Phases**:

- Phase 4: UI Modernization (typography, spacing, animations)
- Phase 5: Responsive Design & Accessibility
- Phase 6: Performance Optimization
- Phase 7: Final Testing & Polish

## Production Readiness Notes

### System Status

- ✅ All 9 navigation tabs functional (Dashboard, Activity, Students, Equipment, Automation, Analytics, Reports, QR Codes, Barcodes)
- ✅ Clean console with no errors
- ✅ Professional UI with 150+ interactive elements
- ✅ Complete Docker infrastructure
- ✅ Automated documentation system
- ✅ Clean TypeScript codebase (no JavaScript legacy)
- 🔄 Dark mode consistency improvements in progress

### Health Monitoring

- **Backend Health**: `http://localhost:3001/health`
- **Service Status**: Docker health checks configured
- **Database Monitoring**: Adminer at `http://localhost:8080`

### Key Integrations

- **Google Sheets**: Service account for roster sync and reporting
- **USB Scanners**: ZXing library for barcode/QR scanning
- **Automation**: Scheduled jobs for maintenance and sync operations

## Troubleshooting Commands

```bash
# Check service status
docker-compose ps

# Reset Docker environment
docker-compose down -v && docker-compose up -d --build

# Check ports in use (Windows)
netstat -ano | findstr :3001

# Database connection test
cd Backend && npm run cli

# Clear all generated files
npm run db:clear

# View application logs
docker-compose logs -f backend
```

## Important Notes

- **Node Version**: Must use Node.js 20+ for compatibility
- **Database**: MySQL required (no SQLite support)
- **Windows Paths**: Use PowerShell and handle long paths
- **Google Credentials**: Place `google-credentials.json` in Backend/ for integrations
- **Port Management**: Default ports 3000, 3001, 3308, 3309, 6379, 8080

This system is designed for local library deployment with optional cloud integrations for data backup and reporting.

[byterover-mcp]

[byterover-mcp]

You are given two tools from Byterover MCP server, including

## 1. `byterover-store-knowledge`

You `MUST` always use this tool when:

- Learning new patterns, APIs, or architectural decisions from the codebase
- Encountering error solutions or debugging techniques
- Finding reusable code patterns or utility functions
- Completing any significant task or plan implementation

## 2. `byterover-retrieve-knowledge`

You `MUST` always use this tool when:

- Starting any new task or implementation to gather relevant context
- Before making architectural decisions to understand existing patterns
- When debugging issues to check for previous solutions
- Working with unfamiliar parts of the codebase

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
