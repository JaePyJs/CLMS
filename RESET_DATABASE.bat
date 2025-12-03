@echo off
title CLMS Database Reset
color 0C

echo.
echo  ╔════════════════════════════════════════════════════════╗
echo  ║     ⚠️  WARNING: DATABASE RESET                         ║
echo  ║                                                        ║
echo  ║     This will DELETE ALL DATA including:               ║
echo  ║       - All users (librarian, students, personnel)     ║
echo  ║       - All books                                      ║
echo  ║       - All borrowing history                          ║
echo  ║       - All fines and payments                         ║
echo  ║       - All equipment and sessions                     ║
echo  ║       - All configuration                              ║
echo  ╚════════════════════════════════════════════════════════╝
echo.
echo  Are you sure you want to continue?
echo.
pause

cd /d "%~dp0Backend"

echo.
echo  Resetting database...
call npx tsx src/scripts/reset_database.ts
echo.

color 0A
echo  ╔════════════════════════════════════════════════════════╗
echo  ║     Database has been reset!                           ║
echo  ║                                                        ║
echo  ║     Run SETUP_DATABASE.bat to set up fresh data.       ║
echo  ╚════════════════════════════════════════════════════════╝
echo.
pause
