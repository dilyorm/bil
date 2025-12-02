#include "connection_manager.h"

ConnectionManager::ConnectionManager() {
    currentState = CONN_DISCONNECTED;
    lastConnectionAttempt = 0;
    reconnectInterval = 1000; // Start with 1 second
    maxReconnectInterval = 30000; // Max 30 seconds
    connectionTimeout = 10000; // 10 second timeout
    lastHeartbeat = 0;
    heartbeatInterval = 30000; // 30 seconds
    heartbeatTimeout = 60000; // 60 seconds
    reconnectAttempts = 0;
    maxReconnectAttempts = 10;
    
    // Initialize callbacks to null
    onConnected = nullptr;
    onDisconnected = nullptr;
    onReconnecting = nullptr;
    onConnectionFailed = nullptr;
}

void ConnectionManager::begin() {
    currentState = CONN_DISCONNECTED;
    reconnectAttempts = 0;
    resetReconnectInterval();
    
    Serial.println("Connection Manager initialized");
}

void ConnectionManager::update() {
    uint32_t currentTime = millis();
    
    switch (currentState) {
        case CONN_DISCONNECTED:
            if (shouldReconnect()) {
                setState(CONN_RECONNECTING);
            }
            break;
            
        case CONN_ADVERTISING:
            // Check for advertising timeout
            if (currentTime - lastConnectionAttempt > connectionTimeout) {
                Serial.println("Advertising timeout, retrying...");
                setState(CONN_RECONNECTING);
            }
            break;
            
        case CONN_CONNECTING:
            // Check for connection timeout
            if (currentTime - lastConnectionAttempt > connectionTimeout) {
                Serial.println("Connection timeout");
                setState(CONN_RECONNECTING);
            }
            break;
            
        case CONN_CONNECTED:
            // Check for heartbeat timeout
            if (isHeartbeatTimeout()) {
                Serial.println("Heartbeat timeout, connection lost");
                setState(CONN_DISCONNECTED);
            }
            break;
            
        case CONN_RECONNECTING:
            if (currentTime - lastConnectionAttempt > reconnectInterval) {
                if (reconnectAttempts < maxReconnectAttempts) {
                    Serial.printf("Reconnection attempt %d/%d\n", reconnectAttempts + 1, maxReconnectAttempts);
                    startAdvertising();
                    reconnectAttempts++;
                    incrementReconnectInterval();
                    lastConnectionAttempt = currentTime;
                    setState(CONN_ADVERTISING);
                } else {
                    Serial.println("Max reconnection attempts reached");
                    setState(CONN_ERROR);
                    if (onConnectionFailed) {
                        onConnectionFailed();
                    }
                }
            }
            break;
            
        case CONN_ERROR:
            // Stay in error state until manually reset
            break;
    }
}

ConnectionState ConnectionManager::getState() {
    return currentState;
}

void ConnectionManager::setState(ConnectionState state) {
    if (currentState != state) {
        ConnectionState previousState = currentState;
        currentState = state;
        
        Serial.printf("Connection state changed: %d -> %d\n", previousState, state);
        
        // Handle state transitions
        switch (state) {
            case CONN_CONNECTED:
                resetReconnectInterval();
                reconnectAttempts = 0;
                updateHeartbeat();
                if (onConnected) {
                    onConnected();
                }
                break;
                
            case CONN_DISCONNECTED:
                if (previousState == CONN_CONNECTED && onDisconnected) {
                    onDisconnected();
                }
                break;
                
            case CONN_RECONNECTING:
                if (onReconnecting) {
                    onReconnecting();
                }
                break;
                
            default:
                break;
        }
    }
}

bool ConnectionManager::isConnected() {
    return currentState == CONN_CONNECTED;
}

bool ConnectionManager::isAdvertising() {
    return currentState == CONN_ADVERTISING;
}

void ConnectionManager::startAdvertising() {
    lastConnectionAttempt = millis();
    // This would be called by BLEManager
    Serial.println("Starting advertising...");
}

void ConnectionManager::stopAdvertising() {
    // This would be called by BLEManager
    Serial.println("Stopping advertising...");
}

void ConnectionManager::disconnect() {
    setState(CONN_DISCONNECTED);
}

void ConnectionManager::reconnect() {
    reconnectAttempts = 0;
    resetReconnectInterval();
    setState(CONN_RECONNECTING);
}

void ConnectionManager::updateHeartbeat() {
    lastHeartbeat = millis();
}

bool ConnectionManager::isHeartbeatTimeout() {
    return (millis() - lastHeartbeat) > heartbeatTimeout;
}

bool ConnectionManager::shouldReconnect() {
    return (millis() - lastConnectionAttempt) > reconnectInterval;
}

void ConnectionManager::incrementReconnectInterval() {
    reconnectInterval = min(reconnectInterval * 2, maxReconnectInterval);
}

void ConnectionManager::resetReconnectInterval() {
    reconnectInterval = 1000; // Reset to 1 second
}

void ConnectionManager::setReconnectInterval(uint32_t intervalMs) {
    reconnectInterval = intervalMs;
}

void ConnectionManager::setMaxReconnectAttempts(int attempts) {
    maxReconnectAttempts = attempts;
}

void ConnectionManager::setHeartbeatInterval(uint32_t intervalMs) {
    heartbeatInterval = intervalMs;
}

void ConnectionManager::setConnectionTimeout(uint32_t timeoutMs) {
    connectionTimeout = timeoutMs;
}

int ConnectionManager::getReconnectAttempts() {
    return reconnectAttempts;
}

uint32_t ConnectionManager::getLastConnectionTime() {
    return lastConnectionAttempt;
}

uint32_t ConnectionManager::getConnectionDuration() {
    if (currentState == CONN_CONNECTED) {
        return millis() - lastConnectionAttempt;
    }
    return 0;
}