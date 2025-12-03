@echo off
title CLMS - Centralized Library Management System
color 0A

echo.
echo  ========================================================
echo   CLMS - Centralized Library Management System
echo  ========================================================
echo.

echo [0/4] Cleaning up old processes...
taskkill /F /IM node.exe >nul 2>&1
echo       Done.

REM Check if node_modules exists
if not exist "Backend\node_modules" (
    echo [1/4] Installing Backend dependencies...
    cd Backend
    call npm install
    cd ..
) else (
    echo [1/4] Backend dependencies OK
)

if not exist "Frontend\node_modules" (
    echo [2/4] Installing Frontend dependencies...
    cd Frontend
    call npm install
    cd ..
) else (
    echo [2/4] Frontend dependencies OK
)

echo [3/4] Starting Backend Server (Port 3001)...
start /min "CLMS Backend" cmd /k "cd Backend && npm run dev"

timeout /t 3 /nobreak >nul

echo [4/4] Starting Frontend Server (Port 3000)...
start /min "CLMS Frontend" cmd /k "cd Frontend && npm run dev"

echo.
echo  ========================================================
echo   CLMS Started Successfully!
echo  ========================================================
echo.
echo  MAIN SCREENS:
echo  -------------
echo    Dashboard:    http://localhost:3000/?tab=dashboard
echo    Scan Station: http://localhost:3000/?tab=scan-station
echo    Students:     http://localhost:3000/?tab=students
echo    Leaderboard:  http://localhost:3000/?tab=leaderboard
echo    Books/Borrow: http://localhost:3000/?tab=books
echo    Rooms:        http://localhost:3000/?tab=equipment
echo    Printing:     http://localhost:3000/?tab=printing
echo    Settings:     http://localhost:3000/?tab=settings-admin
echo.
echo  SPECIAL SCREENS:
echo  ----------------
echo    Kiosk Display: http://localhost:3000/kiosk
echo.
echo  NOTE: Server windows are MINIMIZED in your taskbar.
echo        To stop the app, close those windows or use CLMS_MANAGER.bat
echo.
timeout /t 5
start http://localhost:3000
exit
