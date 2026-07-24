@echo off
title Home Assistant Test Environment Setup
cls

echo =========================================================================
echo  HOME ASSISTANT TEST ENVIRONMENT LAUNCHER
echo =========================================================================
echo.

:: Check if Docker is installed and running
docker --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [+] Docker detected! Checking Docker daemon...
    docker info >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo [+] Docker daemon is running! Starting official Home Assistant Docker container...
        echo.
        docker run -d ^
          --name haai-ha-test ^
          --restart unless-stopped ^
          -p 8123:8123 ^
          homeassistant/home-assistant:stable
          
        if %ERRORLEVEL% EQU 0 (
            echo.
            echo =========================================================================
            echo [SUCCESS] Home Assistant Docker container is running on http://localhost:8123
            echo =========================================================================
            pause
            exit /b 0
        )
    ) else (
        echo [!] Docker is installed but Docker Desktop is not currently running.
    )
) else (
    echo [!] Docker command not found on PATH.
)

echo.
echo [+] Falling back to Lightweight Local Python Test Server...
echo.

python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Neither Docker nor Python was found on your system!
    echo Please install Python 3.x or Docker Desktop to run the test environment.
    pause
    exit /b 1
)

python "%~dp0scratch\ha_test_env.py"

pause
