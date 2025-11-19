# ============================================================================
# CLMS Production Readiness Validation Script (Windows PowerShell)
# ============================================================================
# This script validates that all requirements are met before deployment
# Usage: .\validate-production.ps1
# ============================================================================

Write-Host "🔍 CLMS Production Readiness Validation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$Errors = 0
$Warnings = 0

function Check-Pass {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Check-Fail {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
    $script:Errors++
}

function Check-Warn {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
    $script:Warnings++
}

# 1. Check Docker
Write-Host "1. Checking Docker..." -ForegroundColor White
try {
    $dockerVersion = docker --version
    if ($LASTEXITCODE -eq 0) {
        Check-Pass "Docker installed: $dockerVersion"
    } else {
        Check-Fail "Docker is not running"
    }
} catch {
    Check-Fail "Docker is not installed"
}

# 2. Check Docker Compose
Write-Host ""
Write-Host "2. Checking Docker Compose..." -ForegroundColor White
try {
    $composeVersion = docker-compose --version
    if ($LASTEXITCODE -eq 0) {
        Check-Pass "Docker Compose installed: $composeVersion"
    } else {
        Check-Fail "Docker Compose is not available"
    }
} catch {
    Check-Fail "Docker Compose is not installed"
}

# 3. Check .env.production file
Write-Host ""
Write-Host "3. Checking environment configuration..." -ForegroundColor White
if (Test-Path ".env.production") {
    Check-Pass ".env.production file exists"
    
    $envContent = Get-Content ".env.production" -Raw
    
    # Check for placeholder passwords
    if ($envContent -match "change-me") {
        Check-Fail "Placeholder passwords found in .env.production (contains 'change-me')"
    } else {
        Check-Pass "No placeholder passwords found"
    }
    
    # Check for required variables
    $requiredVars = @("MYSQL_ROOT_PASSWORD", "MYSQL_PASSWORD", "REDIS_PASSWORD", "JWT_SECRET", "JWT_REFRESH_SECRET", "FRONTEND_URL", "PUBLIC_API_URL", "SHEETS_SPREADSHEET_ID")
    foreach ($var in $requiredVars) {
        if ($envContent -match "(?m)^$var=.+") {
            Check-Pass "Required variable $var is set"
        } else {
            Check-Fail "Required variable $var is missing or empty"
        }
    }
    
    # Check JWT secret length
    if ($envContent -match "(?m)^JWT_SECRET=(.+)") {
        $jwtSecret = $matches[1].Trim()
        if ($jwtSecret.Length -ge 32) {
            Check-Pass "JWT_SECRET is sufficiently long ($($jwtSecret.Length) characters)"
        } else {
            Check-Warn "JWT_SECRET is too short ($($jwtSecret.Length) characters, recommended 64+)"
        }
    }
    
    # Check for Google Sheets configuration
    if ($envContent -match "SHEETS_ENABLED=true") {
        Check-Pass "Google Sheets integration is enabled"
    } else {
        Check-Warn "Google Sheets integration is not enabled"
    }
} else {
    Check-Fail ".env.production file does not exist"
}

# 4. Check google-credentials.json
Write-Host ""
Write-Host "4. Checking Google credentials..." -ForegroundColor White
if (Test-Path "google-credentials.json") {
    Check-Pass "google-credentials.json file exists"
    
    # Check if it's valid JSON
    try {
        $null = Get-Content "google-credentials.json" -Raw | ConvertFrom-Json
        Check-Pass "google-credentials.json is valid JSON"
    } catch {
        Check-Warn "google-credentials.json may not be valid JSON"
    }
    
    # Check file size
    $fileSize = (Get-Item "google-credentials.json").Length
    if ($fileSize -gt 100 -and $fileSize -lt 10000) {
        Check-Pass "google-credentials.json has reasonable file size ($fileSize bytes)"
    } else {
        Check-Warn "google-credentials.json file size is unusual ($fileSize bytes)"
    }
} else {
    Check-Fail "google-credentials.json file does not exist (required for Google Sheets integration)"
}

# 5. Check docker-compose.prod.yml
Write-Host ""
Write-Host "5. Checking Docker Compose configuration..." -ForegroundColor White
if (Test-Path "docker-compose.prod.yml") {
    Check-Pass "docker-compose.prod.yml exists"
    
    # Validate YAML syntax
    try {
        docker-compose -f docker-compose.prod.yml config > $null 2>&1
        if ($LASTEXITCODE -eq 0) {
            Check-Pass "docker-compose.prod.yml is valid"
        } else {
            Check-Fail "docker-compose.prod.yml has syntax errors"
        }
    } catch {
        Check-Fail "Cannot validate docker-compose.prod.yml"
    }
} else {
    Check-Fail "docker-compose.prod.yml does not exist"
}

# 6. Check available ports
Write-Host ""
Write-Host "6. Checking port availability..." -ForegroundColor White
$ports = @(3001, 8080, 3308, 6379)
foreach ($port in $ports) {
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connection) {
        Check-Warn "Port $port is already in use by process $($connection[0].OwningProcess)"
    } else {
        Check-Pass "Port $port is available"
    }
}

# 7. Check disk space
Write-Host ""
Write-Host "7. Checking disk space..." -ForegroundColor White
$drive = (Get-Location).Drive.Name
$freeSpace = [math]::Round((Get-PSDrive $drive).Free / 1GB, 2)
if ($freeSpace -ge 20) {
    Check-Pass "Sufficient disk space available ($freeSpace GB on $drive`:)"
} else {
    Check-Warn "Limited disk space ($freeSpace GB available on $drive`:, recommended 20GB+)"
}

# 8. Check Backend Dockerfile
Write-Host ""
Write-Host "8. Checking Backend Dockerfile..." -ForegroundColor White
if (Test-Path "Backend\Dockerfile") {
    Check-Pass "Backend Dockerfile exists"
} else {
    Check-Fail "Backend Dockerfile does not exist"
}

# 9. Check Frontend production Dockerfile
Write-Host ""
Write-Host "9. Checking Frontend Dockerfile..." -ForegroundColor White
if (Test-Path "Frontend\Dockerfile.prod") {
    Check-Pass "Frontend production Dockerfile exists"
} else {
    Check-Fail "Frontend\Dockerfile.prod does not exist"
}

# 10. Check Docker Desktop resources
Write-Host ""
Write-Host "10. Checking Docker resources..." -ForegroundColor White
try {
    docker info > $null 2>&1
    if ($LASTEXITCODE -eq 0) {
        Check-Pass "Docker daemon is running and accessible"
    } else {
        Check-Fail "Docker daemon is not responding"
    }
} catch {
    Check-Fail "Cannot connect to Docker daemon"
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "📊 Validation Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($Errors -eq 0 -and $Warnings -eq 0) {
    Write-Host "✅ All checks passed! Ready for production deployment." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor White
    Write-Host "  1. docker-compose -f docker-compose.prod.yml up -d --build" -ForegroundColor Gray
    Write-Host "  2. docker-compose -f docker-compose.prod.yml logs -f backend" -ForegroundColor Gray
    Write-Host "  3. Visit http://192.168.0.126:8080" -ForegroundColor Gray
    Write-Host ""
    exit 0
} elseif ($Errors -eq 0) {
    Write-Host "⚠️  All critical checks passed with $Warnings warning(s)." -ForegroundColor Yellow
    Write-Host "Review warnings above before proceeding." -ForegroundColor Yellow
    Write-Host ""
    exit 0
} else {
    Write-Host "❌ Validation failed with $Errors error(s) and $Warnings warning(s)." -ForegroundColor Red
    Write-Host "Please fix the errors above before deploying to production." -ForegroundColor Red
    Write-Host ""
    Write-Host "Common fixes:" -ForegroundColor Yellow
    Write-Host "  - Ensure google-credentials.json is in the project root" -ForegroundColor Gray
    Write-Host "  - Verify .env.production has no 'change-me' passwords" -ForegroundColor Gray
    Write-Host "  - Make sure Docker Desktop is running" -ForegroundColor Gray
    Write-Host ""
    exit 1
}
