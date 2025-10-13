@echo off
REM ============================================================================
REM CLMS Development Environment - Stop Services
REM ============================================================================

title CLMS - Stopping Development Services

echo.
echo ============================================================================
echo          Stopping CLMS Development Services
echo ============================================================================
echo.

docker-compose down

echo.
echo ✓ All development services stopped
echo.
pause
