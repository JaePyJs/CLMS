# Quickstart: Production-Readiness Development

**Feature**: 001-production-readiness  
**Date**: 2025-11-05  
**Purpose**: Guide developers through production-readiness improvements

## Prerequisites

Before starting production-readiness work, ensure you have:

- [x] Node.js 22.x LTS or 20.x LTS installed
- [x] npm 10+ or pnpm 9+ installed
- [x] Docker Desktop installed (for MySQL container)
- [x] VS Code with recommended extensions:
  - ESLint
  - Prettier
  - TypeScript + JavaScript
  - Playwright Test
  - Prisma
- [x] Git configured
- [x] Access to CLMS repository on `001-production-readiness` branch

---

## Quick Setup (5 minutes)

### 1. Clone and Install

```bash
# If not already cloned
git clone https://github.com/JaePyJs/CLMS.git
cd CLMS

# Checkout production-readiness branch
git checkout 001-production-readiness

# Install dependencies for both workspaces
cd Backend
npm install
cd ../Frontend
npm install
cd ..
```

### 2. Environment Configuration

```bash
# Backend environment
cp Backend/.env.example Backend/.env

# Edit Backend/.env with your settings:
# DATABASE_URL="mysql://root:password@localhost:3306/clms"
# JWT_SECRET="your-super-secret-jwt-key-change-in-production"
# JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-in-production"
# NODE_ENV="development"
# PORT=3000

# Frontend environment
cp Frontend/.env.example Frontend/.env

# Edit Frontend/.env:
# VITE_API_URL="http://localhost:3000/api"
# VITE_WS_URL="ws://localhost:3000"
```

### 3. Database Setup

```bash
# Start MySQL with Docker Compose
docker-compose up -d mysql

# Run migrations
cd Backend
npx prisma migrate dev
npx prisma db seed  # Optional: seed with test data

# Verify database
npx prisma studio  # Opens browser UI at http://localhost:5555
```

### 4. Run Development Servers

**Terminal 1 - Backend**:

```bash
cd Backend
npm run dev
```

**Terminal 2 - Frontend**:

```bash
cd Frontend
npm run dev
```

**Terminal 3 - Tests (optional)**:

```bash
# Run tests in watch mode
cd Backend
npm run test:watch

# Or Frontend
cd Frontend
npm run test:watch
```

### 5. Verify Setup

- Backend: http://localhost:3000/api/health
- Frontend: http://localhost:5173
- Prisma Studio: http://localhost:5555

---

## Development Workflow

### Daily Workflow

```bash
# 1. Pull latest changes
git pull origin 001-production-readiness

# 2. Install any new dependencies
cd Backend && npm install
cd ../Frontend && npm install

# 3. Run database migrations (if any)
cd Backend && npx prisma migrate dev

# 4. Start development servers (see above)

# 5. Make changes following Constitution principles

# 6. Run quality checks before commit
npm run type-check   # TypeScript
npm run lint         # ESLint
npm run format       # Prettier
npm run test         # Unit tests

# 7. Commit with conventional commits
git add .
git commit -m "fix: eliminate runtime error in Dashboard component"
git push
```

### Quality Gates (Run Before Every Commit)

```bash
# Backend checks
cd Backend
npm run type-check    # tsc --noEmit (zero errors required)
npm run lint          # eslint --max-warnings 0
npm run format:check  # prettier --check
npm run test          # vitest run
npm run build         # Verify production build

# Frontend checks
cd Frontend
npm run type-check    # tsc --noEmit (zero errors required)
npm run lint          # eslint --max-warnings 0
npm run format:check  # prettier --check
npm run test          # vitest run
npm run build         # Verify production build
```

**All checks must pass before commit.** If any fail, fix errors and re-run.

---

## Common Development Tasks

### Fix Runtime Error

```bash
# 1. Reproduce error in browser
# - Open browser DevTools (F12)
# - Navigate to problematic screen
# - Note error in Console tab

# 2. Locate error source
# - Check stack trace in console
# - Use VS Code search (Ctrl+Shift+F) for error message

# 3. Add error boundary if missing
# Frontend/src/components/ErrorBoundary.tsx already exists
# Wrap component in App.tsx:

# Before:
<Suspense fallback={<LoadingSkeleton />}>
  <DashboardOverview />
</Suspense>

# After:
<ErrorBoundary fallback={<ErrorFallback />}>
  <Suspense fallback={<LoadingSkeleton />}>
    <DashboardOverview />
  </Suspense>
</ErrorBoundary>

# 4. Add try-catch for async errors
try {
  const data = await fetchData();
  setData(data);
} catch (error) {
  console.error('Failed to fetch data:', error);
  setError(error.message);
}

# 5. Verify fix
# - Reload browser
# - Repeat error scenario
# - Confirm no console errors
```

### Add Validation to Form

```bash
# 1. Define Zod schema (or import existing)
# Backend/src/validation/student.validation.ts

import { z } from 'zod';

export const studentSchema = z.object({
  student_id: z.string().min(3).max(20),
  first_name: z.string().min(1).max(50),
  last_name: z.string().min(1).max(50),
  grade_level: z.number().int().min(1).max(12),
  section: z.string().min(1).max(20),
});

# 2. Use in frontend form
# Frontend/src/components/students/StudentForm.tsx

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { studentSchema } from '../../schemas/student.schema';

const form = useForm({
  resolver: zodResolver(studentSchema),
});

# 3. Add validation middleware to backend
# Backend/src/routes/students.ts

import { validate } from '../middleware/validation';
import { studentSchema } from '../validation/student.validation';

router.post('/students',
  authenticate,
  authorize(['LIBRARIAN']),
  validate({ body: studentSchema }),
  studentController.create
);

# 4. Test validation
# - Frontend: Submit form with invalid data, verify error messages
# - Backend: Use curl or Postman to POST invalid data, verify 400 response
```

### Fix Responsive Layout Issue

```bash
# 1. Identify problematic screen size
# - Open browser DevTools (F12)
# - Click "Toggle device toolbar" (Ctrl+Shift+M)
# - Test at 320px, 768px, 1024px, 1920px

# 2. Add Tailwind responsive classes
# Before (desktop-only):
<div className="w-1/2 p-8">
  Content
</div>

# After (mobile-first):
<div className="w-full p-4 md:w-3/4 md:p-6 lg:w-1/2 lg:p-8">
  Content
</div>

# 3. Test navigation on mobile
# - Verify hamburger menu appears < 768px
# - Verify full nav bar appears ≥ 768px

# 4. Run Lighthouse mobile audit
# - Open DevTools > Lighthouse tab
# - Select "Mobile" device
# - Run audit
# - Fix any issues (score should be > 90)
```

### Add Accessibility Features

```bash
# 1. Run automated a11y test
cd Frontend
npm run test:a11y  # Runs axe-playwright tests

# 2. Fix common issues

# Missing ARIA label:
<button aria-label="Close dialog">
  <XIcon />
</button>

# Missing form label:
<label htmlFor="student-id">Student ID</label>
<input id="student-id" name="student_id" />

# Non-semantic HTML:
# ❌ Before:
<div onClick={handleClick}>Click me</div>

# ✅ After:
<button onClick={handleClick}>Click me</button>

# 3. Test keyboard navigation
# - Use Tab to navigate through all interactive elements
# - Verify focus indicators visible
# - Use Enter/Space to activate buttons
# - Use Escape to close dialogs

# 4. Test with screen reader (optional but recommended)
# - Windows: NVDA (free download)
# - Mac: VoiceOver (built-in, Cmd+F5)
# - Verify all elements have meaningful labels
```

### Optimize Performance

```bash
# 1. Analyze bundle size
cd Frontend
npm run build
npm run preview  # Opens production build

# Check dist/stats.html for bundle visualization

# 2. Identify large dependencies
# Look for heavy libraries:
# - Chart libraries (recharts, chart.js)
# - QR/Barcode generators
# - PDF generators
# - Icon libraries

# 3. Implement code splitting
# Before:
import { QRCodeGenerator } from './QRCodeGenerator';

# After:
const QRCodeGenerator = lazy(() => import('./QRCodeGenerator'));

<Suspense fallback={<Spinner />}>
  <QRCodeGenerator />
</Suspense>

# 4. Add virtual scrolling for long lists
# Before:
{students.map(student => <StudentCard key={student.id} student={student} />)}

# After:
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={students.length}
  itemSize={80}
>
  {({ index, style }) => (
    <StudentCard student={students[index]} style={style} />
  )}
</FixedSizeList>

# 5. Run Lighthouse performance audit
# - Open DevTools > Lighthouse
# - Run performance audit
# - Target: FCP < 1.5s, TTI < 3.5s, bundle < 200KB
```

### Write Unit Test

```bash
# 1. Create test file next to component/service
# Frontend/src/services/studentService.test.ts

import { describe, it, expect, vi } from 'vitest';
import { studentService } from './studentService';

describe('studentService', () => {
  it('fetches students successfully', async () => {
    const mockData = [{ id: '1', name: 'John Doe' }];
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ data: mockData }),
      })
    );

    const result = await studentService.getAll();
    expect(result).toEqual(mockData);
  });
});

# 2. Run tests
npm run test  # Run all tests once
npm run test:watch  # Watch mode
npm run test:coverage  # Generate coverage report

# 3. Verify coverage
# - Open coverage/index.html in browser
# - Ensure > 70% coverage
# - Focus on critical paths (auth, checkout, fines)
```

### Write E2E Test

```bash
# 1. Create test file
# tests/e2e/checkout.spec.ts

import { test, expect } from '@playwright/test';

test('librarian can checkout book to student', async ({ page }) => {
  // Login
  await page.goto('http://localhost:5173');
  await page.fill('[name="username"]', 'librarian');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  // Navigate to checkout
  await page.click('text=Checkout');

  // Scan student barcode
  await page.fill('[name="student_barcode"]', 'STU-12345');

  // Scan book barcode
  await page.fill('[name="book_barcode"]', 'BOOK-67890');

  // Confirm checkout
  await page.click('button:has-text("Confirm Checkout")');

  // Verify success message
  await expect(page.locator('text=Book checked out successfully')).toBeVisible();
});

# 2. Run E2E tests
cd tests
npx playwright test
npx playwright test --ui  # Interactive mode
npx playwright show-report  # View results
```

---

## Debugging Tips

### TypeScript Errors

```bash
# Show all errors
cd Backend  # or Frontend
npx tsc --noEmit

# Fix common errors:

# Error: Type 'any' is not assignable to type...
# Fix: Add explicit type annotation
const data: Student[] = await fetchStudents();

# Error: Object is possibly 'null' or 'undefined'
# Fix: Add null check
if (user) {
  console.log(user.name);
}

# Error: Property 'xyz' does not exist on type...
# Fix: Update type definition or use optional chaining
user?.xyz
```

### Linting Errors

```bash
# Show all errors
npm run lint

# Auto-fix many errors
npm run lint:fix

# Common issues:

# Error: 'React' must be in scope when using JSX
# Fix: import React from 'react';

# Error: Missing return type on function
# Fix: Add explicit return type
function getStudent(id: string): Promise<Student> {
  return fetch(`/api/students/${id}`);
}
```

### Runtime Errors

```bash
# Check browser console (F12)
# Look for:
# - Uncaught TypeError
# - Unhandled Promise Rejection
# - Network errors (failed API calls)

# Add console.log for debugging
console.log('Variable value:', someVariable);

# Use React DevTools
# - Install React DevTools extension
# - Inspect component props/state
# - Profile component rendering
```

### Database Errors

```bash
# Reset database
cd Backend
npx prisma migrate reset  # Warning: Deletes all data

# View current schema
npx prisma studio

# Check migration status
npx prisma migrate status

# Apply pending migrations
npx prisma migrate deploy
```

---

## Testing Strategy

### Unit Tests (70% of tests)

**What to test**:

- Services (business logic)
- Utilities (helper functions)
- Hooks (custom React hooks)
- Components (UI logic, not styling)

**Example**:

```typescript
// Test service
describe("authService", () => {
  it("validates JWT token", () => {
    const token = authService.generateToken({ userId: "123" });
    const decoded = authService.verifyToken(token);
    expect(decoded.userId).toBe("123");
  });
});
```

### Integration Tests (20% of tests)

**What to test**:

- API contracts (request/response schemas)
- Database operations
- Authentication/authorization flows

**Example**:

```typescript
describe("POST /api/students", () => {
  it("creates student with valid data", async () => {
    const response = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${token}`)
      .send(validStudentData)
      .expect(201);

    expect(response.body.id).toBeDefined();
  });
});
```

### E2E Tests (10% of tests)

**What to test**:

- Critical user workflows
- Login → Dashboard → Logout
- Checkout → Return flow
- Search → View details

**Example**:

```typescript
test("complete checkout flow", async ({ page }) => {
  await loginAsLibrarian(page);
  await navigateToCheckout(page);
  await scanStudent(page, "STU-12345");
  await scanBook(page, "BOOK-67890");
  await confirmCheckout(page);
  await verifyCheckoutSuccess(page);
});
```

---

## Deployment Checklist

Before deploying to production:

- [ ] All tests pass (unit, integration, E2E)
- [ ] TypeScript compilation successful (zero errors)
- [ ] Linting passes (zero warnings)
- [ ] Code formatted with Prettier
- [ ] Build successful (Frontend + Backend)
- [ ] Bundle size < 200KB gzipped (Frontend)
- [ ] Lighthouse scores > 90 (Performance, Accessibility, Best Practices)
- [ ] All accessibility tests pass (zero critical violations)
- [ ] Database migrations tested in staging
- [ ] Environment variables configured for production
- [ ] Security headers verified (Helmet.js)
- [ ] Rate limiting configured
- [ ] Error monitoring configured (Winston logs)
- [ ] Backup strategy in place
- [ ] Rollback plan documented

---

## Helpful Commands Reference

### Package Management

```bash
# Install dependencies
npm install

# Update dependencies
npm update

# Check for outdated packages
npm outdated

# Install specific version
npm install package@version
```

### Development

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test
npm run test:watch
npm run test:coverage

# Linting & Formatting
npm run lint
npm run lint:fix
npm run format
npm run format:check

# Type checking
npm run type-check
```

### Database (Prisma)

```bash
# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy

# Reset database
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio

# Seed database
npx prisma db seed
```

### Docker

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Restart service
docker-compose restart mysql

# Remove volumes (delete data)
docker-compose down -v
```

### Git

```bash
# Create branch
git checkout -b feature-name

# Commit with conventional commits
git commit -m "type: description"
# Types: feat, fix, docs, refactor, test, chore

# Push to remote
git push origin branch-name

# Pull latest changes
git pull origin branch-name

# View status
git status

# View diff
git diff
```

---

## Getting Help

### Documentation

- **CLMS README**: `/README.md`
- **API Docs**: http://localhost:3000/api/info
- **Constitution**: `.specify/memory/constitution.md`
- **Deployment Guide**: `/DEPLOYMENT_GUIDE.md`
- **Bug Tracker**: `/BUGS_AND_FIXES.md`

### Tools Documentation

- **React**: https://react.dev
- **TypeScript**: https://www.typescriptlang.org/docs
- **Vite**: https://vitejs.dev/guide
- **Prisma**: https://www.prisma.io/docs
- **Playwright**: https://playwright.dev/docs/intro
- **Vitest**: https://vitest.dev/guide
- **Tailwind CSS**: https://tailwindcss.com/docs

### Troubleshooting

**Common Issues**:

1. **Port already in use**:

   ```bash
   # Kill process using port 3000
   npx kill-port 3000
   ```

2. **Dependencies not found**:

   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Database connection failed**:

   ```bash
   # Verify MySQL container running
   docker-compose ps
   # Restart MySQL
   docker-compose restart mysql
   ```

4. **Build errors**:
   ```bash
   # Clear cache and rebuild
   rm -rf dist
   npm run build
   ```

---

## Next Steps

After completing quickstart setup:

1. **Read the feature spec**: `specs/001-production-readiness/spec.md`
2. **Review research findings**: `specs/001-production-readiness/research.md`
3. **Understand data model**: `specs/001-production-readiness/data-model.md`
4. **Check API contracts**: `specs/001-production-readiness/contracts/api-validation.md`
5. **Start implementing**: Use `/speckit.tasks` to generate task breakdown

**Focus on one screen at a time**, following the Constitution principles:

- Error elimination first (P1)
- Accessibility and responsiveness (P2)
- Performance optimization (P3)
- Comprehensive testing throughout

Good luck making CLMS production-ready! 🚀
