#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ArduinoJson.h>
#include <OneButton.h>
#include <Adafruit_DRV2605.h>
#include "config.h"
#include "ble_manager.h"
#include "voice_detector.h"
#include "haptic_controller.h"
#include "gesture_detector.h"
#include "connection_manager.h"
#include "protocol.h"

// Global instances
BLEManager bleManager;
VoiceDetector voiceDetector;
HapticController hapticController;
GestureDetector gestureDetector;
ConnectionManager connectionManager;

// Hardware pins
OneButton button(BUTTON_PIN, true);

// System state
bool systemReady = false;
uint32_t lastStatusUpdate = 0;
uint32_t statusUpdateInterval = 5000; // 5 seconds

// Function declarations
void onButtonClick();
void onButtonDoubleClick();
void onButtonLongPress();
void handleWakeWordDetected();
void handleGestureDetected(GestureType gesture);
void handleVoiceRecordingComplete();
void checkBatteryLevel();
void sendPeriodicStatus();
void updateStatusLED();
void onBLEConnected();
void onBLEDisconnected();
void onBLEReconnecting();

void setup() {
    Serial.begin(115200);
    Serial.println("BIL Wearable Device Starting...");
    
    // Initialize hardware components
    pinMode(LED_PIN, OUTPUT);
    pinMode(BATTERY_PIN, INPUT);
    digitalWrite(LED_PIN, LOW);
    
    // Initialize button
    button.attachClick(onButtonClick);
    button.attachDoubleClick(onButtonDoubleClick);
    button.attachLongPressStart(onButtonLongPress);
    
    // Initialize haptic feedback
    if (!hapticController.begin()) {
        Serial.println("Failed to initialize haptic controller");
        hapticController.playErrorPattern();
    } else {
        Serial.println("Haptic controller initialized");
    }
    
    // Initialize gesture detection
    if (!gestureDetector.begin()) {
        Serial.println("Failed to initialize gesture detector");
        if (hapticController.isReady()) {
            hapticController.playErrorPattern();
        }
    } else {
        Serial.println("Gesture detector initialized");
    }
    
    // Initialize voice detection
    if (!voiceDetector.begin()) {
        Serial.println("Failed to initialize voice detector");
        if (hapticController.isReady()) {
            hapticController.playErrorPattern();
        }
    } else {
        Serial.println("Voice detector initialized");
    }
    
    // Initialize connection manager
    connectionManager.begin();
    connectionManager.onConnected = onBLEConnected;
    connectionManager.onDisconnected = onBLEDisconnected;
    connectionManager.onReconnecting = onBLEReconnecting;
    
    // Initialize BLE
    if (!bleManager.begin()) {
        Serial.println("Failed to initialize BLE");
        if (hapticController.isReady()) {
            hapticController.playErrorPattern();
        }
        return;
    }
    
    systemReady = true;
    Serial.println("BIL Wearable Device Ready");
    
    if (hapticController.isReady()) {
        hapticController.playStartupPattern();
    }
    
    // Start advertising
    connectionManager.setState(CONN_ADVERTISING);
}

void loop() {
    if (!systemReady) {
        delay(100);
        return;
    }
    
    // Update button state
    button.tick();
    
    // Update connection manager
    connectionManager.update();
    
    // Update BLE manager
    bleManager.update();
    
    // Update voice detector
    voiceDetector.update();
    
    // Update gesture detector
    gestureDetector.update();
    
    // Check for wake word detection
    if (voiceDetector.detectWakeWord()) {
        Serial.println("Wake word detected!");
        hapticController.playWakeWordPattern();
        handleWakeWordDetected();
    }
    
    // Check for gesture input
    GestureType gesture = gestureDetector.detectGesture();
    if (gesture != GESTURE_NONE) {
        Serial.printf("Gesture detected: %d\n", gesture);
        handleGestureDetected(gesture);
    }
    
    // Handle voice recording completion
    if (voiceDetector.getState() == VOICE_RECORDING && !voiceDetector.isRecording()) {
        handleVoiceRecordingComplete();
    }
    
    // Check battery level periodically
    checkBatteryLevel();
    
    // Send periodic status updates
    sendPeriodicStatus();
    
    // Update LED status
    updateStatusLED();
    
    // Small delay to prevent watchdog issues
    delay(10);
}

void onButtonClick() {
    Serial.println("Button clicked");
    hapticController.playClickPattern();
    
    if (connectionManager.isConnected()) {
        bleManager.sendCommand("button_click");
    }
}

void onButtonDoubleClick() {
    Serial.println("Button double clicked");
    hapticController.playDoubleClickPattern();
    
    // Toggle voice recording
    if (voiceDetector.isRecording()) {
        voiceDetector.stopRecording();
    } else {
        voiceDetector.startRecording();
    }
}

void onButtonLongPress() {
    Serial.println("Button long pressed");
    hapticController.playLongPressPattern();
    
    // Enter pairing mode or disconnect
    if (connectionManager.isConnected()) {
        Serial.println("Disconnecting from current device");
        connectionManager.disconnect();
        bleManager.disconnect();
    } else {
        Serial.println("Starting advertising for pairing");
        connectionManager.setState(CONN_ADVERTISING);
        bleManager.startAdvertising();
    }
}

void handleWakeWordDetected() {
    if (connectionManager.isConnected()) {
        // Start voice recording and notify mobile app
        if (voiceDetector.startRecording()) {
            bleManager.sendCommand("wake_word_detected");
            hapticController.playRecordingStartPattern();
            Serial.println("Started voice recording");
        } else {
            Serial.println("Failed to start voice recording");
            hapticController.playErrorPattern();
        }
    } else {
        // Not connected, play error pattern
        Serial.println("Wake word detected but not connected to mobile app");
        hapticController.playErrorPattern();
    }
}

void handleGestureDetected(GestureType gesture) {
    if (connectionManager.isConnected()) {
        String gestureCommand = "gesture_" + String(gesture);
        bleManager.sendCommand(gestureCommand);
        hapticController.playGesturePattern(gesture);
    } else {
        // Not connected, just provide haptic feedback
        hapticController.playGesturePattern(gesture);
    }
}

void handleVoiceRecordingComplete() {
    Serial.println("Voice recording completed");
    
    if (connectionManager.isConnected()) {
        // Get recorded audio data
        int16_t* audioBuffer = voiceDetector.getAudioBuffer();
        size_t recordedSamples = voiceDetector.getRecordedSamples();
        
        if (recordedSamples > 0) {
            // Convert to bytes and send via BLE
            uint8_t* audioBytes = (uint8_t*)audioBuffer;
            size_t audioSize = recordedSamples * sizeof(int16_t);
            
            if (bleManager.sendAudioData(audioBytes, audioSize)) {
                Serial.printf("Sent %d bytes of audio data\n", audioSize);
                hapticController.playRecordingStopPattern();
            } else {
                Serial.println("Failed to send audio data");
                hapticController.playErrorPattern();
            }
        }
        
        // Clear the buffer for next recording
        voiceDetector.clearBuffer();
    }
}

void checkBatteryLevel() {
    static uint32_t lastBatteryCheck = 0;
    
    if (millis() - lastBatteryCheck > 30000) { // Check every 30 seconds
        float batteryVoltage = Protocol::getBatteryVoltage();
        
        if (batteryVoltage < LOW_BATTERY_THRESHOLD) {
            Serial.printf("Low battery: %.2fV\n", batteryVoltage);
            hapticController.playLowBatteryPattern();
            
            if (connectionManager.isConnected()) {
                bleManager.sendStatus("low_battery");
            }
        }
        
        lastBatteryCheck = millis();
    }
}

void sendPeriodicStatus() {
    if (connectionManager.isConnected() && millis() - lastStatusUpdate > statusUpdateInterval) {
        String status = "ready";
        
        if (voiceDetector.isRecording()) {
            status = "recording";
        } else if (voiceDetector.getState() == VOICE_PROCESSING) {
            status = "processing";
        }
        
        bleManager.sendStatus(status);
        lastStatusUpdate = millis();
    }
}

void updateStatusLED() {
    static uint32_t lastLEDUpdate = 0;
    static bool ledState = false;
    
    uint32_t blinkInterval = 1000; // Default 1 second
    
    switch (connectionManager.getState()) {
        case CONN_DISCONNECTED:
            blinkInterval = 2000; // Slow blink
            break;
        case CONN_ADVERTISING:
            blinkInterval = 500; // Fast blink
            break;
        case CONN_CONNECTED:
            digitalWrite(LED_PIN, HIGH); // Solid on
            return;
        case CONN_RECONNECTING:
            blinkInterval = 200; // Very fast blink
            break;
        case CONN_ERROR:
            digitalWrite(LED_PIN, LOW); // Off
            return;
        default:
            break;
    }
    
    if (millis() - lastLEDUpdate > blinkInterval) {
        ledState = !ledState;
        digitalWrite(LED_PIN, ledState ? HIGH : LOW);
        lastLEDUpdate = millis();
    }
}

// BLE Connection callbacks
void onBLEConnected() {
    Serial.println("BLE Connected");
    hapticController.playConfirmationPattern();
    connectionManager.updateHeartbeat();
}

void onBLEDisconnected() {
    Serial.println("BLE Disconnected");
    hapticController.playErrorPattern();
}

void onBLEReconnecting() {
    Serial.println("BLE Reconnecting...");
    hapticController.playClickPattern();
}