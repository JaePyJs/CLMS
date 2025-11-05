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
