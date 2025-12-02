#ifndef PROTOCOL_H
#define PROTOCOL_H

#include <Arduino.h>
#include <ArduinoJson.h>

// Message types for BLE communication
enum MessageType {
    MSG_COMMAND,
    MSG_STATUS,
    MSG_AUDIO_DATA,
    MSG_HEARTBEAT,
    MSG_ERROR,
    MSG_ACK
};

// Command types from mobile app
enum CommandType {
    CMD_START_RECORDING,
    CMD_STOP_RECORDING,
    CMD_HAPTIC_FEEDBACK,
    CMD_SET_SENSITIVITY,
    CMD_CALIBRATE,
    CMD_SLEEP,
    CMD_WAKE,
    CMD_RESET
};

// Status types to mobile app
enum StatusType {
    STATUS_READY,
    STATUS_RECORDING,
    STATUS_PROCESSING,
    STATUS_LOW_BATTERY,
    STATUS_ERROR,
    STATUS_DISCONNECTED
};

// Error codes
enum ErrorCode {
    ERROR_NONE = 0,
    ERROR_AUDIO_INIT = 1,
    ERROR_BLE_INIT = 2,
    ERROR_HAPTIC_INIT = 3,
    ERROR_ACCEL_INIT = 4,
    ERROR_LOW_MEMORY = 5,
    ERROR_INVALID_COMMAND = 6,
    ERROR_TIMEOUT = 7
};

class Protocol {
public:
    // Message creation
    static String createCommandMessage(const String& command, const String& data = "");
    static String createStatusMessage(StatusType status, const String& data = "");
    static String createErrorMessage(ErrorCode error, const String& description = "");
    static String createHeartbeatMessage();
    static String createAckMessage(const String& messageId);
    
    // Message parsing
    static bool parseMessage(const String& json, MessageType& type, String& payload);
    static bool parseCommand(const String& payload, CommandType& command, String& data);
    static bool parseStatus(const String& payload, StatusType& status, String& data);
    
    // Audio data encoding
    static String encodeAudioData(uint8_t* data, size_t length);
    static bool decodeAudioData(const String& encoded, uint8_t* buffer, size_t& length);
    
    // Utility functions
    static String generateMessageId();
    static uint32_t getTimestamp();
    static float getBatteryVoltage();
    static String getDeviceInfo();
};

#endif // PROTOCOL_H