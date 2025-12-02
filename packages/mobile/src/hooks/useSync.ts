import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { syncService } from '../services/sync';
import { 
  SyncState, 
  SyncMessage, 
  ConversationUpdatePayload, 
  DeviceStatusPayload, 
  TypingIndicatorPayload 
} from '../types/sync';
import { Message } from '../types/chat';
import { useAuth } from './useAuth';

interface UseSyncOptions {
  onMessageReceived?: (message: Message) => void;
  onDeviceStatusUpdate?: (deviceId: string, status: DeviceStatusPayload) => void;
  onTypingIndicator?: (deviceId: string, isTyping: boolean, deviceName?: string) => void;
  autoConnect?: boolean;
}

export const useSync = (options: UseSyncOptions = {}) => {
  const { accessToken, user } = useAuth();
  const [syncState, setSyncState] = useState<SyncState>(syncService.getState());
  const [connectedDevices, setConnectedDevices] = useState<string[]>([]);
  const [typingDevices, setTypingDevices] = useState<Set<string>>(new Set());
  const optionsRef = useRef(options);
  const deviceIdRef = useRef<string | null>(null);

  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Generate or retrieve device ID
  useEffect(() => {
    const generateDeviceId = async () => {
      try {
        const { StorageService } = require('../services/storage');
        let deviceId = await StorageService.getItem('deviceId');
        if (!deviceId) {
          deviceId = `mobile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await StorageService.setItem('deviceId', deviceId);
        }
        deviceIdRef.current = deviceId;
      } catch (error) {
        console.error('Failed to generate device ID:', error);
        deviceIdRef.current = `mobile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
    };

    generateDeviceId();
  }, []);

  // Setup sync service callbacks
  useEffect(() => {
    const callbacks = {
      onConnect: () => {
        console.log('Sync connected');
        setSyncState(syncService.getState());
      },
      onDisconnect: (reason: string) => {
        console.log('Sync disconnected:', reason);
        setSyncState(syncService.getState());
        setTypingDevices(new Set());
      },
      onReconnect: (attemptNumber: number) => {
        console.log('Sync reconnecting, attempt:', attemptNumber);
        setSyncState(syncService.getState());
      },
      onReconnectError: (error: Error) => {
        console.error('Sync reconnection error:', error);
        setSyncState(syncService.getState());
      },
      onMessageReceived: (message: SyncMessage) => {
        setSyncState(syncService.getState());
        
        if (message.type === 'conversation_update') {
          const payload = message.payload as ConversationUpdatePayload;
          if (payload.message && message.deviceId !== deviceIdRef.current) {
            // Only process messages from other devices
            optionsRef.current.onMessageReceived?.(payload.message);
          }
        }
      },
      onDeviceStatusUpdate: (deviceId: string, status: DeviceStatusPayload) => {
        optionsRef.current.onDeviceStatusUpdate?.(deviceId, status);
        
        // Update connected devices list
        setConnectedDevices(prev => {
          const updated = [...prev];
          const index = updated.indexOf(deviceId);
          
          if (status.status === 'online' && index === -1) {
            updated.push(deviceId);
          } else if (status.status === 'offline' && index !== -1) {
            updated.splice(index, 1);
          }
          
          return updated;
        });
      },
      onTypingIndicator: (deviceId: string, payload: TypingIndicatorPayload) => {
        if (deviceId !== deviceIdRef.current) {
          setTypingDevices(prev => {
            const updated = new Set(prev);
            if (payload.isTyping) {
              updated.add(deviceId);
            } else {
              updated.delete(deviceId);
            }
            return updated;
          });
          
          optionsRef.current.onTypingIndicator?.(
            deviceId, 
            payload.isTyping, 
            payload.deviceName
          );
        }
      },
    };

    syncService.setCallbacks(callbacks);

    return () => {
      // Cleanup is handled by the service
    };
  }, []);

  // Auto-connect when auth is available
  useEffect(() => {
    const connectIfReady = async () => {
      if (
        accessToken && 
        user?.id && 
        deviceIdRef.current && 
        options.autoConnect !== false &&
        !syncState.isConnected &&
        !syncState.isConnecting
      ) {
        try {
          syncService.setAuth(accessToken, user.id, deviceIdRef.current);
          await syncService.connect();
        } catch (error) {
          console.error('Failed to connect to sync service:', error);
        }
      }
    };

    connectIfReady();
  }, [accessToken, user?.id, options.autoConnect, syncState.isConnected, syncState.isConnecting]);

  // Update sync state periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setSyncState(syncService.getState());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const connect = useCallback(async () => {
    if (!accessToken || !user?.id || !deviceIdRef.current) {
      throw new Error('Authentication required');
    }

    syncService.setAuth(accessToken, user.id, deviceIdRef.current);
    await syncService.connect();
  }, [accessToken, user?.id]);

  const disconnect = useCallback(() => {
    syncService.disconnect();
  }, []);

  const sendMessage = useCallback(async (message: Omit<SyncMessage, 'userId' | 'deviceId' | 'timestamp'>) => {
    await syncService.sendMessage(message);
  }, []);

  const broadcastMessage = useCallback(async (message: Message) => {
    const payload: ConversationUpdatePayload = {
      messageId: message.id,
      message,
    };
    
    await syncService.broadcastConversationUpdate(payload);
  }, []);

  const sendTypingIndicator = useCallback(async (isTyping: boolean) => {
    await syncService.sendTypingIndicator(isTyping);
  }, []);

  const updateDeviceStatus = useCallback(async (status: 'online' | 'offline' | 'away') => {
    const payload: DeviceStatusPayload = {
      status,
      capabilities: ['voice_input', 'voice_output', 'text_input'],
      lastSeen: new Date(),
    };
    
    await syncService.updateDeviceStatus(payload);
  }, []);

  return {
    // State
    syncState,
    connectedDevices,
    typingDevices: Array.from(typingDevices),
    isConnected: syncState.isConnected,
    isConnecting: syncState.isConnecting,
    connectionError: syncState.connectionError,
    
    // Actions
    connect,
    disconnect,
    sendMessage,
    broadcastMessage,
    sendTypingIndicator,
    updateDeviceStatus,
    
    // Computed
    hasTypingDevices: typingDevices.size > 0,
    deviceCount: connectedDevices.length,
  };
};