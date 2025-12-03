@echo off
title CLMS Database Setup
color 0A

echo.
echo  ╔════════════════════════════════════════════════════════╗
echo  ║     CLMS - Library Management System Setup             ║
echo  ║                                                        ║
echo  ║     This will set up your database with:               ║
echo  ║       - Librarian account                              ║
echo  ║       - Equipment/Rooms configuration                  ║
echo  ║       - Borrowing policies                             ║
echo  ║       - Fine rates and printing prices                 ║
echo  ╚════════════════════════════════════════════════════════╝
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo  [ERROR] Node.js is not installed!
    echo          Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo  [OK] Node.js detected
node --version
echo.

:: Navigate to Backend folder
cd /d "%~dp0Backend"
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo  [ERROR] Backend folder not found!
    pause
    exit /b 1
)

echo  [1/4] Installing dependencies...
echo        This may take a few minutes...
call npm install --silent
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo  [ERROR] Failed to install dependencies!
    pause
    exit /b 1
)
echo        Done!
echo.

echo  [2/4] Generating database client...
call npx prisma generate --schema=prisma/schema.prisma >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo  [ERROR] Failed to generate Prisma client!
    pause
    exit /b 1
)
echo        Done!
echo.

echo  [3/4] Running database migrations...
call npx prisma migrate deploy --schema=prisma/schema.prisma >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo        Creating fresh database...
    call npx prisma db push --schema=prisma/schema.prisma >nul 2>&1
)
echo        Done!
echo.

echo  [4/4] Setting up initial configuration...
call npx tsx src/scripts/seed_initial.ts
if %ERRORLEVEL% NEQ 0 (
    color 0E
    echo  [WARNING] Some configuration may have failed.
)
echo.

:: Navigate to Frontend folder
cd /d "%~dp0Frontend"
echo  [+] Installing Frontend dependencies...
echo      This may take a few minutes...
call npm install --silent
if %ERRORLEVEL% NEQ 0 (
    color 0E
    echo  [WARNING] Frontend dependencies may have failed.
)
echo      Done!
echo.

color 0A
echo.
echo  ╔════════════════════════════════════════════════════════╗
echo  ║                   SETUP COMPLETE!                      ║
echo  ╠════════════════════════════════════════════════════════╣
echo  ║  Default Login Credentials:                            ║
echo  ║    Username: librarian                                 ║
echo  ║    Password: librarian123                              ║
echo  ╠════════════════════════════════════════════════════════╣
echo  ║  Next Steps:                                           ║
echo  ║    1. Run START_CLMS.bat to launch the system          ║
echo  ║    2. Login as librarian                               ║
echo  ║    3. Go to Users and import your users CSV            ║
echo  ║       (Students: 843, Personnel: 38 = 881 total)       ║
echo  ║    4. Go to Books and import your books CSV            ║
echo  ╚════════════════════════════════════════════════════════╝
echo.
pause
