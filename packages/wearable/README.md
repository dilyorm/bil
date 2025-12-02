# BIL Wearable Device Firmware

This package contains the firmware for the BIL wearable device (Culon), built on the ESP32 platform using Arduino framework and PlatformIO.

## Hardware Requirements

- ESP32 development board (ESP32-WROOM-32 or similar)
- DRV2605 haptic feedback driver
- LIS3DH accelerometer (or compatible)
- MEMS microphone (connected to ADC)
- Push button
- LED indicator
- Battery management circuit

## Pin Configuration

| Component | Pin | Description |
|-----------|-----|-------------|
| LED | GPIO 2 | Status indicator |
| Button | GPIO 0 | User input button |
| Microphone | GPIO 34 (ADC1_CH6) | Audio input |
| Haptic SDA | GPIO 21 | I2C data for haptic driver |
| Haptic SCL | GPIO 22 | I2C clock for haptic driver |
| Accel SDA | GPIO 21 | I2C data for accelerometer |
| Accel SCL | GPIO 22 | I2C clock for accelerometer |
| Battery | GPIO 35 | Battery voltage monitoring |

## Features

### Bluetooth Low Energy (BLE)
- Custom BLE service for communication with mobile app
- Audio data transmission characteristic
- Command and status characteristics
- Automatic reconnection handling

### Voice Detection
- Wake word detection ("Hey BIL")
- Voice recording and transmission
- I2S-based audio processing
- Configurable sensitivity thresholds

### Haptic Feedback
- Multiple feedback patterns for different events
- DRV2605-based haptic driver
- Customizable vibration effects
- Battery-aware feedback intensity

### Gesture Recognition
- Tap and double-tap detection
- Swipe gestures (up, down, left, right)
- Shake detection
- Twist gestures (clockwise, counter-clockwise)

## Development Setup

### Prerequisites

1. Install [PlatformIO](https://platformio.org/install)
2. Install [Visual Studio Code](https://code.visualstudio.com/) with PlatformIO extension (recommended)

### Building and Uploading

#### Option 1: Using Build Scripts (Recommended)

1. Connect your ESP32 device via USB
2. Run the build script:
   - **Windows**: Double-click `build.bat` or run in command prompt
   - **Linux/Mac**: Run `./build.sh`
3. Run the upload script:
   - **Windows**: Double-click `upload.bat` or run in command prompt
   - **Linux/Mac**: Run `./upload.sh`

#### Option 2: Using PlatformIO Commands

1. Connect your ESP32 device via USB
2. Open the project in PlatformIO
3. Build the project:
   ```bash
   pio run
   ```
4. Upload to device:
   ```bash
   pio run --target upload
   ```
5. Monitor serial output:
   ```bash
   pio device monitor
   ```

#### Option 3: Using Visual Studio Code

1. Install the PlatformIO extension in VS Code
2. Open the `packages/wearable` folder in VS Code
3. Use the PlatformIO toolbar buttons to build and upload

### Configuration

Edit `src/config.h` to customize:
- Hardware pin assignments
- BLE service UUIDs
- Voice detection parameters
- Haptic feedback settings
- Gesture detection thresholds

## Usage

### Initial Setup

1. Power on the device
2. The device will start advertising as "BIL-Wearable"
3. Pair with the BIL mobile app
4. The device will provide haptic confirmation when connected

### Voice Interaction

1. Say "Hey BIL" to activate wake word detection
2. Device provides haptic feedback when wake word is detected
3. Speak your command/question
4. Audio is transmitted to mobile app for processing
5. Response is received and appropriate haptic feedback is provided

### Button Controls

- **Single Click**: Send button click command to mobile app
- **Double Click**: Toggle voice recording on/off
- **Long Press**: Enter pairing mode or disconnect from current device

### Gesture Controls

- **Tap**: Quick interaction command
- **Double Tap**: Alternative activation method
- **Swipe**: Directional commands (up/down/left/right)
- **Shake**: Attention/alert gesture
- **Twist**: Rotational commands

## Architecture

### Main Components

- **BLEManager**: Handles all Bluetooth communication
- **VoiceDetector**: Manages wake word detection and voice recording
- **HapticController**: Controls vibration feedback patterns
- **GestureDetector**: Processes accelerometer data for gesture recognition

### Communication Protocol

The device communicates with the mobile app using JSON messages over BLE:

```json
{
  "type": "command",
  "command": "wake_word_detected",
  "timestamp": 1234567890
}
```

### Power Management

- Sleep mode after 5 minutes of inactivity
- Low battery detection and warning
- Optimized BLE connection intervals
- Haptic feedback intensity scaling based on battery level

## Troubleshooting

### Common Issues

1. **Device not advertising**
   - Check power supply
   - Verify BLE initialization in serial monitor
   - Try resetting the device

2. **Voice detection not working**
   - Check microphone connections
   - Adjust voice threshold in config.h
   - Monitor audio levels in serial output

3. **Haptic feedback not working**
   - Verify DRV2605 I2C connections
   - Check I2C address in config.h
   - Test with haptic controller test function

4. **Gesture detection issues**
   - Calibrate accelerometer using test function
   - Adjust gesture thresholds
   - Check accelerometer I2C connections

### Debug Output

Enable debug output by setting `DEBUG_ENABLED` to `true` in config.h. Monitor serial output at 115200 baud for detailed logging.

## Testing

### Firmware Test Mode

The firmware includes a comprehensive test mode for validating hardware components:

1. Edit `src/test_firmware.cpp` and uncomment the line:
   ```cpp
   #define ENABLE_FIRMWARE_TESTS
   ```

2. Build and upload the test firmware:
   ```bash
   pio run --target upload
   ```

3. Open serial monitor at 115200 baud:
   ```bash
   pio device monitor
   ```

4. The test will automatically run all hardware tests, then enter interactive mode

#### Interactive Test Commands

Once in interactive mode, type these commands in the serial monitor:

- `haptic` - Test all haptic feedback patterns
- `gesture` - Test gesture detection (follow on-screen instructions)
- `voice` - Test voice detection and wake word
- `battery` - Check current battery voltage
- `help` - Show available commands

### Hardware Tests

#### Manual Testing Functions

If not using test mode, you can call these functions in your code:

- `hapticController.test()` - Test all haptic patterns
- `gestureDetector.test()` - Test gesture recognition for 10 seconds
- `gestureDetector.calibrate()` - Calibrate accelerometer baseline
- `voiceDetector.update()` - Process audio input

#### Expected Test Results

- **Haptic Controller**: Should feel different vibration patterns
- **Gesture Detector**: Should detect taps, swipes, and shakes
- **Voice Detector**: Should detect "Hey BIL" wake word
- **BLE Manager**: Should appear as "BIL-Wearable" in BLE scanners
- **LED**: Should blink according to connection state
- **Button**: Should respond to clicks, double-clicks, and long presses

### BLE Testing

Use a BLE scanner app (like "BLE Scanner" on Android or "LightBlue" on iOS) to verify:

1. **Device Advertising**: Look for "BIL-Wearable" device
2. **Service UUID**: `12345678-1234-1234-1234-123456789abc`
3. **Characteristics**:
   - Audio: `12345678-1234-1234-1234-123456789abd`
   - Command: `12345678-1234-1234-1234-123456789abe`
   - Status: `12345678-1234-1234-1234-123456789abf`

### Mobile App Integration Testing

1. Ensure the BIL mobile app is running
2. Pair the wearable device through the app
3. Test voice commands by saying "Hey BIL"
4. Test gesture commands (tap, swipe, shake)
5. Test button interactions
6. Verify haptic feedback responses

### Performance Testing

Monitor these metrics during testing:

- **Battery Life**: Should last several hours of active use
- **BLE Range**: Should maintain connection up to 10 meters
- **Voice Latency**: Wake word detection within 1-2 seconds
- **Gesture Response**: Gesture detection within 500ms
- **Memory Usage**: Monitor free heap in serial output

## Contributing

When modifying the firmware:

1. Follow Arduino coding standards
2. Update configuration constants in config.h
3. Add appropriate debug logging
4. Test on actual hardware before committing
5. Update this README for any new features

## License

This firmware is part of the BIL Core System project.