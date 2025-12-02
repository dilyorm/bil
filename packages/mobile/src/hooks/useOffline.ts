import { useState, useEffect, useCallback } from 'react';
import { offlineService } from '../services/offline';
import { StorageService } from '../services/storage';
import { OfflineSettings } from '../types/settings';
import { Message } from '../types/chat';
import { Device } from '../types/device';

export interface UseOfflineReturn {
  isOnline: boolean;
  offlineSettings: OfflineSettings;
  queueStatus: {
    count: number;
    isOnline: boolean;
    isSyncing: boolean;
  };
  cachedDevices: Device[];
  cachedMessages: Message[];
  updateOfflineSettings: (settings: Partial<OfflineSettings>) => Promise<void>;
  queueMessage: (message: Message) => Promise<void>;
  syncQueuedItems: () => Promise<void>;
  clearOfflineData: () => Promise<void>;
  enableOfflineMode: () => Promise<void>;
  disableOfflineMode: () => Promise<void>;
}

export const useOffline = (): UseOfflineReturn => {
  const [isOnline, setIsOnline] = useState(true);
  const [offlineSettings, setOfflineSettings] = useState<OfflineSettings>({
    enableOfflineMode: true,
    maxOfflineMessages: 100,
    syncOnReconnect: true,
    cacheConversations: true,
    cacheDurationDays: 7,
  });
  const [queueStatus, setQueueStatus] = useState({
    count: 0,
    isOnline: true,
    isSyncing: false,
  });
  const [cachedDevices, setCachedDevices] = useState<Device[]>([]);
  const [cachedMessages, setCachedMessages] = useState<Message[]>([]);

  // Load offline settings
  const loadOfflineSettings = useCallback(async () => {
    try {
      const settings = await StorageService.getOfflineSettings();
      setOfflineSettings(settings);
    } catch (error) {
      console.error('Failed to load offline settings:', error);
    }
  }, []);

  // Load cached data
  const loadCachedData = useCallback(async () => {
    try {
      const [devices, messages] = await Promise.all([
        offlineService.getCachedDevices(),
        offlineService.getCachedConversations(),
      ]);
      setCachedDevices(devices);
      setCachedMessages(messages);
    } catch (error) {
      console.error('Failed to load cached data:', error);
    }
  }, []);

  // Update queue status
  const updateQueueStatus = useCallback(() => {
    const status = offlineService.getQueueStatus();
    setQueueStatus(status);
  }, []);

  // Update offline settings
  const updateOfflineSettings = useCallback(async (updates: Partial<OfflineSettings>) => {
    try {
      const newSettings = { ...offlineSettings, ...updates };
      await StorageService.setOfflineSettings(newSettings);
      setOfflineSettings(newSettings);
    } catch (error) {
      console.error('Failed to update offline settings:', error);
      throw error;
    }
  }, [offlineSettings]);

  // Queue message for offline sync
  const queueMessage = useCallback(async (message: Message) => {
    if (!offlineSettings.enableOfflineMode) return;
    
    try {
      await offlineService.queueMessage(message);
      updateQueueStatus();
    } catch (error) {
      console.error('Failed to queue message:', error);
      throw error;
    }
  }, [offlineSettings.enableOfflineMode, updateQueueStatus]);

  // Sync queued items
  const syncQueuedItems = useCallback(async () => {
    try {
      await offlineService.syncQueuedItems();
      updateQueueStatus();
      await loadCachedData(); // Refresh cached data after sync
    } catch (error) {
      console.error('Failed to sync queued items:', error);
      throw error;
    }
  }, [updateQueueStatus, loadCachedData]);

  // Clear offline data
  const clearOfflineData = useCallback(async () => {
    try {
      await offlineService.clearQueue();
      await StorageService.clearConversationCache();
      await StorageService.clearOfflineMessages();
      
      setCachedDevices([]);
      setCachedMessages([]);
      updateQueueStatus();
    } catch (error) {
      console.error('Failed to clear offline data:', error);
      throw error;
    }
  }, [updateQueueStatus]);

  // Enable offline mode
  const enableOfflineMode = useCallback(async () => {
    try {
      await offlineService.enableOfflineMode();
      await updateOfflineSettings({ enableOfflineMode: true });
    } catch (error) {
      console.error('Failed to enable offline mode:', error);
      throw error;
    }
  }, [updateOfflineSettings]);

  // Disable offline mode
  const disableOfflineMode = useCallback(async () => {
    try {
      await offlineService.disableOfflineMode();
      await updateOfflineSettings({ enableOfflineMode: false });
      await clearOfflineData();
    } catch (error) {
      console.error('Failed to disable offline mode:', error);
      throw error;
    }
  }, [updateOfflineSettings, clearOfflineData]);

  // Set up network listener
  useEffect(() => {
    const unsubscribe = offlineService.addNetworkListener((online) => {
      setIsOnline(online);
      updateQueueStatus();
      
      if (online && offlineSettings.syncOnReconnect) {
        // Auto-sync when coming back online
        syncQueuedItems();
      }
    });

    return unsubscribe;
  }, [offlineSettings.syncOnReconnect, syncQueuedItems, updateQueueStatus]);

  // Load initial data
  useEffect(() => {
    loadOfflineSettings();
    loadCachedData();
    updateQueueStatus();
    setIsOnline(offlineService.getNetworkStatus());
  }, [loadOfflineSettings, loadCachedData, updateQueueStatus]);

  // Update queue status periodically
  useEffect(() => {
    const interval = setInterval(updateQueueStatus, 5000);
    return () => clearInterval(interval);
  }, [updateQueueStatus]);

  return {
    isOnline,
    offlineSettings,
    queueStatus,
    cachedDevices,
    cachedMessages,
    updateOfflineSettings,
    queueMessage,
    syncQueuedItems,
    clearOfflineData,
    enableOfflineMode,
    disableOfflineMode,
  };
};