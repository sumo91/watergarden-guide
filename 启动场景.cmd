@echo off
setlocal
cd /d "%~dp0"
set "SCENE_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "SCENE_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "node_modules\vite\bin\vite.js" (
  echo Please run pnpm install in this folder first.
  pause
  exit /b 1
)
echo Opening Edge of Water at http://127.0.0.1:5200/
start "" "http://127.0.0.1:5200/"
"%SCENE_NODE%" node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5200 --strictPort
pause
