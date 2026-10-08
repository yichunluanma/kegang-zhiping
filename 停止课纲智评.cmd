@echo off
chcp 65001 >nul
setlocal
pushd "%~dp001-应用源码"
if errorlevel 1 goto failed
node scripts\launcher.mjs --stop
set "APP_EXIT=%ERRORLEVEL%"
popd
if not "%APP_EXIT%"=="0" goto failed
exit /b 0
:failed
echo Stop failed. Please read the error above.
pause
exit /b 1
