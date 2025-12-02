@echo off
REM BIL Wearable Firmware Upload Script for Windows

echo Uploading BIL Wearable Firmware...

REM Check if PlatformIO is installed
where pio >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: PlatformIO is not installed or not in PATH
    echo Please install PlatformIO: https://platformio.org/install
    pause
    exit /b 1
)

REM Check if firmware is built
if not exist ".pio\build\esp32dev\firmware.bin" (
    echo Firmware not found. Building first...
    pio run
    if %ERRORLEVEL% NEQ 0 (
        echo Build failed!
        pause
        exit /b 1
    )
)

REM List available ports
echo Available serial ports:
pio device list

echo.
set /p PORT="Enter the port (e.g., COM3) or press Enter for auto-detect: "

REM Upload firmware
if "%PORT%"=="" (
    echo Uploading firmware (auto-detect port)...
    pio run --target upload
) else (
    echo Uploading firmware to %PORT%...
    pio run --target upload --upload-port %PORT%
)

if %ERRORLEVEL% EQU 0 (
    echo Upload successful!
    echo.
    echo To monitor serial output: pio device monitor
    if not "%PORT%"=="" echo To monitor specific port: pio device monitor --port %PORT%
) else (
    echo Upload failed!
    pause
    exit /b 1
)

pause