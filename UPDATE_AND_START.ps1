# CLMS Smart Launcher & Auto-Updater
# ==========================================

$ErrorActionPreference = "Stop"
$Branch = "master"
$Remote = "origin"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   CLMS Library System - Smart Launcher   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check for Internet Connection
Write-Host "[1/5] Checking for updates..." -NoNewline
try {
    $null = git fetch $Remote $Branch 2>&1
    
    $LocalHash = git rev-parse HEAD
    $RemoteHash = git rev-parse "$Remote/$Branch"

    if ($LocalHash -ne $RemoteHash) {
        Write-Host " Update Found!" -ForegroundColor Yellow
        Write-Host "      Downloading new version..." -ForegroundColor Cyan
        git pull $Remote $Branch
        
        Write-Host "      Update downloaded. Rebuilding system..." -ForegroundColor Cyan
        Write-Host "      (This may take a few minutes)" -ForegroundColor Gray
        docker-compose down
        docker-compose up -d --build
        Write-Host "      System updated and restarted." -ForegroundColor Green
    } else {
        Write-Host " System is up to date." -ForegroundColor Green
    }
} catch {
    Write-Host " Offline or Error." -ForegroundColor Red
    Write-Host "      Skipping update check. Starting local version..." -ForegroundColor Gray
}

# 2. Ensure Docker is Running
Write-Host ""
Write-Host "[2/5] Starting Database and Server..."
docker-compose up -d

# 3. Wait for Health Check
Write-Host ""
Write-Host "[3/5] Waiting for system to initialize..." -NoNewline
$Retries = 0
$MaxRetries = 30
$Healthy = $false

while ($Retries -lt $MaxRetries) {
    try {
        $Response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2
        if ($Response.StatusCode -eq 200) {
            $Healthy = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 2
        Write-Host "." -NoNewline
        $Retries++
    }
}

if ($Healthy) {
    Write-Host " Ready!" -ForegroundColor Green
} else {
    Write-Host " Timeout." -ForegroundColor Red
    Write-Host "      The system is taking longer than expected, but we will open it anyway." -ForegroundColor Yellow
}

# 4. Open Browser
Write-Host ""
Write-Host "[4/5] Opening Librarian Dashboard..."
Start-Process "http://localhost:3000"

# 5. Open Adminer (Optional)
# Start-Process "http://localhost:8081"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "   CLMS is Running!                       " -ForegroundColor Green
Write-Host "   Do not close this window to keep logs. " -ForegroundColor Gray
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# Keep window open for logs if needed, or let it run in background
# docker-compose logs -f
Read-Host "Press Enter to hide this window (System will keep running)..."
