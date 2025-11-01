# Backend Strict-Mode Error Log

_Last updated: 2025-10-22_

## Overview

- **Command:** `pnpm exec tsc --noEmit`
- **Result:** 1,172 errors across 98 files
- **Goal:** Prioritize strict-mode remediation by documenting dominant failure clusters and recommended fixes.

## Priority Error Clusters

1. **Prisma Model Naming Drift**
   - **Files:** `src/services/performanceOptimizationService.ts`, `src/services/queryOptimizationService.ts`, `src/utils/queryOptimizer.ts`, multiple repositories.
   - **Symptoms:** Usage of singular model accessors (`student`, `book`, `studentActivity`) and camelCase Prisma types (`StudentActivityWhereInput`) that no longer exist.
   - **Fix:** Rename delegates and generated types to match Prisma schema (`students`, `books`, `student_activities`, `student_activitiesWhereInput`). Update include/select fragments accordingly.

2. **Scanner & USB Service Typing Gaps**
   - **Files:** `src/services/scannerConfigService.ts`, `src/services/scannerTestService.ts`, `src/services/usbScannerService.ts`.
   - **Symptoms:** `exactOptionalPropertyTypes` violations, `undefined` checks missing, HID device union types not narrowed before property access.
   - **Fix:** Align `ScannerConfig` instantiations with required props (explicit `enabled`, optional fields as `foo ?? default`). Add guards when reading optional HID model variants; return fallback strings for simulated data generators.

3. **Recovery Service Unknown Handling**
   - **File:** `src/services/recoveryService.ts`.
   - **Symptoms:** Legacy variables (`start_time`) referenced after refactor, errors typed as `unknown`, missing `category` on `BaseError`.
   - **Fix:** Replace snake_case leftovers, capture start timestamps locally, narrow errors via helper type guards, extend `BaseError` typing or cast safely.

4. **Data Transformation & Import Pipeline**
   - **Files:** `src/utils/dataTransformationPipeline.ts`, `src/utils/importTransactionManager.ts`.
   - **Symptoms:** Optional schema objects treated as defined, `maxLength` metadata stored on types that no longer expose that key, batches possibly `undefined`.
   - **Fix:** Guard optional schema references, extend type definitions to include metadata or move metadata to parallel map, validate batch presence before use, adjust transaction helper signatures.

5. **Performance Decorators & Error Handler Options**
   - **Files:** `src/utils/performanceDecorators.ts`, `src/utils/errorHandler.ts`.
   - **Symptoms:** Passing `undefined` to options expecting concrete objects due to `exactOptionalPropertyTypes`.
   - **Fix:** Provide explicit defaults (`context ?? {}`), widen types to accept `undefined`, or update caller signatures to mark properties optional with `| undefined` where appropriate.

## File-Level Notes & Fix Actions

### src/services/performanceOptimizationService.ts (in progress)

- ✅ Configured Prisma client for event-based query logging.
- ✅ Replaced legacy `activities` include with `student_activities` and enum-safe filters.
- ✅ Swapped string literals for Prisma enums and guarded optional metrics metadata.
- ✅ Restored analytics helper methods (total activities count, equipment usage typing) to satisfy snake_case and exact optional requirements.
- Pending: tighten return typing to remove lingering `any` usage flagged by ESLint.

### src/services/queryOptimizationService.ts (in progress)

- ✅ Converted student lookup/search helpers to snake_case delegates and include typings.
- ✅ Updated book/equipment search filters to use generated types and enum-safe options.
- ✅ Audited analytics helpers and raw index recommendations to match snake_case Prisma tables/columns.
- Pending: re-run `pnpm exec tsc --noEmit` to confirm residual error count (previously 33).

### src/utils/queryOptimizer.ts (in progress)

- ✅ Updated student activity include to `student_activities` with enum-based status filtering.
- ✅ Replaced equipment status literals with `equipment_status`/`equipment_sessions_status` enums.
- Pending: replace legacy `@ts-ignore` pragma and eliminate `any` helper parameters for full strict compliance.

### src/services/realtimeScanProcessor.ts (2 errors)

- Import correct websocket export (`websocketServer`).
- Pass `eventId` from surrounding scope into `handleScanError`.

### src/services/scannerConfigService.ts (2 errors)

- Provide non-optional `vendorId`/`enabled` when constructing `ScannerConfig`.
- Use default values or explicit `undefined` where schema allows.

### src/services/scannerTestService.ts (5 errors)

- Guard `device` lookup results before access.
- Provide fallback strings for `invalidTypes`/`qrContent` random picks.

### src/services/usbScannerService.ts (11 errors)

- Narrow HID union (`vendorId`, `usagePage`) before comparison.
- Propagate optional device `path` with fallback empty string or skip mapping.

### src/services/user.service.ts (6 errors)

- Align repository inputs with optional typing; pass `role ?? undefined`.
- Use camelCase when calling `updateUser`.
- Inject repository dependency instead of referencing global `prisma`.

### src/utils/databaseQueryOptimizer.ts (17 errors)

- Add parameter types for `map` callbacks.
- Ensure `parallelQueries` returns `Promise<T[]>` by awaiting delegate calls.
- Handle possibly undefined totals before arithmetic.
- Strengthen typed return shapes for summary builders.

### src/utils/dataTransformationPipeline.ts (11 errors)

- Guard `schema` before iterating fields.
- Extend `FieldDefinition` type to include `maxLength` metadata or move metadata storage elsewhere.
- Normalize worksheet lookups when sheet names absent.

### src/utils/errorHandler.ts (2 errors)

- Pass `context ?? {}` or adjust `ErrorHandlerOptions` signature to accept `context?: ErrorContext | undefined`.

### src/utils/importTransactionManager.ts (6 errors)

- Validate `batch` existence before access; adjust type from `any[] | undefined`.
- Provide explicit variables for `student_id`/`equipment_id` before shorthand usage.

### src/utils/performanceDecorators.ts (2 errors)

- Default `metadata` to `{}` or widen target type to accept `undefined`.

### src/websocket/eventTypes.ts (2 errors)

- Ensure `userId`/`sessionId` default to empty string or update interface to allow undefined.
- For response payload, maintain same generic type without `NonNullable` cast.

### src/websocket/realtimeService.ts (2 errors)

- Update session DTO typing to expose `max_time_minutes` or map to camelCase property.

### src/websocket/websocketServer.ts (2 errors)

- Remove `updated_at` from create call; Prisma manages timestamps.
- When filtering notifications, supply explicit `StringNullableFilter` structure when `user_id` undefined.

## Next Diagnostic Pass

1. Wrap up Prisma delegate/type mismatches in `queryOptimizationService.ts` and remove residual `any` usage in performance services.
2. Address scanner-related exactOptionalPropertyTypes errors.
3. Re-run `pnpm exec tsc --noEmit` after each cluster to refresh counts and update this log.
