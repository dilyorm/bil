#!/bin/bash

# BIL Wearable Firmware Upload Script

echo "Uploading BIL Wearable Firmware..."

# Check if PlatformIO is installed
if ! command -v pio &> /dev/null; then
    echo "Error: PlatformIO is not installed or not in PATH"
    echo "Please install PlatformIO: https://platformio.org/install"
    exit 1
fi

# Check if firmware is built
if [ ! -f ".pio/build/esp32dev/firmware.bin" ]; then
    echo "Firmware not found. Building first..."
    if ! pio run; then
        echo "Build failed!"
        exit 1
    fi
fi

# List available ports
echo "Available serial ports:"
pio device list

echo ""
read -p "Enter the port (e.g., COM3 or /dev/ttyUSB0) or press Enter for auto-detect: " PORT

# Upload firmware
if [ -z "$PORT" ]; then
    echo "Uploading firmware (auto-detect port)..."
    pio run --target upload
else
    echo "Uploading firmware to $PORT..."
    pio run --target upload --upload-port "$PORT"
fi

if [ $? -eq 0 ]; then
    echo "Upload successful!"
    echo ""
    echo "To monitor serial output: pio device monitor"
    echo "To monitor specific port: pio device monitor --port $PORT"
else
    echo "Upload failed!"
    exit 1
fi