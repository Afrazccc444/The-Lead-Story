@echo off
title The Lead Story
cd /d "%~dp0"
echo.
echo   THE LEAD STORY
echo   Preparing the fast (optimised) version of the site...
echo.
call npm run build >nul 2>&1
if errorlevel 1 (
  echo   The build failed. Showing details:
  call npm run build
  pause
  exit /b 1
)
echo   Newsletter:  http://localhost:4000
echo   Admin app:   http://localhost:4000/admin
echo.
echo   Keep this window open while you use the site. Close it to stop.
echo.
start "" /b cmd /c "timeout /t 3 >nul && start http://localhost:4000"
call npm start
pause
