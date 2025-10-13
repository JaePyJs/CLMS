# Student Management Testing Guide
**Date:** January 14, 2025  
**Task:** Test Task 16 - Student Management API Integration  
**Duration:** 1 hour

---

## 🚀 Quick Start

### Issue: Port 3001 Already in Use
The backend server is already running! This is actually good - we can test immediately.

**Solution:**
1. Keep existing backend running (port 3001)
2. Start frontend in a new terminal (port 3000)
3. Begin testing

---

## 📋 Pre-Testing Checklist

### Backend Status:
- ✅ Server running on port 3001 (already started)
- ✅ Database connected
- ✅ Redis connected
- ✅ Google Sheets connected
- ✅ WebSocket server initialized
- ✅ All services initialized

### Frontend Status:
- ⏳ Need to start frontend server

---

## 🔧 Starting the Frontend

### Option 1: PowerShell (Recommended)
```powershell
cd Frontend
npm run dev
```

### Option 2: Command Prompt
```cmd
cd Frontend
npm run dev
```

### Expected Output:
```
VITE v5.x.x  ready in XXX ms

➜  Local:   http://localhost:3000/
➜  Network: http://192.168.x.x:3000/
```

---

## 🧪 Testing Checklist

### Test 1: Page Load (5 min)
**Objective:** Verify Student Management page loads with real data

**Steps:**
1. Open browser: http://localhost:3000
2. Login with credentials (if required)
3. Navigate to Student Management tab
4. Wait for data to load

**Success Criteria:**
- ✅ Page loads without errors
- ✅ Students list displays (or shows "No students" message)
- ✅ No console errors
- ✅ Loading spinner appears briefly
- ✅ Search box is functional
- ✅ Filter dropdowns work

**What to Check:**
- Open browser DevTools (F12)
- Check Console tab (should be clean)
- Check Network tab:
  - Look for `GET /api/students` request
  - Status should be 200 OK
  - Response should contain student data

**Screenshots:**
- Take screenshot of student list
- Take screenshot of network tab showing API call

---

### Test 2: Create Student (10 min)
**Objective:** Test adding a new student via API

**Steps:**
1. Click "Add Student" button
2. Fill in form:
   - First Name: "Test"
   - Last Name: "Student"
   - Grade Level: "Grade 7"
   - Section: "A"
   - Email: "test@example.com" (optional)
   - Phone: "123-456-7890" (optional)
3. Click "Save" or "Submit"
4. Wait for success toast notification
5. Verify student appears in list

**Success Criteria:**
- ✅ Form validation works (required fields)
- ✅ Success toast appears: "Student added successfully!"
- ✅ New student appears in list immediately
- ✅ Student has proper ID (STU###)
- ✅ No console errors

**Network Tab Check:**
- Look for `POST /api/students` request
- Check request payload (should have snake_case fields):
  ```json
  {
    "student_id": "STU001",
    "first_name": "Test",
    "last_name": "Student",
    "grade_level": "Grade 7",
    "grade_category": "JUNIOR_HIGH",
    "section": "A",
    ...
  }
  ```
- Response should be 200/201 with created student data

**Common Issues:**
- ❌ Field validation error → Check required fields
- ❌ Duplicate student ID → Expected, try different name
- ❌ 400 error → Check field names (camelCase vs snake_case)
- ❌ 500 error → Check backend logs

---

### Test 3: Search Functionality (5 min)
**Objective:** Test client-side search

**Steps:**
1. Ensure at least 3 students in list
2. Type in search box: "Test"
3. Observe list filtering
4. Clear search box
5. List should show all students again

**Success Criteria:**
- ✅ List filters as you type
- ✅ Only matching students shown
- ✅ Clears properly
- ✅ No API calls during search (client-side only)

---

### Test 4: Filter by Status (5 min)
**Objective:** Test status filter dropdown

**Steps:**
1. Select "Active" from status filter
2. Observe list update
3. Select "Inactive" 
4. Observe list update
5. Select "All"

**Success Criteria:**
- ✅ Filter works correctly
- ✅ List updates immediately
- ✅ No API calls (client-side filtering)

---

### Test 5: Filter by Grade (5 min)
**Objective:** Test grade filter dropdown

**Steps:**
1. Select a grade level from dropdown
2. Observe filtered results
3. Try different grades
4. Select "All Grades"

**Success Criteria:**
- ✅ Filters correctly
- ✅ Client-side only (no API calls)

---

### Test 6: Generate QR Codes (5 min)
**Objective:** Test QR code generation mutation

**Steps:**
1. Click "Generate QR Codes" button (look in toolbar/actions)
2. Wait for loading indicator
3. Wait for success notification

**Success Criteria:**
- ✅ Loading state shows
- ✅ Success toast: "QR codes generated successfully!"
- ✅ No errors in console

**Network Tab Check:**
- Look for `POST /api/utilities/generate-qr-codes`
- Status should be 200 OK

**Expected Behavior:**
- Backend generates QR codes for all students
- Students list may refresh
- QR code status may update

---

### Test 7: Generate Barcodes (5 min)
**Objective:** Test barcode generation mutation

**Steps:**
1. Click "Generate Barcodes" or "Print ID Cards" button
2. Wait for loading
3. Wait for success notification

**Success Criteria:**
- ✅ Loading state shows
- ✅ Success toast appears
- ✅ No errors

**Network Tab Check:**
- Look for `POST /api/utilities/generate-barcodes`
- Status should be 200 OK

---

### Test 8: Update Student (10 min)
**Objective:** Test edit functionality (if UI is connected)

**Steps:**
1. Click "Edit" icon on a student
2. Modify some fields (e.g., section)
3. Click "Save"
4. Wait for success notification
5. Verify changes in list

**Success Criteria:**
- ✅ Edit dialog opens
- ✅ Fields pre-filled with current data
- ✅ Changes save successfully
- ✅ Success toast appears
- ✅ List refreshes with updated data

**Network Tab Check:**
- Look for `PUT /api/students/:id`
- Check request payload has updated fields

**If Edit Button Not Connected:**
- ⚠️ This is expected - handler needs UI connection
- Document as TODO

---

### Test 9: Delete Student (5 min)
**Objective:** Test delete functionality (if UI is connected)

**Steps:**
1. Click "Delete" icon on a test student
2. Confirm deletion in dialog
3. Wait for success notification
4. Verify student removed from list

**Success Criteria:**
- ✅ Confirmation dialog appears
- ✅ Success toast: "Student deleted successfully!"
- ✅ Student removed from list immediately

**Network Tab Check:**
- Look for `DELETE /api/students/:id`
- Status should be 200 OK

**If Delete Button Not Connected:**
- ⚠️ Document as TODO

---

### Test 10: Add Notes (5 min)
**Objective:** Test notes update functionality

**Steps:**
1. Click on a student (if notes button exists)
2. Add/update notes
3. Save
4. Verify notes saved

**Success Criteria:**
- ✅ Notes update successfully
- ✅ Success toast appears

**Network Tab Check:**
- Look for `PUT /api/students/:id` with `notes` field

---

### Test 11: Export CSV (5 min)
**Objective:** Test CSV export (client-side)

**Steps:**
1. Click "Export" button
2. Wait for file download
3. Open CSV file
4. Verify data correctness

**Success Criteria:**
- ✅ CSV file downloads
- ✅ Contains all visible students
- ✅ Columns match student fields
- ✅ No API call (client-side export)

---

### Test 12: Error Handling (5 min)
**Objective:** Test error scenarios

**Test Cases:**
1. **Network Error:**
   - Stop backend server
   - Try to add student
   - Should see error toast
   - Restart backend and retry

2. **Validation Error:**
   - Try to add student with empty required fields
   - Should see validation error

3. **Loading States:**
   - All buttons should show loading indicators
   - Verify spinners/disabled states work

---

## 🐛 Bug Tracking Template

### Bug Report Format:
```markdown
### Bug #X: [Short Description]

**Severity:** Critical / High / Medium / Low

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Behavior:**
- 

**Actual Behavior:**
- 

**Screenshots:**
- 

**Console Errors:**
```javascript
// Paste error here
```

**Network Tab:**
- Request: 
- Status: 
- Response: 

**Environment:**
- Browser: 
- Backend: Running/Stopped
- Frontend: Running/Stopped
```

---

## 📊 Test Results Summary

### Overall Test Results:
```
Test 1: Page Load               [ ]  Pass  [ ]  Fail  [ ]  Partial
Test 2: Create Student           [ ]  Pass  [ ]  Fail  [ ]  Partial
Test 3: Search                   [ ]  Pass  [ ]  Fail  [ ]  Partial
Test 4: Filter Status            [ ]  Pass  [ ]  Fail  [ ]  Partial
Test 5: Filter Grade             [ ]  Pass  [ ]  Fail  [ ]  Partial
Test 6: Generate QR              [ ]  Pass  [ ]  Fail  [ ]  Partial
Test 7: Generate Barcodes        [ ]  Pass  [ ]  Fail  [ ]  Partial
Test 8: Update Student           [ ]  Pass  [ ]  Fail  [ ]  Partial  [ ]  N/A
Test 9: Delete Student           [ ]  Pass  [ ]  Fail  [ ]  Partial  [ ]  N/A
Test 10: Add Notes               [ ]  Pass  [ ]  Fail  [ ]  Partial  [ ]  N/A
Test 11: Export CSV              [ ]  Pass  [ ]  Fail  [ ]  Partial
Test 12: Error Handling          [ ]  Pass  [ ]  Fail  [ ]  Partial

Total Passing: ___/12
Critical Bugs: ___
```

---

## ✅ Success Criteria

**Minimum for "Integration Complete":**
- ✅ Page loads with data from API
- ✅ Create student works end-to-end
- ✅ Search/filter work (client-side OK)
- ✅ At least one mutation works (QR or Barcode)
- ✅ No critical console errors
- ✅ Network requests successful (200 status)

**Nice to Have:**
- ✅ Update student works
- ✅ Delete student works
- ✅ All mutations work
- ✅ Error handling is graceful

---

## 🔥 Common Issues & Solutions

### Issue 1: Port Already in Use
**Error:** `EADDRINUSE: address already in use :::3001`

**Solution:**
```powershell
# Find process using port 3001
netstat -ano | findstr :3001

# Kill process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Or just use the already-running server!
```

---

### Issue 2: CORS Error
**Error:** `Access to fetch at 'http://localhost:3001/api/students' has been blocked by CORS`

**Solution:**
- Check backend `.env` has: `CORS_ORIGIN=http://localhost:3000`
- Restart backend server
- Clear browser cache

---

### Issue 3: 401 Unauthorized
**Error:** API returns 401 on all requests

**Solution:**
- Login first at `/login`
- Check JWT token in localStorage
- Token may have expired - re-login

---

### Issue 4: Empty Student List
**Behavior:** Page loads but shows "No students found"

**Solution:**
- This is normal if database is empty!
- Add a student via "Add Student" button
- Or run backend seed script:
  ```powershell
  cd Backend
  npm run db:seed
  ```

---

### Issue 5: Field Name Errors
**Error:** Backend returns 400 with field errors

**Solution:**
- Check field transformation in `handleAddStudent`
- Should use snake_case for backend
- Example: `first_name` not `firstName`

---

### Issue 6: Cache Not Updating
**Behavior:** New student doesn't appear after creation

**Solution:**
- Check mutation includes `queryClient.invalidateQueries`
- Try manual refresh (F5)
- Check React Query DevTools

---

## 📞 Support Resources

### Useful Commands:
```powershell
# Check port usage
netstat -ano | findstr :3001
netstat -ano | findstr :3000

# View backend logs
cd Backend
npm run dev

# View frontend logs
cd Frontend
npm run dev

# Reset database (if needed)
cd Backend
npm run db:reset
```

### Key Files:
- Component: `Frontend/src/components/dashboard/StudentManagement.tsx`
- API Client: `Frontend/src/lib/api.ts`
- Backend Routes: `Backend/src/routes/students.ts`
- Backend Service: `Backend/src/services/studentService.ts`

### Browser DevTools:
- **Console Tab:** Check for JavaScript errors
- **Network Tab:** Monitor API requests
- **React DevTools:** Check component state
- **TanStack Query DevTools:** Check cache status

---

## 🎯 Next Steps After Testing

### If All Tests Pass:
1. ✅ Mark Student Management API Integration as complete
2. ✅ Update taskmaster status
3. ✅ Document any minor issues
4. ✅ Move to next feature (Barcode UI or PWA icons)

### If Critical Bugs Found:
1. ❌ Document bugs thoroughly
2. ❌ Prioritize fixes
3. ❌ Fix critical bugs first
4. ❌ Re-test after fixes

### If Partial Success:
1. 🔄 Document what works vs. what doesn't
2. 🔄 Fix blocking issues
3. 🔄 Re-test specific scenarios
4. 🔄 Mark partial completion in taskmaster

---

## 📝 Testing Notes

**Tester:**  
**Date:**  
**Time Started:**  
**Time Ended:**  

**Environment:**
- Backend Status: [ ] Running [ ] Stopped
- Frontend Status: [ ] Running [ ] Stopped
- Database Status: [ ] Connected [ ] Error
- Browser: Chrome / Firefox / Edge / Safari
- OS: Windows / Mac / Linux

**Summary:**

**Bugs Found:**

**Recommendations:**

---

**Ready to test! 🚀**

1. **Backend is already running** ✅ (port 3001)
2. **Start frontend:** `cd Frontend && npm run dev`
3. **Open browser:** http://localhost:3000
4. **Follow test checklist above**
5. **Document results**

**Estimated Time:** 1 hour  
**Priority:** HIGH  
**Success Rate Expected:** 80-90% (some features may need UI connection)
