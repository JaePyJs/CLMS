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

echo [1/5] Stopping any existing CLMS processes...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM electron.exe >nul 2>&1
echo       Done.

echo [2/5] Checking dependencies...

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

REM Check BarcodeScanner
if not exist "BarcodeScanner\node_modules" (
    echo       Installing BarcodeScanner dependencies...
    cd BarcodeScanner
    call npm install
    cd ..
    echo       BarcodeScanner ready!
) else (
    echo       BarcodeScanner OK
)

echo [3/5] Starting Backend Server (Port 3001)...
start /min "CLMS Backend" cmd /k "cd /d "%~dp0Backend" && npm run dev"

REM Wait for backend to be ready
timeout /t 4 /nobreak >nul

echo [4/5] Starting Frontend Server (Port 3000)...
start /min "CLMS Frontend" cmd /k "cd /d "%~dp0Frontend" && npm run dev"

REM Wait for frontend to compile
timeout /t 3 /nobreak >nul

echo [5/5] Starting Scanner Daemon (PC1)...
set CLMS_SERVER_URL=http://localhost:3001
set CLMS_PC_ID=PC1
start /min "CLMS Scanner" cmd /k "cd /d "%~dp0BarcodeScanner" && npm start"

echo.
echo  ========================================================
echo   CLMS Started Successfully!
echo  ========================================================
echo.
echo  ACCESSING THE SYSTEM:
echo  ----------------------
echo    Main Dashboard:    http://localhost:3000
echo    Kiosk Mode:        http://localhost:3000/kiosk
echo    Scanner Daemon:    Running in system tray
echo.
echo  MULTI-PC SETUP:
echo  ----------------
echo    PC1 (This PC):     Runs all servers + scanner daemon
echo    PC2 (Kiosk+Scan):  Run BarcodeScanner with different CLMS_PC_ID
echo    PC3 (Display):     Open browser to http://THIS_PC_IP:3000/kiosk
echo.
echo    To find this PC's IP: ipconfig
echo.
echo  SCANNER INFO:
echo  --------------
echo    The scanner daemon runs in the system tray.
echo    It captures barcodes globally (even when minimized).
echo    Tray icon colors:
echo      Green  = Connected to server
echo      Yellow = Connecting...
echo      Red    = Disconnected
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
