@echo off
echo ==================================================
echo    CLMS Hybrid Development Environment Launcher
echo ==================================================
echo.

echo [1/3] Starting Database and Redis containers...
docker-compose -f docker-compose.infra.yml up -d

echo.
echo [2/3] Waiting for database to initialize...
timeout /t 5 /nobreak >nul

echo.
echo [3/3] Starting Applications...

echo    - Starting Backend Server (New Window)...
start "CLMS Backend" cmd /k "cd Backend && npm install && npm run dev"

echo    - Starting Frontend Server (New Window)...
start "CLMS Frontend" cmd /k "cd Frontend && npm install && npm run dev"

echo.
echo ==================================================
echo    Environment Started!
echo    - Database: localhost:3308
echo    - Redis:    localhost:6380
echo    - Backend:  http://localhost:3001
echo    - Frontend: http://localhost:3000
echo ==================================================
pause
