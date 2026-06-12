@echo off
echo.
echo =======================================
echo   AuraStream Audio Backend Installer
echo =======================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python from https://python.org
    echo Or run: winget install Python.Python.3.12
    pause
    exit /b 1
)

echo [1/3] Creating virtual environment...
cd /d "%~dp0backend"
python -m venv venv

echo [2/3] Installing dependencies...
call venv\Scripts\activate.bat
pip install -r requirements.txt

echo [3/3] Starting AuraStream Audio Backend...
echo.
python main.py
