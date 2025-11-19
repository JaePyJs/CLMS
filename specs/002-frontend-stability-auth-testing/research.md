# Research: Frontend Stability & Authentication Testing

**Feature**: 002-frontend-stability-auth-testing  
**Date**: 2025-11-06  
**Purpose**: Resolve technical unknowns before implementation

## Research Question 1: Frontend Crash Root Cause

### Investigation

**Evidence from Session**:

- Vite dev server exits with code 0 or 1 unexpectedly
- Occurs after navigation attempts or during login flow
- No clear error messages in terminal output
- Backend shows successful requests but frontend doesn't respond

**Reproduction Steps**:

1. Start frontend server: `cd Frontend; $env:PORT=3000; npm run dev`
2. Navigate to http://localhost:3000
3. Fill login form (admin/admin123)
4. Click Sign In
5. Server exits shortly after (exit code 1)

**Root Cause Analysis**:

**Primary Suspect: Unhandled Promise Rejections in React Components**

- React 19 changed error handling behavior for unhandled promises in components
- Vite dev server terminates on unhandled rejections by default
- Login flow likely has async operation (token storage, API call) without proper error handling

**Secondary Suspect: React Router Navigation Errors**

- Redirect after login may be failing due to improper route configuration
- Navigation errors in React Router can cause component unmounting issues
- Missing error boundaries allow errors to propagate to root

**Tertiary Suspect: Vite HMR (Hot Module Replacement) Issues**

- File changes during development may trigger HMR errors
- Vite 5.4.20 has known issues with React 19 (not latest Vite 6.0)
- HMR errors can cause process termination

### Decision

**Root Cause**: Combination of unhandled promise rejections in auth flow and missing error boundaries

**Evidence**:

1. Browser console shows "Auth check failed" errors (from session logs)
2. Backend logs show `/api/auth/me` succeeds but frontend doesn't process response
3. No React Error Boundaries to catch component-level errors
4. AuthContext likely has unhandled rejections during token validation

### Solution

**1. Add React Error Boundaries**

```typescript
// Create Frontend/src/components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Log to error tracking service
  }
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

**Placement**:

- Wrap entire App.tsx with root error boundary
- Wrap each route in router with route-level boundaries
- Wrap critical components (AuthProvider, forms) with specific boundaries

**2. Fix Async Error Handling in AuthContext**

```typescript
// In AuthContext.tsx
const checkAuth = async () => {
  try {
    const response = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Auth check failed");
    const data = await response.json();
    setUser(data.user);
  } catch (error) {
    console.error("Auth check error:", error);
    // Clear invalid tokens
    localStorage.removeItem("accessToken");
    setUser(null);
    // Don't throw - let user retry
  }
};
```

**3. Add Process Error Handlers**

```typescript
// In Frontend/src/main.tsx
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
  event.preventDefault(); // Prevent process termination
});
```

**4. Update Vite Configuration**

```typescript
// In vite.config.ts
export default defineConfig({
  // ...existing config
  server: {
    // Prevent server crash on errors
    hmr: {
      overlay: true, // Show errors in browser, don't crash server
    },
  },
});
```

### Alternatives Considered

**Alternative 1: Upgrade to Vite 6.0**

- **Rejected**: Would require dependency updates across entire project
- **Risk**: May introduce breaking changes in other areas
- **Benefit**: Better React 19 compatibility, improved HMR
- **Decision**: Defer to separate upgrade effort

**Alternative 2: Switch to Webpack**

- **Rejected**: Major architectural change, high risk
- **Reason**: Vite is working when server stays up, issue is error handling
- **Decision**: Fix error handling, not build tool

**Alternative 3: Global Error Handlers Only**

- **Rejected**: Too coarse-grained, doesn't allow component recovery
- **Reason**: Error boundaries provide better UX (partial recovery)
- **Decision**: Use both global handlers (prevent crash) and boundaries (graceful recovery)

---

## Research Question 2: Login Flow Incomplete

### Investigation

**Evidence from Session**:

- POST /api/auth/login returns 200 OK with JWT tokens (verified in backend logs)
- GET /api/auth/me succeeds with user data (userId, username, role)
- Frontend doesn't redirect to dashboard after successful login
- Tokens visible in WebSocket requests (in query string), suggesting storage works
- Page stays on login route (/login) instead of navigating to /dashboard

**Backend Logs Analysis**:

```
04:27:55 [info]: Get current user successful
{
  "userId": "cmhkk3fn50000hdwmqqnpqmf1",
  "username": "admin",
  ...
}
```

**Frontend Network Tab Analysis**:

- POST /api/auth/login: 200 OK
- GET /api/auth/me: 200 OK
- No navigation events triggered

### Root Cause

**Decision**: Login success handler in frontend is not triggering navigation after token storage

**Likely Code Location**: `Frontend/src/pages/Login.tsx` or `Frontend/src/contexts/AuthContext.tsx`

**Problem Pattern**:

```typescript
// Current (broken) pattern:
const handleLogin = async (credentials) => {
  const response = await authService.login(credentials);
  // Tokens stored here
  localStorage.setItem("accessToken", response.accessToken);
  // MISSING: Navigation to dashboard
  // return; // Function exits without redirect
};
```

**Expected Pattern**:

```typescript
// Fixed pattern:
const handleLogin = async (credentials) => {
  try {
    const response = await authService.login(credentials);
    localStorage.setItem("accessToken", response.accessToken);
    setUser(response.user);
    // ADD: Navigate after successful login
    navigate("/dashboard");
  } catch (error) {
    // Show error message
    showToast("Login failed");
  }
};
```

### Solution

**1. Update Login Component**

```typescript
// In Frontend/src/pages/Login.tsx
import { useNavigate } from "react-router-dom";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (values) => {
    try {
      await login(values);
      // Redirect after successful login
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setError("Invalid credentials");
    }
  };
};
```

**2. Update AuthContext**

```typescript
// In Frontend/src/contexts/AuthContext.tsx
const login = async (credentials) => {
  setIsLoading(true);
  try {
    const response = await authApi.login(credentials);

    // Store tokens
    localStorage.setItem("accessToken", response.data.accessToken);
    localStorage.setItem("refreshToken", response.data.refreshToken);

    // Update auth state
    setUser(response.data.user);
    setIsAuthenticated(true);

    // Don't navigate here - let component handle it
    // This allows different login entry points
    return response.data;
  } catch (error) {
    setIsAuthenticated(false);
    throw error;
  } finally {
    setIsLoading(false);
  }
};
```

**3. Add Route Protection**

```typescript
// In Frontend/src/App.tsx or routing config
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};
```

### Alternatives Considered

**Alternative 1: Auto-redirect in AuthContext**

- **Rejected**: Violates separation of concerns
- **Reason**: Context shouldn't control navigation (coupling)
- **Decision**: Component controls navigation, context manages state

**Alternative 2: Redirect via Backend Response**

- **Rejected**: Backend shouldn't dictate frontend routing
- **Reason**: Frontend routes may change, backend shouldn't know
- **Decision**: Frontend handles navigation based on auth state

**Alternative 3: Use React Router's `redirect` Function**

- **Accepted** (in addition): For protected routes
- **Reason**: Cleaner than manual `<Navigate>` components
- **Implementation**: Use `loader` functions with redirect for auth checks

---

## Research Question 3: WebSocket 404 Errors

### Investigation

**Evidence from Session**:

- GET /ws?token=<JWT> returns 404 Not Found
- Backend logs show: "Route /ws?token=... not found"
- WebSocket server initialized (logs show "WebSocket server initialized")
- Express server running but WebSocket upgrade handler not configured

**Backend Code Analysis**:

**server.ts**:

```typescript
import { websocketServer } from "./websocket/websocketServer";
// WebSocket initialized but not connected to Express app
```

**websocketServer.ts** (likely):

```typescript
// WebSocket server created but not attached to HTTP server
const wss = new WebSocketServer({ noServer: true });
```

### Root Cause

**Decision**: WebSocket upgrade handler not attached to HTTP server in Express

**Problem**: Express doesn't handle WebSocket upgrade requests by default. Requires explicit upgrade handler.

**Current State**:

- WebSocket server object created
- No `server.on('upgrade', ...)` handler
- Express treats WebSocket requests as regular HTTP requests → 404

### Solution

**1. Attach WebSocket to HTTP Server**

```typescript
// In Backend/src/server.ts
import { createServer } from "http";
import { WebSocketServer } from "ws";

const app = express();
const httpServer = createServer(app);

// WebSocket upgrade handler
httpServer.on("upgrade", (request, socket, head) => {
  // Parse token from query string
  const url = new URL(request.url, "http://localhost");
  const token = url.searchParams.get("token");

  // Verify JWT token
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Upgrade connection
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request, payload);
    });
  } catch (error) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
  }
});

// Start HTTP server (not Express app directly)
httpServer.listen(3001, () => {
  logger.info("Server running with WebSocket support");
});
```

**2. Update WebSocket Server**

```typescript
// In Backend/src/websocket/websocketServer.ts
export const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws, request, user) => {
  logger.info("WebSocket connected", { userId: user.userId });

  // Store user info on connection
  ws.userId = user.userId;
  ws.username = user.username;

  ws.on("message", (data) => {
    // Handle incoming messages
  });

  ws.on("close", () => {
    logger.info("WebSocket disconnected", { userId: user.userId });
  });
});
```

**3. Update Frontend WebSocket Client**

```typescript
// In Frontend/src/services/websocketService.ts
class WebSocketService {
  connect() {
    const token = localStorage.getItem("accessToken");
    const ws = new WebSocket(`ws://localhost:3001/ws?token=${token}`);

    ws.onopen = () => {
      console.log("WebSocket connected");
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      // Fall back to polling
    };

    ws.onclose = () => {
      // Reconnect with exponential backoff
      setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
    };
  }
}
```

### Alternatives Considered

**Alternative 1: Use Socket.io**

- **Rejected**: Adds 200KB+ to bundle, overkill for simple notifications
- **Reason**: Native WebSocket sufficient for CLMS needs
- **Decision**: Stick with native WebSocket, add graceful degradation

**Alternative 2: Separate WebSocket Server (Different Port)**

- **Rejected**: Complicates deployment, CORS issues
- **Reason**: Same server simplifies auth (shared JWT)
- **Decision**: Use upgrade handler on same HTTP server

**Alternative 3: Server-Sent Events (SSE) Instead**

- **Considered**: Simpler than WebSocket, HTTP/2 compatible
- **Rejected**: WebSocket needed for bidirectional communication (barcode scanner)
- **Decision**: Keep WebSocket but add SSE fallback option later

---

## Research Question 4: Error Boundary Strategy

### Investigation

**React Error Boundary Best Practices**:

- Error boundaries catch errors during rendering, in lifecycle methods, and in constructors
- Do NOT catch errors in event handlers, async code, or server-side rendering
- Should be placed at different granularities for optimal UX

**CLMS Architecture Analysis**:

- 13 main dashboard screens (routes)
- 115+ React components
- Multiple contexts (Auth, Theme, Performance, Offline)
- Complex forms with validation

### Decision

**Strategy**: Multi-level error boundaries with different recovery strategies

**Granularity Levels**:

**Level 1: Root Error Boundary** (App.tsx)

- **Purpose**: Catch catastrophic errors preventing entire app from rendering
- **Recovery**: Show full-page error screen with "Reload" button
- **Logging**: Send to error tracking service (e.g., Sentry)
- **User Action**: Reload page or contact support

**Level 2: Route Error Boundaries** (Each main screen)

- **Purpose**: Isolate screen-level errors
- **Recovery**: Show error message within dashboard layout, other screens still accessible
- **User Action**: Navigate to different screen, retry current screen
- **Example**: Student screen crashes → show error, but Books screen still works

**Level 3: Critical Component Boundaries** (Forms, data tables)

- **Purpose**: Protect high-risk components (complex forms, large data lists)
- **Recovery**: Show component-level error, rest of screen works
- **User Action**: Retry component operation, use fallback UI
- **Example**: Student form crashes → show "Form unavailable", rest of student screen works

**NOT Needed**: Error boundaries in simple presentational components (buttons, labels, etc.)

### Solution

**1. Root Error Boundary**

```typescript
// Frontend/src/components/ErrorBoundary/RootErrorBoundary.tsx
class RootErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Root error:', error, errorInfo);
    // Send to error tracking
    // errorTracker.captureException(error, { errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-screen">
          <h1>Something went wrong</h1>
          <p>The application encountered an error.</p>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**2. Route Error Boundary**

```typescript
// Frontend/src/components/ErrorBoundary/RouteErrorBoundary.tsx
class RouteErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  componentDidCatch(error, errorInfo) {
    console.error('Route error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <DashboardLayout>
          <Alert variant="error">
            <AlertTitle>Error loading screen</AlertTitle>
            <AlertDescription>{this.state.error.message}</AlertDescription>
            <Button onClick={this.reset}>Try Again</Button>
            <Button onClick={() => navigate('/dashboard')}>Go Home</Button>
          </Alert>
        </DashboardLayout>
      );
    }
    return this.props.children;
  }
}
```

**3. Apply Boundaries**

```typescript
// In App.tsx
<RootErrorBoundary>
  <AuthProvider>
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={
          <RouteErrorBoundary>
            <Dashboard />
          </RouteErrorBoundary>
        } />
        {/* Wrap each route */}
      </Routes>
    </Router>
  </AuthProvider>
</RootErrorBoundary>
```

### Alternatives Considered

**Alternative 1: Single Global Boundary**

- **Rejected**: Poor UX, entire app crashes for any error
- **Reason**: Users lose all context, can't navigate to working screens
- **Decision**: Multi-level boundaries for graceful degradation

**Alternative 2: Boundary on Every Component**

- **Rejected**: Performance overhead, over-engineering
- **Reason**: Most components are simple, don't need boundaries
- **Decision**: Boundaries only on high-risk areas (routes, complex components)

**Alternative 3: react-error-boundary Library**

- **Accepted**: Use for production implementation
- **Reason**: Provides declarative API, hooks support, better DX
- **Implementation**: Wrap with library instead of class components

```typescript
import { ErrorBoundary } from 'react-error-boundary';

<ErrorBoundary FallbackComponent={ErrorFallback} onError={logError}>
  <MyComponent />
</ErrorBoundary>
```

---

## Research Question 5: Testing Methodology

### Investigation

**Chrome DevTools MCP Capabilities**:

- Browser automation via DevTools Protocol
- Page snapshots (accessibility tree)
- Element interaction (click, fill, navigate)
- Network request inspection
- Console message capture
- Screenshot and DOM inspection

**CLMS Testing Requirements**:

- 13 dashboard screens to test
- Each screen has: buttons, links, forms, data tables
- Need systematic approach to avoid missing tests
- Results must be documented for tracking

### Decision

**Testing Strategy**: Systematic screen-by-screen testing with standardized checklist and automation

**Methodology**: Hybrid manual + automated approach

### Solution

**Phase 1: Smoke Tests (Automated)**

```typescript
// For each of 13 screens:
1. Navigate to screen
2. Take snapshot
3. Verify no console errors
4. Verify page title correct
5. Screenshot for documentation
```

**Phase 2: Interaction Tests (Manual with Automation)**

```typescript
// For each screen:
1. Click all buttons → verify action occurs
2. Click all links → verify navigation
3. Fill forms → verify validation
4. Submit forms → verify backend call
5. Load data → verify display or empty state
```

**Checklist Template** (per screen):

```markdown
## Screen: [Name]

### Rendering

- [ ] Page loads without console errors
- [ ] All UI elements visible (no layout breaks)
- [ ] Loading state shows during data fetch
- [ ] Empty state shows when no data

### Navigation

- [ ] Screen accessible from main menu
- [ ] Breadcrumbs show correct path
- [ ] Back button returns to previous screen

### Buttons

- [ ] [Button 1 name]: Click → [Expected action]
- [ ] [Button 2 name]: Click → [Expected action]
- [ ] All buttons have hover states
- [ ] Disabled buttons not clickable

### Links

- [ ] [Link 1]: Navigate to [destination]
- [ ] [Link 2]: Navigate to [destination]
- [ ] External links open in new tab

### Forms

- [ ] Required fields show validation errors
- [ ] Valid input accepts and submits
- [ ] Submit shows loading state
- [ ] Success shows confirmation message
- [ ] Error shows user-friendly message

### Data Display

- [ ] Data loads and displays correctly
- [ ] Pagination works (if applicable)
- [ ] Sorting works (if applicable)
- [ ] Filtering works (if applicable)
- [ ] Search works (if applicable)
```

**Automation Script** (Chrome DevTools MCP):

```typescript
// test-all-screens.ts
const screens = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "Students", path: "/students" },
  { name: "Books", path: "/books" },
  // ... all 13 screens
];

for (const screen of screens) {
  // Navigate
  await devtools.navigate(screen.path);

  // Wait for load
  await devtools.waitFor("Loading complete");

  // Check console
  const errors = await devtools.getConsoleErrors();
  report.addResult(screen.name, "console", errors.length === 0);

  // Take snapshot
  const snapshot = await devtools.takeSnapshot();
  report.addSnapshot(screen.name, snapshot);

  // Screenshot
  await devtools.screenshot(`${screen.name}.png`);
}
```

**Documentation**:

- Update COMPREHENSIVE_TEST_REPORT.md with checklist
- Track progress per screen (✅/❌/⏳)
- Document bugs found with reproduction steps
- Screenshot evidence for visual issues

### Alternatives Considered

**Alternative 1: Fully Automated E2E Tests**

- **Rejected** (for initial testing): Too time-consuming to write upfront
- **Reason**: Need quick validation first, full automation later
- **Decision**: Manual testing first, then automate critical paths

**Alternative 2: Random/Ad-hoc Testing**

- **Rejected**: High risk of missing issues
- **Reason**: No systematic coverage, can't track progress
- **Decision**: Use structured checklist for accountability

**Alternative 3: Playwright E2E Only**

- **Accepted** (for Phase 2): After initial manual testing
- **Reason**: Playwright better for regression testing
- **Decision**: Chrome DevTools MCP for exploratory, Playwright for automation

---

## Summary

All 5 research questions resolved with actionable solutions:

1. **Frontend Crashes**: Add error boundaries (root + route + component levels) + async error handling + process handlers
2. **Login Flow**: Add navigate('/dashboard') after successful token storage in login handler
3. **WebSocket 404**: Attach upgrade handler to HTTP server, verify JWT before upgrade
4. **Error Boundaries**: Multi-level strategy (root for catastrophic, route for screens, component for forms)
5. **Testing**: Systematic checklist per screen + Chrome DevTools automation + document in COMPREHENSIVE_TEST_REPORT.md

**Next Steps**: Proceed to Phase 1 (Design & Contracts) with all unknowns resolved.
