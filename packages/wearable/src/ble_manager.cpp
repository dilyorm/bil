#include "ble_manager.h"
#include "protocol.h"

BLEManager::BLEManager() {
    deviceConnected = false;
    oldDeviceConnected = false;
    lastHeartbeat = 0;
    server = nullptr;
    service = nullptr;
    audioCharacteristic = nullptr;
    commandCharacteristic = nullptr;
    statusCharacteristic = nullptr;
    advertising = nullptr;
}

bool BLEManager::begin() {
    Serial.println("Initializing BLE...");
    
    // Initialize BLE Device
    BLEDevice::init(DEVICE_NAME);
    
    // Create BLE Server
    server = BLEDevice::createServer();
    server->setCallbacks(this);
    
    // Setup service and characteristics
    setupService();
    setupCharacteristics();
    setupAdvertising();
    
    // Start advertising
    startAdvertising();
    
    Serial.println("BLE initialized successfully");
    return true;
}

void BLEManager::setupService() {
    service = server->createService(BLE_SERVICE_UUID);
}

void BLEManager::setupCharacteristics() {
    // Audio characteristic for sending voice data
    audioCharacteristic = service->createCharacteristic(
        BLE_AUDIO_CHARACTERISTIC_UUID,
        BLECharacteristic::PROPERTY_NOTIFY
    );
    audioCharacteristic->addDescriptor(new BLE2902());
    
    // Command characteristic for sending commands to mobile app
    commandCharacteristic = service->createCharacteristic(
        BLE_COMMAND_CHARACTERISTIC_UUID,
        BLECharacteristic::PROPERTY_NOTIFY
    );
    commandCharacteristic->addDescriptor(new BLE2902());
    commandCharacteristic->setCallbacks(this);
    
    // Status characteristic for receiving commands from mobile app
    statusCharacteristic = service->createCharacteristic(
        BLE_STATUS_CHARACTERISTIC_UUID,
        BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_READ
    );
    statusCharacteristic->setCallbacks(this);
    
    // Start the service
    service->start();
}

void BLEManager::setupAdvertising() {
    advertising = BLEDevice::getAdvertising();
    advertising->addServiceUUID(BLE_SERVICE_UUID);
    advertising->setScanResponse(true);
    advertising->setMinPreferred(0x06);
    advertising->setMinPreferred(0x12);
}

void BLEManager::startAdvertising() {
    Serial.println("Starting BLE advertising...");
    advertising->start();
}

void BLEManager::stopAdvertising() {
    Serial.println("Stopping BLE advertising...");
    advertising->stop();
}

void BLEManager::update() {
    // Handle connection state changes
    if (!deviceConnected && oldDeviceConnected) {
        delay(500); // Give the bluetooth stack time to get ready
        server->startAdvertising();
        Serial.println("Start advertising after disconnect");
        oldDeviceConnected = deviceConnected;
    }
    
    if (deviceConnected && !oldDeviceConnected) {
        oldDeviceConnected = deviceConnected;
        Serial.println("Device connected");
    }
    
    // Send periodic heartbeat if connected
    if (deviceConnected && (millis() - lastHeartbeat > 30000)) {
        sendHeartbeat();
        lastHeartbeat = millis();
    }
}

bool BLEManager::isConnected() {
    return deviceConnected;
}

void BLEManager::disconnect() {
    if (deviceConnected) {
        server->disconnect(server->getConnId());
    }
}

bool BLEManager::sendAudioData(uint8_t* data, size_t length) {
    if (!deviceConnected || !audioCharacteristic) {
        return false;
    }
    
    // Split large audio data into smaller chunks if needed
    const size_t maxChunkSize = 512;
    size_t offset = 0;
    
    while (offset < length) {
        size_t chunkSize = min(maxChunkSize, length - offset);
        audioCharacteristic->setValue(data + offset, chunkSize);
        audioCharacteristic->notify();
        offset += chunkSize;
        delay(10); // Small delay to prevent overwhelming the connection
    }
    
    return true;
}

bool BLEManager::sendCommand(const String& command) {
    if (!deviceConnected || !commandCharacteristic) {
        return false;
    }
    
    String message = Protocol::createCommandMessage(command);
    
    commandCharacteristic->setValue(message.c_str());
    commandCharacteristic->notify();
    
    Serial.printf("Sent command: %s\n", message.c_str());
    return true;
}

bool BLEManager::sendStatus(const String& status) {
    if (!deviceConnected || !statusCharacteristic) {
        return false;
    }
    
    StatusType statusType = STATUS_READY; // Default
    if (status == "recording") statusType = STATUS_RECORDING;
    else if (status == "processing") statusType = STATUS_PROCESSING;
    else if (status == "low_battery") statusType = STATUS_LOW_BATTERY;
    else if (status == "error") statusType = STATUS_ERROR;
    else if (status == "disconnected") statusType = STATUS_DISCONNECTED;
    
    String message = Protocol::createStatusMessage(statusType);
    
    statusCharacteristic->setValue(message.c_str());
    statusCharacteristic->notify();
    
    return true;
}

void BLEManager::sendHeartbeat() {
    if (!deviceConnected || !statusCharacteristic) {
        return;
    }
    
    String message = Protocol::createHeartbeatMessage();
    statusCharacteristic->setValue(message.c_str());
    statusCharacteristic->notify();
}

// BLE Server Callbacks
void BLEManager::onConnect(BLEServer* server) {
    deviceConnected = true;
    Serial.println("BLE device connected");
    stopAdvertising();
}

void BLEManager::onDisconnect(BLEServer* server) {
    deviceConnected = false;
    Serial.println("BLE device disconnected");
}

// BLE Characteristic Callbacks
void BLEManager::onWrite(BLECharacteristic* characteristic) {
    String value = characteristic->getValue().c_str();
    
    if (value.length() > 0) {
        Serial.printf("Received: %s\n", value.c_str());
        
        // Parse message using protocol
        MessageType msgType;
        String payload;
        
        if (Protocol::parseMessage(value, msgType, payload)) {
            handleIncomingMessage(msgType, payload);
        } else {
            Serial.println("Failed to parse incoming message");
            String errorMsg = Protocol::createErrorMessage(ERROR_INVALID_COMMAND, "Invalid message format");
            statusCharacteristic->setValue(errorMsg.c_str());
            statusCharacteristic->notify();
        }
    }
}

void BLEManager::handleIncomingMessage(MessageType msgType, const String& payload) {
    switch (msgType) {
        case MSG_COMMAND: {
            CommandType command;
            String data;
            
            if (Protocol::parseCommand(payload, command, data)) {
                handleCommand(command, data);
            }
            break;
        }
        case MSG_STATUS: {
            StatusType status;
            String data;
            
            if (Protocol::parseStatus(payload, status, data)) {
                handleStatusUpdate(status, data);
            }
            break;
        }
        case MSG_HEARTBEAT:
            // Respond to heartbeat
            sendHeartbeat();
            break;
        default:
            Serial.printf("Unhandled message type: %d\n", msgType);
            break;
    }
}

void BLEManager::handleCommand(CommandType command, const String& data) {
    switch (command) {
        case CMD_START_RECORDING:
            Serial.println("Mobile app requested start recording");
            // This would trigger voice detector to start recording
            break;
        case CMD_STOP_RECORDING:
            Serial.println("Mobile app requested stop recording");
            // This would trigger voice detector to stop recording
            break;
        case CMD_HAPTIC_FEEDBACK:
            Serial.printf("Mobile app requested haptic pattern: %s\n", data.c_str());
            // This would trigger haptic controller
            break;
        case CMD_SET_SENSITIVITY:
            Serial.printf("Mobile app requested sensitivity change: %s\n", data.c_str());
            // This would update voice detection sensitivity
            break;
        case CMD_CALIBRATE:
            Serial.println("Mobile app requested calibration");
            // This would trigger gesture detector calibration
            break;
        case CMD_SLEEP:
            Serial.println("Mobile app requested sleep mode");
            // This would put device into low power mode
            break;
        case CMD_WAKE:
            Serial.println("Mobile app requested wake up");
            // This would wake device from low power mode
            break;
        case CMD_RESET:
            Serial.println("Mobile app requested reset");
            ESP.restart();
            break;
        default:
            Serial.printf("Unknown command: %d\n", command);
            break;
    }
}

void BLEManager::handleStatusUpdate(StatusType status, const String& data) {
    Serial.printf("Received status update: %d, data: %s\n", status, data.c_str());
    // Handle status updates from mobile app if needed
}