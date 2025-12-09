@echo off
title CLMS Manager
color 0B

:MENU
cls
echo  ========================================================
echo   CLMS MANAGER - Library System Control
echo  ========================================================
echo.
echo   [1] START CLMS (Full Application)
echo   [2] STOP CLMS (Kill All Servers)
echo   [3] RESTART (Stop + Start)
echo   [4] CHECK STATUS
echo   [5] SEED ROOMS/EQUIPMENT
echo   [6] OPEN BROWSER
echo   [7] START BARCODE SCANNER
echo   [8] EXIT
echo.
echo  ========================================================
set /p choice="  Select an option (1-8): "

if "%choice%"=="1" goto START
if "%choice%"=="2" goto STOP
if "%choice%"=="3" goto RESTART
if "%choice%"=="4" goto STATUS
if "%choice%"=="5" goto SEED
if "%choice%"=="6" goto BROWSER
if "%choice%"=="7" goto SCANNER
if "%choice%"=="8" exit
goto MENU

:START
echo.
echo [START] Launching CLMS...
call START_CLMS.bat
goto MENU

:STOP
echo.
echo [STOP] Stopping all CLMS processes...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM electron.exe >nul 2>&1
echo Done. All servers stopped.
timeout /t 2 >nul
goto MENU

:RESTART
echo.
echo [RESTART] Restarting CLMS...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM electron.exe >nul 2>&1
timeout /t 1 >nul
call START_CLMS.bat
goto MENU

:STATUS
echo.
echo [STATUS] Checking running processes...
tasklist /FI "IMAGENAME eq node.exe"
tasklist /FI "IMAGENAME eq electron.exe"
echo.
echo If you see 'node.exe' listed above, the server is RUNNING.
echo If you see 'electron.exe' listed, the BarcodeScanner is RUNNING.
echo If you see 'INFO: No tasks...', the process is STOPPED.
echo.
pause
goto MENU

:SEED
echo.
echo [SEED] Seeding rooms and equipment...
cd /d "%~dp0Backend"
call npx tsx src/scripts/seed_equipment.ts
echo.
echo Done! Rooms have been added to the database.
pause
goto MENU

:SCANNER
echo.
echo [SCANNER] Starting Barcode Scanner...
cd /d "%~dp0BarcodeScanner"
if not exist "node_modules" (
    echo Installing BarcodeScanner dependencies first...
    call npm install
)
start "CLMS BarcodeScanner" cmd /k "npm start"
echo.
echo BarcodeScanner started! It will run in the background.
echo Login with your CLMS credentials in the scanner window.
pause
goto MENU

:BROWSER
cls
echo.
echo  ========================================================
echo   CLMS - Quick Launch URLs
echo  ========================================================
echo.
echo   MAIN SCREENS:
echo   [1] Dashboard      [2] Scan Station
echo   [3] Students       [4] Leaderboard
echo   [5] Books/Borrow   [6] Rooms
echo   [7] Printing       [8] Settings
echo.
echo   SPECIAL SCREENS:
echo   [9] Kiosk Display
echo.
echo   [0] Back to Main Menu
echo.
echo  ========================================================
set /p browser="  Select screen to open (0-9): "

if "%browser%"=="1" start http://localhost:3000/?tab=dashboard
if "%browser%"=="2" start http://localhost:3000/?tab=scan-station
if "%browser%"=="3" start http://localhost:3000/?tab=students
if "%browser%"=="4" start http://localhost:3000/?tab=leaderboard
if "%browser%"=="5" start http://localhost:3000/?tab=books
if "%browser%"=="6" start http://localhost:3000/?tab=equipment
if "%browser%"=="7" start http://localhost:3000/?tab=printing
if "%browser%"=="8" start http://localhost:3000/?tab=settings-admin
if "%browser%"=="9" start http://localhost:3000/kiosk
if "%browser%"=="0" goto MENU
goto BROWSER

