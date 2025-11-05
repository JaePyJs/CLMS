# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for CLMS. Use the latest versions as of November 2025.
-->

**Language/Version**: TypeScript 5.7+ (strict mode enabled)  
**Runtime**: Node.js 22.x LTS (backend) / Modern browsers (frontend)  
**Primary Dependencies**:

- **Frontend**: React 19.0+, Vite 6.0+, TanStack Query 5.59+, Radix UI 1.x, Tailwind CSS 3.4+
- **Backend**: Express.js 4.21+, Prisma 6.0+, Zod 3.23+, Winston 3.15+, Helmet 8.0+
  **Storage**: MySQL 8.4+ LTS (or PostgreSQL 17+), Redis 7.x (optional caching)  
  **Testing**: Vitest 2.1+ (unit/integration), Playwright 1.48+ (E2E), Supertest 7.0+ (API)  
  **Target Platform**: Docker containers (dev/prod), Linux server (Ubuntu 22.04/24.04 LTS)  
  **Project Type**: Full-stack web application (monorepo: Frontend/ + Backend/)  
  **Performance Goals**:
- API: p95 < 200ms (simple), < 1s (complex reports)
- Frontend: FCP < 1.5s, TTI < 3.5s, bundle < 200KB gzipped
- Database: Indexed queries, pagination for lists > 100 items
  **Constraints**:
- TypeScript strict mode (no `any` types)
- WCAG 2.1 Level AA accessibility
- Zero runtime errors in production
- 70%+ test coverage for new code
  **Scale/Scope**:
- Users: 100-1000 concurrent (library staff + students)
- Data: 10k-100k books, 1k-10k students, 100k+ transactions/year
- Screens: 13 main tabs, 115+ React components

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Based on CLMS Constitution v1.0.0**

### I. Production-Readiness First

- [ ] Feature includes comprehensive error handling (try-catch, error boundaries)
- [ ] All user inputs have validation schemas (Zod)
- [ ] Feature has graceful degradation for failure states
- [ ] No runtime errors expected in any code path

### II. UI/UX Excellence

- [ ] Feature includes responsive design (mobile, tablet, desktop)
- [ ] Accessibility requirements defined (WCAG 2.1 Level AA)
- [ ] Loading states and empty states designed
- [ ] Dark mode support planned
- [ ] Performance targets defined (FCP < 1.5s, TTI < 3.5s)

### III. Type Safety & Code Quality

- [ ] TypeScript strict mode compliance verified
- [ ] Shared types/schemas between frontend and backend defined
- [ ] ESLint and Prettier configuration aligned
- [ ] No `any` types planned (use explicit types or `unknown`)

### IV. Comprehensive Testing

- [ ] Unit tests planned (70% coverage target)
- [ ] Integration tests planned for API contracts
- [ ] E2E tests planned for critical user flows
- [ ] Accessibility tests planned (axe-playwright)

### V. Performance & Optimization

- [ ] Performance requirements defined (response times, bundle size)
- [ ] Code splitting strategy planned (lazy loading)
- [ ] Virtual scrolling planned for large lists (if applicable)
- [ ] Database query optimization considered (indexes, pagination)

### VI. Full-Stack Integration

- [ ] API contracts documented (OpenAPI/Swagger)
- [ ] Error response format standardized
- [ ] Authentication/authorization requirements defined
- [ ] WebSocket usage documented (if applicable)

### VII. Security & Compliance

- [ ] Authentication requirements defined
- [ ] Authorization rules documented (RBAC)
- [ ] Input validation planned (prevent XSS, SQL injection)
- [ ] Audit logging requirements defined
- [ ] Security headers configured (Helmet.js)

**Violations Requiring Justification**: [List any principle violations with rationale, or write "None"]

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
