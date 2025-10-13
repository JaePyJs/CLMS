@echo off
REM ============================================================================
REM CLMS Production Environment - One-Click Startup
REM ============================================================================
REM Purpose: Start all CLMS services in production mode
REM Usage: Double-click this file or run: start-prod.bat
REM ============================================================================

title CLMS Production Environment

echo.
echo ============================================================================
echo             CLMS - Production Environment Starting
echo ============================================================================
echo.

REM Check if Docker is running
echo [1/4] Checking Docker...
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running!
    echo.
    echo Please start Docker Desktop and try again.
    echo.
    pause
    exit /b 1
)
echo    ✓ Docker is running

REM Check if .env.production exists
echo.
echo [2/4] Checking configuration...
if not exist ".env.production" (
    echo [WARNING] .env.production file not found!
    echo.
    echo Creating from .env.example...
    if exist ".env.example" (
        copy ".env.example" ".env.production" >nul
        echo    ✓ Created .env.production from template
        echo.
        echo    ⚠️  IMPORTANT: Please edit .env.production with your settings!
        echo.
        notepad ".env.production"
        echo.
        echo Press any key after saving your configuration...
        pause >nul
    ) else (
        echo [ERROR] .env.example not found! Cannot create configuration.
        pause
        exit /b 1
    )
)
echo    ✓ Configuration file exists

REM Build production images
echo.
echo [3/4] Building production images...
echo This may take 5-10 minutes on first run...
docker-compose -f docker-compose.prod.yml build --no-cache
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed! Please check the errors above.
    pause
    exit /b 1
)
echo    ✓ Build complete

REM Start production services
echo.
echo [4/4] Starting CLMS production services...
docker-compose -f docker-compose.prod.yml up -d

REM Wait for services to be healthy
echo.
echo Waiting for services to be ready...
timeout /t 10 /nobreak >nul

REM Show service status
echo.
docker-compose -f docker-compose.prod.yml ps

REM Get server IP
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr "IPv4" ^| findstr "192.168"') do (
    set SERVER_IP=%%i
    goto :found_ip
)
set SERVER_IP=localhost
:found_ip
set SERVER_IP=%SERVER_IP: =%

echo.
echo ============================================================================
echo            CLMS Production Environment Started Successfully!
echo ============================================================================
echo.
echo 📍 Access URLs:
echo    Local:     http://localhost:3000
echo    Network:   http://%SERVER_IP%:3000
echo    iPad:      http://%SERVER_IP%:3000
echo.
echo 🔐 Default Login:
echo    Username: admin
echo    Password: admin123
echo.
echo 📊 Monitoring:
echo    Backend API:  http://localhost:3001/health
echo    Database GUI: http://localhost:8080 (if adminer enabled)
echo.
echo 🛠️  Management Commands:
echo    View logs:     stop-prod.bat OR docker-compose -f docker-compose.prod.yml logs -f
echo    Stop services: docker-compose -f docker-compose.prod.yml down
echo    Restart:       docker-compose -f docker-compose.prod.yml restart
echo.
echo ============================================================================
echo.
pause
