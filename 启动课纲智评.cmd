@echo off
chcp 65001 >nul
setlocal
where node.exe >nul 2>nul
if errorlevel 1 goto missing_node
pushd "%~dp001-应用源码"
if errorlevel 1 goto failed
if not exist "node_modules\katex\package.json" (
  call npm.cmd ci --no-audit --no-fund
  if errorlevel 1 goto failed
)
node scripts\launcher.mjs %*
set "APP_EXIT=%ERRORLEVEL%"
popd
if not "%APP_EXIT%"=="0" goto failed
exit /b 0
:missing_node
echo Please install Node.js 24 or newer, then try again.
:failed
echo.
echo Startup failed. Please read the error above.
pause
exit /b 1
