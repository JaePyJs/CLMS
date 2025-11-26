@echo off
echo Stopping CLMS Development Environment...

echo Stopping Node.js processes...
taskkill /F /IM node.exe
taskkill /F /IM cmd.exe /FI "WINDOWTITLE eq CLMS Backend"
taskkill /F /IM cmd.exe /FI "WINDOWTITLE eq CLMS Frontend"

echo Stopping Docker containers...
docker-compose stop

echo All services stopped.
pause
