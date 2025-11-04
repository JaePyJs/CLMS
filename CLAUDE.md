# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CLMS (Centralized Library Management System)** is a production-ready, full-stack educational library management platform with:

- **193+ API endpoints** (28 route modules)
- **115+ React components** with TypeScript
- **20+ database tables** with Prisma ORM
- **Comprehensive automation** with Redis queues
- **92% complete** with real-time features

See **[README.md](README.md)** (1400+ lines) for complete documentation.

---

## Essential Development Commands

### Infrastructure & Setup

```bash
# Start all services (MySQL, Redis, Frontend, Backend)
docker-compose up -d

# Install all dependencies
npm run install:all

# View logs
npm run logs              # All services
npm run logs:backend      # Backend only
npm run logs:frontend     # Frontend only

# Stop services
npm run stop              # Stops containers
npm run clean             # Stops and removes volumes
```

### Backend Development

```bash
cd Backend

# Development
npm run dev              # Start with hot-reload (tsx watch)
npm run start:dev        # Alternative dev command

# Database
npm run db:generate      # Regenerate Prisma client
npm run db:push          # Push schema changes (dev)
npm run db:migrate       # Create migration
npm run db:studio        # Open Prisma Studio (GUI)
npm run db:seed          # Seed database with sample data

# Testing
npm test                 # Run Jest tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report

# Build & Run
npm run build            # TypeScript compilation
npm start                # Production start (dist/index.js)

# Code Quality
npm run lint             # ESLint
npm run lint:fix         # Fix ESLint issues
npm run format           # Prettier formatting
```

### Frontend Development

```bash
cd Frontend

# Development
npm run dev              # Vite dev server (port 3000)

# Building
npm run build            # Production build (dist/)
npm run preview          # Preview production build

# Testing
npm test                 # Vitest tests
npm run test:ui          # Vitest UI
npm run test:coverage    # Coverage with V8

# Code Quality
npm run lint             # ESLint
npm run lint:fix         # Fix ESLint issues
```

### E2E Testing

```bash
# Run Playwright E2E tests
npm run test:e2e              # All E2E tests
npm run test:e2e:ui           # With Playwright UI
npm run test:e2e:debug        # Debug mode
npm run test:report           # View HTML report

# Specific test
npx playwright test auth.spec.ts
npx playwright test --project=chromium-desktop
```

### Quick Start (First Time)

```bash
# 1. Start infrastructure
docker-compose up -d

# 2. Setup environment
cp Backend/.env.example Backend/.env
# Edit Backend/.env with your database credentials

# 3. Initialize database
cd Backend
npx prisma generate
npx prisma db push
npm run db:seed

# 4. Start dev servers
cd ../ && npm run dev
# Frontend: http://localhost:3000
# Backend: http://localhost:3001
# Health: http://localhost:3001/health
# Adminer (DB): http://localhost:8080
```

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLMS Monorepo                           │
├─────────────────────┬───────────────────┬───────────────────┤
│   Frontend (3000)   │   Backend (3001)  │   Infrastructure  │
│                     │                   │                   │
│   • React 19 SPA    │   • Express API   │   • MySQL :3308   │
│   • Vite HMR        │   • 193+ routes   │   • Redis :6380   │
│   • PWA support     │   • Prisma ORM    │   • Adminer:8080  │
│   • 115+ components │   • JWT Auth      │                   │
└─────────────────────┴───────────────────┴───────────────────┘
```

### Request Flow Pattern

```
┌──────────────┐
│   Client     │
│  (Browser)   │
└──────┬───────┘
       │ HTTP Request
       ▼
┌──────────────────┐    ┌──────────────┐    ┌─────────────────┐
│  Middleware      │ -> │   Route      │ -> │    Service      │
│                  │    │  Handler     │    │    Layer        │
│  • Helmet        │    │              │    │                 │
│  • CORS          │    │  Business    │    │  • studentSvc   │
│  • Rate Limit    │    │  Logic       │    │  • bookSvc      │
│  • Auth          │    │              │    │  • authSvc      │
│  • Validation    │    │              │    │                 │
└──────────────────┘    └──────┬───────┘    └────────┬────────┘
                                │                       │
                                ▼                       ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │   Repository     │    │   Prisma ORM    │
                       │                  │    │                 │
                       │  Data Access     │    │  Database       │
                       │  Pattern         │    │  Queries        │
                       └────────┬─────────┘    └────────┬────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────────────────────────┐
                       │          MySQL Database            │
                       │                                     │
                       │  20+ Tables: students, books, etc.  │
                       └─────────────────────────────────────┘
```

### State Management Architecture

**Frontend uses hybrid state pattern:**

1. **Server State (TanStack Query):**

   - API data with automatic caching (5-min stale time)
   - Synchronization across components
   - Background refetching

   ```typescript
   // ✅ DO: Use React Query for server state
   const { data, isLoading } = useQuery({
     queryKey: ["students"],
     queryFn: fetchStudents,
   });

   // ❌ DON'T: Use useState for server data
   const [students, setStudents] = useState([]);
   ```

2. **Global State (Zustand):**

   - Authentication state
   - UI preferences (theme, layout)
   - Cross-component interactions

   ```typescript
   // ✅ DO: Use Zustand for global UI/auth state
   const { user, login } = useAuthStore();

   // ❌ DON'T: Prop drill authentication
   <Component user={user} onLogin={login} />;
   ```

3. **Local State (useState):**

   - Form inputs
   - Component-specific UI
   - Temporary calculations

4. **Context (React Context):**
   - AuthContext (authentication)
   - ThemeContext (theming)
   - WebSocketContext (real-time)

** NEVER mix these patterns** - use the right tool for each state type.

### Backend Architecture (Layered Pattern)

**Request Flow:**

```
Request → Middleware Stack → Route Handler → Service Layer →
Repository → Prisma ORM → MySQL Database
```

**Key Directories:**

- `src/routes/` - Express route handlers (~193 endpoints across 28 modules)
- `src/services/` - Business logic (studentService, bookService, authService)
- `src/middleware/` - Auth, error handling, logging, validation
- `src/config/` - Environment, database, Redis configuration
- `src/utils/` - Logger, helpers, validation utilities
- `prisma/schema.prisma` - Database schema (20+ tables)

**Example Route Pattern:**

```typescript
// src/routes/students.ts
router.post(
  "/",
  authenticate, // JWT auth middleware
  validate(studentSchema), // Zod validation
  async (req, res) => {
    const student = await studentService.create(req.body);
    res.json({ success: true, data: student });
  }
);
```

### Frontend Architecture (Feature-Based)

**Component Structure:**

```
src/components/
├── ui/                    # shadcn/ui base components
├── dashboard/             # Dashboard pages (Students, Books, etc.)
├── Import/                # Data import components
├── mobile/                # Mobile-optimized components
├── security/              # Security dashboard
├── performance/           # Performance monitoring
└── analytics/             # Charts and reports
```

**State Management:**

- **Global State:** Zustand stores in `src/store/`
- **Server State:** TanStack Query for API data caching
- **Local State:** React useState, useReducer
- **Context:** AuthContext, ThemeContext, WebSocketContext

**Key Patterns:**

```typescript
// Custom hook pattern
export const useStudents = () => {
  return useQuery({
    queryKey: ["students"],
    queryFn: fetchStudents,
  });
};

// Typed API client
export const studentApi = {
  list: () => apiClient.get<Student[]>("/students"),
  create: (data: CreateStudentDto) =>
    apiClient.post<Student>("/students", data),
};
```

### Database Schema (Prisma)

**Core Models:**

- `students` - Student records with barcodes and photos
- `books` - Library catalog with ISBN and accessions
- `book_checkouts` - Checkout transactions and fines
- `equipment` - Equipment inventory and sessions
- `student_activities` - Activity tracking
- `automation_jobs` - Background job scheduling
- `users` - Admin/Librarian accounts with RBAC

**Key Relationships:**

- Students ↔ Book Checkouts (one-to-many)
- Students ↔ Equipment Sessions (one-to-many)
- Students ↔ Activities (one-to-many)

---

## Key Technologies & Patterns

### Technology Stack

**Frontend:**

- React 19.2.0 with TypeScript 5.6+
- Vite 5.4.11 (build tool and dev server)
- Tailwind CSS + shadcn/ui (styling)
- TanStack Query + Zustand (state)
- Radix UI primitives
- PWA with service worker

**Backend:**

- Express.js 4.21.1 + TypeScript 5.7+
- Prisma ORM 5.22.0 + MySQL 8.0
- JWT authentication with RBAC
- Redis 7 for caching and queues
- Winston for structured logging

**Testing & DevOps:**

- Vitest (frontend unit tests)
- Jest (backend tests)
- Playwright (E2E tests)
- Docker Compose (infrastructure)

---

## Common Development Patterns

### 1. Repository Pattern with Flexible IDs

**The STANDARD data access pattern:**

```typescript
// ✅ DO: Use repository with flexible ID resolution
interface Repository<T> {
  findByIdentifier(id: string | number): Promise<T | null>;
  create(data: CreateInput): Promise<T>;
  update(id: string | number, data: UpdateInput): Promise<T>;
  delete(id: string | number): Promise<void>;
}

// ✅ Usage in services
export class StudentService {
  async findStudent(identifier: string | number) {
    return repository.findByIdentifier(identifier);
    // Accepts: DB ID, student_id, barcode, scan code
  }
}

// ❌ DON'T: Use Prisma directly in route handlers
router.get("/students/:id", async (req, res) => {
  const student = await prisma.student.findUnique({
    where: { id: req.params.id },
  });
});
```

**Why:** Flexible IDs allow using barcodes, student IDs, or database IDs interchangeably, essential for scanning workflows.

### 2. Zod Validation Pattern

**All endpoints must validate input with Zod:**

```typescript
// ✅ Validation schema
const createStudentSchema = z.object({
  student_id: z.string().min(3),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  grade_level: z.number().min(1).max(12),
  barcode: z.string().optional(),
  email: z.string().email().optional(),
});

// ✅ Route with validation
router.post(
  "/students",
  authenticate,
  validate(createStudentSchema),
  async (req, res) => {
    const student = await studentService.create(req.body);
    res.json({ success: true, data: student });
  }
);

// ❌ DON'T: Skip validation or use manual checks
router.post("/students", async (req, res) => {
  if (!req.body.first_name) {
    return res.status(400).json({ error: "First name required" });
  }
});
```

### 3. Middleware Stack Pattern

**Request flows through ordered middleware:**

```typescript
// ✅ Standard middleware chain (in order)
app.use(helmet()); // Security headers (ALWAYS FIRST)
app.use(cors(corsOptions)); // CORS
app.use(compression()); // Response compression
app.use(express.json({ limit: "10mb" })); // Body parsing
app.use(requestLogger); // Request logging
app.use(authenticate); // JWT auth (BEFORE routes)
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 })); // Rate limiting

// Route handlers
app.use("/api/students", studentRoutes);
app.use("/api/books", bookRoutes);
```

**Order matters:** Security → Auth → Business logic

### 4. WebSocket Real-Time Pattern

**How real-time updates work:**

```typescript
// ✅ Backend: Broadcasting events
export class WebSocketService {
  emit(event: string, data: any) {
    this.io.emit(event, data);
  }
}

// ✅ Usage in services
export class StudentService {
  async checkIn(barcode: string) {
    const student = await this.repository.findByIdentifier(barcode);

    // Create activity
    const activity = await this.logActivity(student.id, "CHECK_IN");

    // Broadcast to all clients
    websocketService.emit("activity:new", activity);

    return student;
  }
}

// ✅ Frontend: Listening for updates
const queryClient = useQueryClient();

useEffect(() => {
  websocket.on("activity:new", (activity) => {
    // Invalidate and refetch affected queries
    queryClient.invalidateQueries(["activities"]);
    queryClient.invalidateQueries(["students", student.id]);

    // Show toast notification
    toast.success(`New activity: ${activity.type}`);
  });
}, []);
```

### 5. Error Handling Pattern

**Structured error handling throughout:**

```typescript
// ✅ Service layer throws specific errors
export class StudentService {
  async create(data: CreateStudentDto) {
    try {
      // Business logic
      return await this.repository.create(data);
    } catch (error) {
      if (error.code === "P2002") {
        throw new ValidationError("Student ID already exists");
      }
      throw new DatabaseError("Failed to create student", error);
    }
  }
}

// ✅ Middleware catches and formats errors
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const error = err instanceof AppError ? err : new DatabaseError(err.message);

  logger.error("Error handling request", { error, requestId: req.id });

  res.status(error.statusCode).json({
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
    },
    timestamp: new Date().toISOString(),
    requestId: req.id,
  });
};

// ❌ DON'T: Try-catch in every route handler
router.post("/students", async (req, res) => {
  try {
    const student = await studentService.create(req.body);
    res.json(student);
  } catch (error) {
    res.status(500).json({ error: error.message }); // DON'T
  }
});
```

### 6. Service Layer Pattern

**Services contain business logic, repositories handle data access:**

```typescript
// ✅ DO: Services orchestrate operations
export class StudentService {
  constructor(
    private repository: StudentRepository,
    private barcodeService: BarcodeService,
    private websocket: WebSocketService
  ) {}

  async create(data: CreateStudentDto) {
    // Business logic: Generate barcode if needed
    const barcode = data.barcode || (await this.barcodeService.generate());

    // Data persistence
    const student = await this.repository.create({ ...data, barcode });

    // Side effects: Notify clients
    this.websocket.emit("student:created", student);

    return student;
  }

  async checkOutBooks(studentId: string, bookIds: string[]) {
    // Complex business logic in service
    const student = await this.repository.findById(studentId);

    // Validate business rules
    if (student.status !== "ACTIVE") {
      throw new ValidationError("Student is not active");
    }

    // Process checkout
    const checkouts = await Promise.all(
      bookIds.map((bookId) => this.processBookCheckout(student, bookId))
    );

    return checkouts;
  }
}

// ❌ DON'T: Put business logic in route handlers
router.post("/students", async (req, res) => {
  const { data } = req.body;
  const barcode = data.barcode || generateBarcode(); // DON'T
  const student = await prisma.student.create({
    // DON'T
    data: { ...data, barcode },
  });
});
```

### 7. React Component Patterns

**Consistent component structure:**

```typescript
// ✅ DO: Follow this pattern for all components
interface StudentCardProps {
  student: Student;
  onEdit?: (student: Student) => void;
}

export const StudentCard = memo(({ student, onEdit }: StudentCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Optimizations for performance
  const activityQuery = useQuery({
    queryKey: ["activities", student.id],
    queryFn: () => fetchStudentActivities(student.id),
    enabled: isExpanded, // Only fetch when needed
  });

  return (
    <Card className="student-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <StudentName student={student} />
          <Button onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? "Hide" : "Show"} Activities
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent>
          {/* Lazy load heavy content */}
          {activityQuery.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <ActivityList activities={activityQuery.data} />
          )}
        </CardContent>
      )}
    </Card>
  );
});

// ✅ DO: Use proper hooks
const StudentManagement = () => {
  // Server state with React Query
  const { data: students, isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: fetchStudents,
  });

  // Local state for UI
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel | null>(null);

  // Computed state
  const filteredStudents = useMemo(() => {
    return (
      students?.filter((s) =>
        s.first_name.toLowerCase().includes(searchQuery.toLowerCase())
      ) ?? []
    );
  }, [students, searchQuery]);

  return (
    <div>
      <SearchBar onSearch={setSearchQuery} />
      <GradeFilter onSelect={setSelectedGrade} />

      {isLoading ? (
        <StudentListSkeleton />
      ) : (
        <StudentList students={filteredStudents} />
      )}
    </div>
  );
};
```

---

## Common Development Tasks

### Adding a New API Endpoint

**Step-by-step process:**

1. **Create route handler:** `Backend/src/routes/<feature>.ts`

   ```typescript
   // routes/student-notes.ts
   import { Router } from "express";
   import { authenticate } from "../middleware/authenticate.js";
   import { validate } from "../middleware/validation.js";
   import { noteSchema } from "../validation/note.schema.js";
   import { NoteService } from "../services/noteService.js";

   const router = Router();
   const noteService = new NoteService();

   router.post(
     "/notes",
     authenticate,
     validate(noteSchema),
     async (req, res) => {
       const note = await noteService.create(req.body);
       res.json({ success: true, data: note });
     }
   );

   export default router;
   ```

2. **Add Zod validation schema:** `Backend/src/validation/<feature>.schema.ts`

   ```typescript
   import { z } from "zod";

   export const noteSchema = z.object({
     student_id: z.string(),
     content: z.string().min(1),
     is_private: z.boolean().default(false),
   });
   ```

3. **Implement service logic:** `Backend/src/services/noteService.ts`

   ```typescript
   export class NoteService {
     async create(data: CreateNoteDto) {
       // Business logic here
     }
   }
   ```

4. **Update Prisma schema if needed:** `prisma/schema.prisma`

   ```prisma
   model Note {
     id         String   @id @default(cuid())
     student_id String
     content    String
     is_private Boolean  @default(false)
     created_at DateTime @default(now())
   }
   ```

   Then run: `npx prisma generate && npx prisma db push`

5. **Add tests:** `Backend/tests/services/noteService.test.ts`
   ```typescript
   describe("NoteService", () => {
     it("should create a note", async () => {
       const service = new NoteService();
       const note = await service.create(testData);
       expect(note.id).toBeDefined();
     });
   });
   ```

### Adding a New Component

1. **Create component:** `Frontend/src/components/<feature>/<Component>.tsx`

   ```typescript
   interface Props {
     data: DataType;
   }

   export const Component = memo(({ data }: Props) => {
     // Component logic
     return <div>{/* UI */}</div>;
   });
   ```

2. **Export from index:** `Frontend/src/components/<feature>/index.ts`

   ```typescript
   export { Component } from "./Component";
   ```

3. **Add to dashboard:** Update relevant dashboard component
4. **Add tests:** `Frontend/src/test/<Component>.test.tsx`

### Database Changes

1. **Update schema:** Edit `prisma/schema.prisma`
2. **Generate client:** `npm run db:generate`
3. **Dev changes:** `npm run db:push` (non-destructive)
4. **Prod migration:** `npm run db:migrate` (creates migration file)
5. **Update seed:** `Backend/src/scripts/seed.ts` if needed

**⚠️ Important:** Always test migrations in dev before running in prod!

### Environment Setup

```bash
# Backend .env (copy from .env.example)
DATABASE_URL="mysql://username:password@localhost:3308/clms_db"
JWT_SECRET="your-32+ character secret key"  # Min 32 chars!
JWT_REFRESH_SECRET="your-32+ character refresh secret"
NODE_ENV=development
PORT=3001

# Frontend .env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

**Critical:** JWT secrets must be 32+ characters or authentication will fail!

### Adding a New Service

**Complete example:**

```typescript
// 1. Create service: Backend/src/services/equipmentService.ts
export class EquipmentService {
  async reserveEquipment(equipmentId: string, studentId: string) {
    // Check availability
    const equipment = await this.repository.findById(equipmentId);
    if (equipment.status !== "AVAILABLE") {
      throw new ValidationError("Equipment not available");
    }

    // Create reservation
    const reservation = await this.repository.createReservation({
      equipment_id: equipmentId,
      student_id: studentId,
      status: "RESERVED",
    });

    // Broadcast update
    this.websocket.emit("equipment:reserved", reservation);

    return reservation;
  }
}

// 2. Create route: Backend/src/routes/equipment.ts
import { Router } from "express";
import { EquipmentService } from "../services/equipmentService.js";

const router = Router();
const equipmentService = new EquipmentService();

router.post("/equipment/:id/reserve", authenticate, async (req, res) => {
  const reservation = await equipmentService.reserveEquipment(
    req.params.id,
    req.body.student_id
  );
  res.json({ success: true, data: reservation });
});

// 3. Export route in index: Backend/src/routes/index.ts
export { default as equipmentRoutes } from "./equipment.js";

// 4. Register in app: Backend/src/app.ts
import { equipmentRoutes } from "./routes/index.js";
app.use("/api/equipment", equipmentRoutes);
```

---

## Testing Strategy

### Test Locations & Types

**Backend Tests (Jest):**

- `Backend/tests/unit/` - Service, repository, utility tests
- `Backend/tests/integration/` - API endpoint tests with Supertest
- `Backend/tests/helpers/` - Test utilities, database seeding

**Frontend Tests (Vitest):**

- `Frontend/src/test/` - Component tests with Testing Library
- `Frontend/src/test/unit/` - Hook, utility tests
- `Frontend/src/test/integration/` - Feature integration tests

**E2E Tests (Playwright):**

- `tests/e2e/` - Full workflow tests across browser engines

### Testing Patterns

**Backend Service Testing:**

```typescript
// ✅ DO: Test service logic with mocked repository
describe("StudentService", () => {
  const mockRepository = {
    findByIdentifier: jest.fn(),
    create: jest.fn(),
  };

  const service = new StudentService(mockRepository);

  it("should create student with generated barcode", async () => {
    mockRepository.create.mockResolvedValue(testStudent);

    const student = await service.create({
      student_id: "STU001",
      first_name: "John",
      last_name: "Doe",
    });

    expect(student.barcode).toBeDefined();
    expect(mockRepository.create).toHaveBeenCalledWith({
      student_id: "STU001",
      first_name: "John",
      last_name: "Doe",
      barcode: expect.any(String),
    });
  });
});
```

**Frontend Component Testing:**

```typescript
// ✅ DO: Test component behavior, not implementation
import { render, screen, fireEvent } from "@testing-library/react";
import { StudentCard } from "./StudentCard";

describe("StudentCard", () => {
  it("shows student name and shows activities on expand", async () => {
    render(<StudentCard student={mockStudent} />);

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.queryByText("Recent Activities")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Show Activities"));

    expect(await screen.findByText("Recent Activities")).toBeInTheDocument();
  });
});
```

**E2E Testing:**

```typescript
// ✅ DO: Test complete user workflows
test("student check-in flow", async ({ page }) => {
  await page.goto("/dashboard");

  // Login
  await page.fill("[data-testid=username]", "admin");
  await page.fill("[data-testid=password]", "librarian123");
  await page.click("[data-testid=login-button]");

  // Navigate to scan workspace
  await page.click("[data-testid=scan-workspace-tab]");

  // Simulate scan
  await page.fill("[data-testid=barcode-input]", "STU123456");
  await page.click("[data-testid=check-in-button]");

  // Verify success
  await expect(page.locator("[data-testid=success-toast]")).toContainText(
    "Check-in successful"
  );
});
```

### Running Specific Tests

```bash
# Backend - Single test file
cd Backend && npm test studentService.test.ts

# Backend - Watch mode (auto-reruns on changes)
npm run test:watch

# Backend - Coverage report
npm run test:coverage

# Frontend - Single component test
cd Frontend && npm test StudentCard.test.tsx

# Frontend - Test with UI (interactive)
npm run test:ui

# Frontend - Coverage
npm run test:coverage

# E2E - Specific test
npx playwright test auth.spec.ts

# E2E - Specific browser
npx playwright test --project=chromium

# E2E - Debug mode
npx playwright test --debug

# E2E - View report
npm run test:report
```

### Testing Best Practices

**DO:**

- Test behavior, not implementation
- Use descriptive test names that explain what is being tested
- Mock external dependencies (database, APIs, WebSocket)
- Use factories for test data (`TestDataFactory`)
- Test edge cases and error conditions
- Keep tests isolated and independent

**DON'T:**

- Test private methods directly
- Mock everything (integration tests should use real services)
- Write tests that depend on other tests
- Use test IDs for styling (use `data-testid` for E2E only)

---

## Access Points & URLs

| Service           | URL                            | Purpose         |
| ----------------- | ------------------------------ | --------------- |
| Frontend          | http://localhost:3000          | React dashboard |
| Backend API       | http://localhost:3001          | REST API        |
| Health Check      | http://localhost:3001/health   | System status   |
| API Docs          | http://localhost:3001/api-docs | Swagger UI      |
| Adminer (DB)      | http://localhost:8080          | Database GUI    |
| Prisma Studio     | `npm run db:studio`            | Prisma GUI      |
| Playwright Report | `playwright-report/index.html` | E2E results     |

**Default Admin Credentials:**

- Username: `admin`
- Password: `librarian123`
- ⚠️ Change after first login!

---

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port
lsof -ti:3000 | xargs kill -9  # Frontend
lsof -ti:3001 | xargs kill -9  # Backend

# Or restart Docker
docker-compose down && docker-compose up -d
```

### Database Connection Issues

```bash
# Check MySQL container
docker-compose logs mysql

# Restart database
docker-compose restart mysql

# Reset database
docker-compose down -v
docker-compose up -d mysql
cd Backend && npx prisma db push
```

### Prisma Client Out of Sync

```bash
cd Backend
npx prisma generate
npx prisma db push
```

### Node Modules Issues

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

---

## Performance Optimization

### Frontend

- **Code Splitting:** Manual chunks for React, Radix, Charts
- **Lazy Loading:** React.lazy() for routes
- **Image Optimization:** WebP, lazy loading
- **React Query:** 5-minute stale time, smart caching

### Backend

- **Connection Pooling:** 10 Prisma connections
- **Query Optimization:** Indexed queries on foreign keys
- **Redis Caching:** Frequently accessed data
- **Compression:** Gzip responses

### Database

- **Indexes:** student_id, isbn, accession_no, barcode
- **Query Plans:** Reviewed for slow queries (>1s)
- **Transactions:** READ COMMITTED isolation

---

## Security Features

- **Authentication:** JWT with 15-minute access tokens
- **Authorization:** RBAC (Admin, Librarian, Staff)
- **Password Security:** bcrypt (12 rounds)
- **Input Validation:** Zod schemas on all endpoints
- **Rate Limiting:** 100 req/15min per IP
- **Audit Logging:** All mutations tracked
- **FERPA Compliance:** Student data protection
- **Encryption:** AES-256 for sensitive fields

---

## Development Workflow

**Typical Day:**

1. `docker-compose up -d` - Start services
2. Make code changes (auto-reload enabled)
3. Run tests: `npm test` (or in parallel terminals)
4. Check logs: `npm run logs:backend`
5. Database changes: `npx prisma db push`
6. Commit and push

**Key Files to Know:**

- `Backend/src/server.ts` - Main server entry point
- `Backend/src/app.ts` - Express app bootstrap
- `Backend/src/config/database.ts` - Prisma client setup
- `Frontend/src/App.tsx` - Main React app
- `Frontend/src/lib/api.ts` - API client configuration
- `docker-compose.yml` - Infrastructure config
- `Backend/.env.example` - Environment template

---

## Additional Resources

- **Complete Documentation:** `README.md` (1400+ lines)
- **Planning & Progress:** `PLANNING.md`
- **Contributing Guide:** `CONTRIBUTING.md`
- **API Contract:** `/api-docs.json` (when backend running)
- **Database Schema:** `Backend/prisma/schema.prisma`
- **Test Reports:** `playwright-report/index.html`

---

## Configuration Files

### TypeScript Configuration

**Backend (`tsconfig.json`):**

- Target: ES2022
- Module: ESNext
- Strict mode: **ENABLED**
- Output: `./dist`

**Frontend (`tsconfig.json`):**

- Target: ES2020
- NoEmit: true (Vite handles compilation)
- Strict mode: **DISABLED** (lenient for DX)

### Environment Variables

**Backend Required:**

```bash
DATABASE_URL="mysql://..."
JWT_SECRET="32+ chars"
JWT_REFRESH_SECRET="32+ chars"
NODE_ENV=development
PORT=3001
```

**Frontend:**

```bash
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

---

## Docker Services

**Services in `docker-compose.yml`:**

- `mysql` - MySQL 8.0 (port 3308)
- `redis` - Redis 7-alpine (port 6379)
- `adminer` - Database admin UI (port 8080)
- `backend` - Express dev server (port 3001)
- `frontend` - Vite dev server (port 3000)

**Volumes:**

- `mysql_data` - Persistent MySQL data
- `redis_data` - Persistent Redis data

---

## Database Schema Overview

**20+ Tables including:**

- Identity: `users` (RBAC roles)
- Students: `students`, `student_activities`
- Library: `books`, `book_checkouts`
- Equipment: `equipment`, `equipment_sessions`
- Automation: `automation_jobs`, `automation_logs`
- Audit: `audit_logs`, `barcode_history`

**Key Features:**

- Flexible ID handling (DB ID, barcode, accession)
- Comprehensive audit trails
- Automated fine calculation
- Google Sheets synchronization
- Background job processing

---

## Code Quality Standards

- **ESLint:** Strict TypeScript rules
- **Prettier:** Consistent formatting
- **Husky:** Pre-commit hooks
- **TypeScript:** Strict mode (backend)
- **Testing:** 85%+ coverage (backend), 80%+ (frontend)
- **Security:** Input validation, audit logging, FERPA compliance

---

## Documentation

**This repository has extensive documentation:**

- `README.md` - Main documentation (1400+ lines)
- `PLANNING.md` - Project roadmap
- Inline code documentation
- API docs at `/api-docs` (when running)
- Type definitions throughout codebase

**For more information, always check `README.md` first!**

---

**Last Updated:** January 2025
**Project Status:** Production Ready (92% Complete)
**Backend:** 100% TypeScript Error-Free
**Frontend:** React 19 Migration Complete
