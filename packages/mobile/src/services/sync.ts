import { io, Socket } from 'socket.io-client';
import { AppState, AppStateStatus } from 'react-native';
import { 
  SyncMessage, 
  SyncState, 
  SyncConfig, 
  SyncCallbacks,
  ConversationUpdatePayload,
  DeviceStatusPayload,
  TypingIndicatorPayload
} from '../types/sync';
import { API_BASE_URL } from '../config/constants';

class SyncService {
  private socket: Socket | null = null;
  private config: SyncConfig;
  private callbacks: SyncCallbacks = {};
  private state: SyncState;
  private accessToken: string | null = null;
  private userId: string | null = null;
  private deviceId: string | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private appStateSubscription: any = null;

  constructor() {
    this.config = {
      serverUrl: API_BASE_URL?.replace('/api', '') || 'http://localhost:3000',
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      maxReconnectionAttempts: 5,
      timeout: 20000,
    };

    this.state = {
      isConnected: false,
      isConnecting: false,
      connectionError: null,
      lastSyncTime: null,
      connectedDevices: [],
      retryCount: 0,
      maxRetries: this.config.maxReconnectionAttempts,
    };

    this.setupAppStateListener();
  }

  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    if (nextAppState === 'active') {
      // App came to foreground, reconnect if needed
      if (!this.state.isConnected && this.accessToken) {
        this.connect();
      }
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App went to background, maintain connection but reduce activity
      this.pauseHeartbeat();
    }
  };

  setAuth(accessToken: string, userId: string, deviceId: string): void {
    this.accessToken = accessToken;
    this.userId = userId;
    this.deviceId = deviceId;
  }

  setCallbacks(callbacks: SyncCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  getState(): SyncState {
    return { ...this.state };
  }

  async connect(): Promise<void> {
    if (this.state.isConnecting || this.state.isConnected) {
      return;
    }

    if (!this.accessToken || !this.userId || !this.deviceId) {
      throw new Error('Authentication required before connecting');
    }

    this.updateState({ isConnecting: true, connectionError: null });

    try {
      this.socket = io(this.config.serverUrl, {
        auth: {
          token: this.accessToken,
          userId: this.userId,
          deviceId: this.deviceId,
        },
        timeout: this.config.timeout,
        reconnection: false, // We'll handle reconnection manually
      });

      this.setupSocketListeners();

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, this.config.timeout);

        this.socket!.on('connect', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.socket!.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

    } catch (error) {
      this.updateState({ 
        isConnecting: false, 
        connectionError: error instanceof Error ? error.message : 'Connection failed' 
      });
      throw error;
    }
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.updateState({
        isConnected: true,
        isConnecting: false,
        connectionError: null,
        retryCount: 0,
        lastSyncTime: new Date(),
      });
      this.startHeartbeat();
      this.callbacks.onConnect?.();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.updateState({
        isConnected: false,
        isConnecting: false,
      });
      this.stopHeartbeat();
      this.callbacks.onDisconnect?.(reason);
      
      // Auto-reconnect unless it was a manual disconnect
      if (reason !== 'io client disconnect') {
        this.scheduleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.updateState({
        isConnected: false,
        isConnecting: false,
        connectionError: error.message,
      });
      this.callbacks.onReconnectError?.(error);
      this.scheduleReconnect();
    });

    // Sync message handlers
    this.socket.on('sync', (message: SyncMessage) => {
      this.handleSyncMessage(message);
    });

    this.socket.on('conversation_update', (payload: ConversationUpdatePayload) => {
      this.handleConversationUpdate(payload);
    });

    this.socket.on('device_status', (deviceId: string, payload: DeviceStatusPayload) => {
      this.handleDeviceStatusUpdate(deviceId, payload);
    });

    this.socket.on('typing_indicator', (deviceId: string, payload: TypingIndicatorPayload) => {
      this.handleTypingIndicator(deviceId, payload);
    });

    this.socket.on('devices_list', (devices: string[]) => {
      this.updateState({ connectedDevices: devices });
    });
  }

  private handleSyncMessage(message: SyncMessage): void {
    console.log('Received sync message:', message);
    this.updateState({ lastSyncTime: new Date() });
    this.callbacks.onMessageReceived?.(message);

    switch (message.type) {
      case 'conversation_update':
        this.handleConversationUpdate(message.payload);
        break;
      case 'device_status':
        this.handleDeviceStatusUpdate(message.deviceId, message.payload);
        break;
      case 'typing_indicator':
        this.handleTypingIndicator(message.deviceId, message.payload);
        break;
    }
  }

  private handleConversationUpdate(payload: ConversationUpdatePayload): void {
    // This will be handled by the chat hook through callbacks
    console.log('Conversation update received:', payload);
  }

  private handleDeviceStatusUpdate(deviceId: string, payload: DeviceStatusPayload): void {
    console.log('Device status update:', deviceId, payload);
    this.callbacks.onDeviceStatusUpdate?.(deviceId, payload);
  }

  private handleTypingIndicator(deviceId: string, payload: TypingIndicatorPayload): void {
    console.log('Typing indicator:', deviceId, payload);
    this.callbacks.onTypingIndicator?.(deviceId, payload);
  }

  private scheduleReconnect(): void {
    if (this.state.retryCount >= this.state.maxRetries) {
      console.log('Max reconnection attempts reached');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = Math.min(
      this.config.reconnectionDelay * Math.pow(2, this.state.retryCount),
      this.config.reconnectionDelayMax
    );

    console.log(`Scheduling reconnect in ${delay}ms (attempt ${this.state.retryCount + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.updateState({ retryCount: this.state.retryCount + 1 });
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error);
        this.callbacks.onReconnectError?.(error);
      });
    }, delay);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('heartbeat', {
          deviceId: this.deviceId,
          timestamp: Date.now(),
        });
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private pauseHeartbeat(): void {
    // Keep connection but reduce heartbeat frequency when in background
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('heartbeat', {
          deviceId: this.deviceId,
          timestamp: Date.now(),
        });
      }
    }, 60000); // Send heartbeat every 60 seconds in background
  }

  // Public methods for sending sync messages
  async sendMessage(message: Omit<SyncMessage, 'userId' | 'deviceId' | 'timestamp'>): Promise<void> {
    if (!this.socket?.connected) {
      throw new Error('Not connected to sync server');
    }

    const syncMessage: SyncMessage = {
      ...message,
      userId: this.userId!,
      deviceId: this.deviceId!,
      timestamp: Date.now(),
    };

    this.socket.emit('sync', syncMessage);
  }

  async broadcastConversationUpdate(payload: ConversationUpdatePayload): Promise<void> {
    await this.sendMessage({
      type: 'conversation_update',
      payload,
    });
  }

  async sendTypingIndicator(isTyping: boolean): Promise<void> {
    await this.sendMessage({
      type: 'typing_indicator',
      payload: { isTyping },
    });
  }

  async updateDeviceStatus(status: DeviceStatusPayload): Promise<void> {
    await this.sendMessage({
      type: 'device_status',
      payload: status,
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.updateState({
      isConnected: false,
      isConnecting: false,
      retryCount: 0,
    });
  }

  private updateState(updates: Partial<SyncState>): void {
    this.state = { ...this.state, ...updates };
  }

  destroy(): void {
    this.disconnect();
    
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }
}

export const syncService = new SyncService();