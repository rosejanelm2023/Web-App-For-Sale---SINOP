@echo off
title PH Inventory System
cd /d "%~dp0"

powershell.exe -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:4173/' -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }"
if not errorlevel 1 (
  echo The inventory app is already running.
  start "" "http://127.0.0.1:4173/"
  exit /b 0
)

set "NODE_CMD=node"
where node >nul 2>nul
if not errorlevel 1 goto start_app

set "NODE_CMD=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%NODE_CMD%" goto start_app

echo.
echo Node.js could not be found.
echo Open this project in Codex and ask it to restart the inventory app.
echo.
pause
exit /b 1

:start_app
echo.
echo Starting the PH Inventory System...
echo Keep this window open while using the app.
echo To stop the app, close this window.
echo.

start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Milliseconds 900; Start-Process 'http://127.0.0.1:4173/'"
"%NODE_CMD%" scripts\serve-dist.mjs

echo.
echo The inventory app has stopped.
pause
