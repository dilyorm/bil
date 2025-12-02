import { io, Socket } from 'socket.io-client';

interface SyncMessage {
  type: 'conversation_update' | 'device_status' | 'user_preference' | 'typing_indicator';
  userId: string;
  deviceId: string;
  timestamp: number;
  payload: any;
}

interface DeviceStatus {
  deviceId: string;
  isActive: boolean;
  lastSeen: Date;
  capabilities: any;
}

interface ConversationUpdate {
  messageId: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  deviceId: string;
}

interface SyncEventHandlers {
  onConversationUpdate?: (update: ConversationUpdate) => void;
  onDeviceStatusChange?: (status: DeviceStatus) => void;
  onUserPreferenceChange?: (preferences: any) => void;
  onTypingIndicator?: (data: { deviceId: string; isTyping: boolean }) => void;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: Error) => void;
}

class SyncService {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private deviceId: string;
  private userId: string | null = null;
  private eventHandlers: SyncEventHandlers = {};

  constructor() {
    this.deviceId = this.getOrCreateDeviceId();
  }

  // Initialize connection
  connect(userId: string, token: string): void {
    this.userId = userId;
    
    const socketUrl =
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SOCKET_URL) ||
      'http://localhost:3000';
    console.log('[SyncService] Socket URL:', socketUrl);
    
    this.socket = io(socketUrl, {
      auth: {
        token,
        userId,
        deviceId: this.deviceId,
        deviceType: 'desktop'
      },
      transports: ['websocket', 'polling'],
      timeout: 20000,
    });

    this.setupEventListeners();
  }

  // Disconnect
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.userId = null;
    this.reconnectAttempts = 0;
  }

  // Set event handlers
  setEventHandlers(handlers: SyncEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  // Send sync message
  sendSyncMessage(message: Omit<SyncMessage, 'userId' | 'deviceId' | 'timestamp'>): void {
    if (!this.socket || !this.isConnected || !this.userId) {
      console.warn('Cannot send sync message: not connected');
      return;
    }

    const syncMessage: SyncMessage = {
      ...message,
      userId: this.userId,
      deviceId: this.deviceId,
      timestamp: Date.now(),
    };

    this.socket.emit('sync', syncMessage);
  }

  // Broadcast conversation update
  broadcastConversationUpdate(update: Omit<ConversationUpdate, 'deviceId'>): void {
    this.sendSyncMessage({
      type: 'conversation_update',
      payload: {
        ...update,
        deviceId: this.deviceId,
      },
    });
  }

  // Broadcast device status
  broadcastDeviceStatus(status: Partial<DeviceStatus>): void {
    this.sendSyncMessage({
      type: 'device_status',
      payload: {
        deviceId: this.deviceId,
        isActive: true,
        lastSeen: new Date(),
        ...status,
      },
    });
  }

  // Broadcast typing indicator
  broadcastTypingIndicator(isTyping: boolean): void {
    this.sendSyncMessage({
      type: 'typing_indicator',
      payload: {
        deviceId: this.deviceId,
        isTyping,
      },
    });
  }

  // Broadcast user preference change
  broadcastUserPreferenceChange(preferences: any): void {
    this.sendSyncMessage({
      type: 'user_preference',
      payload: preferences,
    });
  }

  // Get connection status
  getConnectionStatus(): { connected: boolean; deviceId: string } {
    return {
      connected: this.isConnected,
      deviceId: this.deviceId,
    };
  }

  // Private methods
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('Sync service connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.eventHandlers.onConnectionChange?.(true);
      
      // Send initial device status
      this.broadcastDeviceStatus({
        isActive: true,
        capabilities: {
          hasVoiceInput: true,
          hasVoiceOutput: true,
          hasFileAccess: true,
          hasCalendarAccess: true,
        },
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Sync service disconnected:', reason);
      this.isConnected = false;
      this.eventHandlers.onConnectionChange?.(false);
      
      // Attempt reconnection for certain disconnect reasons
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect automatically
        return;
      }
      
      this.attemptReconnection();
    });

    this.socket.on('connect_error', (error) => {
      console.error('Sync service connection error:', error);
      this.eventHandlers.onError?.(error);
      this.attemptReconnection();
    });

    // Sync message events
    this.socket.on('sync', (message: SyncMessage) => {
      this.handleSyncMessage(message);
    });

    // Specific event handlers
    this.socket.on('conversation_update', (update: ConversationUpdate) => {
      this.eventHandlers.onConversationUpdate?.(update);
    });

    this.socket.on('device_status', (status: DeviceStatus) => {
      this.eventHandlers.onDeviceStatusChange?.(status);
    });

    this.socket.on('user_preference', (preferences: any) => {
      this.eventHandlers.onUserPreferenceChange?.(preferences);
    });

    this.socket.on('typing_indicator', (data: { deviceId: string; isTyping: boolean }) => {
      // Don't handle our own typing indicators
      if (data.deviceId !== this.deviceId) {
        this.eventHandlers.onTypingIndicator?.(data);
      }
    });
  }

  private handleSyncMessage(message: SyncMessage): void {
    // Don't handle messages from our own device
    if (message.deviceId === this.deviceId) {
      return;
    }

    switch (message.type) {
      case 'conversation_update':
        this.eventHandlers.onConversationUpdate?.(message.payload);
        break;
      case 'device_status':
        this.eventHandlers.onDeviceStatusChange?.(message.payload);
        break;
      case 'user_preference':
        this.eventHandlers.onUserPreferenceChange?.(message.payload);
        break;
      case 'typing_indicator':
        this.eventHandlers.onTypingIndicator?.(message.payload);
        break;
    }
  }

  private attemptReconnection(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.socket && !this.isConnected) {
        this.socket.connect();
      }
    }, delay);
  }

  private getOrCreateDeviceId(): string {
    let deviceId = localStorage.getItem('desktop_device_id');
    
    if (!deviceId) {
      deviceId = `desktop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('desktop_device_id', deviceId);
    }
    
    return deviceId;
  }
}

// Create singleton instance
export const syncService = new SyncService();
export default syncService;