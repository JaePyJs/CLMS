# Data Model: Frontend Stability & Authentication Testing

**Feature**: 002-frontend-stability-auth-testing  
**Date**: 2025-11-06  
**Purpose**: Define entities, state management, and data flows for authentication and testing infrastructure

## Entity Definitions

### 1. User (Existing Prisma Model)

**Purpose**: Represents authenticated users with role-based access control

**Schema** (Prisma):

```prisma
model users {
  id             String    @id @default(cuid())
  username       String    @unique
  password       String    // bcrypt hashed
  email          String?
  first_name     String?
  last_name      String?
  full_name      String?
  role           String    @default("ASSISTANT") // ADMIN, LIBRARIAN, ASSISTANT
  is_active      Boolean   @default(true)
  last_login_at  DateTime?
  created_at     DateTime  @default(now())
  updated_at     DateTime  @updatedAt
}
```

**TypeScript Interface**:

```typescript
interface User {
  id: string;
  username: string;
  email: string | null;
  full_name: string | null;
  role: "ADMIN" | "LIBRARIAN" | "ASSISTANT";
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
}
```

**Validation Rules**:

- `username`: Required, unique, 3-50 characters, alphanumeric + underscore
- `password`: Required on creation, min 6 characters, bcrypt hashed with 10 rounds
- `email`: Optional, valid email format if provided
- `role`: Enum validation (ADMIN | LIBRARIAN | ASSISTANT)
- `is_active`: Boolean, defaults to true

**State Transitions**:

- **Created** → `is_active = true`, `last_login_at = null`
- **First Login** → `last_login_at = <timestamp>`
- **Deactivated** → `is_active = false` (soft delete)
- **Reactivated** → `is_active = true`

**Relationships**:

- None for authentication (extended by other features for books, checkouts, etc.)

---

### 2. JWT Token (Runtime Only - Not Stored in DB)

**Purpose**: Stateless authentication token for API requests

**Structure**:

```typescript
interface JWTPayload {
  userId: string; // User ID from database
  username: string; // Username for display
  role: string; // User role for authorization
  iat: number; // Issued at (timestamp)
  exp: number; // Expires at (timestamp)
}
```

**Token Types**:

**Access Token**:

- Lifetime: 7 days (604800 seconds)
- Storage: localStorage.accessToken
- Usage: Authorization header on every API request
- Format: `Bearer <token>`

**Refresh Token**:

- Lifetime: 30 days (2592000 seconds)
- Storage: localStorage.refreshToken
- Usage: Renew access token when expired
- Endpoint: POST /api/auth/refresh

**Generation**:

```typescript
// Backend: src/services/authService.ts
const accessToken = jwt.sign(
  { userId: user.id, username: user.username, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);

const refreshToken = jwt.sign(
  { userId: user.id, username: user.username, role: user.role },
  process.env.JWT_REFRESH_SECRET,
  { expiresIn: "30d" }
);
```

**Validation**:

```typescript
// Backend: src/middleware/authenticate.ts
const payload = jwt.verify(token, process.env.JWT_SECRET);
// Throws error if expired or invalid signature
```

---

### 3. Auth State (React Context)

**Purpose**: Client-side authentication state management

**Interface**:

```typescript
interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}
```

**State Transitions**:

```
Initial State:
  user = null
  isAuthenticated = false
  isLoading = true  // Check for existing session

Page Load → checkAuth():
  - Read accessToken from localStorage
  - If token exists:
    - Call GET /api/auth/me
    - If 200: isAuthenticated = true, user = <data>
    - If 401: Clear tokens, isAuthenticated = false
  - If no token: isAuthenticated = false
  - isLoading = false

Login Flow → login(credentials):
  - isLoading = true
  - Call POST /api/auth/login
  - If 200:
    - Store tokens in localStorage
    - isAuthenticated = true
    - user = <response.user>
    - Navigate to /dashboard
  - If 401:
    - error = "Invalid credentials"
    - isAuthenticated = false
  - isLoading = false

Logout Flow → logout():
  - Call POST /api/auth/logout (optional backend cleanup)
  - Clear localStorage tokens
  - isAuthenticated = false
  - user = null
  - Navigate to /login

Token Expired → refreshToken():
  - Read refreshToken from localStorage
  - Call POST /api/auth/refresh
  - If 200: Store new accessToken
  - If 401: Logout user
```

**Persistence**:

```typescript
// Storage Keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: "accessToken",
  REFRESH_TOKEN: "refreshToken",
  USER_PREFERENCE: "rememberMe",
};

// Storage Strategy
const storage = rememberMe ? localStorage : sessionStorage;
storage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
```

---

### 4. WebSocket Connection (Runtime State)

**Purpose**: Real-time bidirectional communication for notifications and live updates

**Connection State**:

```typescript
enum WebSocketState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  FAILED = "failed",
}

interface WebSocketConnection {
  // State
  state: WebSocketState;
  socket: WebSocket | null;
  reconnectAttempts: number;
  lastError: Error | null;

  // Config
  maxReconnectAttempts: number; // 5
  reconnectDelay: number; // Start at 1000ms
  maxReconnectDelay: number; // Cap at 30000ms

  // Actions
  connect: () => void;
  disconnect: () => void;
  send: (event: string, data: any) => void;
  subscribe: (event: string, handler: Function) => void;
}
```

**Endpoint**:

```
ws://localhost:3001/ws?token=<JWT_ACCESS_TOKEN>
```

**Authentication**:

- Token passed in query string (WebSocket doesn't support headers)
- Backend verifies JWT before upgrade
- Invalid token → 401 response, connection closed

**Event Types**:

```typescript
// Server → Client
type ServerEvent =
  | { type: "notification"; data: Notification }
  | { type: "dashboard_update"; data: DashboardStats }
  | { type: "equipment_event"; data: EquipmentSession }
  | { type: "checkout_update"; data: Checkout };

// Client → Server
type ClientEvent =
  | { type: "ping" }
  | { type: "subscribe"; data: { topics: string[] } }
  | { type: "unsubscribe"; data: { topics: string[] } };
```

**Reconnection Strategy**:

```typescript
// Exponential backoff with jitter
reconnectDelay = Math.min(
  baseDelay * Math.pow(2, reconnectAttempts) + jitter(),
  maxReconnectDelay
);

function jitter() {
  return Math.random() * 1000; // 0-1000ms random delay
}
```

**Graceful Degradation**:

```typescript
// If WebSocket connection fails after max attempts
if (reconnectAttempts > maxReconnectAttempts) {
  console.warn("WebSocket failed, falling back to polling");
  // Start polling /api/notifications every 30 seconds
  pollingInterval = setInterval(pollNotifications, 30000);
}
```

---

### 5. Error State (React Error Boundaries)

**Purpose**: Capture and recover from React component errors

**Error Boundary State**:

```typescript
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorCount: number;
  lastErrorTime: Date | null;
}

interface ErrorBoundaryProps {
  // Behavior
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetOnPropsChange?: boolean;

  // Recovery
  maxErrors?: number; // Max errors before permanent failure
  resetTimeout?: number; // Auto-reset after N milliseconds
  children: React.ReactNode;
}
```

**Recovery Strategies**:

**Root Level** (App.tsx):

- Show full-page error screen
- Option to reload page
- Send error to logging service

**Route Level** (Dashboard screens):

- Show error within layout
- Preserve navigation
- Option to retry or go home

**Component Level** (Forms, tables):

- Show inline error message
- Rest of screen functional
- Option to retry component

**Error Tracking**:

```typescript
interface ErrorLog {
  timestamp: Date;
  errorMessage: string;
  componentStack: string;
  userAgent: string;
  userId: string | null;
  route: string;
  severity: "low" | "medium" | "high" | "critical";
}
```

---

## Data Flow Diagrams

### Authentication Flow

```
┌─────────────┐
│ User enters │
│ credentials │
└──────┬──────┘
       │
       ▼
┌─────────────────┐         POST /api/auth/login          ┌─────────────┐
│  LoginForm.tsx  │─────────{username, password}──────────▶│ auth.ts     │
│  (Frontend)     │                                        │ (Backend)   │
└─────────────────┘                                        └──────┬──────┘
       ▲                                                          │
       │                                                          ▼
       │                                                   ┌──────────────┐
       │                                                   │ authService  │
       │                                                   │ .login()     │
       │                                                   └──────┬───────┘
       │                                                          │
       │                                                          ▼
       │                                                   ┌──────────────┐
       │                                                   │ Prisma:      │
       │                                                   │ users.find() │
       │                                                   │ bcrypt.      │
       │                                                   │ compare()    │
       │                                                   └──────┬───────┘
       │                                                          │
       │              200 OK + {user, tokens}                    │
       │◀────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────┐
│ AuthContext     │
│ .login()        │
│ - Store tokens  │
│ - Set user      │
│ - Navigate      │
└─────────────────┘
```

### Protected Request Flow

```
┌─────────────────┐
│ Component calls │
│ API (e.g.,      │
│ getStudents())  │
└────────┬────────┘
         │
         ▼
┌──────────────────┐     GET /api/students        ┌────────────────┐
│ apiClient.ts     │────Authorization: Bearer ────▶│ students.ts    │
│ (adds token from │      <accessToken>            │ (Backend)      │
│  localStorage)   │                               └────────┬───────┘
└──────────────────┘                                        │
         ▲                                                  ▼
         │                                           ┌─────────────┐
         │                                           │authenticate │
         │                                           │ middleware  │
         │                                           │ - Verify    │
         │                                           │   JWT       │
         │                                           │ - Attach    │
         │                                           │   req.user  │
         │                                           └──────┬──────┘
         │                                                  │
         │                200 OK + {students}              │
         │◀────────────────────────────────────────────────┘
         │            or 401 Unauthorized
         │
         ▼
┌──────────────────┐
│ If 401:          │
│ - Clear tokens   │
│ - Redirect login │
│ If 200:          │
│ - Return data    │
└──────────────────┘
```

### WebSocket Real-time Flow

```
┌─────────────────┐
│ User logs in    │
│ Token stored    │
└────────┬────────┘
         │
         ▼
┌──────────────────┐    ws://localhost:3001/ws    ┌─────────────────┐
│ WebSocketService │───────?token=<JWT>───────────▶│ websocketServer │
│ .connect()       │                               │ (Backend)       │
└──────────────────┘                               └────────┬────────┘
         ▲                                                  │
         │                                                  ▼
         │                                           ┌─────────────┐
         │                                           │ Verify JWT  │
         │                                           │ Upgrade HTTP│
         │                                           │ to WS       │
         │                                           └──────┬──────┘
         │                                                  │
         │              Upgrade: websocket                 │
         │◀────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐                              ┌─────────────────┐
│ Connection open  │◀────────Events──────────────▶│ Server emits:   │
│ Listen for:      │                               │ - notifications │
│ - notification   │                               │ - updates       │
│ - dashboard_     │                               │ - equipment     │
│   update         │                               │ - checkout      │
│ - equipment_     │                               └─────────────────┘
│   event          │
└──────────────────┘
```

---

## Validation Rules

### Login Validation (Backend - Zod)

```typescript
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  rememberMe: z.boolean().optional().default(false),
});
```

### User Creation Validation

```typescript
const createUserSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be at most 50 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    ),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password too long"),
  email: z.string().email("Invalid email format").optional().nullable(),
  full_name: z.string().max(100, "Name too long").optional().nullable(),
  role: z.enum(["ADMIN", "LIBRARIAN", "ASSISTANT"]).default("ASSISTANT"),
});
```

---

## Performance Considerations

### Token Storage

- **localStorage**: Persists across sessions, survives browser restart
- **sessionStorage**: Cleared on tab close, better security
- **Cookie**: Not used (CSRF risk, size limits)

### Auth State Caching

- User object cached in React Context
- Avoid redundant /api/auth/me calls
- Refresh only on explicit user action or token expiry

### WebSocket Reconnection

- Exponential backoff prevents server overload
- Jitter prevents thundering herd
- Max attempts prevent infinite reconnect loops
- Graceful degradation to polling

### Error Boundary Performance

- Error boundaries don't add render overhead
- Error state stored locally (not propagated to parents)
- Auto-reset after timeout prevents permanent failures

---

## Security Considerations

### Password Hashing

```typescript
// bcryptjs with 10 rounds (balance security vs performance)
const hashedPassword = await bcrypt.hash(password, 10);
```

### JWT Secrets

- Separate secrets for access and refresh tokens
- Stored in .env, never committed to git
- Minimum 32 characters, randomly generated

### Token Storage

- localStorage vulnerable to XSS
- Mitigation: CSP headers (Helmet.js), input sanitization
- Alternative: httpOnly cookies (future improvement)

### WebSocket Authentication

- Token verified before upgrade
- Invalid token → immediate close
- No token caching on server (stateless)

### Session Invalidation

- Logout clears client-side tokens
- Server doesn't track sessions (stateless JWT)
- Compromise: Token valid until expiry (7 days max)
- Mitigation: Short token lifetime + refresh mechanism

---

## Summary

**Entities Defined**: 5 (User, JWT Token, Auth State, WebSocket Connection, Error State)  
**Data Flows**: 3 (Login, Protected Request, WebSocket)  
**Validation Schemas**: 2 (Login, User Creation)  
**State Machines**: 2 (Auth State, WebSocket State)

**Next Step**: Create API contracts (contracts/auth-api.yaml) ✅
