<!--
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SYNC IMPACT REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Version Change: 1.0.0 → 1.0.1
Change Type: PATCH (Technology Stack Version Updates)
Date: 2025-11-05

CHANGES IN v1.0.1:
  - Updated all technology versions to latest stable as of November 2025
  - React Query → TanStack Query 5.59+ (rebranded name)
  - Vite 5+ → Vite 6.0+ (latest with performance improvements)
  - Prisma 5+ → Prisma 6.0+ (latest with enhanced type safety)
  - Playwright 1.40+ → Playwright 1.48+ (latest stable)
  - Node.js 18+ → Node.js 22.x LTS recommended (20.x minimum)
  - PostgreSQL 14+ → PostgreSQL 17+ (latest major version)
  - MySQL 8.0+ → MySQL 8.4+ LTS (latest long-term support)
  - Added specific version requirements for all dependencies
  - Added PM2 5.x for production process management
  - Updated Docker Compose to v2.x (modern compose spec)

PRINCIPLES (unchanged):
  1. Production-Readiness First (Zero-Error Mandate)
  2. UI/UX Excellence (Design-First Development)
  3. Type Safety & Code Quality (TypeScript-First)
  4. Comprehensive Testing (Test Pyramid Strategy)
  5. Performance & Optimization (Speed & Efficiency)
  6. Full-Stack Integration (End-to-End Reliability)
  7. Security & Compliance (Defense in Depth)

TEMPLATES STATUS:
  ✅ plan-template.md - Constitution Check gates aligned
  ✅ spec-template.md - Requirements aligned with latest versions
  ✅ tasks-template.md - Task categorization aligned with latest tech stack

FOLLOW-UP ITEMS:
  - Update package.json files to latest versions (automated dependency updates)
  - Run `npm outdated` to identify packages needing updates
  - Test compatibility with Vite 6.0 and Prisma 6.0 migrations
  - Verify React 19 compatibility with all Radix UI components
  - Update Docker base images to latest LTS versions

NOTES:
  This PATCH update ensures CLMS uses the latest stable versions as of November 5,
  2025, improving performance, security, and developer experience while maintaining
  backward compatibility with all principles and workflows.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-->

# CLMS (Centralized Library Management System) Constitution

## Core Principles

### I. Production-Readiness First (Zero-Error Mandate)

**NON-NEGOTIABLE**: All code deployed to production MUST be error-free and fully functional.

**Rules**:

- **Runtime Errors**: Zero tolerance for unhandled exceptions, console errors, or runtime failures
- **Build Quality**: All builds MUST complete without errors or warnings (TypeScript strict mode enforced)
- **Functional Completeness**: Every UI element (button, form, screen) MUST be fully functional before merge
- **Error Boundaries**: React Error Boundaries REQUIRED on all major components and routes
- **Error Handling**: All async operations MUST have try-catch blocks with proper error recovery
- **Validation**: All user inputs MUST be validated (Zod schemas on both frontend and backend)
- **Graceful Degradation**: Features MUST handle failure states with user-friendly error messages

**Rationale**: Library management systems are mission-critical educational infrastructure. Students,
librarians, and staff depend on consistent, reliable operation. A single runtime error can disrupt
service for hundreds of users. Production deployment means zero errors, not "acceptable errors."

---

### II. UI/UX Excellence (Design-First Development)

**All user interfaces MUST be clean, responsive, accessible, and pleasing to the eye.**

**Rules**:

- **Design System**: All components MUST use the established design system (Radix UI + Tailwind CSS)
- **Responsive Design**: MANDATORY support for mobile (320px), tablet (768px), desktop (1024px+)
- **Accessibility**: WCAG 2.1 Level AA compliance REQUIRED (semantic HTML, ARIA labels, keyboard navigation)
- **Visual Consistency**: Consistent spacing, typography, colors across all screens (Tailwind design tokens)
- **Loading States**: All async operations MUST show loading indicators (skeletons, spinners)
- **Empty States**: All lists/tables MUST have meaningful empty state messages with actionable CTAs
- **Touch Targets**: Minimum 44×44px touch targets for all interactive elements (mobile-first)
- **Performance**: First Contentful Paint < 1.5s, Time to Interactive < 3.5s (measured via Lighthouse)
- **Dark Mode**: Full dark mode support REQUIRED for all screens (next-themes integration)

**Rationale**: Users judge software quality by its interface. A beautiful, intuitive UI builds trust
and encourages adoption. Accessibility ensures the system serves all users, including those with
disabilities. Responsive design acknowledges that modern library staff work from various devices.

---

### III. Type Safety & Code Quality (TypeScript-First)

**TypeScript strict mode MUST be enabled and enforced across the entire codebase.**

**Rules**:

- **Strict Mode**: `strict: true` in tsconfig.json (both frontend and backend)
- **No Implicit Any**: FORBIDDEN - all types MUST be explicitly declared
- **Type Imports**: Use `import type` for type-only imports to optimize bundle size
- **Zod Validation**: Runtime validation schemas REQUIRED for all API inputs/outputs
- **Type Sharing**: Shared types between frontend/backend MUST live in a common types file
- **ESLint**: All code MUST pass ESLint with TypeScript rules (no warnings allowed)
- **Prettier**: Code MUST be formatted with Prettier before commit (automated via pre-commit hook)
- **Naming Conventions**: PascalCase (components, types), camelCase (functions, variables), UPPER_SNAKE_CASE (constants)
- **Documentation**: Complex types and business logic MUST have JSDoc comments

**Rationale**: TypeScript catches bugs at compile-time instead of runtime. Strict typing eliminates
entire classes of errors (null reference exceptions, type mismatches, missing properties). Shared
validation schemas (Zod) ensure frontend and backend speak the same language, preventing API contract
violations.

---

### IV. Comprehensive Testing (Test Pyramid Strategy)

**Testing MUST cover unit, integration, and end-to-end layers with meaningful coverage.**

**Rules**:

- **Test Pyramid**: 70% unit tests (Vitest), 20% integration tests (Vitest), 10% E2E tests (Playwright)
- **Critical Paths**: 100% coverage REQUIRED for authentication, authorization, checkout/return, fine calculation
- **Component Testing**: All reusable components MUST have React Testing Library tests
- **API Contract Tests**: All endpoints MUST have contract tests verifying request/response schemas
- **Visual Regression**: Playwright visual regression tests for critical user flows
- **Accessibility Testing**: Automated a11y tests (axe-playwright) REQUIRED for all public-facing screens
- **Performance Tests**: Load testing REQUIRED for bulk operations (import, export, report generation)
- **Pre-Deployment**: All tests MUST pass before production deployment (CI/CD gate)
- **Test Documentation**: Complex test scenarios MUST have comments explaining what is being tested

**Rationale**: Untested code is broken code. The test pyramid ensures fast feedback (unit tests run
in seconds) while still catching integration issues and user-facing bugs. Critical library operations
(checkout/return, fines) affect real-world finances and must be bulletproof.

---

### V. Performance & Optimization (Speed & Efficiency)

**The system MUST be fast, efficient, and scalable for real-world library workloads.**

**Rules**:

- **Frontend Performance**:
  - Code splitting: Lazy load routes and heavy components (React.lazy)
  - Bundle size: Main bundle < 200KB gzipped
  - Virtual scrolling: REQUIRED for lists > 100 items (react-window)
  - Image optimization: Automatic compression and WebP conversion (vite-plugin-imagemin)
  - Caching: React Query with staleTime/cacheTime optimization
  - Service Worker: Offline support with background sync for PWA
- **Backend Performance**:
  - Database queries: N+1 query detection and resolution
  - Query optimization: Proper indexes on all foreign keys and search fields
  - Response times: p95 < 200ms for simple queries, < 1s for complex reports
  - Connection pooling: Prisma connection pool properly configured
  - Rate limiting: 100 requests per 15 minutes per IP (express-rate-limit)
  - Response compression: Gzip/Brotli compression enabled (compression middleware)
- **Database Performance**:
  - Indexes: REQUIRED on all foreign keys, search fields, and filter columns
  - Query analysis: EXPLAIN queries for complex joins and aggregations
  - Pagination: MANDATORY for all list endpoints (cursor-based preferred)

**Rationale**: Library systems handle thousands of daily transactions. Slow response times frustrate
users and reduce productivity. Efficient code reduces server costs and environmental impact. Proper
optimization means the system scales from small school libraries to large university systems without
architectural changes.

---

### VI. Full-Stack Integration (End-to-End Reliability)

**Frontend and backend MUST work seamlessly together with zero integration issues.**

**Rules**:

- **API Contracts**: OpenAPI/Swagger documentation REQUIRED for all endpoints
- **Type Synchronization**: Shared types/schemas between frontend and backend (Zod + TypeScript)
- **Error Consistency**: Error responses MUST follow standard format: `{ error: string, code: string, details?: any }`
- **Authentication Flow**: JWT-based auth with refresh tokens, secure httpOnly cookies
- **WebSocket Reliability**: Socket.io with automatic reconnection and offline queue
- **CORS Configuration**: Properly configured CORS headers (no wildcard in production)
- **Environment Variables**: Separate configs for dev/staging/production (dotenv)
- **Health Checks**: `/health` endpoint for monitoring and orchestration
- **API Versioning**: Version API endpoints when breaking changes are required (`/api/v1/`, `/api/v2/`)

**Rationale**: Frontend-backend integration failures are the #1 source of production bugs. Strong
contracts (OpenAPI, shared types) prevent miscommunication. Reliable authentication ensures security.
Proper error handling means users see helpful messages, not cryptic 500 errors.

---

### VII. Security & Compliance (Defense in Depth)

**Security MUST be baked into every layer, not bolted on as an afterthought.**

**Rules**:

- **Authentication**:
  - Password hashing: bcrypt with 12 rounds minimum
  - JWT tokens: Short-lived access tokens (15 min), long-lived refresh tokens (7 days)
  - Token storage: httpOnly cookies (NEVER localStorage for sensitive tokens)
  - Session management: Server-side session tracking with logout on all devices
- **Authorization**:
  - Role-Based Access Control (RBAC): ADMIN, LIBRARIAN, STAFF roles enforced
  - Endpoint protection: All routes MUST verify user role before execution
  - Resource-level checks: Users can only access resources they own or have permission to view
- **Input Validation**:
  - SQL Injection: Prevented by Prisma ORM (parameterized queries)
  - XSS: React's built-in escaping + Content Security Policy headers
  - CSRF: Double-submit cookie pattern for state-changing operations
  - File uploads: Whitelist extensions, size limits, virus scanning for production
- **Security Headers** (Helmet.js):
  - `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`
- **Audit Logging**:
  - ALL state-changing operations MUST be logged to `audit_logs` table
  - Logs MUST include: user ID, action, timestamp, IP address, resource affected
- **Dependency Security**:
  - Weekly `npm audit` scans in CI/CD
  - Automated dependency updates via Dependabot/Renovate
  - Critical vulnerabilities MUST be patched within 48 hours

**Rationale**: Library systems handle student data (PII), financial data (fines), and institutional
assets (inventory). Security breaches can result in data loss, identity theft, and legal liability.
Defense in depth means multiple layers of protection, so a single failure doesn't compromise the system.

---

## Technology Stack & Standards

### Required Technologies

**Last Updated**: November 5, 2025

**Frontend**:

- **Framework**: React 19.0+ (latest stable) + TypeScript 5.7+
- **Build Tool**: Vite 6.0+ (latest with improved performance and HMR)
- **UI Library**: Radix UI 1.x (accessible, unstyled primitives) + Tailwind CSS 3.4+
- **State Management**: Zustand 5.0+ (global state) + TanStack Query 5.59+ (server state, formerly React Query)
- **Forms**: React Hook Form 7.53+ + Zod 3.23+ validation
- **Testing**: Vitest 2.1+ (unit/integration) + React Testing Library 16.0+ + Playwright 1.48+ (E2E)
- **Code Quality**: ESLint 9.x + Prettier 3.3+ + TypeScript strict mode
- **Animation**: Framer Motion 11.11+ (smooth, performant animations)

**Backend**:

- **Runtime**: Node.js 22.x LTS (or 20.x LTS minimum)
- **Framework**: Express.js 4.21+ + TypeScript 5.7+
- **ORM**: Prisma 6.0+ (latest with improved performance and type safety)
- **Database**: MySQL 8.4+ LTS (or PostgreSQL 17+ for advanced features)
- **Authentication**: JWT (jsonwebtoken 9.0+) + bcryptjs 2.4+
- **Validation**: Zod 3.23+ (runtime type validation, shared schemas)
- **Testing**: Vitest 2.1+ (unit/integration) + Supertest 7.0+ (API contract tests)
- **Logging**: Winston 3.15+ (structured logging with log levels and transports)
- **Security**: Helmet 8.0+ (security headers) + express-rate-limit 7.4+

**Infrastructure**:

- **Containerization**: Docker 27.x + Docker Compose v2.x (modern compose spec)
- **Reverse Proxy**: Nginx 1.27+ (SSL termination, static file serving, load balancing)
- **Monitoring**: Prometheus 2.54+ + Grafana 11.x (metrics) + Winston logs
- **CI/CD**: GitHub Actions (latest) + automated testing, building, deployment
- **Process Manager**: PM2 5.x (production process management, zero-downtime restarts)

### Forbidden Practices

- ❌ **JavaScript without TypeScript**: All new code MUST be TypeScript
- ❌ **Inline styles**: Use Tailwind CSS classes (utility-first CSS)
- ❌ **`any` type**: Explicit types REQUIRED (use `unknown` if type truly unknown)
- ❌ **Unvalidated inputs**: All user inputs MUST be validated with Zod
- ❌ **Secrets in code**: Use environment variables (dotenv) + secure vaults (production)
- ❌ **Direct database queries**: Use Prisma ORM (prevents SQL injection)
- ❌ **Unhandled promises**: All async functions MUST have error handling
- ❌ **Large commits**: PRs MUST be < 500 lines of code (easier to review)

---

## Development Workflow & Quality Gates

### Pre-Development (Planning Phase)

1. **Requirements Gathering**: Create feature spec in `.specify/specs/[###-feature-name]/spec.md`
2. **Constitution Check**: Verify feature adheres to all 7 core principles
3. **Design Review**: UI mockups MUST be approved before implementation (Figma/wireframes)
4. **Technical Planning**: Document approach in `plan.md` (architecture, data model, API contracts)

### Development Phase

1. **Branch Creation**: `git checkout -b [###-feature-name]` (numbered branches)
2. **Test-First**: Write failing tests BEFORE implementation (TDD for critical paths)
3. **Implementation**: Follow TypeScript/React/Express best practices
4. **Self-Review**: Run linters, formatters, tests locally before commit
5. **Commit Convention**: Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`)

### Pre-Merge Quality Gates

**MANDATORY** - All gates MUST pass before merge:

1. ✅ **Type Check**: `tsc --noEmit` (zero errors in frontend and backend)
2. ✅ **Linting**: `eslint` (zero errors, zero warnings)
3. ✅ **Formatting**: `prettier --check` (all files properly formatted)
4. ✅ **Unit Tests**: Vitest (all tests pass, coverage > 70% for new code)
5. ✅ **Integration Tests**: API contract tests pass (Supertest)
6. ✅ **E2E Tests**: Critical user flows pass (Playwright)
7. ✅ **Build Success**: Production build completes without errors
8. ✅ **Bundle Size**: Frontend bundle < 200KB gzipped (check with `vite build`)
9. ✅ **Accessibility**: No critical a11y violations (axe-playwright)
10. ✅ **Security**: No critical vulnerabilities (`npm audit`)

### Post-Merge

1. **Automated Deployment**: CI/CD pipeline deploys to staging environment
2. **Smoke Tests**: Verify critical paths work in staging (login, checkout, return)
3. **Performance Check**: Lighthouse scores > 90 (performance, accessibility, best practices)
4. **Production Deployment**: Manual approval required for production deploy
5. **Monitoring**: Watch error rates, response times, user feedback for 24 hours

---

## Governance

### Amendment Process

This constitution governs all development practices for the CLMS project. Amendments follow this process:

1. **Proposal**: Document proposed changes in a GitHub issue with rationale
2. **Discussion**: Team review and feedback (minimum 3 business days for comments)
3. **Approval**: Unanimous approval from core maintainers required
4. **Migration Plan**: Document how existing code will be brought into compliance
5. **Version Update**: Increment constitution version following semantic versioning:
   - **MAJOR**: Backward-incompatible principle changes (e.g., removing a principle)
   - **MINOR**: New principle added or significant expansion
   - **PATCH**: Clarifications, wording improvements, non-semantic fixes
6. **Template Updates**: Update all affected templates (plan, spec, tasks) to reflect changes
7. **Communication**: Announce changes in project README and team chat

### Compliance & Enforcement

- **Pull Requests**: All PRs MUST pass automated quality gates (CI/CD checks)
- **Code Review**: At least one maintainer MUST verify constitution compliance
- **Complexity Justification**: Violations MUST be explicitly justified and documented in PR description
- **Periodic Audits**: Monthly audits of codebase for drift from constitution standards
- **Automated Enforcement**: Husky pre-commit hooks + GitHub Actions enforce linting, formatting, testing

### Exception Handling

In rare cases, temporary exceptions MAY be granted:

1. **Emergency Hotfixes**: Critical production bugs may bypass E2E tests (but MUST add tests post-fix)
2. **Technical Debt**: Document in `TECHNICAL_DEBT.md` with remediation plan and timeline
3. **Third-Party Constraints**: External API limitations documented in `docs/external-dependencies.md`

All exceptions MUST have:

- Clear justification (why exception is necessary)
- Remediation plan (how to eventually comply)
- Expiration date (when exception will be re-evaluated)

---

**Version**: 1.0.1  
**Ratified**: 2025-11-05  
**Last Amended**: 2025-11-05

---

## Appendix: Quick Reference Checklist

### Every Feature MUST Have:

- [ ] Feature specification in `.specify/specs/[###-feature-name]/spec.md`
- [ ] Implementation plan in `plan.md` with constitution check
- [ ] Task breakdown in `tasks.md` organized by user story
- [ ] TypeScript strict mode compliance (zero errors)
- [ ] Zod validation schemas for all inputs/outputs
- [ ] React Error Boundaries on all major components
- [ ] Loading states and empty states for all async operations
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Dark mode support
- [ ] Accessibility (WCAG 2.1 Level AA)
- [ ] Unit tests (70% coverage minimum for new code)
- [ ] Integration tests for API contracts
- [ ] E2E tests for critical user flows
- [ ] Performance optimization (code splitting, virtual scrolling)
- [ ] Security review (input validation, auth checks, RBAC)
- [ ] Audit logging for state-changing operations
- [ ] Documentation (JSDoc for complex logic, README updates)
- [ ] Passing CI/CD pipeline (all quality gates green)

### Every Screen/Component MUST Have:

- [ ] Responsive layout (320px mobile → 1920px desktop)
- [ ] Loading skeleton or spinner
- [ ] Empty state with actionable CTA
- [ ] Error state with retry mechanism
- [ ] Dark mode styles
- [ ] Keyboard navigation support
- [ ] ARIA labels for screen readers
- [ ] Minimum 44×44px touch targets
- [ ] Consistent spacing (Tailwind design tokens)
- [ ] Consistent typography (Tailwind font system)
- [ ] React Error Boundary wrapper
- [ ] Performance optimization (React.memo, useMemo, useCallback where appropriate)

### Every API Endpoint MUST Have:

- [ ] OpenAPI/Swagger documentation
- [ ] Zod validation schema for request body
- [ ] Zod validation schema for response
- [ ] Authentication check (JWT verification)
- [ ] Authorization check (RBAC role verification)
- [ ] Error handling with try-catch
- [ ] Standardized error response format
- [ ] Audit logging for state-changing operations
- [ ] Rate limiting (express-rate-limit)
- [ ] Database query optimization (no N+1 queries)
- [ ] Pagination for list endpoints
- [ ] Contract tests (Supertest)
- [ ] Response time monitoring

---

**Remember**: This constitution exists to ensure CLMS is production-ready, error-free, and delightful
to use. When in doubt, ask: "Will this make the system more reliable, secure, and user-friendly?"
If yes, proceed. If no, reconsider the approach.
