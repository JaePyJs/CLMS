# CLMS API Test Script
$baseUrl = "http://localhost:3001"

Write-Host "Testing CLMS Backend API" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "1. Testing Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET
    Write-Host "Success: Server is running!" -ForegroundColor Green
    Write-Host ($health | ConvertTo-Json -Depth 2) -ForegroundColor White
} catch {
    Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: API Info
Write-Host "2. Testing API Info..." -ForegroundColor Yellow
try {
    $info = Invoke-RestMethod -Uri "$baseUrl/api" -Method GET
    Write-Host "Success: API endpoints listed!" -ForegroundColor Green
    Write-Host ($info | ConvertTo-Json -Depth 2) -ForegroundColor White
} catch {
    Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Authenticated Endpoints Test Instructions" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To test authenticated endpoints (reports, fines):" -ForegroundColor White
Write-Host "1. Login and get token:" -ForegroundColor Gray
Write-Host '   $body = @{ username = "admin"; password = "your_password" } | ConvertTo-Json' -ForegroundColor DarkGray
Write-Host '   $login = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method POST -Body $body -ContentType "application/json"' -ForegroundColor DarkGray
Write-Host '   $token = $login.data.token' -ForegroundColor DarkGray
Write-Host ""
Write-Host "2. Use token for authenticated requests:" -ForegroundColor Gray
Write-Host '   $headers = @{ Authorization = "Bearer $token" }' -ForegroundColor DarkGray
Write-Host '   Invoke-RestMethod -Uri "http://localhost:3001/api/reports/daily" -Headers $headers' -ForegroundColor DarkGray
Write-Host ""
