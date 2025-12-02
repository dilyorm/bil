#include "protocol.h"
#include "config.h"

String Protocol::createCommandMessage(const String& command, const String& data) {
    DynamicJsonDocument doc(512);
    
    doc["type"] = "command";
    doc["id"] = generateMessageId();
    doc["timestamp"] = getTimestamp();
    doc["command"] = command;
    doc["battery"] = getBatteryVoltage();
    
    if (data.length() > 0) {
        doc["data"] = data;
    }
    
    String result;
    serializeJson(doc, result);
    return result;
}

String Protocol::createStatusMessage(StatusType status, const String& data) {
    DynamicJsonDocument doc(512);
    
    doc["type"] = "status";
    doc["id"] = generateMessageId();
    doc["timestamp"] = getTimestamp();
    doc["battery"] = getBatteryVoltage();
    
    // Convert status enum to string
    switch (status) {
        case STATUS_READY:
            doc["status"] = "ready";
            break;
        case STATUS_RECORDING:
            doc["status"] = "recording";
            break;
        case STATUS_PROCESSING:
            doc["status"] = "processing";
            break;
        case STATUS_LOW_BATTERY:
            doc["status"] = "low_battery";
            break;
        case STATUS_ERROR:
            doc["status"] = "error";
            break;
        case STATUS_DISCONNECTED:
            doc["status"] = "disconnected";
            break;
        default:
            doc["status"] = "unknown";
            break;
    }
    
    if (data.length() > 0) {
        doc["data"] = data;
    }
    
    String result;
    serializeJson(doc, result);
    return result;
}

String Protocol::createErrorMessage(ErrorCode error, const String& description) {
    DynamicJsonDocument doc(512);
    
    doc["type"] = "error";
    doc["id"] = generateMessageId();
    doc["timestamp"] = getTimestamp();
    doc["error_code"] = error;
    doc["battery"] = getBatteryVoltage();
    
    if (description.length() > 0) {
        doc["description"] = description;
    } else {
        // Default error descriptions
        switch (error) {
            case ERROR_AUDIO_INIT:
                doc["description"] = "Failed to initialize audio system";
                break;
            case ERROR_BLE_INIT:
                doc["description"] = "Failed to initialize Bluetooth";
                break;
            case ERROR_HAPTIC_INIT:
                doc["description"] = "Failed to initialize haptic feedback";
                break;
            case ERROR_ACCEL_INIT:
                doc["description"] = "Failed to initialize accelerometer";
                break;
            case ERROR_LOW_MEMORY:
                doc["description"] = "Insufficient memory available";
                break;
            case ERROR_INVALID_COMMAND:
                doc["description"] = "Invalid command received";
                break;
            case ERROR_TIMEOUT:
                doc["description"] = "Operation timed out";
                break;
            default:
                doc["description"] = "Unknown error";
                break;
        }
    }
    
    String result;
    serializeJson(doc, result);
    return result;
}

String Protocol::createHeartbeatMessage() {
    DynamicJsonDocument doc(256);
    
    doc["type"] = "heartbeat";
    doc["id"] = generateMessageId();
    doc["timestamp"] = getTimestamp();
    doc["battery"] = getBatteryVoltage();
    doc["uptime"] = millis();
    doc["free_heap"] = ESP.getFreeHeap();
    
    String result;
    serializeJson(doc, result);
    return result;
}

String Protocol::createAckMessage(const String& messageId) {
    DynamicJsonDocument doc(256);
    
    doc["type"] = "ack";
    doc["id"] = generateMessageId();
    doc["timestamp"] = getTimestamp();
    doc["ack_id"] = messageId;
    
    String result;
    serializeJson(doc, result);
    return result;
}

bool Protocol::parseMessage(const String& json, MessageType& type, String& payload) {
    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, json);
    
    if (error) {
        Serial.printf("JSON parse error: %s\n", error.c_str());
        return false;
    }
    
    String typeStr = doc["type"];
    
    if (typeStr == "command") {
        type = MSG_COMMAND;
    } else if (typeStr == "status") {
        type = MSG_STATUS;
    } else if (typeStr == "audio_data") {
        type = MSG_AUDIO_DATA;
    } else if (typeStr == "heartbeat") {
        type = MSG_HEARTBEAT;
    } else if (typeStr == "error") {
        type = MSG_ERROR;
    } else if (typeStr == "ack") {
        type = MSG_ACK;
    } else {
        return false;
    }
    
    // Extract the payload (everything except type)
    doc.remove("type");
    serializeJson(doc, payload);
    
    return true;
}

bool Protocol::parseCommand(const String& payload, CommandType& command, String& data) {
    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, payload);
    
    if (error) {
        return false;
    }
    
    String commandStr = doc["command"];
    
    if (commandStr == "start_recording") {
        command = CMD_START_RECORDING;
    } else if (commandStr == "stop_recording") {
        command = CMD_STOP_RECORDING;
    } else if (commandStr == "haptic_feedback") {
        command = CMD_HAPTIC_FEEDBACK;
    } else if (commandStr == "set_sensitivity") {
        command = CMD_SET_SENSITIVITY;
    } else if (commandStr == "calibrate") {
        command = CMD_CALIBRATE;
    } else if (commandStr == "sleep") {
        command = CMD_SLEEP;
    } else if (commandStr == "wake") {
        command = CMD_WAKE;
    } else if (commandStr == "reset") {
        command = CMD_RESET;
    } else {
        return false;
    }
    
    if (doc.containsKey("data")) {
        data = doc["data"].as<String>();
    } else {
        data = "";
    }
    
    return true;
}

bool Protocol::parseStatus(const String& payload, StatusType& status, String& data) {
    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, payload);
    
    if (error) {
        return false;
    }
    
    String statusStr = doc["status"];
    
    if (statusStr == "ready") {
        status = STATUS_READY;
    } else if (statusStr == "recording") {
        status = STATUS_RECORDING;
    } else if (statusStr == "processing") {
        status = STATUS_PROCESSING;
    } else if (statusStr == "low_battery") {
        status = STATUS_LOW_BATTERY;
    } else if (statusStr == "error") {
        status = STATUS_ERROR;
    } else if (statusStr == "disconnected") {
        status = STATUS_DISCONNECTED;
    } else {
        return false;
    }
    
    if (doc.containsKey("data")) {
        data = doc["data"].as<String>();
    } else {
        data = "";
    }
    
    return true;
}

String Protocol::encodeAudioData(uint8_t* data, size_t length) {
    // Simple base64-like encoding for audio data
    String encoded = "";
    
    for (size_t i = 0; i < length; i++) {
        if (i > 0 && i % 64 == 0) {
            encoded += "\n"; // Line breaks for readability
        }
        encoded += String(data[i], HEX);
        if (data[i] < 16) {
            encoded = encoded.substring(0, encoded.length() - 1) + "0" + encoded.substring(encoded.length() - 1);
        }
    }
    
    return encoded;
}

bool Protocol::decodeAudioData(const String& encoded, uint8_t* buffer, size_t& length) {
    String cleaned = encoded;
    cleaned.replace("\n", "");
    cleaned.replace(" ", "");
    
    if (cleaned.length() % 2 != 0) {
        return false; // Invalid hex string
    }
    
    length = cleaned.length() / 2;
    
    for (size_t i = 0; i < length; i++) {
        String byteStr = cleaned.substring(i * 2, i * 2 + 2);
        buffer[i] = (uint8_t)strtol(byteStr.c_str(), NULL, 16);
    }
    
    return true;
}

String Protocol::generateMessageId() {
    static uint32_t counter = 0;
    counter++;
    
    return String(ESP.getChipId(), HEX) + "_" + String(counter);
}

uint32_t Protocol::getTimestamp() {
    return millis();
}

float Protocol::getBatteryVoltage() {
    int rawValue = analogRead(BATTERY_PIN);
    return (rawValue * 3.3) / 4095.0;
}

String Protocol::getDeviceInfo() {
    DynamicJsonDocument doc(256);
    
    doc["device_name"] = DEVICE_NAME;
    doc["version"] = DEVICE_VERSION;
    doc["manufacturer"] = MANUFACTURER_NAME;
    doc["chip_id"] = String(ESP.getChipId(), HEX);
    doc["flash_size"] = ESP.getFlashChipSize();
    doc["free_heap"] = ESP.getFreeHeap();
    
    String result;
    serializeJson(doc, result);
    return result;
}