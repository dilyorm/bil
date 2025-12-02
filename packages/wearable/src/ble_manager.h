#ifndef BLE_MANAGER_H
#define BLE_MANAGER_H

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ArduinoJson.h>
#include "config.h"
#include "protocol.h"

class BLEManager : public BLEServerCallbacks, public BLECharacteristicCallbacks {
private:
    BLEServer* server;
    BLEService* service;
    BLECharacteristic* audioCharacteristic;
    BLECharacteristic* commandCharacteristic;
    BLECharacteristic* statusCharacteristic;
    BLEAdvertising* advertising;
    
    bool deviceConnected;
    bool oldDeviceConnected;
    uint32_t lastHeartbeat;
    
    void setupService();
    void setupCharacteristics();
    void setupAdvertising();
    void sendHeartbeat();
    void handleIncomingMessage(MessageType msgType, const String& payload);
    void handleCommand(CommandType command, const String& data);
    void handleStatusUpdate(StatusType status, const String& data);

public:
    BLEManager();
    bool begin();
    void update();
    bool isConnected();
    void startAdvertising();
    void stopAdvertising();
    void disconnect();
    
    // Data transmission methods
    bool sendAudioData(uint8_t* data, size_t length);
    bool sendCommand(const String& command);
    bool sendStatus(const String& status);
    
    // BLE Callbacks
    void onConnect(BLEServer* server) override;
    void onDisconnect(BLEServer* server) override;
    void onWrite(BLECharacteristic* characteristic) override;
};

#endif // BLE_MANAGER_H