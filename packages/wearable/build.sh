#!/bin/bash

# BIL Wearable Firmware Build Script

echo "Building BIL Wearable Firmware..."

# Check if PlatformIO is installed
if ! command -v pio &> /dev/null; then
    echo "Error: PlatformIO is not installed or not in PATH"
    echo "Please install PlatformIO: https://platformio.org/install"
    exit 1
fi

# Clean previous build
echo "Cleaning previous build..."
pio run --target clean

# Build the firmware
echo "Building firmware..."
if pio run; then
    echo "Build successful!"
    
    # Show build information
    echo ""
    echo "Build Information:"
    echo "=================="
    ls -la .pio/build/esp32dev/
    
    echo ""
    echo "Firmware ready for upload!"
    echo "To upload: pio run --target upload"
    echo "To monitor: pio device monitor"
else
    echo "Build failed!"
    exit 1
fi