# CLMS Dependency Update Guide

**Last Updated**: November 5, 2025  
**Constitution Version**: 1.0.1

This guide provides instructions for updating CLMS dependencies to the latest stable versions as specified in the constitution.

---

## 🎯 Target Versions (November 2025)

### Frontend Dependencies

#### Core Framework

```json
{
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "typescript": "^5.7.2",
  "vite": "^6.0.0"
}
```

#### State Management & Data Fetching

```json
{
  "@tanstack/react-query": "^5.59.0",
  "@tanstack/react-query-devtools": "^5.59.0",
  "zustand": "^5.0.0",
  "axios": "^1.7.7"
}
```

#### UI Components & Styling

```json
{
  "@radix-ui/react-*": "latest (1.x stable)",
  "tailwindcss": "^3.4.15",
  "tailwindcss-animate": "^1.0.7",
  "framer-motion": "^11.11.0",
  "lucide-react": "^0.454.0",
  "next-themes": "^0.4.3"
}
```

#### Forms & Validation

```json
{
  "react-hook-form": "^7.53.0",
  "zod": "^3.23.8",
  "@hookform/resolvers": "^3.9.1"
}
```

#### Testing

```json
{
  "vitest": "^2.1.3",
  "@vitest/ui": "^2.1.3",
  "@vitest/coverage-v8": "^2.1.3",
  "@testing-library/react": "^16.0.1",
  "@testing-library/jest-dom": "^6.6.3",
  "@testing-library/user-event": "^14.5.2",
  "playwright": "^1.48.2",
  "@playwright/test": "^1.48.2",
  "axe-playwright": "^2.0.3"
}
```

#### Build & Development Tools

```json
{
  "@vitejs/plugin-react": "^4.3.3",
  "eslint": "^9.14.0",
  "prettier": "^3.3.3",
  "@typescript-eslint/eslint-plugin": "^8.13.0",
  "@typescript-eslint/parser": "^8.13.0"
}
```

---

### Backend Dependencies

#### Core Framework

```json
{
  "express": "^4.21.1",
  "typescript": "^5.7.2",
  "@types/express": "^5.0.0",
  "@types/node": "^22.9.0"
}
```

#### Database & ORM

```json
{
  "prisma": "^6.0.0",
  "@prisma/client": "^6.0.0"
}
```

#### Authentication & Security

```json
{
  "jsonwebtoken": "^9.0.2",
  "bcryptjs": "^2.4.3",
  "helmet": "^8.0.0",
  "express-rate-limit": "^7.4.1",
  "cors": "^2.8.5"
}
```

#### Validation & Utilities

```json
{
  "zod": "^3.23.8",
  "express-validator": "^7.2.0",
  "date-fns": "^4.1.0",
  "uuid": "^11.0.2"
}
```

#### Logging & Monitoring

```json
{
  "winston": "^3.15.0"
}
```

#### Testing

```json
{
  "vitest": "^2.1.3",
  "@vitest/coverage-v8": "^2.1.3",
  "supertest": "^7.0.0",
  "@types/supertest": "^6.0.2"
}
```

#### Development Tools

```json
{
  "tsx": "^4.20.6",
  "eslint": "^9.14.0",
  "prettier": "^3.3.3",
  "@typescript-eslint/eslint-plugin": "^8.13.0",
  "@typescript-eslint/parser": "^8.13.0"
}
```

---

## 📦 Update Procedures

### Step 1: Check Current Versions

```bash
# Check outdated packages in Frontend
cd Frontend
npm outdated

# Check outdated packages in Backend
cd Backend
npm outdated

# Check outdated packages in root
npm outdated
```

### Step 2: Update Frontend Dependencies

```bash
cd Frontend

# Update major dependencies (CAREFULLY - test after each)
npm install react@^19.0.0 react-dom@^19.0.0
npm install vite@^6.0.0
npm install @tanstack/react-query@^5.59.0 @tanstack/react-query-devtools@^5.59.0
npm install zustand@^5.0.0
npm install typescript@^5.7.2
npm install vitest@^2.1.3 @vitest/ui@^2.1.3 @vitest/coverage-v8@^2.1.3
npm install playwright@^1.48.2 @playwright/test@^1.48.2

# Update minor dependencies (safer)
npm update

# Update Radix UI components (all at once)
npm install @radix-ui/react-accordion@latest \
  @radix-ui/react-alert-dialog@latest \
  @radix-ui/react-avatar@latest \
  @radix-ui/react-checkbox@latest \
  @radix-ui/react-dialog@latest \
  @radix-ui/react-dropdown-menu@latest \
  @radix-ui/react-icons@latest \
  @radix-ui/react-label@latest \
  @radix-ui/react-popover@latest \
  @radix-ui/react-progress@latest \
  @radix-ui/react-scroll-area@latest \
  @radix-ui/react-select@latest \
  @radix-ui/react-separator@latest \
  @radix-ui/react-slot@latest \
  @radix-ui/react-switch@latest \
  @radix-ui/react-tabs@latest \
  @radix-ui/react-toast@latest \
  @radix-ui/react-tooltip@latest

# Update dev dependencies
npm install -D @typescript-eslint/eslint-plugin@^8.13.0 \
  @typescript-eslint/parser@^8.13.0 \
  eslint@^9.14.0 \
  prettier@^3.3.3
```

### Step 3: Update Backend Dependencies

```bash
cd Backend

# Update major dependencies (CAREFULLY - test after each)
npm install prisma@^6.0.0 @prisma/client@^6.0.0
npm install typescript@^5.7.2
npm install vitest@^2.1.3 @vitest/coverage-v8@^2.1.3
npm install supertest@^7.0.0

# Update minor dependencies
npm update

# Update dev dependencies
npm install -D @typescript-eslint/eslint-plugin@^8.13.0 \
  @typescript-eslint/parser@^8.13.0 \
  eslint@^9.14.0 \
  prettier@^3.3.3 \
  tsx@^4.20.6
```

### Step 4: Update Root Dependencies

```bash
cd ../ # Back to root

# Update Playwright in root (for E2E tests)
npm install -D @playwright/test@^1.48.2 playwright@^1.48.2
```

---

## 🧪 Testing After Updates

### Critical Test Sequence

**IMPORTANT**: Test after EACH major update, not all at once!

#### 1. Type Checking

```bash
# Frontend
cd Frontend
npx tsc --noEmit

# Backend
cd Backend
npx tsc --noEmit
```

#### 2. Linting

```bash
# Frontend
cd Frontend
npm run lint

# Backend
cd Backend
npm run lint
```

#### 3. Unit Tests

```bash
# Frontend
cd Frontend
npm test

# Backend
cd Backend
npm test
```

#### 4. Build Test

```bash
# Frontend
cd Frontend
npm run build

# Backend
cd Backend
npm run build
```

#### 5. Development Server Test

```bash
# Start all services
docker-compose up

# Verify:
# - Frontend loads at http://localhost:5173
# - Backend responds at http://localhost:3001/health
# - No console errors
# - Can login and navigate tabs
```

#### 6. E2E Tests

```bash
# Run E2E tests
npm run test:e2e

# Or with UI
npm run test:e2e:ui
```

---

## ⚠️ Breaking Changes to Watch

### React 19 (from 18)

- **Automatic batching**: Already enabled by default
- **New hooks**: `use()`, `useOptimistic()`, `useFormStatus()`
- **Server Components**: Not used in CLMS (client-side only)
- **Migration**: Minimal changes needed for client-side apps

### Vite 6 (from 5)

- **Improved HMR**: Faster hot module replacement
- **Environment API**: New environment configuration options
- **Deprecated**: Some legacy config options
- **Migration**: Update `vite.config.ts` if using deprecated APIs

### Prisma 6 (from 5)

- **Enhanced type safety**: Better TypeScript inference
- **Performance**: Improved query performance
- **New features**: Enhanced relations, better migrations
- **Migration**: Run `npx prisma migrate dev` after update
  ```bash
  cd Backend
  npx prisma generate
  npx prisma migrate dev --name upgrade_to_prisma_6
  ```

### TanStack Query 5.59 (latest)

- **Performance**: Better cache management
- **DevTools**: Enhanced debugging capabilities
- **Migration**: Review breaking changes in v5 if coming from v4

### Zustand 5 (from 4)

- **TypeScript**: Improved type inference
- **Middleware**: Enhanced middleware API
- **Migration**: Minimal changes needed (mostly backward compatible)

---

## 🔄 Automated Dependency Updates

### Setup Dependabot (Recommended)

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  # Frontend dependencies
  - package-ecosystem: "npm"
    directory: "/Frontend"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    groups:
      radix-ui:
        patterns:
          - "@radix-ui/*"
      typescript:
        patterns:
          - "typescript"
          - "@typescript-eslint/*"
          - "@types/*"
      testing:
        patterns:
          - "vitest"
          - "@vitest/*"
          - "playwright"
          - "@playwright/*"
          - "@testing-library/*"

  # Backend dependencies
  - package-ecosystem: "npm"
    directory: "/Backend"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    groups:
      prisma:
        patterns:
          - "prisma"
          - "@prisma/*"
      typescript:
        patterns:
          - "typescript"
          - "@typescript-eslint/*"
          - "@types/*"
      testing:
        patterns:
          - "vitest"
          - "@vitest/*"
          - "supertest"

  # Root dependencies
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5

  # Docker dependencies
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
```

---

## 🚨 Emergency Update Procedures

### Security Vulnerability Detected

```bash
# Check for vulnerabilities
npm audit

# Fix automatically (may break things!)
npm audit fix

# Fix only production dependencies
npm audit fix --only=prod

# Force fix (may introduce breaking changes)
npm audit fix --force

# Manual fix for specific package
npm install package-name@safe-version
```

### Critical Dependency Update

1. **Create emergency branch**

   ```bash
   git checkout -b emergency/security-update-PACKAGE_NAME
   ```

2. **Update specific package**

   ```bash
   npm install package-name@latest
   ```

3. **Run critical tests**

   ```bash
   npm test
   npm run build
   ```

4. **Deploy to staging**

   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

5. **Smoke test critical paths**
   - Login/logout
   - Book checkout/return
   - Student registration
   - Report generation

6. **If successful, merge and deploy**
   ```bash
   git commit -m "fix: update PACKAGE_NAME to VERSION (security patch)"
   git push origin emergency/security-update-PACKAGE_NAME
   # Create PR and merge
   ```

---

## 📊 Version Compatibility Matrix

| Component      | Minimum  | Recommended | Latest Tested |
| -------------- | -------- | ----------- | ------------- |
| Node.js        | 20.x LTS | 22.x LTS    | 22.11.0       |
| React          | 19.0.0   | 19.0.0      | 19.0.0        |
| TypeScript     | 5.6.0    | 5.7.2       | 5.7.2         |
| Vite           | 5.4.0    | 6.0.0       | 6.0.0         |
| Prisma         | 5.22.0   | 6.0.0       | 6.0.0         |
| TanStack Query | 5.8.0    | 5.59.0      | 5.59.0        |
| Playwright     | 1.40.0   | 1.48.2      | 1.48.2        |
| Vitest         | 1.0.0    | 2.1.3       | 2.1.3         |

---

## 🎯 Update Checklist

Before updating:

- [ ] Create backup branch
- [ ] Document current working versions
- [ ] Check CHANGELOG for breaking changes
- [ ] Review migration guides

During update:

- [ ] Update one major dependency at a time
- [ ] Run type check after each update
- [ ] Run tests after each update
- [ ] Check for console errors/warnings
- [ ] Verify critical user flows work

After update:

- [ ] Run full test suite
- [ ] Build production bundle
- [ ] Deploy to staging environment
- [ ] Run E2E tests on staging
- [ ] Update DEPENDENCY_UPDATE_GUIDE.md (this file)
- [ ] Update constitution if needed
- [ ] Document any issues encountered
- [ ] Commit with conventional commit message

---

## 📝 Update Log

| Date       | Version | Changes                                     | Issues |
| ---------- | ------- | ------------------------------------------- | ------ |
| 2025-11-05 | Initial | Created update guide with Nov 2025 versions | None   |

---

## 🔗 Useful Resources

- **React 19 Release Notes**: https://react.dev/blog/2025/
- **Vite 6 Migration Guide**: https://vite.dev/guide/migration
- **Prisma 6 Upgrade Guide**: https://www.prisma.io/docs/guides/upgrade-guides
- **TanStack Query Docs**: https://tanstack.com/query/latest/docs/react/overview
- **Playwright Updates**: https://playwright.dev/docs/release-notes

---

**Constitution Compliance**: This guide ensures all dependencies meet the production-readiness, type safety, and security requirements specified in CLMS Constitution v1.0.1.
