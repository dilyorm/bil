#ifndef HAPTIC_CONTROLLER_H
#define HAPTIC_CONTROLLER_H

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_DRV2605.h>
#include "config.h"
#include "gesture_detector.h"

enum HapticPattern {
    HAPTIC_STARTUP,
    HAPTIC_CONFIRMATION,
    HAPTIC_ERROR,
    HAPTIC_CLICK,
    HAPTIC_DOUBLE_CLICK,
    HAPTIC_LONG_PRESS,
    HAPTIC_WAKE_WORD,
    HAPTIC_RECORDING_START,
    HAPTIC_RECORDING_STOP,
    HAPTIC_LOW_BATTERY,
    HAPTIC_GESTURE_TAP,
    HAPTIC_GESTURE_SWIPE,
    HAPTIC_GESTURE_SHAKE
};

class HapticController {
private:
    Adafruit_DRV2605 drv;
    bool isInitialized;
    uint32_t lastFeedbackTime;
    uint32_t feedbackCooldown;
    
    void playEffect(uint8_t effect);
    void playCustomPattern(uint8_t* effects, size_t count, uint16_t* delays);

public:
    HapticController();
    bool begin();
    void end();
    
    // Pattern playback methods
    void playStartupPattern();
    void playConfirmationPattern();
    void playErrorPattern();
    void playClickPattern();
    void playDoubleClickPattern();
    void playLongPressPattern();
    void playWakeWordPattern();
    void playRecordingStartPattern();
    void playRecordingStopPattern();
    void playLowBatteryPattern();
    void playGesturePattern(GestureType gesture);
    
    // Generic pattern method
    void playPattern(HapticPattern pattern);
    
    // Utility methods
    bool isReady();
    void setCooldown(uint32_t cooldownMs);
    void test();
};

#endif // HAPTIC_CONTROLLER_H