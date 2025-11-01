# Frontend TS6133 Cleanup – Commit Message Drafts

These commit messages are prepared per modified file. Each focuses on unused imports/variables (TS6133) and safe type-only changes.

## Analytics Components

1) Frontend/src/components/analytics/EquipmentUtilizationAnalytics.tsx

Subject: cleanup(analytics): remove unused default React import

Body:
- Drop `React` default import; retain `useState`, `useEffect` named imports
- No runtime/UI changes; resolves TS6133 unused import warning

2) Frontend/src/components/analytics/FineCollectionAnalytics.tsx

Subject: cleanup(analytics): remove unused default React import

Body:
- Switch to named `useState`, `useEffect` imports only
- No runtime/UI changes; clears TS6133

3) Frontend/src/components/analytics/PredictiveInsights.tsx

Subject: cleanup(analytics): remove unused default React import

Body:
- Use named `useState` import; `React` default not referenced
- No functional changes; resolves TS6133

4) Frontend/src/components/analytics/TimeSeriesForecast.tsx

Subject: cleanup(analytics): remove unused default React import

Body:
- Use named `useState`, `useMemo` imports
- No UI impact; clears TS6133

5) Frontend/src/components/analytics/ExportAnalytics.tsx

Subject: cleanup(analytics): remove default React import; use ComponentType in types

Body:
- Remove `React` default import; import `type ComponentType` from `react`
- Replace `React.ComponentType` with `ComponentType` in interface properties
- Pure type-only changes; no runtime impact; resolves TS6133

6) Frontend/src/components/analytics/MetricsCards.tsx

Subject: cleanup(analytics): remove default React import; use ComponentType for icon type

Body:
- Remove `React` default import; add `type ComponentType`
- Replace `React.ComponentType` with `ComponentType` in interface
- No functional changes; resolves TS6133

## Dashboard Components

7) Frontend/src/components/dashboard/AutomationDashboard.tsx

Subject: cleanup(dashboard): remove unused React default import and unused states

Body:
- Remove `React` default import; keep named `useState`
- Drop unused `useAutomationJobs` import
- Remove unused local state: `isRefreshing`, `triggeringJobId`
- No behavioral/UI changes; clears TS6133

8) Frontend/src/components/dashboard/AnalyticsDashboard.tsx

Subject: cleanup(dashboard): remove unused imports and helpers flagged by TS6133

Body:
- Remove unused `ButtonLoading`, `useAppStore`, and `useExportData` imports
- Delete unused helper functions: `calculateTotalStudents`, `calculatePeakTime`, `calculateAverageSessionTime`
- No runtime changes; functions were not referenced; resolves TS6133

9) Frontend/src/components/dashboard/BookCatalog.tsx

Subject: cleanup(dashboard): remove unused isTablet/isDesktop from mobile optimization

Body:
- Keep only `isMobile` from `useMobileOptimization()`
- No functional/UI change; resolves TS6133

## Verification

- Ran `tsc --noEmit` and filtered for `TS6133` across modified analytics and dashboard files; no remaining TS6133 in these targets
- Broader repo still has other type errors (per PLANNING.md); out of scope for this change

## Notes

- All changes are non-visual; no preview required
- Prefer squashing these into a single "TS6133 cleanup" commit per area if desired