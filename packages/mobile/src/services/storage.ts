import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserPreferences, OfflineSettings, DEFAULT_USER_PREFERENCES, DEFAULT_OFFLINE_SETTINGS } from '../types/settings';
import { Device } from '../types/device';
import { Message } from '../types/chat';

const STORAGE_KEYS = {
  USER_PREFERENCES: '@bil_user_preferences',
  OFFLINE_SETTINGS: '@bil_offline_settings',
  CACHED_DEVICES: '@bil_cached_devices',
  OFFLINE_MESSAGES: '@bil_offline_messages',
  CONVERSATION_CACHE: '@bil_conversation_cache',
  DEVICE_INFO: '@bil_device_info',
} as const;

export class StorageService {
  // Generic storage methods for compatibility
  static async getItem(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key);
  }

  static async setItem(key: string, value: string): Promise<void> {
    return AsyncStorage.setItem(key, value);
  }

  static async removeItem(key: string): Promise<void> {
    return AsyncStorage.removeItem(key);
  }
  // User Preferences
  static async getUserPreferences(): Promise<UserPreferences> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to ensure all properties exist
        return { ...DEFAULT_USER_PREFERENCES, ...parsed };
      }
      return DEFAULT_USER_PREFERENCES;
    } catch (error) {
      console.error('Failed to load user preferences:', error);
      return DEFAULT_USER_PREFERENCES;
    }
  }

  static async setUserPreferences(preferences: UserPreferences): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(preferences));
    } catch (error) {
      console.error('Failed to save user preferences:', error);
      throw error;
    }
  }

  static async updateUserPreferences(updates: Partial<UserPreferences>): Promise<UserPreferences> {
    try {
      const current = await this.getUserPreferences();
      const updated = { ...current, ...updates };
      await this.setUserPreferences(updated);
      return updated;
    } catch (error) {
      console.error('Failed to update user preferences:', error);
      throw error;
    }
  }

  // Offline Settings
  static async getOfflineSettings(): Promise<OfflineSettings> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_SETTINGS);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_OFFLINE_SETTINGS, ...parsed };
      }
      return DEFAULT_OFFLINE_SETTINGS;
    } catch (error) {
      console.error('Failed to load offline settings:', error);
      return DEFAULT_OFFLINE_SETTINGS;
    }
  }

  static async setOfflineSettings(settings: OfflineSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save offline settings:', error);
      throw error;
    }
  }

  // Device Cache
  static async getCachedDevices(): Promise<Device[]> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_DEVICES);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load cached devices:', error);
      return [];
    }
  }

  static async setCachedDevices(devices: Device[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CACHED_DEVICES, JSON.stringify(devices));
    } catch (error) {
      console.error('Failed to cache devices:', error);
      throw error;
    }
  }

  // Offline Messages
  static async getOfflineMessages(): Promise<Message[]> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_MESSAGES);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load offline messages:', error);
      return [];
    }
  }

  static async addOfflineMessage(message: Message): Promise<void> {
    try {
      const messages = await this.getOfflineMessages();
      const settings = await this.getOfflineSettings();
      
      messages.push(message);
      
      // Limit the number of offline messages
      if (messages.length > settings.maxOfflineMessages) {
        messages.splice(0, messages.length - settings.maxOfflineMessages);
      }
      
      await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_MESSAGES, JSON.stringify(messages));
    } catch (error) {
      console.error('Failed to save offline message:', error);
      throw error;
    }
  }

  static async clearOfflineMessages(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_MESSAGES);
    } catch (error) {
      console.error('Failed to clear offline messages:', error);
      throw error;
    }
  }

  // Conversation Cache
  static async getCachedConversations(): Promise<Message[]> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.CONVERSATION_CACHE);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load cached conversations:', error);
      return [];
    }
  }

  static async setCachedConversations(messages: Message[]): Promise<void> {
    try {
      const settings = await this.getOfflineSettings();
      if (!settings.cacheConversations) return;

      // Filter messages by cache duration
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - settings.cacheDurationDays);
      
      const filteredMessages = messages.filter(
        message => new Date(message.timestamp) > cutoffDate
      );

      await AsyncStorage.setItem(STORAGE_KEYS.CONVERSATION_CACHE, JSON.stringify(filteredMessages));
    } catch (error) {
      console.error('Failed to cache conversations:', error);
      throw error;
    }
  }

  static async clearConversationCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.CONVERSATION_CACHE);
    } catch (error) {
      console.error('Failed to clear conversation cache:', error);
      throw error;
    }
  }

  // Device Info
  static async getDeviceInfo(): Promise<{ deviceId: string; deviceName: string } | null> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_INFO);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to load device info:', error);
      return null;
    }
  }

  static async setDeviceInfo(deviceId: string, deviceName: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_INFO, JSON.stringify({ deviceId, deviceName }));
    } catch (error) {
      console.error('Failed to save device info:', error);
      throw error;
    }
  }

  // Clear all data
  static async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
    } catch (error) {
      console.error('Failed to clear all data:', error);
      throw error;
    }
  }
}