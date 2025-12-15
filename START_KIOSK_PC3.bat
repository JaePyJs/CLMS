@echo off
title CLMS Kiosk - PC3 (Display Only)
color 0E

echo.
echo  ========================================================
echo   CLMS Kiosk Mode - PC3 (Door Display - No Scanner)
echo  ========================================================
echo.

REM ============================================
REM CONFIGURATION - Edit the IP address below
REM ============================================
set SERVER_IP=192.168.1.100
REM ============================================

cd /d "%~dp0"

echo  Server IP: %SERVER_IP%
echo  Mode: Display Only (no barcode scanner)
echo.

echo [1/1] Testing connection to server...
ping -n 1 %SERVER_IP% >nul 2>&1
if errorlevel 1 (
    echo.
    echo  ERROR: Cannot reach server at %SERVER_IP%
    echo.
    echo  Please check:
    echo    1. PC1 is running START_CLMS.bat
    echo    2. Both PCs are on the same network
    echo    3. Windows Firewall allows ports 3000, 3001
    echo    4. Edit this file and set correct SERVER_IP
    echo.
    pause
    exit /b 1
)
echo       Server reachable!

REM Launch Kiosk in Edge
echo       Opening Kiosk display in browser...
start "" "msedge" --kiosk "http://%SERVER_IP%:3000/kiosk" --edge-kiosk-type=fullscreen

echo.
echo  ========================================================
echo   PC3 Display Running!
echo  ========================================================
echo.
echo  Mode:     Display Only (leaderboards, reminders)
echo  Server:   %SERVER_IP%:3000
echo.
echo  To exit kiosk mode: Alt+F4 or press Escape
echo.
echo  Press any key to close this window...
pause >nul
