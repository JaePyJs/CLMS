# UI/UX Specification: Frontend Stability & Authentication Testing

**Feature**: 002-frontend-stability-auth-testing  
**Date**: 2025-11-06  
**Purpose**: Define user interface, interactions, and error handling for authentication and dashboard testing

## Design Principles

### 1. Production-Readiness First
- **Error Boundaries**: Every route wrapped in error boundary
- **Loading States**: Clear loading indicators for all async operations
- **Empty States**: Helpful messages when no data exists
- **Graceful Degradation**: WebSocket failure → HTTP polling fallback

### 2. UI/UX Excellence
- **Responsive**: Mobile (320px+), Tablet (768px+), Desktop (1024px+)
- **Accessible**: WCAG 2.1 AA compliant, keyboard navigation, screen reader support
- **Dark Mode**: Automatic system detection + manual toggle
- **Animations**: Subtle, performant (< 16ms frame time)

### 3. Performance
- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3.5s
- **Skeleton Loading**: Visible within 100ms
- **Optimistic UI**: Immediate feedback, background sync

---

## Screen Specifications

### 1. Login Screen

**Route**: `/login`  
**Access**: Public (unauthenticated users only)  
**Purpose**: User authentication entry point

#### Layout

```
┌─────────────────────────────────────────┐
│                                         │
│          [CLMS Logo]                    │
│     Comprehensive Library               │
│     Management System                   │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Username                         │  │
│  │  [__________________________]     │  │
│  │                                   │  │
│  │  Password                         │  │
│  │  [__________________________] 👁  │  │
│  │                                   │  │
│  │  ☐ Remember Me                   │  │
│  │                                   │  │
│  │  [     Log In     ]               │  │
│  │                                   │  │
│  │  Forgot Password? | Register      │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

#### Components

**Form Fields**:
- **Username Input**:
  - Type: Text
  - Placeholder: "Enter your username"
  - Validation: Required, display error inline
  - Autocomplete: `username`
  - ARIA: `aria-label="Username"`, `aria-required="true"`

- **Password Input**:
  - Type: Password (toggleable to text)
  - Placeholder: "Enter your password"
  - Validation: Required, min 6 characters
  - Autocomplete: `current-password`
  - Toggle Button: Eye icon (👁) to show/hide password
  - ARIA: `aria-label="Password"`, `aria-required="true"`

- **Remember Me Checkbox**:
  - Type: Checkbox
  - Default: Unchecked
  - Effect: If checked, store tokens in `localStorage`; else `sessionStorage`
  - ARIA: `aria-label="Remember me on this device"`

**Submit Button**:
- Text: "Log In"
- Type: Submit
- States:
  - **Idle**: Blue background, white text, hover effect
  - **Loading**: Disabled, spinner icon, "Logging in..."
  - **Success**: Green checkmark (500ms), then redirect
  - **Error**: Red shake animation, focus on username field
- Keyboard: `Enter` key submits form
- ARIA: `aria-label="Log in to your account"`

**Links**:
- **Forgot Password**: Navigate to `/forgot-password` (if implemented)
- **Register**: Navigate to `/register` (if implemented)
- Styling: Subtle, underlined on hover

#### Interactions

**1. Submit Flow (Success)**:
```
User fills form → Clicks "Log In" → Button shows spinner
→ POST /api/auth/login (200) → Store tokens
→ Button shows checkmark (500ms) → Navigate to /dashboard
→ AuthContext updates (user, isAuthenticated)
```

**2. Submit Flow (Error - Invalid Credentials)**:
```
User fills form → Clicks "Log In" → Button shows spinner
→ POST /api/auth/login (401) → Button shakes, turns red
→ Error message below form: "Invalid username or password"
→ Focus returns to username field
```

**3. Submit Flow (Error - Network)**:
```
User fills form → Clicks "Log In" → Button shows spinner
→ POST /api/auth/login (timeout/network error)
→ Error message: "Connection failed. Please check your internet."
→ Retry button appears
```

**4. Validation Errors**:
```
User submits empty form → Inline errors appear:
  - "Username is required" (below username field, red text)
  - "Password is required" (below password field, red text)
→ Focus on first invalid field
```

**5. Auto-Login (Existing Session)**:
```
User navigates to /login → AuthContext checks token
→ If valid token exists → Skip login, redirect to /dashboard
→ If expired token → Clear tokens, show login form
```

**6. Password Toggle**:
```
User clicks eye icon → Password field type changes to "text"
→ Eye icon changes to "eye-slash" (🙈)
→ Click again → type="password", icon back to 👁
```

#### States

**Idle**:
- Form fields empty or prefilled (if "Remember Me" was checked)
- No error messages
- Submit button enabled

**Loading**:
- Submit button disabled, shows spinner
- Form fields disabled
- Screen reader announces: "Logging in, please wait"

**Success**:
- Submit button shows checkmark (500ms)
- Form fades out (300ms)
- Navigate to `/dashboard`

**Error (Validation)**:
- Inline error messages below invalid fields
- Fields with errors have red border
- Submit button enabled
- Focus on first invalid field

**Error (Authentication)**:
- Error banner above form: "Invalid username or password. Please try again."
- Submit button enabled
- Username and password fields cleared (security best practice)
- Focus on username field

**Error (Network)**:
- Error banner: "Connection failed. Check your internet and try again."
- Retry button appears
- Submit button re-enabled

#### Accessibility

- **Keyboard Navigation**:
  - Tab order: Username → Password → Remember Me → Submit → Links
  - Enter key submits form from any field
  - Esc key clears error messages

- **Screen Reader**:
  - Form labeled: `<form aria-label="Login form">`
  - Live region for errors: `<div role="alert" aria-live="polite">`
  - Submit button state announced: "Loading", "Success", "Error"

- **Focus Management**:
  - On load, focus on username field
  - After error, focus on first invalid field
  - After success, announce "Login successful, navigating to dashboard"

- **Color Contrast**:
  - Error text: Red (#DC2626) on white (#FFFFFF) = 6.5:1 ratio (AAA)
  - Button: Blue (#3B82F6) on white = 4.7:1 ratio (AA)
  - Dark mode: Adjust to maintain contrast

#### Responsive Design

**Mobile (320px - 767px)**:
- Single column layout
- Full-width form (90% viewport width)
- Touch-friendly inputs (min 44px height)
- Larger submit button (min 48px height)
- Links stacked vertically

**Tablet (768px - 1023px)**:
- Centered form (max-width 400px)
- Horizontal "Forgot Password" and "Register" links
- Logo larger

**Desktop (1024px+)**:
- Centered form (max-width 450px)
- Larger logo and branding
- Background image/pattern (optional)
- Hover effects on links and button

#### Dark Mode

**Auto-Detection**:
```typescript
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
```

**Toggle**:
- Icon in top-right corner (sun/moon)
- Persists preference in `localStorage.theme`

**Color Adjustments**:
- Background: White → Dark Gray (#1F2937)
- Text: Black (#000000) → Light Gray (#F3F4F6)
- Form fields: White → Dark (#374151)
- Borders: Gray (#D1D5DB) → Light Gray (#4B5563)
- Error text: Red (#DC2626) → Light Red (#FCA5A5)

---

### 2. Dashboard (Protected Route)

**Route**: `/dashboard`  
**Access**: Authenticated users only  
**Purpose**: Main hub after login, real-time statistics

#### Layout

```
┌─────────────────────────────────────────────────────────┐
│  [CLMS]  Dashboard  Students  Books  Checkout  ...  [👤]│
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Welcome back, John Doe! (Admin)                       │
│  Last login: Jan 6, 2025 at 10:30 AM                   │
│                                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │ Students│ │  Books  │ │ Active  │ │ Overdue │      │
│  │  1,234  │ │  5,678  │ │ Checks  │ │ Checks  │      │
│  │         │ │         │ │   89    │ │   12    │      │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘      │
│                                                         │
│  Recent Checkouts                          [View All]  │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 10:25 AM  John Doe checked out The Great Gatsby│   │
│  │ 10:18 AM  Jane Smith returned 1984             │   │
│  │ 10:12 AM  Bob Jones checked out To Kill a...   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Equipment Sessions (5 active)             [View All]  │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 3D Printer - John Doe (ends in 1h 30m)         │   │
│  │ Laptop #3 - Jane Smith (ends in 45m)           │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### Components

**Top Navigation Bar**:
- **Logo**: "CLMS" (clickable, navigates to /dashboard)
- **Menu Items**: Dashboard, Students, Books, Checkout, Equipment, Automation, Analytics, Reports, Import/Export, Settings, Documentation, System Admin
- **User Menu**: Avatar (👤) → Dropdown with "Profile", "Settings", "Logout"
- **Notifications**: Bell icon (🔔) with unread count badge
- **Theme Toggle**: Sun/moon icon

**Greeting Section**:
- **User Name**: From `AuthContext.user.full_name` or `username`
- **Role Badge**: `(Admin)`, `(Librarian)`, `(Assistant)`
- **Last Login**: Timestamp from `AuthContext.user.last_login_at`

**Statistics Cards** (4 cards):
- **Total Students**: Count, icon (👥)
- **Total Books**: Count, icon (📚)
- **Active Checkouts**: Count, icon (📖)
- **Overdue Checkouts**: Count with warning icon (⚠️) if > 0

**Recent Checkouts List**:
- **Items**: Last 3 checkouts (real-time via WebSocket)
- **Format**: `{time} {studentName} {action} {bookTitle}`
- **Actions**: "checked out", "returned", "renewed"
- **View All Link**: Navigate to `/checkouts`

**Equipment Sessions List**:
- **Items**: Active sessions (real-time via WebSocket)
- **Format**: `{equipmentName} - {studentName} (ends in {timeRemaining})`
- **Countdown**: Live countdown timer
- **View All Link**: Navigate to `/equipment`

#### Interactions

**1. Page Load (Authenticated)**:
```
User navigates to /dashboard → AuthContext checks token
→ If valid: Render dashboard, fetch data
→ If invalid: Redirect to /login
→ WebSocket connects → Subscribe to 'dashboard' topic
→ Dashboard data arrives → Update statistics
```

**2. Page Load (Unauthenticated)**:
```
User navigates to /dashboard → AuthContext.isAuthenticated = false
→ Redirect to /login with `?redirect=/dashboard`
→ After login → Redirect back to /dashboard
```

**3. Real-Time Updates (WebSocket)**:
```
WebSocket message (type: 'dashboard_update') arrives
→ Extract new statistics (totalStudents, totalBooks, etc.)
→ Animate number change (count-up effect)
→ Update "Recent Checkouts" list (prepend new item, fade in)
→ Update "Equipment Sessions" list (add/remove/update)
```

**4. Logout**:
```
User clicks Avatar → Dropdown → "Logout"
→ Confirm modal: "Are you sure you want to log out?"
→ User confirms → AuthContext.logout()
→ Clear tokens from storage → WebSocket disconnect
→ Navigate to /login → Show "Logged out successfully" toast
```

**5. Navigation**:
```
User clicks "Students" in top nav
→ Navigate to /students
→ Dashboard unmounts → WebSocket unsubscribes from 'dashboard'
```

#### States

**Loading (Initial)**:
- Skeleton UI:
  - Gray rectangles for stat cards
  - Gray lines for recent checkouts
  - Animated shimmer effect
- Screen reader: "Loading dashboard, please wait"

**Loaded (Data Available)**:
- Statistics cards populated with numbers
- Recent checkouts list shows items
- Equipment sessions list shows items
- WebSocket connected (green dot in top-right)

**Loaded (Empty State - No Data)**:
- Statistics cards show "0"
- Recent checkouts: "No checkouts yet. Start by checking out a book!"
- Equipment sessions: "No active sessions."

**Error (Data Fetch Failed)**:
- Error banner: "Failed to load dashboard data. Retrying..."
- Retry button
- Statistics cards show "---"
- Lists show error message

**Error (WebSocket Disconnected)**:
- Warning banner: "Live updates unavailable. Reconnecting..."
- Fallback to HTTP polling (every 30 seconds)
- Status indicator: Yellow dot (reconnecting) or red dot (failed)

#### Accessibility

- **Keyboard Navigation**:
  - Tab through nav items, stat cards, list items
  - Arrow keys navigate dropdown menus
  - Esc closes dropdowns

- **Screen Reader**:
  - Statistics announced: "Total students: 1,234"
  - Live region for real-time updates: `<div role="status" aria-live="polite">`
  - New checkout announced: "New checkout: John Doe checked out The Great Gatsby"

- **Focus Management**:
  - On load, focus on main content (skip nav)
  - After logout, announce "Logged out successfully"

- **ARIA Labels**:
  - Nav: `<nav aria-label="Main navigation">`
  - Stat cards: `<div role="region" aria-label="Dashboard statistics">`
  - Lists: `<ul aria-label="Recent checkouts">`

#### Responsive Design

**Mobile (320px - 767px)**:
- **Nav**: Hamburger menu (☰) → Slide-in sidebar
- **Stat Cards**: Stacked vertically (1 per row)
- **Lists**: Full-width, scrollable
- **User Menu**: Bottom nav bar

**Tablet (768px - 1023px)**:
- **Nav**: Horizontal, scrollable if overflow
- **Stat Cards**: 2 per row (2x2 grid)
- **Lists**: Side-by-side (50/50)

**Desktop (1024px+)**:
- **Nav**: Full horizontal nav bar
- **Stat Cards**: 4 in a row
- **Lists**: Side-by-side with fixed max-width

#### Dark Mode

**Color Adjustments**:
- Background: White → Dark Gray (#1F2937)
- Stat Cards: White → Dark (#374151), shadow → border
- Text: Black → Light Gray (#F3F4F6)
- Links: Blue → Light Blue (#60A5FA)
- Borders: Gray → Dark Gray (#4B5563)

---

### 3. Error Boundary Fallback UI

**Trigger**: React component error (runtime exception)  
**Purpose**: Graceful error display instead of blank screen

#### Layout

```
┌─────────────────────────────────────────┐
│                                         │
│          ⚠️                              │
│     Something Went Wrong                │
│                                         │
│  We encountered an unexpected error.   │
│  Don't worry, your data is safe.       │
│                                         │
│  [Go Home]  [Reload Page]  [Report]    │
│                                         │
│  ──────────────────────────────────────│
│                                         │
│  Error Details (for developers):       │
│  ┌─────────────────────────────────┐   │
│  │ TypeError: Cannot read property │   │
│  │ 'name' of undefined              │   │
│  │ at Dashboard.tsx:45:12           │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

#### Levels

**1. Root Level** (App.tsx wraps entire app):
- **UI**: Full-page error screen
- **Message**: "The application encountered an error. Please reload the page."
- **Actions**:
  - "Reload Page" → `window.location.reload()`
  - "Go Home" → Navigate to `/dashboard`
  - "Report Issue" → Open GitHub issue (pre-filled with error)

**2. Route Level** (Each route wrapped separately):
- **UI**: Error within page layout (nav remains)
- **Message**: "This page failed to load. Try going back or refreshing."
- **Actions**:
  - "Go Back" → `window.history.back()`
  - "Refresh" → Remount component
  - "Go Home" → Navigate to `/dashboard`

**3. Component Level** (Form, table, etc.):
- **UI**: Inline error message
- **Message**: "This component failed to load. Please try again."
- **Actions**:
  - "Retry" → Remount component
  - No navigation (rest of page works)

#### Error Logging

**Client-Side**:
```typescript
function logError(error: Error, errorInfo: React.ErrorInfo) {
  console.error('Error caught by boundary:', error, errorInfo);
  
  // Send to error tracking service (Sentry, LogRocket, etc.)
  // Example:
  // Sentry.captureException(error, { extra: { errorInfo } });
  
  // Store in localStorage for debugging
  const errorLog = {
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo.componentStack,
    userAgent: navigator.userAgent,
    userId: AuthContext.user?.id || null,
    route: window.location.pathname
  };
  
  const logs = JSON.parse(localStorage.getItem('errorLogs') || '[]');
  logs.push(errorLog);
  localStorage.setItem('errorLogs', JSON.stringify(logs.slice(-10))); // Keep last 10
}
```

**Auto-Recovery**:
- If error count < 3 in 60 seconds: Auto-retry after 2 seconds
- If error count >= 3: Show persistent error UI, disable auto-retry

---

## Loading States

### Skeleton UI (Dashboard)

**Purpose**: Immediate visual feedback while data loads

```typescript
// Skeleton Stat Card
<div className="animate-pulse">
  <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
</div>

// Skeleton List Item
<div className="animate-pulse space-y-2">
  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
</div>
```

**Animation**: Shimmer effect (gradient moving left to right)

```css
@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}

.animate-shimmer {
  animation: shimmer 2s infinite linear;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 1000px 100%;
}
```

### Spinner (Login Button)

**Purpose**: Indicate async operation in progress

```typescript
<button disabled={isLoading}>
  {isLoading ? (
    <>
      <Spinner className="mr-2" />
      Logging in...
    </>
  ) : (
    'Log In'
  )}
</button>
```

**Spinner Component**:
```tsx
function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
```

### Progress Bar (Form Submission)

**Purpose**: Show multi-step process progress

```typescript
<div className="w-full bg-gray-200 rounded-full h-2">
  <div
    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
    style={{ width: `${progress}%` }}
    role="progressbar"
    aria-valuenow={progress}
    aria-valuemin={0}
    aria-valuemax={100}
  />
</div>
```

---

## Animations

### Principles
- **Purposeful**: Animations guide attention, not distract
- **Performant**: Use CSS transforms (GPU-accelerated)
- **Respects Motion Preferences**: Disable for `prefers-reduced-motion`

### Examples

**1. Button Press**:
```css
.button {
  transition: transform 100ms ease-out;
}
.button:active {
  transform: scale(0.95);
}
```

**2. Error Shake**:
```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-10px); }
  75% { transform: translateX(10px); }
}

.error-shake {
  animation: shake 300ms ease-in-out;
}
```

**3. Fade In**:
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.fade-in {
  animation: fadeIn 300ms ease-in;
}
```

**4. Slide In (Notification)**:
```css
@keyframes slideInRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.notification {
  animation: slideInRight 300ms ease-out;
}
```

**5. Count Up (Statistics)**:
```typescript
function CountUp({ end }: { end: number }) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const duration = 1000; // 1 second
    const startTime = Date.now();
    
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setCount(Math.floor(progress * end));
      
      if (progress === 1) clearInterval(timer);
    }, 16); // 60fps
    
    return () => clearInterval(timer);
  }, [end]);
  
  return <span>{count.toLocaleString()}</span>;
}
```

**Reduced Motion**:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Notifications / Toasts

### Design

```
┌────────────────────────────────────┐
│ ✅ Login successful!          [×] │
└────────────────────────────────────┘
```

**Position**: Top-right corner  
**Duration**: 3 seconds (auto-dismiss)  
**Max Visible**: 3 toasts (stack vertically)

### Types

**Success** (Green):
- Icon: ✅ Checkmark
- Example: "Login successful!", "Settings saved!"

**Info** (Blue):
- Icon: ℹ️ Info
- Example: "Reconnecting to server...", "New update available"

**Warning** (Yellow):
- Icon: ⚠️ Warning
- Example: "Connection lost, retrying...", "Session expires soon"

**Error** (Red):
- Icon: ❌ Cross
- Example: "Login failed", "Network error"

### Implementation

```typescript
interface Toast {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
  duration?: number; // default 3000ms
}

function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { ...toast, id }]);
    
    setTimeout(() => {
      removeToast(id);
    }, toast.duration || 3000);
  };
  
  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };
  
  return (
    <div className="fixed top-4 right-4 space-y-2 z-50">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}
```

---

## Summary

**Screens Defined**: 3 (Login, Dashboard, Error Boundary)  
**Interactive Components**: 15+ (Form fields, buttons, cards, lists, toasts)  
**States Documented**: 5 per screen (Idle, Loading, Success, Error, Empty)  
**Accessibility**: WCAG 2.1 AA compliant, keyboard navigation, screen reader support  
**Responsive Breakpoints**: 3 (Mobile 320px+, Tablet 768px+, Desktop 1024px+)  
**Dark Mode**: Auto-detect + manual toggle  
**Animations**: 5 types (button press, shake, fade, slide, count-up)  
**Error Handling**: 3 levels (Root, Route, Component)  

**Next Step**: Commit all Phase 1 artifacts and proceed to Phase 2 (Implementation) ✅
