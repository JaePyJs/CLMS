@echo off
:: ====================================================================
:: CLMS - Centralized Library Management System
:: Stop Services Script
:: ====================================================================

echo.
echo ====================================================================
echo  CLMS - Stop Services
echo ====================================================================
echo.
echo This will stop all CLMS services.
echo.
set /p confirm="Are you sure? (y/N): "

if /i "%confirm%" neq "y" (
    echo Operation cancelled.
    goto :END
)

echo.
echo Stopping CLMS services...
docker-compose down

if errorlevel 1 (
    echo ERROR: Failed to stop services properly.
) else (
    echo.
    echo All services stopped successfully.
)

echo.
echo ====================================================================
echo.

:END
pause
