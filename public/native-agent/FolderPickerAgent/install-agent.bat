@echo off
title Folder Picker Agent - Quick Install
setlocal

:: تحديد موقع exe الموجود (نفترض أنه في نفس مجلد السكريبت)
if not exist "%~dp0folder-picker-agent.exe" (
    echo [ERROR] folder-picker-agent.exe not found in current folder.
    echo Please run this script from the same folder as the agent executable.
    pause
    exit /b 1
)

set "INSTALL_DIR=%ProgramFiles%\FolderPickerAgent"
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
copy /Y "%~dp0folder-picker-agent.exe" "%INSTALL_DIR%\" >nul

:: إضافة إلى Startup
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
powershell -Command "$WS = New-Object -ComObject WScript.Shell; $SC = $WS.CreateShortcut('%STARTUP_DIR%\FolderPickerAgent.lnk'); $SC.TargetPath = '%INSTALL_DIR%\folder-picker-agent.exe'; $SC.Save()"

:: تشغيل الأداة
start "" "%INSTALL_DIR%\folder-picker-agent.exe" /min

echo.
echo ========================================
echo Agent installed and running.
echo You can close this window.
echo ========================================
timeout /t 3 /nobreak >nul
exit