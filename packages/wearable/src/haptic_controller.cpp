#include "haptic_controller.h"

HapticController::HapticController() {
    isInitialized = false;
    lastFeedbackTime = 0;
    feedbackCooldown = 100; // 100ms cooldown between feedback
}

bool HapticController::begin() {
    Serial.println("Initializing Haptic Controller...");
    
    // Initialize I2C
    Wire.begin(HAPTIC_SDA_PIN, HAPTIC_SCL_PIN);
    
    // Initialize DRV2605 haptic driver
    if (!drv.begin()) {
        Serial.println("Failed to initialize DRV2605 haptic driver");
        return false;
    }
    
    // Select library
    drv.selectLibrary(1);
    
    // Set mode to internal trigger
    drv.setMode(DRV2605_MODE_INTTRIG);
    
    isInitialized = true;
    Serial.println("Haptic Controller initialized successfully");
    
    return true;
}

void HapticController::end() {
    isInitialized = false;
}

void HapticController::playEffect(uint8_t effect) {
    if (!isInitialized) {
        return;
    }
    
    // Check cooldown
    if (millis() - lastFeedbackTime < feedbackCooldown) {
        return;
    }
    
    drv.setWaveform(0, effect);
    drv.setWaveform(1, 0); // End waveform
    drv.go();
    
    lastFeedbackTime = millis();
}

void HapticController::playCustomPattern(uint8_t* effects, size_t count, uint16_t* delays) {
    if (!isInitialized || count == 0) {
        return;
    }
    
    // Check cooldown
    if (millis() - lastFeedbackTime < feedbackCooldown) {
        return;
    }
    
    for (size_t i = 0; i < count && i < 8; i++) {
        drv.setWaveform(i, effects[i]);
        if (i < count - 1 && delays && delays[i] > 0) {
            // Add delay between effects if specified
            drv.setWaveform(i + 1, 0); // Pause
        }
    }
    drv.setWaveform(count < 8 ? count : 7, 0); // End waveform
    drv.go();
    
    // If delays are specified, handle them manually
    if (delays) {
        for (size_t i = 0; i < count - 1; i++) {
            if (delays[i] > 0) {
                delay(delays[i]);
            }
        }
    }
    
    lastFeedbackTime = millis();
}

void HapticController::playStartupPattern() {
    // Gentle ascending pattern for startup
    uint8_t effects[] = {2, 4, 6, 8};
    uint16_t delays[] = {100, 100, 100, 0};
    playCustomPattern(effects, 4, delays);
}

void HapticController::playConfirmationPattern() {
    // Double pulse for confirmation
    playEffect(HAPTIC_CONFIRMATION_EFFECT);
}

void HapticController::playErrorPattern() {
    // Strong buzz for error
    playEffect(HAPTIC_ERROR_EFFECT);
}

void HapticController::playClickPattern() {
    // Light click
    playEffect(HAPTIC_CLICK_EFFECT);
}

void HapticController::playDoubleClickPattern() {
    // Two quick clicks
    uint8_t effects[] = {HAPTIC_CLICK_EFFECT, HAPTIC_CLICK_EFFECT};
    uint16_t delays[] = {50, 0};
    playCustomPattern(effects, 2, delays);
}

void HapticController::playLongPressPattern() {
    // Long vibration for long press
    playEffect(HAPTIC_LONG_PRESS_EFFECT);
}

void HapticController::playWakeWordPattern() {
    // Gentle pulse for wake word detection
    playEffect(10); // Soft fuzz effect
}

void HapticController::playRecordingStartPattern() {
    // Rising pattern for recording start
    uint8_t effects[] = {1, 3, 5};
    uint16_t delays[] = {50, 50, 0};
    playCustomPattern(effects, 3, delays);
}

void HapticController::playRecordingStopPattern() {
    // Falling pattern for recording stop
    uint8_t effects[] = {5, 3, 1};
    uint16_t delays[] = {50, 50, 0};
    playCustomPattern(effects, 3, delays);
}

void HapticController::playLowBatteryPattern() {
    // Urgent pattern for low battery
    uint8_t effects[] = {58, 58, 58}; // Strong buzz repeated
    uint16_t delays[] = {200, 200, 0};
    playCustomPattern(effects, 3, delays);
}

void HapticController::playGesturePattern(GestureType gesture) {
    switch (gesture) {
        case GESTURE_TAP:
            playEffect(14); // Sharp click
            break;
        case GESTURE_DOUBLE_TAP:
            playDoubleClickPattern();
            break;
        case GESTURE_SWIPE_UP:
        case GESTURE_SWIPE_DOWN:
        case GESTURE_SWIPE_LEFT:
        case GESTURE_SWIPE_RIGHT:
            playEffect(12); // Soft bump
            break;
        case GESTURE_SHAKE:
            playEffect(47); // Buzz
            break;
        default:
            playClickPattern();
            break;
    }
}

void HapticController::playPattern(HapticPattern pattern) {
    switch (pattern) {
        case HAPTIC_STARTUP:
            playStartupPattern();
            break;
        case HAPTIC_CONFIRMATION:
            playConfirmationPattern();
            break;
        case HAPTIC_ERROR:
            playErrorPattern();
            break;
        case HAPTIC_CLICK:
            playClickPattern();
            break;
        case HAPTIC_DOUBLE_CLICK:
            playDoubleClickPattern();
            break;
        case HAPTIC_LONG_PRESS:
            playLongPressPattern();
            break;
        case HAPTIC_WAKE_WORD:
            playWakeWordPattern();
            break;
        case HAPTIC_RECORDING_START:
            playRecordingStartPattern();
            break;
        case HAPTIC_RECORDING_STOP:
            playRecordingStopPattern();
            break;
        case HAPTIC_LOW_BATTERY:
            playLowBatteryPattern();
            break;
        default:
            playClickPattern();
            break;
    }
}

bool HapticController::isReady() {
    return isInitialized && (millis() - lastFeedbackTime >= feedbackCooldown);
}

void HapticController::setCooldown(uint32_t cooldownMs) {
    feedbackCooldown = cooldownMs;
}

void HapticController::test() {
    if (!isInitialized) {
        Serial.println("Haptic controller not initialized");
        return;
    }
    
    Serial.println("Testing haptic patterns...");
    
    playStartupPattern();
    delay(1000);
    
    playConfirmationPattern();
    delay(500);
    
    playErrorPattern();
    delay(500);
    
    playClickPattern();
    delay(500);
    
    Serial.println("Haptic test complete");
}