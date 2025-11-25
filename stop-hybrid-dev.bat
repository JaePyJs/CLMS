@echo off
echo ==================================================
echo    Stopping CLMS Hybrid Environment
echo ==================================================
echo.

echo Stopping Database and Redis containers...
docker-compose -f docker-compose.infra.yml down

echo.
echo ==================================================
echo    Infrastructure Stopped.
echo    Please manually close the Backend and Frontend
echo    terminal windows.
echo ==================================================
pause
