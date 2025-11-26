@echo off
echo Starting CLMS Development Environment...

echo Starting Database and Redis containers...
docker-compose up -d mysql redis

echo Waiting for services to initialize...
timeout /t 5

echo Starting Backend Server...
start "CLMS Backend" cmd /k "cd Backend && npm run dev"

echo Starting Frontend Server...
start "CLMS Frontend" cmd /k "cd Frontend && npm run dev"

echo All services started!
echo Frontend will be available at http://localhost:3000
echo Backend will be available at http://localhost:3001
pause
