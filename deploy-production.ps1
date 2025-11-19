# ============================================================================
# CLMS Production Quick Deploy Script (Windows PowerShell)
# ============================================================================
# This script automates the production deployment process
# Usage: .\deploy-production.ps1
# ============================================================================

param(
    [switch]$SkipValidation,
    [switch]$NoBuild,
    [switch]$Help
)

if ($Help) {
    Write-Host @"
CLMS Production Deployment Script

Usage: .\deploy-production.ps1 [options]

Options:
  -SkipValidation   Skip pre-deployment validation checks
  -NoBuild          Skip rebuilding images (use existing)
  -Help             Show this help message

Examples:
  .\deploy-production.ps1                 # Full deployment with validation
  .\deploy-production.ps1 -SkipValidation # Skip validation (not recommended)
  .\deploy-production.ps1 -NoBuild        # Use existing images
"@
    exit 0
}

Write-Host @"
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║           CLMS Production Deployment Wizard                  ║
║                                                              ║
║  This script will deploy CLMS to production                 ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

Write-Host ""

# Step 1: Validation
if (-not $SkipValidation) {
    Write-Host "Step 1: Running pre-deployment validation..." -ForegroundColor Yellow
    Write-Host ""
    
    & .\validate-production.ps1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "❌ Validation failed. Please fix errors before deploying." -ForegroundColor Red
        Write-Host "   Run with -SkipValidation to bypass (not recommended)" -ForegroundColor Gray
        exit 1
    }
    
    Write-Host ""
    Write-Host "Press any key to continue with deployment, or Ctrl+C to cancel..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
} else {
    Write-Host "⚠️  Skipping validation (not recommended)" -ForegroundColor Yellow
}

# Step 2: Stop existing services
Write-Host ""
Write-Host "Step 2: Stopping existing services (if any)..." -ForegroundColor Yellow
docker-compose -f docker-compose.prod.yml down 2>$null
Write-Host "✅ Services stopped" -ForegroundColor Green

# Step 3: Build and start services
Write-Host ""
if ($NoBuild) {
    Write-Host "Step 3: Starting services (no rebuild)..." -ForegroundColor Yellow
    docker-compose -f docker-compose.prod.yml up -d
} else {
    Write-Host "Step 3: Building and starting services..." -ForegroundColor Yellow
    Write-Host "   (This may take 5-10 minutes...)" -ForegroundColor Gray
    docker-compose -f docker-compose.prod.yml up -d --build
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start services" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Services started" -ForegroundColor Green

# Step 4: Wait for services to be healthy
Write-Host ""
Write-Host "Step 4: Waiting for services to be healthy..." -ForegroundColor Yellow
Write-Host "   (This may take 2-3 minutes...)" -ForegroundColor Gray

$maxAttempts = 60
$attempt = 0
$allHealthy = $false

while ($attempt -lt $maxAttempts -and -not $allHealthy) {
    $attempt++
    Start-Sleep -Seconds 5
    
    $status = docker-compose -f docker-compose.prod.yml ps --format json | ConvertFrom-Json
    $unhealthy = $status | Where-Object { $_.Health -ne "healthy" -and $_.State -ne "running" }
    
    if ($unhealthy.Count -eq 0) {
        $allHealthy = $true
    } else {
        Write-Host "   Attempt $attempt/$maxAttempts - Waiting for: $($unhealthy.Service -join ', ')" -ForegroundColor Gray
    }
}

if ($allHealthy) {
    Write-Host "✅ All services are healthy" -ForegroundColor Green
} else {
    Write-Host "⚠️  Services may not be fully healthy yet. Check logs." -ForegroundColor Yellow
}

# Step 5: Check service status
Write-Host ""
Write-Host "Step 5: Service Status" -ForegroundColor Yellow
docker-compose -f docker-compose.prod.yml ps

# Step 6: Initialize database
Write-Host ""
Write-Host "Step 6: Initializing database..." -ForegroundColor Yellow
$runMigrations = Read-Host "Run database migrations? (y/N)"

if ($runMigrations -eq 'y' -or $runMigrations -eq 'Y') {
    Write-Host "   Running Prisma migrations..." -ForegroundColor Gray
    docker-compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Database migrations completed" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Migration failed or no migrations needed" -ForegroundColor Yellow
    }
    
    # Optional: Seed data
    $seedData = Read-Host "Seed initial data? (y/N)"
    if ($seedData -eq 'y' -or $seedData -eq 'Y') {
        Write-Host "   Seeding database..." -ForegroundColor Gray
        docker-compose -f docker-compose.prod.yml exec -T backend npm run db:seed
    }
} else {
    Write-Host "⏭️  Skipping database migrations" -ForegroundColor Gray
}

# Step 7: Show access information
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                                                              ║" -ForegroundColor Green
Write-Host "║  ✅ CLMS Production Deployment Complete!                     ║" -ForegroundColor Green
Write-Host "║                                                              ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green

Write-Host ""
Write-Host "📍 Access Points:" -ForegroundColor Cyan
Write-Host "   Frontend:  http://192.168.0.126:8080" -ForegroundColor White
Write-Host "   Backend:   http://192.168.0.126:3001" -ForegroundColor White
Write-Host "   Health:    http://192.168.0.126:3001/health" -ForegroundColor White

Write-Host ""
Write-Host "📊 Service Status:" -ForegroundColor Cyan
Write-Host "   Check status:  docker-compose -f docker-compose.prod.yml ps" -ForegroundColor Gray
Write-Host "   View logs:     docker-compose -f docker-compose.prod.yml logs -f" -ForegroundColor Gray
Write-Host "   Backend logs:  docker-compose -f docker-compose.prod.yml logs -f backend" -ForegroundColor Gray

Write-Host ""
Write-Host "👤 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Create admin user:  node create-librarian.js" -ForegroundColor Gray
Write-Host "   2. Access frontend:    http://192.168.0.126:8080" -ForegroundColor Gray
Write-Host "   3. Login with admin credentials" -ForegroundColor Gray
Write-Host "   4. Configure library settings" -ForegroundColor Gray

Write-Host ""
Write-Host "📖 Documentation:" -ForegroundColor Cyan
Write-Host "   Full guide:        PRODUCTION_DEPLOYMENT_WINDOWS.md" -ForegroundColor Gray
Write-Host "   Troubleshooting:   PRODUCTION_DEPLOYMENT.md" -ForegroundColor Gray
Write-Host "   What was fixed:    PRODUCTION_FIXES.md" -ForegroundColor Gray

Write-Host ""
$viewLogs = Read-Host "Would you like to view backend logs now? (y/N)"

if ($viewLogs -eq 'y' -or $viewLogs -eq 'Y') {
    Write-Host ""
    Write-Host "Showing backend logs (Press Ctrl+C to exit)..." -ForegroundColor Yellow
    docker-compose -f docker-compose.prod.yml logs -f backend
}

Write-Host ""
Write-Host "Deployment complete! 🎉" -ForegroundColor Green
