#ifndef GESTURE_DETECTOR_H
#define GESTURE_DETECTOR_H

#include <Arduino.h>
#include <Wire.h>
#include "config.h"

enum GestureType {
    GESTURE_NONE,
    GESTURE_TAP,
    GESTURE_DOUBLE_TAP,
    GESTURE_SWIPE_UP,
    GESTURE_SWIPE_DOWN,
    GESTURE_SWIPE_LEFT,
    GESTURE_SWIPE_RIGHT,
    GESTURE_SHAKE,
    GESTURE_TWIST_CW,
    GESTURE_TWIST_CCW
};

struct AccelData {
    float x;
    float y;
    float z;
    uint32_t timestamp;
};

class GestureDetector {
private:
    bool isInitialized;
    
    // Accelerometer data
    AccelData currentAccel;
    AccelData previousAccel;
    AccelData gestureBuffer[32];
    size_t bufferIndex;
    
    // Gesture detection parameters
    float tapThreshold;
    float swipeThreshold;
    float shakeThreshold;
    uint32_t gestureTimeout;
    uint32_t lastGestureTime;
    uint32_t lastTapTime;
    
    // Accelerometer communication
    bool initializeAccelerometer();
    bool readAccelerometer(AccelData& data);
    void writeRegister(uint8_t reg, uint8_t value);
    uint8_t readRegister(uint8_t reg);
    
    // Gesture analysis
    GestureType analyzeGestureBuffer();
    bool detectTap();
    bool detectDoubleTap();
    GestureType detectSwipe();
    bool detectShake();
    GestureType detectTwist();
    
    // Utility functions
    float calculateMagnitude(const AccelData& data);
    float calculateDistance(const AccelData& a, const AccelData& b);
    void addToBuffer(const AccelData& data);
    void clearBuffer();

public:
    GestureDetector();
    bool begin();
    void end();
    void update();
    
    // Main detection method
    GestureType detectGesture();
    
    // Configuration methods
    void setTapThreshold(float threshold);
    void setSwipeThreshold(float threshold);
    void setShakeThreshold(float threshold);
    void setGestureTimeout(uint32_t timeoutMs);
    
    // Calibration and testing
    void calibrate();
    void test();
    AccelData getCurrentAccel();
    bool isReady();
};

#endif // GESTURE_DETECTOR_H