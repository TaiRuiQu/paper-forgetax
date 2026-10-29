@echo off
setlocal
cd /d "%~dp0"
set "NODE_BIN="
where node >nul 2>nul
if %errorlevel%==0 set "NODE_BIN=node"
if not defined NODE_BIN if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_BIN=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_BIN if exist "%LocalAppData%\Programs\nodejs\node.exe" set "NODE_BIN=%LocalAppData%\Programs\nodejs\node.exe"
if not defined NODE_BIN (
  echo Node.js was not found. Install Node.js 22+ and try again.
  pause
  exit /b 1
)
"%NODE_BIN%" scripts\dev.mjs
pause
