@echo off
:: ====================================================================
:: CLMS - Centralized Library Management System
:: One-Click Installer Script
:: ====================================================================

echo.
echo ====================================================================
echo  CLMS - Centralized Library Management System
echo  One-Click Installer
echo ====================================================================
echo.

:: Check if Docker is installed
echo [1/5] Checking Docker installation...
docker --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not installed!
    echo Please install Docker Desktop first: https://docs.docker.com/get-docker/
    pause
    exit /b 1
)
echo Docker found!
echo.

:: Check if Docker Compose is available
echo [2/5] Checking Docker Compose...
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker Compose is not installed!
    echo Please install Docker Compose first.
    pause
    exit /b 1
)
echo Docker Compose found!
echo.

:: Stop any existing containers
echo [3/5] Stopping existing services (if any)...
docker-compose down --remove-orphans 2>nul
echo.

:: Build and start services
echo [4/5] Building and starting CLMS services...
echo This may take a few minutes on first run...
echo.
docker-compose up -d --build

if errorlevel 1 (
    echo.
    echo ERROR: Failed to start services!
    echo Please check the logs with: docker-compose logs
    pause
    exit /b 1
)

:: Wait for services to be ready
echo.
echo [5/5] Waiting for services to be ready...
timeout /t 30 /nobreak >nul

:: Check service health
echo.
echo Checking service health...
curl -s http://localhost:3001/health >nul 2>&1
if errorlevel 1 (
    echo WARNING: Backend not yet ready, please wait a moment...
) else (
    echo Backend is ready!
)

echo.
echo ====================================================================
echo  Installation Complete!
echo ====================================================================
echo.
echo  CLMS is now running!
echo.
echo  Access Points:
echo   - Frontend Dashboard: http://localhost:3000
echo   - Backend API:        http://localhost:3001
echo   - Database Admin:     http://localhost:8080
echo.
echo  Default Credentials:
echo   - Username: admin
echo   - Password: admin123
echo.
echo  To stop services: Run STOP.bat
echo  To view logs:     Run START.bat logs
echo.
echo  For help, visit: README.md
echo ====================================================================
echo.

pause
