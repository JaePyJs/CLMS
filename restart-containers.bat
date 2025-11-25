@echo off
echo Restarting CLMS Docker Containers...
echo.

REM Stop all CLMS containers
echo Stopping containers...
docker stop clms-frontend-dev clms-backend-dev clms-mysql-dev clms-redis-dev

REM Start all CLMS containers
echo Starting containers...
docker start clms-mysql-dev clms-redis-dev clms-backend-dev clms-frontend-dev

echo.
echo Done! Containers restarted.
echo Please wait 10-15 seconds for services to fully initialize.
pause
