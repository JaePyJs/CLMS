Write-Host "🚀 Starting CLMS Hybrid Development Environment..." -ForegroundColor Cyan

# 1. Start Infrastructure (MySQL, Redis)
Write-Host "📦 Starting Database and Redis containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.infra.yml up -d

# Wait for DB to be ready (simple pause)
Write-Host "⏳ Waiting for database to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# 2. Start Backend
Write-Host "🔙 Starting Backend Server..." -ForegroundColor Green
if (-not (Test-Path "Backend/node_modules")) {
    Write-Host "   Installing Backend dependencies..." -ForegroundColor Gray
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd Backend; npm install; npm run dev"
} else {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd Backend; npm run dev"
}

# 3. Start Frontend
Write-Host "🔜 Starting Frontend Server..." -ForegroundColor Green
if (-not (Test-Path "Frontend/node_modules")) {
    Write-Host "   Installing Frontend dependencies..." -ForegroundColor Gray
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd Frontend; npm install; npm run dev"
} else {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd Frontend; npm run dev"
}

Write-Host "✅ Environment started!" -ForegroundColor Cyan
Write-Host "   - Database: localhost:3308"
Write-Host "   - Redis:    localhost:6380"
Write-Host "   - Backend:  http://localhost:3001"
Write-Host "   - Frontend: http://localhost:3000"
