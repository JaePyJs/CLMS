# Guidelines

Here are some project rules you should add to maintain quality and consistency while working on your CLMS migration and development:

- All code changes must pass strict TypeScript checks with zero errors before merging.
- Every major change must be accompanied by corresponding unit and integration tests that cover all critical paths.
- Documentation must be limited strictly to README.md and PLANNING.md to avoid fragmentation. All other MD files should be merged or removed.
- All tasks must be broken down into small, manageable pieces focusing on one problem or feature at a time.
- Code commits should be atomic and include descriptive messages referencing corresponding tasks or issues.
- Prioritize fixing blocking errors before addressing lint or style warnings.   
- Code reviews must verify type safety, adherence to component architecture, and React 19 compatibility before approval.
- Run full end-to-end frontend builds and manual smoke tests after migration steps.
- Any third-party library updates require compatibility verification with React 19 and TypeScript.  
- Maintain transparency and document progress clearly in PLANNING.md at all times.
- Double-check your work thoroughly before marking any task as completed.
- Any third-party library updates require compatibility verification with React 19 and TypeScript.
- Maintain transparency and document progress clearly in PLANNING.md at all times.
- only update markdown files (README.md, PLANNING.md)

These rules help keep your project stable, easy to navigate, and aligned with your migration goals.
