@echo off
REM BIL Wearable Firmware Build Script for Windows

echo Building BIL Wearable Firmware...

REM Check if PlatformIO is installed
where pio >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: PlatformIO is not installed or not in PATH
    echo Please install PlatformIO: https://platformio.org/install
    pause
    exit /b 1
)

REM Clean previous build
echo Cleaning previous build...
pio run --target clean

REM Build the firmware
echo Building firmware...
pio run
if %ERRORLEVEL% EQU 0 (
    echo Build successful!
    echo.
    echo Build Information:
    echo ==================
    dir .pio\build\esp32dev\
    echo.
    echo Firmware ready for upload!
    echo To upload: pio run --target upload
    echo To monitor: pio device monitor
) else (
    echo Build failed!
    pause
    exit /b 1
)

pause