@echo off
title CLMS Health Check
color 0E

echo.
echo  ========================================================
echo   CLMS HEALTH CHECK - System Diagnostics
echo  ========================================================
echo.

:: Initialize counters
set PASS_COUNT=0
set FAIL_COUNT=0

:: ============================================
:: Test 1: Node.js Version
:: ============================================
echo [1/7] Checking Node.js version...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo       [FAIL] Node.js not found in PATH
    set /a FAIL_COUNT+=1
    goto :test2
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo       [PASS] Node.js %NODE_VERSION% detected
set /a PASS_COUNT+=1

:: ============================================
:: Test 2: npm Availability
:: ============================================
:test2
echo [2/7] Checking npm availability...
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo       [FAIL] npm not found in PATH
    set /a FAIL_COUNT+=1
    goto :test3
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo       [PASS] npm %NPM_VERSION% detected
set /a PASS_COUNT+=1

:: ============================================
:: Test 3: Backend Dependencies
:: ============================================
:test3
echo [3/7] Checking Backend dependencies...
if not exist "Backend\node_modules" (
    echo       [FAIL] Backend node_modules not found
    echo              Run: cd Backend ^&^& npm install
    set /a FAIL_COUNT+=1
    goto :test4
)
echo       [PASS] Backend dependencies installed
set /a PASS_COUNT+=1

:: ============================================
:: Test 4: Frontend Dependencies
:: ============================================
:test4
echo [4/7] Checking Frontend dependencies...
if not exist "Frontend\node_modules" (
    echo       [FAIL] Frontend node_modules not found
    echo              Run: cd Frontend ^&^& npm install
    set /a FAIL_COUNT+=1
    goto :test5
)
echo       [PASS] Frontend dependencies installed
set /a PASS_COUNT+=1

:: ============================================
:: Test 5: Database File
:: ============================================
:test5
echo [5/7] Checking database file...
if not exist "Backend\prisma\dev.db" (
    echo       [WARN] Database file not found
    echo              Run SETUP_DATABASE.bat to initialize
    set /a FAIL_COUNT+=1
    goto :test6
)
echo       [PASS] Database file exists
set /a PASS_COUNT+=1

:: ============================================
:: Test 6: Google Credentials (Optional)
:: ============================================
:test6
echo [6/7] Checking Google Sheets credentials...
if not exist "credentials\google-credentials.json" (
    echo       [WARN] Google credentials not found (Optional)
    echo              Google Sheets sync will not work
    goto :test7
)
echo       [PASS] Google credentials configured
set /a PASS_COUNT+=1

:: ============================================
:: Test 7: Port Availability
:: ============================================
:test7
echo [7/7] Checking port availability...

:: Check if port 3000 is in use
netstat -ano | findstr ":3000 " >nul 2>&1
if %errorlevel% equ 0 (
    echo       [WARN] Port 3000 already in use
    echo              Frontend may fail to start
    set /a FAIL_COUNT+=1
) else (
    echo       [PASS] Port 3000 available
    set /a PASS_COUNT+=1
)

:: Check if port 3001 is in use
netstat -ano | findstr ":3001 " >nul 2>&1
if %errorlevel% equ 0 (
    echo       [WARN] Port 3001 already in use
    echo              Backend may fail to start
    set /a FAIL_COUNT+=1
) else (
    echo       [PASS] Port 3001 available
    set /a PASS_COUNT+=1
)

:: ============================================
:: Summary
:: ============================================
echo.
echo  ========================================================
echo   HEALTH CHECK SUMMARY
echo  ========================================================
echo.
echo   PASSED: %PASS_COUNT%
echo   FAILED: %FAIL_COUNT%
echo.

if %FAIL_COUNT% equ 0 (
    echo   STATUS: [READY] All systems operational!
    echo.
    echo   You can safely start CLMS using START_CLMS.bat
    color 0A
) else (
    echo   STATUS: [NEEDS ATTENTION] %FAIL_COUNT% issue(s) found
    echo.
    echo   Please resolve the failures above before starting CLMS.
    color 0C
)

echo.
echo  ========================================================
pause
