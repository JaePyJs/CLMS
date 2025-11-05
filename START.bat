@echo off
:: ====================================================================
:: CLMS - Centralized Library Management System
:: Service Management Script
:: ====================================================================

if "%1"=="logs" goto :LOGS
if "%1"=="stop" goto :STOP
if "%1"=="restart" goto :RESTART
if "%1"=="status" goto :STATUS

echo.
echo ====================================================================
echo  CLMS - Service Management
echo ====================================================================
echo.
echo Usage:
echo   START.bat           - Start all services
echo   START.bat logs      - View live logs
echo   START.bat stop      - Stop all services
echo   START.bat restart   - Restart all services
echo   START.bat status    - Show service status
echo.
echo ====================================================================
echo.

:CHOICE
set /p choice="What would you like to do? (s=start, l=logs, st=status, r=restart, q=quit): "

if /i "%choice%"=="s" goto :START
if /i "%choice%"=="l" goto :LOGS
if /i "%choice%"=="st" goto :STATUS
if /i "%choice%"=="r" goto :RESTART
if /i "%choice%"=="q" goto :END
goto :CHOICE

:START
echo.
echo Starting CLMS services...
docker-compose up -d
if errorlevel 1 (
    echo ERROR: Failed to start services!
) else (
    echo.
    echo Services started successfully!
    echo.
    echo Access Points:
    echo   - Frontend: http://localhost:3000
    echo   - Backend:  http://localhost:3001
)
goto :END

:LOGS
echo.
echo Showing live logs (Press Ctrl+C to stop)...
echo.
docker-compose logs -f
goto :END

:STOP
echo.
echo Stopping CLMS services...
docker-compose down
echo Services stopped.
goto :END

:RESTART
echo.
echo Restarting CLMS services...
docker-compose restart
echo Services restarted.
goto :END

:STATUS
echo.
echo Service Status:
echo ===============
docker-compose ps
echo.
echo URLs:
echo   - Frontend: http://localhost:3000
echo   - Backend:  http://localhost:3001/health
echo   - Adminer:  http://localhost:8080
goto :END

:END
