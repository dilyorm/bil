// Test file for BIL Wearable Firmware
// This file contains test functions to validate hardware components
// Uncomment the #define below to enable test mode

// #define ENABLE_FIRMWARE_TESTS

#ifdef ENABLE_FIRMWARE_TESTS

#include <Arduino.h>
#include "config.h"
#include "ble_manager.h"
#include "voice_detector.h"
#include "haptic_controller.h"
#include "gesture_detector.h"
#include "protocol.h"

// Test instances
BLEManager testBLE;
VoiceDetector testVoice;
HapticController testHaptic;
GestureDetector testGesture;

void setup() {
    Serial.begin(115200);
    delay(2000);
    
    Serial.println("=== BIL Wearable Firmware Test Mode ===");
    Serial.println("Running hardware component tests...");
    
    // Test hardware pins
    testHardwarePins();
    
    // Test haptic controller
    testHapticController();
    
    // Test gesture detector
    testGestureDetector();
    
    // Test voice detector
    testVoiceDetector();
    
    // Test BLE manager
    testBLEManager();
    
    // Test protocol functions
    testProtocol();
    
    Serial.println("=== All tests completed ===");
}

void loop() {
    // Interactive test mode
    if (Serial.available()) {
        String command = Serial.readStringUntil('\n');
        command.trim();
        
        if (command == "haptic") {
            testHaptic.test();
        } else if (command == "gesture") {
            testGesture.test();
        } else if (command == "voice") {
            testVoiceDetector();
        } else if (command == "battery") {
            testBattery();
        } else if (command == "help") {
            printHelp();
        } else {
            Serial.println("Unknown command. Type 'help' for available commands.");
        }
    }
    
    delay(100);
}

void testHardwarePins() {
    Serial.println("\n--- Testing Hardware Pins ---");
    
    // Test LED
    pinMode(LED_PIN, OUTPUT);
    Serial.println("Testing LED...");
    for (int i = 0; i < 3; i++) {
        digitalWrite(LED_PIN, HIGH);
        delay(200);
        digitalWrite(LED_PIN, LOW);
        delay(200);
    }
    Serial.println("LED test complete");
    
    // Test button
    pinMode(BUTTON_PIN, INPUT_PULLUP);
    Serial.println("Testing button (press button within 5 seconds)...");
    uint32_t startTime = millis();
    bool buttonPressed = false;
    
    while (millis() - startTime < 5000) {
        if (digitalRead(BUTTON_PIN) == LOW) {
            buttonPressed = true;
            break;
        }
        delay(10);
    }
    
    if (buttonPressed) {
        Serial.println("Button test PASSED");
    } else {
        Serial.println("Button test FAILED (no press detected)");
    }
    
    // Test battery pin
    pinMode(BATTERY_PIN, INPUT);
    int batteryReading = analogRead(BATTERY_PIN);
    float voltage = (batteryReading * 3.3) / 4095.0;
    Serial.printf("Battery voltage: %.2fV (raw: %d)\n", voltage, batteryReading);
}

void testHapticController() {
    Serial.println("\n--- Testing Haptic Controller ---");
    
    if (testHaptic.begin()) {
        Serial.println("Haptic controller initialized successfully");
        testHaptic.test();
    } else {
        Serial.println("Haptic controller initialization FAILED");
    }
}

void testGestureDetector() {
    Serial.println("\n--- Testing Gesture Detector ---");
    
    if (testGesture.begin()) {
        Serial.println("Gesture detector initialized successfully");
        
        // Calibrate first
        Serial.println("Calibrating gesture detector...");
        testGesture.calibrate();
        
        // Run test
        testGesture.test();
    } else {
        Serial.println("Gesture detector initialization FAILED");
    }
}

void testVoiceDetector() {
    Serial.println("\n--- Testing Voice Detector ---");
    
    if (testVoice.begin()) {
        Serial.println("Voice detector initialized successfully");
        
        Serial.println("Testing voice detection for 10 seconds...");
        Serial.println("Try saying 'Hey BIL' or making noise...");
        
        uint32_t startTime = millis();
        while (millis() - startTime < 10000) {
            testVoice.update();
            
            if (testVoice.detectWakeWord()) {
                Serial.println("Wake word detected!");
                if (testHaptic.isReady()) {
                    testHaptic.playWakeWordPattern();
                }
            }
            
            delay(50);
        }
        
        Serial.println("Voice detection test complete");
    } else {
        Serial.println("Voice detector initialization FAILED");
    }
}

void testBLEManager() {
    Serial.println("\n--- Testing BLE Manager ---");
    
    if (testBLE.begin()) {
        Serial.println("BLE manager initialized successfully");
        Serial.println("Device should be advertising as 'BIL-Wearable'");
        Serial.println("Check with BLE scanner app on your phone");
        
        // Test for 10 seconds
        uint32_t startTime = millis();
        while (millis() - startTime < 10000) {
            testBLE.update();
            
            if (testBLE.isConnected()) {
                Serial.println("BLE connection detected!");
                
                // Test sending data
                testBLE.sendCommand("test_command");
                testBLE.sendStatus("test_status");
                
                delay(1000);
                break;
            }
            
            delay(100);
        }
        
        Serial.println("BLE test complete");
    } else {
        Serial.println("BLE manager initialization FAILED");
    }
}

void testProtocol() {
    Serial.println("\n--- Testing Protocol Functions ---");
    
    // Test message creation
    String commandMsg = Protocol::createCommandMessage("test_command", "test_data");
    Serial.println("Command message: " + commandMsg);
    
    String statusMsg = Protocol::createStatusMessage(STATUS_READY, "test_status");
    Serial.println("Status message: " + statusMsg);
    
    String errorMsg = Protocol::createErrorMessage(ERROR_NONE, "test_error");
    Serial.println("Error message: " + errorMsg);
    
    String heartbeatMsg = Protocol::createHeartbeatMessage();
    Serial.println("Heartbeat message: " + heartbeatMsg);
    
    // Test message parsing
    MessageType msgType;
    String payload;
    
    if (Protocol::parseMessage(commandMsg, msgType, payload)) {
        Serial.printf("Parsed message type: %d\n", msgType);
        Serial.println("Payload: " + payload);
    } else {
        Serial.println("Message parsing FAILED");
    }
    
    Serial.println("Protocol test complete");
}

void testBattery() {
    Serial.println("\n--- Battery Test ---");
    
    float voltage = Protocol::getBatteryVoltage();
    Serial.printf("Battery voltage: %.2fV\n", voltage);
    
    if (voltage < LOW_BATTERY_THRESHOLD) {
        Serial.println("LOW BATTERY WARNING!");
        if (testHaptic.isReady()) {
            testHaptic.playLowBatteryPattern();
        }
    } else {
        Serial.println("Battery level OK");
    }
}

void printHelp() {
    Serial.println("\n--- Available Test Commands ---");
    Serial.println("haptic  - Test haptic feedback patterns");
    Serial.println("gesture - Test gesture detection");
    Serial.println("voice   - Test voice detection");
    Serial.println("battery - Check battery level");
    Serial.println("help    - Show this help message");
    Serial.println();
}

#endif // ENABLE_FIRMWARE_TESTS