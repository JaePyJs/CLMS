# US1 Final Testing Guide - T033 & T035

**Server Started**: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  
**Target**: 30+ minutes uptime + 10 login/logout cycles without crashes

---

## Instructions

### Part 1: T035 - Login/Logout Cycles (Do this first)

Perform 10 complete login/logout cycles. After each cycle, check the box below.

**Login Credentials**: admin / admin123

**Procedure for each cycle**:

1. Open http://localhost:3000 (already open in Simple Browser)
2. Enter username: `admin`
3. Enter password: `admin123`
4. Click "Sign In" (or press Enter)
5. Verify: Dashboard loads successfully
6. Click logout button (or user menu → Logout)
7. Verify: Redirected to login page
8. Check server terminal - ensure no errors or crashes

**Login/Logout Cycle Checklist**:

- [ ] Cycle 1: Login → Dashboard → Logout
- [ ] Cycle 2: Login → Dashboard → Logout
- [ ] Cycle 3: Login → Dashboard → Logout
- [ ] Cycle 4: Login → Dashboard → Logout
- [ ] Cycle 5: Login → Dashboard → Logout
- [ ] Cycle 6: Login → Dashboard → Logout
- [ ] Cycle 7: Login → Dashboard → Logout
- [ ] Cycle 8: Login → Dashboard → Logout
- [ ] Cycle 9: Login → Dashboard → Logout
- [ ] Cycle 10: Login → Dashboard → Logout

**After all 10 cycles, verify**:

- [ ] No server crashes (check terminal still shows Vite running)
- [ ] No console errors in browser
- [ ] Login still works on cycle 11 (bonus test)

---

### Part 2: T033 - 30-Minute Uptime Test

**Goal**: Let server run for 30+ minutes without crashes

**Start Time**: $(Get-Date -Format 'HH:mm:ss')  
**Target End Time**: $((Get-Date).AddMinutes(30).ToString('HH:mm:ss'))

**Monitoring Checkpoints** (check server every 5-10 minutes):

- [ ] 5 min: Server still running?
- [ ] 10 min: Server still running?
- [ ] 15 min: Server still running?
- [ ] 20 min: Server still running?
- [ ] 25 min: Server still running?
- [ ] 30 min: Server still running? ✅ **TEST COMPLETE**

**How to check**: Run this command periodically:

```powershell
netstat -ano | findstr ":3000"
# Should show LISTENING on port 3000
```

**OR** Check the Vite terminal - should still show:

```
➜  Local:   http://localhost:3000/
```

---

## What to Watch For

### ✅ Good Signs:

- Server terminal shows HMR updates when you save files
- Login page loads instantly
- Dashboard loads after login
- No error messages in terminal
- Browser console is clean (no red errors)

### ❌ Red Flags (Report immediately):

- Server terminal exits (shows PowerShell prompt)
- "Error" or "Unhandled rejection" in terminal
- White screen / blank page in browser
- Login fails with no error message
- Browser console shows red errors

---

## Testing Strategy

**Recommended Approach**:

1. **First 10 minutes**: Complete all 10 login/logout cycles (T035)
2. **Next 20 minutes**: Let server run while you do other work
   - Navigate between dashboard tabs occasionally
   - Make small file edits to trigger HMR
   - Keep terminal visible to watch for crashes

**OR**

**Passive Approach**:

1. Complete 10 login/logout cycles
2. Leave server running in background for 30 minutes
3. Check periodically (every 5-10 min)

---

## After 30+ Minutes

Run this final verification:

```powershell
# Check uptime
$processId = (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue).OwningProcess[0]
if ($processId) {
    $process = Get-Process -Id $processId
    $uptime = (Get-Date) - $process.StartTime
    Write-Host "✅ SUCCESS! Server uptime: $([Math]::Floor($uptime.TotalMinutes)) minutes" -ForegroundColor Green
    Write-Host "T033 PASSED - Frontend stable for 30+ minutes" -ForegroundColor Cyan
} else {
    Write-Host "❌ FAILED - Server not running" -ForegroundColor Red
}
```

---

## Reporting Results

When complete, update `tasks.md`:

```markdown
- [x] T033 [US1] Manual test: Run server for 30 minutes ✅ PASSED (XX minutes uptime)
- [x] T035 [US1] Manual test: Perform login/logout cycles ✅ PASSED (10 cycles, no crashes)
```

Then document in `US1_TEST_RESULTS.md`:

- Total uptime achieved
- Number of login/logout cycles completed
- Any errors encountered (or "None")
- Final verdict: US1 COMPLETE ✅

---

## Quick Reference

**Frontend URL**: http://localhost:3000  
**Backend API**: http://localhost:3001  
**Test Credentials**: admin / admin123  
**Expected Behavior**: Smooth login → dashboard → logout, no crashes

**Success Criteria**:

- ✅ 30+ minutes uptime without crashes
- ✅ 10 login/logout cycles without errors
- ✅ Server responsive throughout testing

---

**Ready to begin?**

Start with T035 (10 login/logout cycles), then let the server run for 30 minutes total.

**Current Status**: Server is running, browser is open, credentials are ready. You can start testing now!

---

# US2 Authentication Testing Guide - T055 to T059

**Target**: Comprehensive authentication flow testing  
**Prerequisites**: Backend server running on port 3001, Frontend on port 3000

---

## Phase 4 US2 Manual Tests

### T055: Login with Valid Credentials

**Purpose**: Verify successful login redirects to dashboard

**Steps**:

1. Navigate to http://localhost:3000
2. Verify login form is displayed
3. Enter credentials:
   - Username: `admin`
   - Password: `admin123`
4. Click "Sign In" button (or press Enter)

**Expected Results**:

- ✅ No error messages displayed
- ✅ Loading spinner appears briefly
- ✅ Redirected to `/dashboard` URL
- ✅ Dashboard interface loads successfully
- ✅ User menu shows "admin" username
- ✅ No console errors in browser DevTools

**Checklist**:

- [ ] Login form displayed correctly
- [ ] Credentials accepted
- [ ] Redirect to dashboard successful
- [ ] User information visible in header
- [ ] No errors in browser console

**Known Issue**: Backend may return 401 Unauthorized. If this occurs, document the error but note that frontend handles it gracefully with error message display.

---

### T056: Login with Invalid Credentials

**Purpose**: Verify error handling for wrong credentials

**Steps**:

1. Navigate to http://localhost:3000 (or click Logout if already logged in)
2. Enter INVALID credentials:
   - Username: `wronguser`
   - Password: `wrongpass`
3. Click "Sign In"

**Expected Results**:

- ✅ Error message displayed: "Invalid credentials" or "Login failed"
- ✅ Login form remains visible
- ✅ User NOT redirected
- ✅ Input fields allow retry
- ✅ Error message is clear and user-friendly

**Additional Test Cases**:

- [ ] Empty username: Should show validation error
- [ ] Empty password: Should show validation error
- [ ] Wrong username, correct password: Should fail
- [ ] Correct username, wrong password: Should fail
- [ ] SQL injection attempt: `admin' OR '1'='1` (should fail safely)

**Checklist**:

- [ ] Error message displayed
- [ ] No redirect occurred
- [ ] Can retry login
- [ ] Error is user-friendly

---

### T057: Session Persistence on Page Refresh

**Purpose**: Verify auto-login on page reload

**Steps**:

1. Login successfully with admin/admin123
2. Verify dashboard is displayed
3. Press F5 to refresh the page (or Ctrl+R)
4. Wait for page to reload

**Expected Results**:

- ✅ Brief "Checking authentication..." loading screen
- ✅ User remains logged in
- ✅ Dashboard reloads successfully
- ✅ No redirect to login page
- ✅ Token retrieved from localStorage/sessionStorage
- ✅ User session persists

**Additional Tests**:

- [ ] Refresh multiple times - should stay logged in
- [ ] Open new tab with same URL - should auto-login
- [ ] Check localStorage in DevTools - token should be present

**Checklist**:

- [ ] Page refreshes without logout
- [ ] Dashboard reloads successfully
- [ ] No login prompt shown
- [ ] Session token persists

---

### T058: Logout Functionality

**Purpose**: Verify logout clears session and redirects

**Steps**:

1. Login successfully with admin/admin123
2. Navigate to dashboard
3. Click user menu button (usually top-right)
4. Click "Logout" option

**Expected Results**:

- ✅ Immediate redirect to `/login` page
- ✅ Login form displayed
- ✅ Token cleared from localStorage/sessionStorage
- ✅ User menu no longer visible
- ✅ Cannot access dashboard without re-login

**Additional Verification**:

- [ ] Check localStorage in DevTools - token should be removed
- [ ] Try accessing /dashboard directly - should redirect to /login
- [ ] Page refresh should show login form (not dashboard)

**Checklist**:

- [ ] Logout button works
- [ ] Redirected to login page
- [ ] Token cleared from storage
- [ ] Cannot access protected routes

---

### T059: Protected Route Access While Logged Out

**Purpose**: Verify ProtectedRoute blocks unauthenticated access

**Steps**:

1. Ensure you are logged OUT (click Logout if needed)
2. Verify you're on the login page
3. Manually navigate to protected URL:
   - Type in address bar: `http://localhost:3000/dashboard`
   - Press Enter

**Expected Results**:

- ✅ Immediately redirected to `/login`
- ✅ Dashboard does NOT load
- ✅ Login form is displayed
- ✅ URL changes back to `/login`
- ✅ No protected content briefly visible (no flash)

**Additional Protected Routes to Test**:

- [ ] `/dashboard` → should redirect to login
- [ ] Any dashboard tab URL → should redirect to login

**Checklist**:

- [ ] Cannot access dashboard when logged out
- [ ] Automatic redirect to login
- [ ] No content flash/leak
- [ ] Clean redirect behavior

---

## Testing Summary

After completing all tests, update `tasks.md`:

```markdown
- [x] T055 [US2] Manual test: Login with admin/admin123 (verify redirect to dashboard) - ✅ PASSED
- [x] T056 [US2] Manual test: Login with invalid credentials (verify error message) - ✅ PASSED
- [x] T057 [US2] Manual test: Refresh page after login (verify session persists) - ✅ PASSED
- [x] T058 [US2] Manual test: Logout and verify redirect to login - ✅ PASSED
- [x] T059 [US2] Manual test: Try accessing /dashboard while logged out (verify redirect) - ✅ PASSED
```

---

## Known Issues & Workarounds

**Backend Auth 401 Error**:

- Issue: admin/admin123 may return "401 Unauthorized"
- Root Cause: Backend authentication database/seeding issue
- Workaround: Test frontend error handling (should display error gracefully)
- Resolution: Requires backend investigation (separate from frontend testing)

**Session Timeout Warning**:

- Feature: Modal appears after 55 minutes of inactivity
- Test: Leave session idle for 55+ minutes to see warning
- Expected: Countdown timer, option to extend session or logout

---

## Success Criteria

**Phase 4 US2 Complete When**:

- ✅ All 5 manual tests (T055-T059) passed
- ✅ Login/logout flow works smoothly
- ✅ Session persistence verified
- ✅ Protected routes properly guarded
- ✅ Error handling graceful and user-friendly

**Current Authentication Features**:

- ✅ JWT-based authentication
- ✅ Auto-login on page load
- ✅ Token stored in localStorage/sessionStorage
- ✅ Auto-refresh every 55 minutes
- ✅ Session timeout warning modal
- ✅ Protected route wrapper
- ✅ Graceful error handling

---

**Ready to Test?**

Start with T055 (valid login), then proceed through T056-T059 in order. Document any issues encountered.
