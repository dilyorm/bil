// Note: NetInfo would be imported from @react-native-community/netinfo in a real implementation
// For now, we'll create a mock implementation
import { StorageService } from './storage';
import { apiService } from './api';
import { Message } from '../types/chat';
import { Device } from '../types/device';

export interface OfflineQueueItem {
  id: string;
  type: 'message' | 'device_update' | 'preferences_update';
  data: any;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
}

class OfflineService {
  private isOnline: boolean = true;
  private syncQueue: OfflineQueueItem[] = [];
  private syncInProgress: boolean = false;
  private listeners: Array<(isOnline: boolean) => void> = [];

  constructor() {
    this.initializeNetworkListener();
    this.loadSyncQueue();
  }

  private async initializeNetworkListener() {
    // Mock network listener - in real implementation would use NetInfo
    // For now, assume we're online
    this.isOnline = true;
    
    // In a real implementation, this would be:
    // NetInfo.addEventListener(state => {
    //   const wasOnline = this.isOnline;
    //   this.isOnline = state.isConnected ?? false;
    //   
    //   if (!wasOnline && this.isOnline) {
    //     this.syncQueuedItems();
    //   }
    //   
    //   this.listeners.forEach(listener => listener(this.isOnline));
    // });
  }

  private async loadSyncQueue() {
    try {
      const stored = await StorageService.getOfflineMessages();
      // Convert stored messages to queue items
      this.syncQueue = stored.map(message => ({
        id: message.id,
        type: 'message' as const,
        data: message,
        timestamp: new Date(message.timestamp),
        retryCount: 0,
        maxRetries: 3,
      }));
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  }

  private async saveSyncQueue() {
    try {
      // Save message items back to storage
      const messages = this.syncQueue
        .filter(item => item.type === 'message')
        .map(item => item.data as Message);
      
      await StorageService.clearOfflineMessages();
      for (const message of messages) {
        await StorageService.addOfflineMessage(message);
      }
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  // Public methods
  public getNetworkStatus(): boolean {
    return this.isOnline;
  }

  public addNetworkListener(listener: (isOnline: boolean) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public async queueMessage(message: Message): Promise<void> {
    const queueItem: OfflineQueueItem = {
      id: message.id,
      type: 'message',
      data: message,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: 3,
    };

    this.syncQueue.push(queueItem);
    await this.saveSyncQueue();

    // Try to sync immediately if online
    if (this.isOnline) {
      this.syncQueuedItems();
    }
  }

  public async queueDeviceUpdate(deviceId: string, updateData: any): Promise<void> {
    const queueItem: OfflineQueueItem = {
      id: `device_${deviceId}_${Date.now()}`,
      type: 'device_update',
      data: { deviceId, updateData },
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: 3,
    };

    this.syncQueue.push(queueItem);
    await this.saveSyncQueue();

    if (this.isOnline) {
      this.syncQueuedItems();
    }
  }

  public async queuePreferencesUpdate(preferences: any): Promise<void> {
    const queueItem: OfflineQueueItem = {
      id: `preferences_${Date.now()}`,
      type: 'preferences_update',
      data: preferences,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: 3,
    };

    this.syncQueue.push(queueItem);
    await this.saveSyncQueue();

    if (this.isOnline) {
      this.syncQueuedItems();
    }
  }

  public async syncQueuedItems(): Promise<void> {
    if (!this.isOnline || this.syncInProgress || this.syncQueue.length === 0) {
      return;
    }

    this.syncInProgress = true;

    try {
      const itemsToSync = [...this.syncQueue];
      const successfulItems: string[] = [];

      for (const item of itemsToSync) {
        try {
          await this.syncItem(item);
          successfulItems.push(item.id);
        } catch (error) {
          console.error(`Failed to sync item ${item.id}:`, error);
          
          // Increment retry count
          item.retryCount++;
          
          // Remove item if max retries exceeded
          if (item.retryCount >= item.maxRetries) {
            console.warn(`Max retries exceeded for item ${item.id}, removing from queue`);
            successfulItems.push(item.id);
          }
        }
      }

      // Remove successfully synced items
      this.syncQueue = this.syncQueue.filter(item => !successfulItems.includes(item.id));
      await this.saveSyncQueue();

    } finally {
      this.syncInProgress = false;
    }
  }

  private async syncItem(item: OfflineQueueItem): Promise<void> {
    switch (item.type) {
      case 'message':
        await this.syncMessage(item.data as Message);
        break;
      case 'device_update':
        await this.syncDeviceUpdate(item.data);
        break;
      case 'preferences_update':
        await this.syncPreferencesUpdate(item.data);
        break;
      default:
        throw new Error(`Unknown sync item type: ${item.type}`);
    }
  }

  private async syncMessage(message: Message): Promise<void> {
    // Send message to server
    await apiService.sendMessage({
      message: message.content,
      deviceContext: {
        type: 'mobile',
        capabilities: ['voice', 'text'],
      },
    });
  }

  private async syncDeviceUpdate(data: { deviceId: string; updateData: any }): Promise<void> {
    await apiService.updateDevice(data.deviceId, data.updateData);
  }

  private async syncPreferencesUpdate(preferences: any): Promise<void> {
    await apiService.updateUserPreferences(preferences);
  }

  public getQueueStatus(): { count: number; isOnline: boolean; isSyncing: boolean } {
    return {
      count: this.syncQueue.length,
      isOnline: this.isOnline,
      isSyncing: this.syncInProgress,
    };
  }

  public async clearQueue(): Promise<void> {
    this.syncQueue = [];
    await StorageService.clearOfflineMessages();
  }

  // Offline fallback methods
  public async getCachedDevices(): Promise<Device[]> {
    return await StorageService.getCachedDevices();
  }

  public async getCachedConversations(): Promise<Message[]> {
    return await StorageService.getCachedConversations();
  }

  public async enableOfflineMode(): Promise<void> {
    const settings = await StorageService.getOfflineSettings();
    await StorageService.setOfflineSettings({
      ...settings,
      enableOfflineMode: true,
    });
  }

  public async disableOfflineMode(): Promise<void> {
    const settings = await StorageService.getOfflineSettings();
    await StorageService.setOfflineSettings({
      ...settings,
      enableOfflineMode: false,
    });
    
    // Clear offline data
    await this.clearQueue();
    await StorageService.clearConversationCache();
  }
}

export const offlineService = new OfflineService();