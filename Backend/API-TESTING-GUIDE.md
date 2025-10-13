# CLMS API Testing Guide

## 🚀 Quick Start

The backend server is running on **`http://localhost:3001`**

### ✅ Verify Server Health
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/health"
```

---

## 🔐 Authentication

All `/api/reports` and `/api/fines` endpoints require authentication.

### Step 1: Login
```powershell
$loginBody = @{
    username = "admin"
    password = "your_password"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod `
    -Uri "http://localhost:3001/api/auth/login" `
    -Method POST `
    -Body $loginBody `
    -ContentType "application/json"

$token = $loginResponse.data.token
Write-Host "Token: $token"
```

### Step 2: Set Headers
```powershell
$headers = @{
    Authorization = "Bearer $token"
}
```

---

## 📊 Testing Reports Endpoints

### 1. Daily Report
```powershell
# Get today's report
Invoke-RestMethod `
    -Uri "http://localhost:3001/api/reports/daily" `
    -Headers $headers

# Get specific date
Invoke-RestMethod `
    -Uri "http://localhost:3001/api/reports/daily?date=2025-10-10" `
    -Headers $headers
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "date": "2025-10-12",
    "summary": {
      "checkIns": 45,
      "checkOuts": 42,
      "uniqueStudents": 38,
      "booksCirculated": 23,
      "avgDuration": 45,
      "peakHour": "14:00"
    },
    "details": { ... },
    "gradeLevelBreakdown": { ... }
  }
}
```

---

### 2. Weekly Report
```powershell
# Get current week
Invoke-RestMethod `
    -Uri "http://localhost:3001/api/reports/weekly" `
    -Headers $headers

# Get specific week (any date within that week)
Invoke-RestMethod `
    -Uri "http://localhost:3001/api/reports/weekly?date=2025-10-01" `
    -Headers $headers
```

---

### 3. Monthly Report
```powershell
# Get current month
Invoke-RestMethod `
    -Uri "http://localhost:3001/api/reports/monthly" `
    -Headers $headers

# Get specific month
Invoke-RestMethod `
    -Uri "http://localhost:3001/api/reports/monthly?month=9&year=2025" `
    -Headers $headers
```

---

### 4. Custom Report
```powershell
# Custom date range
$startDate = "2025-09-01"
$endDate = "2025-09-30"

Invoke-RestMethod `
    -Uri "http://localhost:3001/api/reports/custom?start=$startDate&end=$endDate" `
    -Headers $headers
```

---

## 💰 Testing Fines Endpoints

### 1. Get All Fines
```powershell
# All fines
Invoke-RestMethod `
    -Uri "http://localhost:3001/api/fines" `
    -Headers $headers

# Filter by status
Invoke-RestMethod `
    -Uri "http://localhost:3001/api/fines?status=outstanding" `
    -Headers $headers

Invoke-RestMethod `
    -Uri "http://localhost:3001/api/fines?status=paid" `
    -Headers $headers

# Filter by student
Invoke-RestMethod `
    -Uri "http://localhost:3001/api/fines?studentId=student_id_here" `
    -Headers $headers
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "fines": [...],
    "summary": {
      "totalFines": 15,
      "outstandingCount": 8,
      "paidCount": 7,
      "totalOutstanding": 450.00,
      "totalCollected": 350.00,
      "totalAmount": 800.00
    }
  }
}
```

---

### 2. Get Student Fines
```powershell
$studentId = "student_id_here"

Invoke-RestMethod `
    -Uri "http://localhost:3001/api/fines/student/$studentId" `
    -Headers $headers
```

---

### 3. Record Fine Payment
```powershell
$checkoutId = "checkout_id_here"

$paymentBody = @{
    amountPaid = 50.00
    paymentMethod = "Cash"
    notes = "Paid in full"
} | ConvertTo-Json

Invoke-RestMethod `
    -Uri "http://localhost:3001/api/fines/$checkoutId/payment" `
    -Method POST `
    -Headers $headers `
    -Body $paymentBody `
    -ContentType "application/json"
```

---

### 4. Waive Fine
```powershell
$checkoutId = "checkout_id_here"

$waiveBody = @{
    reason = "Student withdrew from school"
} | ConvertTo-Json

Invoke-RestMethod `
    -Uri "http://localhost:3001/api/fines/$checkoutId/waive" `
    -Method POST `
    -Headers $headers `
    -Body $waiveBody `
    -ContentType "application/json"
```

---

### 5. Update Fine Amount
```powershell
$checkoutId = "checkout_id_here"

$updateBody = @{
    amount = 25.00
} | ConvertTo-Json

Invoke-RestMethod `
    -Uri "http://localhost:3001/api/fines/$checkoutId/amount" `
    -Method PATCH `
    -Headers $headers `
    -Body $updateBody `
    -ContentType "application/json"
```

---

## 🧪 Alternative: Using cURL

If you prefer cURL:

### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}'
```

### Daily Report
```bash
curl http://localhost:3001/api/reports/daily \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Get Fines
```bash
curl "http://localhost:3001/api/fines?status=outstanding" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🛠️ Using Postman

1. **Import Collection**: Create a new Postman collection
2. **Set Environment Variables**:
   - `base_url`: `http://localhost:3001`
   - `token`: (will be set after login)

3. **Login Request**:
   - Method: `POST`
   - URL: `{{base_url}}/api/auth/login`
   - Body (JSON):
     ```json
     {
       "username": "admin",
       "password": "your_password"
     }
     ```
   - Save `response.data.token` to `token` variable

4. **Authenticated Requests**:
   - Add Header: `Authorization: Bearer {{token}}`
   - Make requests to `/api/reports/*` or `/api/fines/*`

---

## 📝 Testing Checklist

### Reports API
- [ ] Daily report (current date)
- [ ] Daily report (specific date)
- [ ] Weekly report (current week)
- [ ] Weekly report (specific week)
- [ ] Monthly report (current month)
- [ ] Monthly report (specific month)
- [ ] Custom report (valid date range)
- [ ] Custom report (invalid date range - should error)

### Fines API
- [ ] Get all fines
- [ ] Get outstanding fines only
- [ ] Get paid fines only
- [ ] Get fines for specific student
- [ ] Record payment (valid)
- [ ] Record payment (invalid amount - should error)
- [ ] Record payment (already paid - should error)
- [ ] Waive fine (valid)
- [ ] Waive fine (without reason - should error)
- [ ] Update fine amount (valid)
- [ ] Update fine amount (negative - should error)

---

## 🔍 Troubleshooting

### "401 Unauthorized"
- Make sure you've logged in and obtained a token
- Check that the Authorization header is correctly formatted: `Bearer YOUR_TOKEN`
- Token may have expired - login again

### "404 Not Found"
- Verify the URL is correct
- Check that the server is running

### "500 Internal Server Error"
- Check the server logs in the terminal
- Verify database connection
- Ensure all required parameters are provided

---

## ✅ Verification

To verify all endpoints are working:

```powershell
# Run the test script
./test-api.ps1
```

This will check server health and show you how to test authenticated endpoints.

---

## 🎯 Next Steps

1. **Frontend Integration**: Connect React components to these endpoints
2. **Data Seeding**: Add sample data for more realistic testing
3. **Performance Testing**: Test with larger datasets
4. **Security Testing**: Verify authentication and authorization

---

**Happy Testing!** 🚀
