---
description: "Task list template for feature implementation"
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: The examples below include test tasks. Tests are OPTIONAL - only include them if explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- **Web app**: `backend/src/`, `frontend/src/`
- **Mobile**: `api/src/`, `ios/src/` or `android/src/`
- Paths shown below assume single project - adjust based on plan.md structure

<!--
  ============================================================================
  IMPORTANT: The tasks below are SAMPLE TASKS for illustration purposes only.

  The /speckit.tasks command MUST replace these with actual tasks based on:
  - User stories from spec.md (with their priorities P1, P2, P3...)
  - Feature requirements from plan.md
  - Entities from data-model.md
  - Endpoints from contracts/

  Tasks MUST be organized by user story so each story can be:
  - Implemented independently
  - Tested independently
  - Delivered as an MVP increment

  DO NOT keep these sample tasks in the generated tasks.md file.
  ============================================================================
-->

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure aligned with CLMS Constitution

- [ ] T001 Create project structure per implementation plan (Frontend/ and Backend/ workspaces)
- [ ] T002 [P] Initialize TypeScript 5.7+ with strict mode in Frontend (Vite + React 19)
- [ ] T003 [P] Initialize TypeScript 5.7+ with strict mode in Backend (Express + Prisma)
- [ ] T004 [P] Configure ESLint + Prettier with CLMS code quality rules
- [ ] T005 [P] Setup Vitest for unit/integration testing (frontend and backend)
- [ ] T006 [P] Setup Playwright for E2E testing with accessibility checks (axe-playwright)
- [ ] T007 [P] Configure Husky pre-commit hooks (lint, format, type-check)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

**Constitution Compliance** - These tasks ensure all 7 principles are supported:

### Database & ORM (Type Safety + Performance)

- [ ] T008 Setup Prisma schema with required models (extends existing schema)
- [ ] T009 Add database indexes for performance (foreign keys, search fields)
- [ ] T010 Create database migration for new tables/columns
- [ ] T011 [P] Generate Prisma client types (ensures type safety)

### Authentication & Authorization (Security)

- [ ] T012 [P] Implement JWT authentication middleware (Backend/src/middleware/auth.ts)
- [ ] T013 [P] Implement RBAC authorization middleware (Backend/src/middleware/rbac.ts)
- [ ] T014 [P] Setup audit logging service (Backend/src/services/auditService.ts)

### API Infrastructure (Full-Stack Integration)

- [ ] T015 Setup API routing structure (Backend/src/routes/)
- [ ] T016 [P] Configure Zod validation middleware (Backend/src/middleware/validate.ts)
- [ ] T017 [P] Configure error handling middleware (Backend/src/middleware/errorHandler.ts)
- [ ] T018 [P] Configure rate limiting (express-rate-limit, 100 req/15 min)
- [ ] T019 [P] Configure security headers (Helmet.js)
- [ ] T020 [P] Configure CORS with proper origin settings

### Frontend Infrastructure (UI/UX + Type Safety)

- [ ] T021 Setup shared types for API contracts (Backend/src/types/ → Frontend/src/types/)
- [ ] T022 [P] Configure React Query for server state management
- [ ] T023 [P] Setup error boundaries (Frontend/src/components/ErrorBoundary.tsx)
- [ ] T024 [P] Configure dark mode theme provider (next-themes)
- [ ] T025 [P] Setup responsive layout system (Tailwind breakpoints)

### Testing Infrastructure (Comprehensive Testing)

- [ ] T026 [P] Setup Vitest contract test utilities (Backend/tests/helpers/)
- [ ] T027 [P] Setup Playwright E2E test utilities (tests/helpers/)
- [ ] T028 [P] Configure accessibility testing (axe-playwright)
- [ ] T029 [P] Setup test data factories (Frontend/tests/factories/, Backend/tests/factories/)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - [Title] (Priority: P1) 🎯 MVP

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

**Constitution Alignment**: This story must satisfy all 7 principles

### Tests for User Story 1 (MANDATORY per Constitution Principle IV) ✅

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation (TDD)**

**Backend Tests**:

- [ ] T030 [P] [US1] Contract test for [endpoint] in Backend/tests/contract/test\_[name].test.ts
  - Validates request/response schemas (Zod)
  - Verifies HTTP status codes
  - Tests error responses
- [ ] T031 [P] [US1] Integration test for [service] in Backend/tests/integration/test\_[name].test.ts
  - Tests database operations
  - Validates business logic
  - Tests auth/authorization

**Frontend Tests**:

- [ ] T032 [P] [US1] Component test for [Component] in Frontend/tests/components/[Component].test.tsx
  - React Testing Library
  - User interactions
  - Loading/error/empty states
- [ ] T033 [P] [US1] Accessibility test for [Component] in Frontend/tests/a11y/[Component].a11y.test.ts
  - axe-playwright checks
  - Keyboard navigation
  - ARIA labels

**E2E Tests**:

- [ ] T034 [US1] E2E test for [user flow] in tests/e2e/[feature].spec.ts
  - Full user journey
  - Cross-browser compatibility
  - Mobile responsive behavior

### Backend Implementation for User Story 1

**Type Safety & Validation** (Principle III):

- [ ] T035 [P] [US1] Define Zod schemas in Backend/src/schemas/[entity]Schema.ts
  - Request validation schemas
  - Response validation schemas
  - Type inference exports
- [ ] T036 [P] [US1] Create TypeScript types in Backend/src/types/[entity].ts
  - Database model types
  - API request/response types
  - Shared with frontend

**Data Layer** (Principle VI):

- [ ] T037 [P] [US1] Create Prisma models in Backend/prisma/schema.prisma
  - Define entities and relationships
  - Add performance indexes
  - Generate migration
- [ ] T038 [P] [US1] Implement repository pattern in Backend/src/repositories/[Entity]Repository.ts
  - CRUD operations
  - Custom queries with pagination
  - Error handling

**Business Logic** (Principle I):

- [ ] T039 [US1] Implement service in Backend/src/services/[entity]Service.ts (depends on T038)
  - Business logic and validation
  - Error handling with custom errors
  - Audit logging integration
  - Performance optimization (query efficiency)

**API Layer** (Principles VI, VII):

- [ ] T040 [US1] Implement controller in Backend/src/controllers/[entity]Controller.ts (depends on T039)
  - Request handling
  - Response formatting
  - Error handling
- [ ] T041 [US1] Define routes in Backend/src/routes/[entity]Routes.ts
  - Route definitions
  - Authentication middleware
  - Authorization middleware (RBAC)
  - Validation middleware (Zod)
  - Rate limiting

**Documentation**:

- [ ] T042 [P] [US1] Add OpenAPI/Swagger documentation in Backend/src/docs/[entity].yaml

### Frontend Implementation for User Story 1

**Type Safety** (Principle III):

- [ ] T043 [P] [US1] Import shared types to Frontend/src/types/[entity].ts
- [ ] T044 [P] [US1] Define component prop types (TypeScript interfaces)

**State Management** (Principle VI):

- [ ] T045 [P] [US1] Create API service in Frontend/src/services/api/[entity]Service.ts
  - Axios requests with error handling
  - Type-safe request/response
  - Authentication headers (JWT)
- [ ] T046 [P] [US1] Create React Query hooks in Frontend/src/hooks/use[Entity].ts
  - useQuery for fetching
  - useMutation for updates
  - Optimistic updates
  - Cache invalidation

**UI Components** (Principle II):

- [ ] T047 [P] [US1] Create base components in Frontend/src/components/[Feature]/
  - [MainComponent].tsx (main feature component)
  - [Form].tsx (input forms with react-hook-form)
  - [Table].tsx (data display with virtual scrolling if > 100 items)
  - [Card].tsx (card layouts)
- [ ] T048 [US1] Implement responsive layout (depends on T047)
  - Mobile: 320px - 767px
  - Tablet: 768px - 1023px
  - Desktop: 1024px+
  - Tailwind responsive classes
- [ ] T049 [P] [US1] Add loading states (skeletons/spinners)
- [ ] T050 [P] [US1] Add empty states (with actionable CTAs)
- [ ] T051 [P] [US1] Add error states (with retry buttons)
- [ ] T052 [P] [US1] Implement dark mode support (Tailwind dark: classes)

**Accessibility** (Principle II):

- [ ] T053 [US1] Add ARIA labels and semantic HTML (depends on T047-T052)
- [ ] T054 [US1] Implement keyboard navigation
- [ ] T055 [US1] Ensure minimum 44×44px touch targets
- [ ] T056 [US1] Test with screen readers (manual verification)

**Performance** (Principle V):

- [ ] T057 [P] [US1] Implement code splitting (React.lazy for heavy components)
- [ ] T058 [P] [US1] Add React.memo for expensive components
- [ ] T059 [P] [US1] Optimize re-renders (useMemo, useCallback)
- [ ] T060 [US1] Implement virtual scrolling if list > 100 items (react-window)

**Integration**:

- [ ] T061 [US1] Connect component to React Query hooks (depends on T046, T047)
- [ ] T062 [US1] Add error boundary wrapper
- [ ] T063 [US1] Integrate with tab navigation (if applicable)

**Checkpoint**: At this point, User Story 1 should be:

- ✅ Fully functional (all buttons/forms work)
- ✅ Error-free (zero console errors, no runtime exceptions)
- ✅ Responsive (mobile, tablet, desktop)
- ✅ Accessible (WCAG 2.1 Level AA)
- ✅ Performant (FCP < 1.5s, TTI < 3.5s)
- ✅ Secure (auth/authz enforced, inputs validated)
- ✅ Tested (unit, integration, E2E, accessibility)
- ✅ Independently deployable and testable

---

## Phase 4: User Story 2 - [Title] (Priority: P2)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 2 (OPTIONAL - only if tests requested) ⚠️

- [ ] T018 [P] [US2] Contract test for [endpoint] in tests/contract/test\_[name].py
- [ ] T019 [P] [US2] Integration test for [user journey] in tests/integration/test\_[name].py

### Implementation for User Story 2

- [ ] T020 [P] [US2] Create [Entity] model in src/models/[entity].py
- [ ] T021 [US2] Implement [Service] in src/services/[service].py
- [ ] T022 [US2] Implement [endpoint/feature] in src/[location]/[file].py
- [ ] T023 [US2] Integrate with User Story 1 components (if needed)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - [Title] (Priority: P3)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 3 (OPTIONAL - only if tests requested) ⚠️

- [ ] T024 [P] [US3] Contract test for [endpoint] in tests/contract/test\_[name].py
- [ ] T025 [P] [US3] Integration test for [user journey] in tests/integration/test\_[name].py

### Implementation for User Story 3

- [ ] T026 [P] [US3] Create [Entity] model in src/models/[entity].py
- [ ] T027 [US3] Implement [Service] in src/services/[service].py
- [ ] T028 [US3] Implement [endpoint/feature] in src/[location]/[file].py

**Checkpoint**: All user stories should now be independently functional

---

[Add more user story phases as needed, following the same pattern]

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] TXXX [P] Documentation updates in docs/
- [ ] TXXX Code cleanup and refactoring
- [ ] TXXX Performance optimization across all stories
- [ ] TXXX [P] Additional unit tests (if requested) in tests/unit/
- [ ] TXXX Security hardening
- [ ] TXXX Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - May integrate with US1 but should be independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - May integrate with US1/US2 but should be independently testable

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (if tests requested):
Task: "Contract test for [endpoint] in tests/contract/test_[name].py"
Task: "Integration test for [user journey] in tests/integration/test_[name].py"

# Launch all models for User Story 1 together:
Task: "Create [Entity1] model in src/models/[entity1].py"
Task: "Create [Entity2] model in src/models/[entity2].py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
