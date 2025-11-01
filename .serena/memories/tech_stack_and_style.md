# Tech Stack & Style
- **Backend**: Node.js 20+, Express, TypeScript 5.9, Prisma ORM targeting MySQL 8, Redis/Bull queues, extensive scripts under `Backend/package.json`.
- **Frontend**: React 19 + Vite, TypeScript, TanStack Query, shadcn/ui (Radix primitives), TailwindCSS, Zustand state management.
- **Tooling**: Vitest test suites (unit/integration/e2e/performance), ESLint + Prettier, Husky + lint-staged, Playwright for E2E.
- **TypeScript Conventions**: `strict` mode with `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, path aliases via `@/*`; prefer conditional property assignment over `undefined` spreads.
- **Data Layer Conventions**: Prisma models use snake_case columns; application code must map to snake_case when creating/updating records and avoid non-schema fields.
- **Logging/Audit**: Structured logging with Winston; audit logs persist JSON payloads via Prisma `new_values`/`old_values` fields.
