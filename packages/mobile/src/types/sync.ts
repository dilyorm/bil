export interface SyncMessage {
  type: 'conversation_update' | 'device_status' | 'user_preference' | 'typing_indicator';
  userId: string;
  deviceId: string;
  timestamp: number;
  payload: any;
}

export interface ConversationUpdatePayload {
  messageId: string;
  message: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    deviceId?: string;
    metadata?: {
      inputMethod: 'voice' | 'text' | 'gesture';
      processingTime?: number;
      confidence?: number;
    };
  };
  conversationId?: string;
}

export interface DeviceStatusPayload {
  status: 'online' | 'offline' | 'away';
  capabilities: string[];
  lastSeen: Date;
}

export interface TypingIndicatorPayload {
  isTyping: boolean;
  deviceName?: string;
}

export interface SyncState {
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  lastSyncTime: Date | null;
  connectedDevices: string[];
  retryCount: number;
  maxRetries: number;
}

export interface SyncConfig {
  serverUrl: string;
  reconnectionDelay: number;
  reconnectionDelayMax: number;
  maxReconnectionAttempts: number;
  timeout: number;
}

export interface SyncCallbacks {
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onReconnect?: (attemptNumber: number) => void;
  onReconnectError?: (error: Error) => void;
  onMessageReceived?: (message: SyncMessage) => void;
  onDeviceStatusUpdate?: (deviceId: string, status: DeviceStatusPayload) => void;
  onTypingIndicator?: (deviceId: string, payload: TypingIndicatorPayload) => void;
}