@echo off
title CLMS - Centralized Library Management System
color 0A

echo.
echo  ========================================================
echo   CLMS - Centralized Library Management System
echo  ========================================================
echo  
echo   ONE-CLICK STARTUP - All services will start automatically
echo.

REM Get directory where batch file is located
cd /d "%~dp0"

echo [1/4] Stopping any existing CLMS processes...
taskkill /F /IM node.exe >nul 2>&1
echo       Done.

echo [2/4] Checking dependencies...

REM Check Backend
if not exist "Backend\node_modules" (
    echo       Installing Backend dependencies...
    cd Backend
    call npm install
    cd ..
    echo       Backend ready!
) else (
    echo       Backend OK
)

REM Check Frontend
if not exist "Frontend\node_modules" (
    echo       Installing Frontend dependencies...
    cd Frontend
    call npm install
    cd ..
    echo       Frontend ready!
) else (
    echo       Frontend OK
)

echo [3/4] Starting Backend Server (Port 3001)...
start /min "CLMS Backend" cmd /k "cd /d "%~dp0Backend" && npm run dev"

REM Wait for backend to be ready
timeout /t 4 /nobreak >nul

echo [4/4] Starting Frontend Server (Port 3000)...
start /min "CLMS Frontend" cmd /k "cd /d "%~dp0Frontend" && npm run dev"

echo.
echo  ========================================================
echo   CLMS Started Successfully!
echo  ========================================================
echo.
echo  ACCESSING THE SYSTEM:
echo  ----------------------
echo    Main Dashboard:  http://localhost:3000
echo    Kiosk Mode:      http://localhost:3000/kiosk
echo.
echo  MULTI-PC SETUP:
echo  ----------------
echo    From other PCs on the network, use THIS PC's IP:
echo    Example: http://192.168.x.x:3000/kiosk
echo.
echo    The Kiosk automatically connects to the server!
echo.
echo  TABS (Alt+Number for shortcuts):
echo  ---------------------------------
echo    Alt+1: Dashboard      Alt+5: Rooms/Equipment
echo    Alt+2: Scan Station   Alt+6: Printing
echo    Alt+3: Students       Alt+7: Settings
echo    Alt+4: Books/Borrow   Alt+8: Leaderboard
echo.
echo  NOTE: Server windows are MINIMIZED in your taskbar.
echo        Close them to stop CLMS, or press Ctrl+C.
echo.
echo  Opening browser in 5 seconds...
timeout /t 5 /nobreak >nul
start http://localhost:3000
echo.
echo  Press any key to close this window (servers keep running)...
pause >nul
