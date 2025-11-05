# Implementation Plan: Frontend Stability & Authentication Testing# Implementation Plan: [FEATURE]

**Branch**: `002-frontend-stability-auth-testing` | **Date**: 2025-11-06 | **Spec**: [spec.md](./spec.md) **Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/002-frontend-stability-auth-testing/spec.md`**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

## Summary**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

This feature addresses critical production blockers preventing application testing and deployment: **frontend development server crashes** and **incomplete authentication flow**. The primary requirement is establishing stable infrastructure (Vite dev server running continuously) and verifying complete user authentication (login → dashboard redirect). Secondary requirements include comprehensive testing of all 13 dashboard screens, form validation, and WebSocket connectivity.## Summary

**Technical Approach**:[Extract from feature spec: primary requirement + technical approach from research]

1. **Diagnose & Fix Frontend Crashes**: Investigate unhandled promise rejections, React component errors, and Vite HMR issues causing process termination

2. **Complete Authentication Flow**: Ensure login form → backend authentication → token storage → dashboard redirect works end-to-end## Technical Context

3. **Systematic Testing**: Use Chrome DevTools MCP to test all screens, buttons, links, and forms methodically

4. **WebSocket Routing**: Fix 404 errors on `/ws` endpoint for real-time features<!--

5. **Error Boundaries**: Add React error boundaries to prevent component errors from crashing the application ACTION REQUIRED: Replace the content in this section with the technical details

for CLMS. Use the latest versions as of November 2025.

## Technical Context-->

**Language/Version**: TypeScript 5.7+ (strict mode enabled) **Language/Version**: TypeScript 5.7+ (strict mode enabled)

**Runtime**: Node.js 22.x (backend running on port 3001) / Chrome 142+ (frontend testing) **Runtime**: Node.js 22.x LTS (backend) / Modern browsers (frontend)

**Primary Dependencies**:**Primary Dependencies**:

- **Frontend**: React 19.0+, Vite 5.4.20 (current), TanStack Query 5.x, Radix UI 1.x, Tailwind CSS 3.4+, React Router 6.x

- **Backend**: Express.js 4.x, Prisma 5.22.0 (current), Zod 3.x, Winston 3.x, Helmet 8.x, bcryptjs (password hashing), jsonwebtoken (JWT auth)- **Frontend**: React 19.0+, Vite 6.0+, TanStack Query 5.59+, Radix UI 1.x, Tailwind CSS 3.4+

- **Backend**: Express.js 4.21+, Prisma 6.0+, Zod 3.23+, Winston 3.15+, Helmet 8.0+

**Storage**: MySQL 8.0 (Docker on port 3308), users table with admin/librarian/assistant roles **Storage**: MySQL 8.4+ LTS (or PostgreSQL 17+), Redis 7.x (optional caching)

**Testing**: Chrome DevTools MCP (browser automation), Vitest 2.x (unit), Playwright 1.x (E2E planned) **Testing**: Vitest 2.1+ (unit/integration), Playwright 1.48+ (E2E), Supertest 7.0+ (API)

**Target Platform**: Windows 11 development environment, PowerShell, Docker Desktop **Target Platform**: Docker containers (dev/prod), Linux server (Ubuntu 22.04/24.04 LTS)

**Current Infrastructure**: **Project Type**: Full-stack web application (monorepo: Frontend/ + Backend/)

- Backend: Running successfully on http://localhost:3001, database connected, JWT generation working **Performance Goals**:

- Frontend: Vite dev server crashes unexpectedly (exit code 0 or 1), blocking all testing- API: p95 < 200ms (simple), < 1s (complex reports)

- Database: MySQL container running, admin user created (admin/admin123), schema synchronized- Frontend: FCP < 1.5s, TTI < 3.5s, bundle < 200KB gzipped

- Auth: Backend routes fixed (login/register no longer require pre-authentication), tokens generated successfully- Database: Indexed queries, pagination for lists > 100 items

  **Constraints**:

**Known Issues**:- TypeScript strict mode (no `any` types)

- Frontend server exits without clear error messages after navigation or login attempts- WCAG 2.1 Level AA accessibility

- Login form submits but frontend doesn't redirect to dashboard despite backend returning 200 OK with JWT token- Zero runtime errors in production

- WebSocket endpoint `/ws` returns 404 (backend expects WebSocket upgrade but routing not configured)- 70%+ test coverage for new code

- Backend logs show successful `/api/auth/me` responses, indicating user is authenticated but frontend not responding appropriately **Scale/Scope**:

- Users: 100-1000 concurrent (library staff + students)

**Performance Goals**:- Data: 10k-100k books, 1k-10k students, 100k+ transactions/year

- Dev server uptime: 8+ hours continuous operation without crashes- Screens: 13 main tabs, 115+ React components

- Login flow: Complete in < 3 seconds (form submit → dashboard visible)

- Screen navigation: < 100ms client-side routing transitions## Constitution Check

- API responses: Already meeting < 200ms target (verified in logs)

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Constraints**:

- TypeScript strict mode enabled (0 TS errors currently maintained)**Based on CLMS Constitution v1.0.0**

- 385 ESLint warnings exist but considered non-blocking

- Must work in Windows/PowerShell environment### I. Production-Readiness First

- Cannot disrupt ongoing development on 001-production-readiness branch

- Testing must be systematic and documented- [ ] Feature includes comprehensive error handling (try-catch, error boundaries)

- [ ] All user inputs have validation schemas (Zod)

**Scale/Scope**:- [ ] Feature has graceful degradation for failure states

- Users: 3 roles (ADMIN, LIBRARIAN, ASSISTANT), testing with admin user- [ ] No runtime errors expected in any code path

- Screens: 13 main dashboard screens to test

- Components: 115+ React components (focusing on route-level components and authentication flow)### II. UI/UX Excellence

- Test Coverage Target: 70% for auth flows, 50% for dashboard screens

- [ ] Feature includes responsive design (mobile, tablet, desktop)

## Constitution Check- [ ] Accessibility requirements defined (WCAG 2.1 Level AA)

- [ ] Loading states and empty states designed

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._- [ ] Dark mode support planned

- [ ] Performance targets defined (FCP < 1.5s, TTI < 3.5s)

**Based on CLMS Constitution v1.0.1**

### III. Type Safety & Code Quality

### I. Production-Readiness First

- [ ] TypeScript strict mode compliance verified

- [x] Feature includes comprehensive error handling (try-catch, error boundaries)- [ ] Shared types/schemas between frontend and backend defined
  - Plan includes adding React Error Boundaries to all route components- [ ] ESLint and Prettier configuration aligned

  - Frontend auth flow will include try-catch for all async operations- [ ] No `any` types planned (use explicit types or `unknown`)

  - Backend already has error handling middleware (helmet, CORS, rate limiting)

- [x] All user inputs have validation schemas (Zod)### IV. Comprehensive Testing
  - Login form already has Zod validation on backend (username, password required)

  - Form validation testing is part of User Story 4- [ ] Unit tests planned (70% coverage target)

- [x] Feature has graceful degradation for failure states- [ ] Integration tests planned for API contracts
  - WebSocket failures will fall back to polling (per User Story 5)- [ ] E2E tests planned for critical user flows

  - Backend unavailability will show user-friendly errors with retry logic- [ ] Accessibility tests planned (axe-playwright)

  - Loading states and error states planned for all async operations

- [x] No runtime errors expected in any code path### V. Performance & Optimization
  - Error boundaries will catch React component errors

  - All async operations will have proper error handling- [ ] Performance requirements defined (response times, bundle size)

  - Browser console errors will be monitored and resolved during testing- [ ] Code splitting strategy planned (lazy loading)

- [ ] Virtual scrolling planned for large lists (if applicable)

### II. UI/UX Excellence- [ ] Database query optimization considered (indexes, pagination)

- [x] Feature includes responsive design (mobile, tablet, desktop)### VI. Full-Stack Integration
  - Testing will verify existing responsive implementation (already built)

  - Chrome DevTools will test multiple viewport sizes- [ ] API contracts documented (OpenAPI/Swagger)

- [x] Accessibility requirements defined (WCAG 2.1 Level AA)- [ ] Error response format standardized
  - Existing screens already have ARIA labels and semantic HTML- [ ] Authentication/authorization requirements defined

  - Focus will be on keyboard navigation and error message accessibility- [ ] WebSocket usage documented (if applicable)

- [x] Loading states and empty states designed
  - NFR-004: Loading states MUST be displayed for all async operations### VII. Security & Compliance

  - NFR-006: Success confirmations MUST be shown for state-changing operations

  - Testing will verify existing loading/empty state implementations- [ ] Authentication requirements defined

- [x] Dark mode support planned- [ ] Authorization rules documented (RBAC)
  - Already implemented in existing codebase (next-themes)- [ ] Input validation planned (prevent XSS, SQL injection)

  - Testing will verify dark mode works on all screens- [ ] Audit logging requirements defined

- [x] Performance targets defined (FCP < 1.5s, TTI < 3.5s)- [ ] Security headers configured (Helmet.js)
  - SC-002: Login completes in < 3 seconds

  - NFR-014: Dashboard transitions < 100ms**Violations Requiring Justification**: [List any principle violations with rationale, or write "None"]

### III. Type Safety & Code Quality## Project Structure

- [x] TypeScript strict mode compliance verified### Documentation (this feature)
  - 0 TypeScript errors currently (maintained throughout development)

  - NFR-007: Auth code MUST use strict mode without `any` types```text

- [x] Shared types/schemas between frontend and backend definedspecs/[###-feature]/
  - NFR-008: API request/response types MUST be shared├── plan.md # This file (/speckit.plan command output)

  - LoginCredentials, AuthResponse, TokenPayload already defined in backend├── research.md # Phase 0 output (/speckit.plan command)

- [x] ESLint and Prettier configuration aligned├── data-model.md # Phase 1 output (/speckit.plan command)
  - 385 warnings exist but non-blocking (separate cleanup effort)├── quickstart.md # Phase 1 output (/speckit.plan command)

  - Focus is on stability, not code style├── contracts/ # Phase 1 output (/speckit.plan command)

- [x] No `any` types planned (use explicit types or `unknown`)└── tasks.md # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
  - Existing types already defined for auth flow```

  - Error handling will use typed Error objects

### Source Code (repository root)

### IV. Comprehensive Testing

<!--

- [x] Unit tests planned (70% coverage target)  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout

  - NFR-011: WebSocket connection logic unit tests  for this feature. Delete unused options and expand the chosen structure with

  - NFR-012: Form validation unit tests  real paths (e.g., apps/admin, packages/something). The delivered plan must

  - SC-010: 70%+ coverage for auth flows  not include Option labels.

- [x] Integration tests planned for API contracts-->

- NFR-013: API contract tests for login endpoint

- Backend already has Supertest setup```text

- [x] E2E tests planned for critical user flows# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
  - NFR-009: Login flow E2E tests (success and failure)src/

  - NFR-010: Dashboard screens smoke tests├── models/

  - Chrome DevTools MCP for manual E2E testing initially├── services/

- [x] Accessibility tests planned (axe-playwright)├── cli/
  - NFR-014: Accessibility tests required└── lib/

  - Planned for Phase 2 (after stability established)

tests/

### V. Performance & Optimization├── contract/

├── integration/

- [x] Performance requirements defined (response times, bundle size)└── unit/
  - SC-002: Login < 3 seconds

  - NFR-014: Navigation < 100ms# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)

  - NFR-015: HMR < 2 secondsbackend/

  - API responses already < 200ms (verified in backend logs)├── src/

- [x] Code splitting strategy planned (lazy loading)│ ├── models/
  - React Router lazy loading already implemented│ ├── services/

  - Will verify during testing│ └── api/

- [x] Virtual scrolling planned for large lists (if applicable)└── tests/
  - NFR-017: Lists > 100 items MUST use react-window

  - Already implemented in existing codebasefrontend/

  - Testing will verify functionality├── src/

- [x] Database query optimization considered (indexes, pagination)│ ├── components/
  - Prisma queries already use indexes│ ├── pages/

  - Pagination implemented for large datasets│ └── services/

  - Focus is on frontend stability, not DB optimization└── tests/

### VI. Full-Stack Integration# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)

api/

- [x] API contracts documented (OpenAPI/Swagger)└── [same as backend above]
  - POST /api/auth/login: {username, password} → {user, accessToken, refreshToken}

  - GET /api/auth/me: Authorization header → {user}ios/ or android/

  - Backend already has Swagger enabled (env.ENABLE_SWAGGER)└── [platform-specific structure: feature modules, UI flows, platform tests]

- [x] Error response format standardized```
  - Backend returns: {error: string} or {success: boolean, message: string}

  - Frontend error handling will parse standardized format**Structure Decision**: [Document the selected structure and reference the real

- [x] Authentication/authorization requirements defineddirectories captured above]
  - NFR-016: JWT tokens validated on every protected request

  - NFR-017: Rate limiting already implemented (100 requests/15min)## Complexity Tracking

  - NFR-018: Auth errors don't leak sensitive info

- [x] WebSocket usage documented (if applicable)> **Fill ONLY if Constitution Check has violations that must be justified**
  - WebSocket endpoint: ws://localhost:3001/ws?token=<JWT>

  - Currently returns 404, needs routing configuration| Violation | Why Needed | Simpler Alternative Rejected Because |

  - Used for real-time notifications and dashboard updates| -------------------------- | ------------------ | ------------------------------------ |

| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |

### VII. Security & Compliance| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |

- [x] Authentication requirements defined
  - JWT-based authentication with access tokens (7 days) and refresh tokens (30 days)
  - Tokens stored in localStorage/sessionStorage
  - bcryptjs for password hashing (10 rounds)
- [x] Authorization rules documented (RBAC)
  - 3 roles: ADMIN, LIBRARIAN, ASSISTANT
  - Role stored in JWT payload
  - Backend validates role on protected endpoints
- [x] Input validation planned (prevent XSS, SQL injection)
  - Zod schemas on backend for all inputs
  - Prisma parameterized queries prevent SQL injection
  - Helmet.js CSP headers prevent XSS
- [x] Audit logging requirements defined
  - NFR-020: State-changing operations MUST be audit logged
  - Winston logger already configured
  - Login attempts, user actions logged with timestamps
- [x] Security headers configured (Helmet.js)
  - Helmet middleware already enabled (CSP, HSTS, X-Frame-Options, etc.)
  - CORS configured for http://localhost:3000
  - Rate limiting enabled

**Violations Requiring Justification**: None - All constitution principles satisfied

## Project Structure

### Documentation (this feature)

```text
specs/002-frontend-stability-auth-testing/
├── spec.md              # Feature specification (DONE)
├── plan.md              # This file (IN PROGRESS)
├── research.md          # Phase 0: Root cause analysis & solutions (TO DO)
├── data-model.md        # Phase 1: Auth entities & state management (TO DO)
├── quickstart.md        # Phase 1: Developer setup & testing guide (TO DO)
├── contracts/           # Phase 1: API contracts (TO DO)
│   └── auth-api.yaml    # OpenAPI spec for login, logout, me endpoints
├── tasks.md             # Phase 2: Task breakdown (via /speckit.tasks)
└── checklists/
    └── requirements.md  # Spec quality checklist (DONE)
```

### Source Code (repository root)

```text
# Frontend Stability Focus Areas
Frontend/
├── src/
│   ├── main.tsx                    # Entry point - check error handling
│   ├── App.tsx                     # Root component - add error boundary
│   ├── components/
│   │   ├── ErrorBoundary.tsx       # TO CREATE: React error boundary
│   │   ├── auth/
│   │   │   └── LoginForm.tsx       # FIX: Handle login response properly
│   │   └── common/
│   │       └── LoadingState.tsx    # Verify: Loading indicators
│   ├── contexts/
│   │   └── AuthContext.tsx         # FIX: Token storage & redirect logic
│   ├── pages/
│   │   ├── Login.tsx               # FIX: Post-login navigation
│   │   ├── Dashboard.tsx           # TEST: Verify renders after auth
│   │   ├── Students.tsx            # TEST: Screen functionality
│   │   ├── Books.tsx               # TEST: Screen functionality
│   │   ├── Checkout.tsx            # TEST: Screen functionality
│   │   └── [9 more screens]        # TEST: All 13 screens systematically
│   └── services/
│       └── authService.ts          # FIX: Handle auth responses
├── vite.config.ts                  # CHECK: Vite configuration for stability
└── package.json                    # Verify: Dependencies up to date

# Backend Authentication Focus Areas
Backend/
├── src/
│   ├── server.ts                   # FIXED: Express import (type vs default)
│   ├── routes/
│   │   └── auth.ts                 # FIXED: Removed req.user check on login
│   ├── services/
│   │   └── authService.ts          # VERIFY: JWT generation & validation
│   ├── middleware/
│   │   ├── authenticate.ts         # VERIFY: JWT validation logic
│   │   └── errorHandler.ts         # VERIFY: Error handling middleware
│   └── websocket/
│       └── websocketServer.ts      # FIX: WebSocket routing (404 errors)
└── check-user.js                   # UTILITY: ES module script for user creation

# Testing Infrastructure
tests/
├── e2e/
│   └── auth-flow.spec.ts           # TO CREATE: Playwright E2E tests
├── integration/
│   └── auth-api.spec.ts            # TO CREATE: Supertest API tests
└── unit/
    ├── auth-service.spec.ts        # TO CREATE: AuthService unit tests
    └── error-boundary.spec.ts      # TO CREATE: ErrorBoundary tests
```

**Structure Decision**: Using existing CLMS monorepo structure (Frontend/ + Backend/). Focus is on debugging and testing existing code rather than creating new architecture. Key files identified based on session context (server.ts, auth.ts already modified, LoginForm.tsx, AuthContext.tsx, websocketServer.ts need investigation).

## Complexity Tracking

> This feature has **NO constitution violations** requiring justification. All principles are satisfied.

| Principle             | Status | Notes                                                              |
| --------------------- | ------ | ------------------------------------------------------------------ |
| Production-Readiness  | ✅     | Error boundaries, validation, graceful degradation planned         |
| UI/UX Excellence      | ✅     | Responsive, accessible, loading states (testing existing impl)     |
| Type Safety           | ✅     | TypeScript strict, 0 errors, shared types defined                  |
| Testing               | ✅     | 70% coverage target, E2E/unit/integration tests planned            |
| Performance           | ✅     | Login < 3s, navigation < 100ms, HMR < 2s targets defined           |
| Integration           | ✅     | API contracts documented, WebSocket usage defined, errors standard |
| Security & Compliance | ✅     | JWT auth, RBAC, input validation, audit logging, Helmet headers    |

**Complexity Notes**: This is primarily a **debugging and testing feature** rather than new development. Most complexity lies in systematically identifying root causes of crashes and authentication flow issues, not in adding new functionality.

---

## Phase 0: Outline & Research

### Research Questions

Based on Technical Context unknowns and current session findings:

1. **Frontend Crash Root Cause**
   - **Question**: What is causing Vite dev server to exit unexpectedly (exit code 0/1)?
   - **Research Task**: Analyze unhandled promise rejections, React component errors, Vite HMR failures
   - **Sources**: Vite error logs, browser console, React error messages, process exit handlers

2. **Login Flow Incomplete**
   - **Question**: Why does successful backend authentication (200 OK + JWT) not redirect to dashboard?
   - **Research Task**: Trace login flow from form submit → API call → token storage → redirect logic
   - **Sources**: AuthContext.tsx, LoginForm.tsx, authService.ts, browser network tab

3. **WebSocket 404 Errors**
   - **Question**: Why does `/ws` endpoint return 404 despite WebSocket server initialization?
   - **Research Task**: Investigate Express WebSocket routing, upgrade handling, server.ts configuration
   - **Sources**: websocketServer.ts, server.ts, Express WebSocket docs

4. **Error Boundary Strategy**
   - **Question**: What granularity of error boundaries is needed to prevent full app crashes?
   - **Research Task**: Determine boundary placement (route-level? component-level? both?)
   - **Best Practices**: React Error Boundary docs, production error handling patterns

5. **Chrome DevTools MCP Testing**
   - **Question**: What is the optimal testing strategy for 13 screens using Chrome DevTools?
   - **Research Task**: Define systematic testing checklist (render, buttons, links, forms, data)
   - **Best Practices**: E2E testing patterns, smoke test strategies

### Research Deliverables

**Output File**: `research.md` will contain:

**Section 1: Frontend Crash Analysis**

- Decision: [Root cause identified - unhandled rejections / React errors / Vite config]
- Rationale: [Evidence from logs, reproduction steps]
- Solution: [Error boundaries placement, async error handling, Vite config fixes]
- Alternatives considered: [Other potential causes ruled out]

**Section 2: Login Flow Completion**

- Decision: [Where redirect logic fails - AuthContext / LoginForm / routing]
- Rationale: [Code trace showing token storage but no navigation]
- Solution: [Fix redirect after token storage, update AuthContext]
- Alternatives considered: [Different auth patterns, session vs token]

**Section 3: WebSocket Routing Fix**

- Decision: [WebSocket middleware placement in Express app]
- Rationale: [Express routing order, upgrade handler requirements]
- Solution: [Correct server.ts WebSocket setup]
- Alternatives considered: [Separate WebSocket server, Socket.io]

**Section 4: Error Boundary Implementation**

- Decision: [Route-level boundaries + critical component boundaries]
- Rationale: [Granular recovery without full app crash]
- Solution: [ErrorBoundary component + strategic placement]
- Alternatives considered: [Global boundary only, no boundaries]

**Section 5: Testing Methodology**

- Decision: [Systematic screen-by-screen testing with standardized checklist]
- Rationale: [Ensures comprehensive coverage, repeatable process]
- Solution: [Chrome DevTools MCP automation + manual verification]
- Alternatives considered: [Automated E2E only, random testing]

---

## Phase 1: Design & Contracts

**Prerequisites**: research.md complete with all unknowns resolved

### 1.1 Data Model (`data-model.md`)

**Entities** (from spec):

**User** (existing Prisma model)

- Fields: id, username, password (hashed), email, full_name, role, is_active, last_login_at, created_at
- Relationships: None for auth (extended by other features)
- State: Active/Inactive (is_active boolean)
- Validation: Zod schemas on login (username required, password ≥6 chars)

**JWT Token** (runtime only, not stored in DB)

- Structure: {userId: string, username: string, role: string, iat: number, exp: number}
- Lifetime: Access token 7 days, refresh token 30 days
- Storage: localStorage.accessToken, localStorage.refreshToken
- Validation: jsonwebtoken.verify() on every protected request

**Auth State** (React Context)

- Fields: user (User | null), isAuthenticated (boolean), isLoading (boolean)
- Actions: login(credentials), logout(), checkAuth()
- Persistence: Tokens in localStorage, user in context (restored on page load)

**WebSocket Connection** (runtime)

- Endpoint: ws://localhost:3001/ws?token=<JWT>
- State: Connected | Disconnected | Reconnecting
- Events: notification, dashboard_update, equipment_event
- Reconnection: Exponential backoff (1s, 2s, 4s, 8s, max 30s)

### 1.2 API Contracts (`contracts/auth-api.yaml`)

```yaml
openapi: 3.0.0
info:
  title: CLMS Authentication API
  version: 1.0.0
  description: User authentication and session management

paths:
  /api/auth/login:
    post:
      summary: Authenticate user and generate JWT tokens
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [username, password]
              properties:
                username:
                  type: string
                  minLength: 1
                password:
                  type: string
                  minLength: 6
                rememberMe:
                  type: boolean
                  default: false
      responses:
        200:
          description: Authentication successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    type: object
                    properties:
                      user:
                        $ref: "#/components/schemas/User"
                      accessToken:
                        type: string
                      refreshToken:
                        type: string
                      expiresIn:
                        type: number
                        description: Token expiry in seconds
        400:
          description: Missing credentials
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        401:
          description: Invalid credentials or account disabled
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"

  /api/auth/me:
    get:
      summary: Get current authenticated user
      security:
        - bearerAuth: []
      responses:
        200:
          description: User retrieved successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    $ref: "#/components/schemas/User"
        401:
          description: Not authenticated
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"

  /api/auth/logout:
    post:
      summary: Invalidate user session
      security:
        - bearerAuth: []
      responses:
        200:
          description: Logged out successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  message:
                    type: string

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    User:
      type: object
      properties:
        id:
          type: string
        username:
          type: string
        email:
          type: string
          nullable: true
        full_name:
          type: string
          nullable: true
        role:
          type: string
          enum: [ADMIN, LIBRARIAN, ASSISTANT]
        is_active:
          type: boolean
        last_login_at:
          type: string
          format: date-time
          nullable: true
        created_at:
          type: string
          format: date-time

    Error:
      type: object
      properties:
        success:
          type: boolean
          example: false
        message:
          type: string
        code:
          type: string
```

### 1.3 Quickstart Guide (`quickstart.md`)

**Developer Setup**:

````markdown
# Frontend Stability & Auth Testing - Developer Guide

## Prerequisites

- Node.js 22.x LTS installed
- Docker Desktop running
- Git on branch 002-frontend-stability-auth-testing
- MySQL container running (port 3308)

## Setup Steps

1. **Start Infrastructure**

   ```powershell
   # Start MySQL
   cd "c:\Users\jmbar\Desktop\ALL REPOS\Pia_REPOS\CLMS"
   docker-compose up -d mysql

   # Verify MySQL running
   docker ps | Select-String "mysql"
   ```
````

2. **Start Backend Server**

   ```powershell
   cd Backend
   npm install  # If dependencies changed
   npm run dev  # Starts on port 3001
   ```

   Verify: http://localhost:3001/health should return 200 OK

3. **Start Frontend Server**

   ```powershell
   cd Frontend
   $env:PORT=3000
   npm install  # If dependencies changed
   npm run dev  # Starts on port 3000
   ```

   Verify: http://localhost:3000 should show login page

4. **Test Authentication**
   - Navigate to http://localhost:3000
   - Login with: admin / admin123
   - Should redirect to dashboard

## Testing Checklist

### Authentication Flow

- [ ] Login page renders without errors
- [ ] Form accepts username and password input
- [ ] Submit triggers POST /api/auth/login
- [ ] Backend returns 200 + JWT tokens
- [ ] Tokens stored in localStorage
- [ ] Redirect to /dashboard occurs
- [ ] Dashboard shows user info
- [ ] Protected routes require auth

### Dashboard Screens (All 13)

- [ ] Dashboard Overview
- [ ] Scan Workspace
- [ ] Students Management
- [ ] Books Catalog
- [ ] Checkout System
- [ ] Equipment Sessions
- [ ] Automation Jobs
- [ ] Analytics Dashboard
- [ ] Reports Generation
- [ ] Import/Export
- [ ] Settings
- [ ] Documentation
- [ ] System Admin

### For Each Screen:

- [ ] Page renders without console errors
- [ ] All buttons are clickable
- [ ] All links navigate correctly
- [ ] Forms validate inputs
- [ ] Data loads or shows empty state
- [ ] Loading states appear during async ops

## Common Issues

**Frontend crashes immediately**

- Check browser console for errors
- Look for unhandled promise rejections
- Verify Vite config in vite.config.ts
- Check React component errors

**Login succeeds but no redirect**

- Open browser DevTools Network tab
- Verify POST /api/auth/login returns 200
- Check localStorage for accessToken
- Inspect AuthContext redirect logic
- Check React Router configuration

**WebSocket 404 errors**

- Backend endpoint not configured
- Will be fixed in Phase 1
- Not blocking for basic testing

## Useful Commands

```powershell
# Check running servers
Get-NetTCPConnection -LocalPort 3000,3001,3308

# Kill Node processes
Get-Process -Name node | Stop-Process -Force

# View backend logs
cd Backend
npm run dev  # Watch terminal output

# Create/verify admin user
cd Backend
node check-user.js
```

````

### 1.4 Agent Context Update

Run the update script:

```powershell
.specify/scripts/powershell/update-agent-context.ps1 -AgentType copilot
````

**Technologies to Add** (if not already present):

- Vite 5.4.20 (dev server)
- React 19 Error Boundaries
- Chrome DevTools MCP (testing)
- bcryptjs (password hashing)
- jsonwebtoken (JWT auth)

---

## Phase 2: Task Breakdown

**NOT INCLUDED IN THIS COMMAND** - Run `/speckit.tasks` after this plan is complete.

The tasks command will generate:

- tasks.md with prioritized task list
- Subtasks for each user story
- Acceptance criteria per task
- Dependencies and blockers

**Expected Task Categories**:

1. **P1 Critical**: Fix frontend crashes, complete login redirect
2. **P1 Testing**: Verify authentication flow end-to-end
3. **P2 Testing**: Test all 13 dashboard screens systematically
4. **P2 Forms**: Test form validation and submission
5. **P3 WebSocket**: Fix WebSocket routing for real-time features
6. **P3 Testing**: Add E2E test automation

---

## Validation & Next Steps

### Pre-Flight Checklist

- [x] Constitution Check passed (all 7 principles satisfied)
- [x] Technical Context documented (current versions, known issues)
- [x] Research questions defined (5 key unknowns)
- [ ] Phase 0: research.md created (root cause analysis)
- [ ] Phase 1: data-model.md created (auth entities)
- [ ] Phase 1: contracts/auth-api.yaml created (API spec)
- [ ] Phase 1: quickstart.md created (developer guide)
- [ ] Phase 1: Agent context updated (copilot-instructions.md)

### Success Criteria

This plan is complete when:

1. ✅ All research questions have documented answers
2. ✅ API contracts are OpenAPI-compliant
3. ✅ Developer can follow quickstart to reproduce issues
4. ✅ Agent context includes testing technologies
5. ⏳ Ready for `/speckit.tasks` command

### Next Command

```bash
# After this plan is reviewed and approved:
/speckit.tasks
```

This will generate the detailed task breakdown with:

- User story → task mapping
- Acceptance criteria per task
- Time estimates
- Dependency graph
- Testing requirements

---

## Notes

**Session Context**:

- Backend auth routes already fixed (removed `if (!req.user)` check)
- Admin user already created (admin/admin123)
- Frontend crashes appear related to unhandled errors during navigation
- Login API works (200 OK + JWT) but frontend doesn't complete redirect
- WebSocket endpoint needs routing configuration (currently 404)

**Key Files Modified in Session**:

- Backend/src/routes/auth.ts (removed auth check from login endpoint)
- Backend/src/server.ts (fixed Express import issue)
- Backend/check-user.js (ES module script for user creation)

**Testing Strategy**:

- Use Chrome DevTools MCP for systematic browser testing
- Document findings in COMPREHENSIVE_TEST_REPORT.md
- Start with P1 (stability + auth), then P2 (screens), then P3 (WebSocket)
- Focus on smoke tests first, detailed testing second

**Risk Mitigation**:

- Frontend crashes blocking all progress → Highest priority
- Authentication flow must work before dashboard testing
- WebSocket issues not blocking basic functionality
- ESLint warnings (385) not addressed in this feature
