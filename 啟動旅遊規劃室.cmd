@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 請先安裝 Node.js 24，再重新啟動。
  pause
  exit /b 1
)
node scripts\build.mjs
if errorlevel 1 (
  pause
  exit /b 1
)
echo 旅遊規劃室網址：http://127.0.0.1:4173
echo 請保留本視窗；按 Ctrl+C 可結束服務。
start "" "http://127.0.0.1:4173"
node scripts\serve.mjs
pause
