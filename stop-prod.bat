@echo off
REM ============================================================================
REM CLMS Production Environment - Stop Services
REM ============================================================================

title CLMS - Stopping Production Services

echo.
echo ============================================================================
echo          Stopping CLMS Production Services
echo ============================================================================
echo.

docker-compose -f docker-compose.prod.yml down

echo.
echo ✓ All production services stopped
echo.
pause
