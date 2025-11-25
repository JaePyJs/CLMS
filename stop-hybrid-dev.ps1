Write-Host "🛑 Stopping CLMS Hybrid Development Environment..." -ForegroundColor Cyan

# Stop Infrastructure
docker-compose -f docker-compose.infra.yml down

Write-Host "✅ Infrastructure stopped." -ForegroundColor Green
Write-Host "⚠️  Note: Please close the Backend and Frontend terminal windows manually." -ForegroundColor Yellow
