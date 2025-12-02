#include "gesture_detector.h"

// LIS3DH register addresses (common accelerometer)
#define LIS3DH_REG_CTRL1 0x20
#define LIS3DH_REG_CTRL4 0x23
#define LIS3DH_REG_OUT_X_L 0x28
#define LIS3DH_REG_OUT_X_H 0x29
#define LIS3DH_REG_OUT_Y_L 0x2A
#define LIS3DH_REG_OUT_Y_H 0x2B
#define LIS3DH_REG_OUT_Z_L 0x2C
#define LIS3DH_REG_OUT_Z_H 0x2D
#define LIS3DH_REG_WHO_AM_I 0x0F

GestureDetector::GestureDetector() {
    isInitialized = false;
    bufferIndex = 0;
    tapThreshold = GESTURE_THRESHOLD;
    swipeThreshold = GESTURE_THRESHOLD * 1.5;
    shakeThreshold = GESTURE_THRESHOLD * 2.0;
    gestureTimeout = GESTURE_TIMEOUT_MS;
    lastGestureTime = 0;
    lastTapTime = 0;
    
    // Initialize data structures
    memset(&currentAccel, 0, sizeof(AccelData));
    memset(&previousAccel, 0, sizeof(AccelData));
    memset(gestureBuffer, 0, sizeof(gestureBuffer));
}

bool GestureDetector::begin() {
    Serial.println("Initializing Gesture Detector...");
    
    // Initialize I2C if not already done
    Wire.begin(ACCEL_SDA_PIN, ACCEL_SCL_PIN);
    
    // Initialize accelerometer
    if (!initializeAccelerometer()) {
        Serial.println("Failed to initialize accelerometer");
        return false;
    }
    
    isInitialized = true;
    Serial.println("Gesture Detector initialized successfully");
    
    return true;
}

void GestureDetector::end() {
    isInitialized = false;
}

bool GestureDetector::initializeAccelerometer() {
    // Check WHO_AM_I register
    uint8_t whoAmI = readRegister(LIS3DH_REG_WHO_AM_I);
    if (whoAmI != 0x33) {
        Serial.printf("Unexpected WHO_AM_I value: 0x%02X\n", whoAmI);
        // Continue anyway, might be a different accelerometer
    }
    
    // Configure accelerometer
    // CTRL1: Normal mode, 100Hz, XYZ enabled
    writeRegister(LIS3DH_REG_CTRL1, 0x57);
    
    // CTRL4: +/- 2g, high resolution
    writeRegister(LIS3DH_REG_CTRL4, 0x08);
    
    delay(10); // Allow time for configuration
    
    // Test read
    AccelData testData;
    if (!readAccelerometer(testData)) {
        Serial.println("Failed to read test data from accelerometer");
        return false;
    }
    
    return true;
}

void GestureDetector::writeRegister(uint8_t reg, uint8_t value) {
    Wire.beginTransmission(ACCEL_I2C_ADDRESS);
    Wire.write(reg);
    Wire.write(value);
    Wire.endTransmission();
}

uint8_t GestureDetector::readRegister(uint8_t reg) {
    Wire.beginTransmission(ACCEL_I2C_ADDRESS);
    Wire.write(reg);
    Wire.endTransmission(false);
    
    Wire.requestFrom(ACCEL_I2C_ADDRESS, 1);
    if (Wire.available()) {
        return Wire.read();
    }
    return 0;
}

bool GestureDetector::readAccelerometer(AccelData& data) {
    Wire.beginTransmission(ACCEL_I2C_ADDRESS);
    Wire.write(LIS3DH_REG_OUT_X_L | 0x80); // Auto-increment
    Wire.endTransmission(false);
    
    Wire.requestFrom(ACCEL_I2C_ADDRESS, 6);
    
    if (Wire.available() >= 6) {
        int16_t x = Wire.read() | (Wire.read() << 8);
        int16_t y = Wire.read() | (Wire.read() << 8);
        int16_t z = Wire.read() | (Wire.read() << 8);
        
        // Convert to g-force (assuming +/- 2g range)
        data.x = (float)x / 16384.0;
        data.y = (float)y / 16384.0;
        data.z = (float)z / 16384.0;
        data.timestamp = millis();
        
        return true;
    }
    
    return false;
}

void GestureDetector::update() {
    if (!isInitialized) {
        return;
    }
    
    // Read current accelerometer data
    previousAccel = currentAccel;
    if (readAccelerometer(currentAccel)) {
        addToBuffer(currentAccel);
    }
}

GestureType GestureDetector::detectGesture() {
    if (!isInitialized) {
        return GESTURE_NONE;
    }
    
    // Check for timeout since last gesture
    if (millis() - lastGestureTime < 200) {
        return GESTURE_NONE; // Prevent rapid-fire gestures
    }
    
    // Check for tap first (most common)
    if (detectTap()) {
        if (detectDoubleTap()) {
            lastGestureTime = millis();
            return GESTURE_DOUBLE_TAP;
        } else {
            lastGestureTime = millis();
            return GESTURE_TAP;
        }
    }
    
    // Check for shake
    if (detectShake()) {
        lastGestureTime = millis();
        return GESTURE_SHAKE;
    }
    
    // Check for swipe
    GestureType swipe = detectSwipe();
    if (swipe != GESTURE_NONE) {
        lastGestureTime = millis();
        return swipe;
    }
    
    // Check for twist
    GestureType twist = detectTwist();
    if (twist != GESTURE_NONE) {
        lastGestureTime = millis();
        return twist;
    }
    
    return GESTURE_NONE;
}

bool GestureDetector::detectTap() {
    float magnitude = calculateMagnitude(currentAccel);
    float prevMagnitude = calculateMagnitude(previousAccel);
    
    // Look for sudden acceleration spike
    if (magnitude > tapThreshold && magnitude > prevMagnitude * 1.5) {
        return true;
    }
    
    return false;
}

bool GestureDetector::detectDoubleTap() {
    uint32_t currentTime = millis();
    
    // Check if this tap is within double-tap window
    if (currentTime - lastTapTime < 500) {
        lastTapTime = 0; // Reset to prevent triple-tap
        return true;
    }
    
    lastTapTime = currentTime;
    return false;
}

GestureType GestureDetector::detectSwipe() {
    if (bufferIndex < 8) {
        return GESTURE_NONE; // Need enough data points
    }
    
    // Analyze recent motion in buffer
    AccelData start = gestureBuffer[(bufferIndex - 8) % 32];
    AccelData end = gestureBuffer[(bufferIndex - 1) % 32];
    
    float deltaX = end.x - start.x;
    float deltaY = end.y - start.y;
    float deltaZ = end.z - start.z;
    
    // Check for significant movement in one direction
    if (abs(deltaX) > swipeThreshold && abs(deltaX) > abs(deltaY) && abs(deltaX) > abs(deltaZ)) {
        return deltaX > 0 ? GESTURE_SWIPE_RIGHT : GESTURE_SWIPE_LEFT;
    }
    
    if (abs(deltaY) > swipeThreshold && abs(deltaY) > abs(deltaX) && abs(deltaY) > abs(deltaZ)) {
        return deltaY > 0 ? GESTURE_SWIPE_UP : GESTURE_SWIPE_DOWN;
    }
    
    return GESTURE_NONE;
}

bool GestureDetector::detectShake() {
    if (bufferIndex < 16) {
        return false; // Need enough data points
    }
    
    // Calculate variance in recent accelerometer readings
    float variance = 0;
    float mean = 0;
    
    for (int i = 0; i < 16; i++) {
        int index = (bufferIndex - 16 + i) % 32;
        float magnitude = calculateMagnitude(gestureBuffer[index]);
        mean += magnitude;
    }
    mean /= 16;
    
    for (int i = 0; i < 16; i++) {
        int index = (bufferIndex - 16 + i) % 32;
        float magnitude = calculateMagnitude(gestureBuffer[index]);
        variance += (magnitude - mean) * (magnitude - mean);
    }
    variance /= 16;
    
    return variance > shakeThreshold;
}

GestureType GestureDetector::detectTwist() {
    // Simplified twist detection based on Z-axis rotation
    // This would need more sophisticated implementation for real twist detection
    if (bufferIndex < 8) {
        return GESTURE_NONE;
    }
    
    AccelData start = gestureBuffer[(bufferIndex - 8) % 32];
    AccelData end = gestureBuffer[(bufferIndex - 1) % 32];
    
    float deltaZ = end.z - start.z;
    
    if (abs(deltaZ) > swipeThreshold * 0.8) {
        return deltaZ > 0 ? GESTURE_TWIST_CW : GESTURE_TWIST_CCW;
    }
    
    return GESTURE_NONE;
}

float GestureDetector::calculateMagnitude(const AccelData& data) {
    return sqrt(data.x * data.x + data.y * data.y + data.z * data.z);
}

float GestureDetector::calculateDistance(const AccelData& a, const AccelData& b) {
    float dx = a.x - b.x;
    float dy = a.y - b.y;
    float dz = a.z - b.z;
    return sqrt(dx * dx + dy * dy + dz * dz);
}

void GestureDetector::addToBuffer(const AccelData& data) {
    gestureBuffer[bufferIndex] = data;
    bufferIndex = (bufferIndex + 1) % 32;
}

void GestureDetector::clearBuffer() {
    bufferIndex = 0;
    memset(gestureBuffer, 0, sizeof(gestureBuffer));
}

void GestureDetector::setTapThreshold(float threshold) {
    tapThreshold = threshold;
}

void GestureDetector::setSwipeThreshold(float threshold) {
    swipeThreshold = threshold;
}

void GestureDetector::setShakeThreshold(float threshold) {
    shakeThreshold = threshold;
}

void GestureDetector::setGestureTimeout(uint32_t timeoutMs) {
    gestureTimeout = timeoutMs;
}

void GestureDetector::calibrate() {
    if (!isInitialized) {
        Serial.println("Gesture detector not initialized");
        return;
    }
    
    Serial.println("Calibrating gesture detector...");
    Serial.println("Keep device still for 3 seconds");
    
    delay(3000);
    
    // Read baseline values
    AccelData baseline;
    float totalX = 0, totalY = 0, totalZ = 0;
    
    for (int i = 0; i < 100; i++) {
        if (readAccelerometer(baseline)) {
            totalX += baseline.x;
            totalY += baseline.y;
            totalZ += baseline.z;
        }
        delay(10);
    }
    
    // Calculate average baseline
    AccelData avgBaseline;
    avgBaseline.x = totalX / 100;
    avgBaseline.y = totalY / 100;
    avgBaseline.z = totalZ / 100;
    
    Serial.printf("Baseline: X=%.3f, Y=%.3f, Z=%.3f\n", 
                  avgBaseline.x, avgBaseline.y, avgBaseline.z);
    
    Serial.println("Calibration complete");
}

void GestureDetector::test() {
    if (!isInitialized) {
        Serial.println("Gesture detector not initialized");
        return;
    }
    
    Serial.println("Testing gesture detection for 10 seconds...");
    Serial.println("Try tapping, shaking, or swiping the device");
    
    uint32_t startTime = millis();
    while (millis() - startTime < 10000) {
        update();
        
        GestureType gesture = detectGesture();
        if (gesture != GESTURE_NONE) {
            Serial.printf("Detected gesture: %d\n", gesture);
        }
        
        delay(50);
    }
    
    Serial.println("Gesture test complete");
}

AccelData GestureDetector::getCurrentAccel() {
    return currentAccel;
}

bool GestureDetector::isReady() {
    return isInitialized;
}