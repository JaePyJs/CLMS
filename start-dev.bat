@echo off
REM ============================================================================
REM CLMS Development Environment - One-Click Startup
REM ============================================================================
REM Purpose: Start all CLMS services in development mode with hot-reload
REM Usage: Double-click this file or run: start-dev.bat
REM ============================================================================

title CLMS Development Environment

echo.
echo ============================================================================
echo              CLMS - Development Environment Starting
echo ============================================================================
echo.

REM Check if Docker is running
echo [1/3] Checking Docker...
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

REM Stop any existing containers
echo.
echo [2/3] Cleaning up existing containers...
docker-compose down >nul 2>&1
echo    ✓ Cleanup complete

REM Start development services
echo.
echo [3/3] Starting CLMS development services...
echo.
echo This will take 2-3 minutes on first run (downloading images)...
echo Subsequent starts will be much faster!
echo.

docker-compose up

REM If we get here, services were stopped (Ctrl+C)
echo.
echo ============================================================================
echo               CLMS Development Environment Stopped
echo ============================================================================
echo.
pause
