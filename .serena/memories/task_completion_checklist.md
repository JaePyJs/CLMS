# Task Completion Checklist
- Run targeted TypeScript compile (`npm exec -- tsc --noEmit`) for affected workspace, prioritizing backend errors per current mandate.
- Execute relevant Vitest suite(s) when logic changes impact business rules or Prisma queries.
- Update `PLANNING.md` with progress notes and remaining TODOs after each task per repository guidelines.
- Refresh any touched documentation/markdown artifacts tied to the change scope.
- Review terminal output for errors, address blockers before lint warnings unless user requests otherwise.
