#ifndef CONNECTION_MANAGER_H
#define CONNECTION_MANAGER_H

#include <Arduino.h>
#include "config.h"

enum ConnectionState {
    CONN_DISCONNECTED,
    CONN_ADVERTISING,
    CONN_CONNECTING,
    CONN_CONNECTED,
    CONN_RECONNECTING,
    CONN_ERROR
};

class ConnectionManager {
private:
    ConnectionState currentState;
    uint32_t lastConnectionAttempt;
    uint32_t reconnectInterval;
    uint32_t maxReconnectInterval;
    uint32_t connectionTimeout;
    uint32_t lastHeartbeat;
    uint32_t heartbeatInterval;
    uint32_t heartbeatTimeout;
    int reconnectAttempts;
    int maxReconnectAttempts;
    
    bool shouldReconnect();
    void incrementReconnectInterval();
    void resetReconnectInterval();

public:
    ConnectionManager();
    
    void begin();
    void update();
    
    // State management
    ConnectionState getState();
    void setState(ConnectionState state);
    bool isConnected();
    bool isAdvertising();
    
    // Connection control
    void startAdvertising();
    void stopAdvertising();
    void disconnect();
    void reconnect();
    
    // Heartbeat management
    void updateHeartbeat();
    bool isHeartbeatTimeout();
    
    // Configuration
    void setReconnectInterval(uint32_t intervalMs);
    void setMaxReconnectAttempts(int attempts);
    void setHeartbeatInterval(uint32_t intervalMs);
    void setConnectionTimeout(uint32_t timeoutMs);
    
    // Statistics
    int getReconnectAttempts();
    uint32_t getLastConnectionTime();
    uint32_t getConnectionDuration();
    
    // Event callbacks (to be implemented by user)
    void (*onConnected)();
    void (*onDisconnected)();
    void (*onReconnecting)();
    void (*onConnectionFailed)();
};

#endif // CONNECTION_MANAGER_H