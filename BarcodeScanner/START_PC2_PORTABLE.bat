@echo off
title CLMS Kiosk - PC2 (Portable Scanner)
color 0B

echo.
echo  ========================================================
echo   CLMS Kiosk Mode - PC2 (Portable Scanner Edition)
echo  ========================================================
echo.

REM ============================================
REM CONFIGURATION - Edit the IP address below
REM ============================================
set SERVER_IP=192.168.1.100
REM ============================================

set CLMS_SERVER_URL=http://%SERVER_IP%:3001
set CLMS_PC_ID=PC2

cd /d "%~dp0"

echo  Server IP: %SERVER_IP%
echo  PC ID: %CLMS_PC_ID%
echo.

echo [1/2] Testing connection to server...
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

echo [2/2] Starting Scanner + Kiosk Display...

REM Start Portable Scanner Daemon
echo       Starting portable scanner daemon...
start "" "CLMS-Scanner-Portable.exe"

REM Wait for scanner to load
timeout /t 5 /nobreak >nul

REM Launch Kiosk in Edge
echo       Opening Kiosk display in browser...
start "" "msedge" --kiosk "http://%SERVER_IP%:3000/kiosk" --edge-kiosk-type=fullscreen

echo.
echo  ========================================================
echo   PC2 Kiosk Running!
echo  ========================================================
echo.
echo  Scanner:  Running in system tray (green icon = connected)
echo  Display:  Fullscreen kiosk mode
echo  Server:   %SERVER_IP%:3001
echo.
echo  To exit: Alt+F4 or Escape on kiosk, right-click tray icon for scanner
echo.
pause >nul
