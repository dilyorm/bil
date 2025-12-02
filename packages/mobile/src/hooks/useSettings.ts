import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { apiService } from '../services/api';
import { StorageService } from '../services/storage';
import { UserPreferences, OfflineSettings, DEFAULT_USER_PREFERENCES, DEFAULT_OFFLINE_SETTINGS } from '../types/settings';
import { useAuth } from './useAuth';

export interface UseSettingsReturn {
  preferences: UserPreferences;
  offlineSettings: OfflineSettings;
  isLoading: boolean;
  error: string | null;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  updateOfflineSettings: (updates: Partial<OfflineSettings>) => Promise<void>;
  resetPreferences: () => Promise<void>;
  exportSettings: () => Promise<string>;
  importSettings: (settingsJson: string) => Promise<boolean>;
  isOnline: boolean;
}

export const useSettings = (): UseSettingsReturn => {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [offlineSettings, setOfflineSettings] = useState<OfflineSettings>(DEFAULT_OFFLINE_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  
  const { isAuthenticated } = useAuth();

  // Load settings from storage
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const [storedPreferences, storedOfflineSettings] = await Promise.all([
        StorageService.getUserPreferences(),
        StorageService.getOfflineSettings(),
      ]);
      
      setPreferences(storedPreferences);
      setOfflineSettings(storedOfflineSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      setError('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sync settings with server (when available)
  const syncWithServer = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      // Try to get preferences from server
      const response = await apiService.getUserPreferences();
      
      // Merge server preferences with local ones
      const mergedPreferences = { ...preferences, ...response.preferences };
      setPreferences(mergedPreferences);
      await StorageService.setUserPreferences(mergedPreferences);
      
      setIsOnline(true);
    } catch (error) {
      console.warn('Failed to sync with server, using local settings:', error);
      setIsOnline(false);
    }
  }, [isAuthenticated, preferences]);

  // Update user preferences
  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>): Promise<void> => {
    try {
      setError(null);
      
      // Deep merge the updates
      const updatedPreferences = {
        ...preferences,
        ...updates,
        voiceSettings: { ...preferences.voiceSettings, ...updates.voiceSettings },
        privacySettings: { ...preferences.privacySettings, ...updates.privacySettings },
        aiPersonality: { ...preferences.aiPersonality, ...updates.aiPersonality },
        notifications: { ...preferences.notifications, ...updates.notifications },
      };
      
      // Update local state and storage
      setPreferences(updatedPreferences);
      await StorageService.setUserPreferences(updatedPreferences);
      
      // Try to sync with server if online
      if (isAuthenticated && isOnline) {
        try {
          await apiService.updateUserPreferences(updatedPreferences);
        } catch (error) {
          console.warn('Failed to sync preferences with server:', error);
          setIsOnline(false);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update preferences';
      setError(errorMessage);
      Alert.alert('Update Failed', errorMessage);
      throw error;
    }
  }, [preferences, isAuthenticated, isOnline]);

  // Update offline settings
  const updateOfflineSettings = useCallback(async (updates: Partial<OfflineSettings>): Promise<void> => {
    try {
      setError(null);
      
      const updatedSettings = { ...offlineSettings, ...updates };
      setOfflineSettings(updatedSettings);
      await StorageService.setOfflineSettings(updatedSettings);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update offline settings';
      setError(errorMessage);
      Alert.alert('Update Failed', errorMessage);
      throw error;
    }
  }, [offlineSettings]);

  // Reset preferences to defaults
  const resetPreferences = useCallback(async (): Promise<void> => {
    return new Promise((resolve) => {
      Alert.alert(
        'Reset Settings',
        'Are you sure you want to reset all settings to their default values? This action cannot be undone.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(),
          },
          {
            text: 'Reset',
            style: 'destructive',
            onPress: async () => {
              try {
                setPreferences(DEFAULT_USER_PREFERENCES);
                setOfflineSettings(DEFAULT_OFFLINE_SETTINGS);
                
                await Promise.all([
                  StorageService.setUserPreferences(DEFAULT_USER_PREFERENCES),
                  StorageService.setOfflineSettings(DEFAULT_OFFLINE_SETTINGS),
                ]);
                
                // Try to sync with server if online
                if (isAuthenticated && isOnline) {
                  try {
                    await apiService.updateUserPreferences(DEFAULT_USER_PREFERENCES);
                  } catch (error) {
                    console.warn('Failed to sync reset preferences with server:', error);
                  }
                }
                
                resolve();
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Failed to reset settings';
                setError(errorMessage);
                Alert.alert('Reset Failed', errorMessage);
                resolve();
              }
            },
          },
        ]
      );
    });
  }, [isAuthenticated, isOnline]);

  // Export settings as JSON
  const exportSettings = useCallback(async (): Promise<string> => {
    try {
      const settingsExport = {
        preferences,
        offlineSettings,
        exportedAt: new Date().toISOString(),
        version: '1.0',
      };
      
      return JSON.stringify(settingsExport, null, 2);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to export settings';
      setError(errorMessage);
      throw error;
    }
  }, [preferences, offlineSettings]);

  // Import settings from JSON
  const importSettings = useCallback(async (settingsJson: string): Promise<boolean> => {
    try {
      const imported = JSON.parse(settingsJson);
      
      // Validate the imported data
      if (!imported.preferences || !imported.offlineSettings) {
        throw new Error('Invalid settings format');
      }
      
      // Merge with defaults to ensure all properties exist
      const importedPreferences = { ...DEFAULT_USER_PREFERENCES, ...imported.preferences };
      const importedOfflineSettings = { ...DEFAULT_OFFLINE_SETTINGS, ...imported.offlineSettings };
      
      // Update state and storage
      setPreferences(importedPreferences);
      setOfflineSettings(importedOfflineSettings);
      
      await Promise.all([
        StorageService.setUserPreferences(importedPreferences),
        StorageService.setOfflineSettings(importedOfflineSettings),
      ]);
      
      // Try to sync with server if online
      if (isAuthenticated && isOnline) {
        try {
          await apiService.updateUserPreferences(importedPreferences);
        } catch (error) {
          console.warn('Failed to sync imported preferences with server:', error);
        }
      }
      
      Alert.alert('Import Successful', 'Settings have been imported successfully.');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to import settings';
      setError(errorMessage);
      Alert.alert('Import Failed', errorMessage);
      return false;
    }
  }, [isAuthenticated, isOnline]);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Sync with server when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      syncWithServer();
    }
  }, [isAuthenticated, syncWithServer]);

  return {
    preferences,
    offlineSettings,
    isLoading,
    error,
    updatePreferences,
    updateOfflineSettings,
    resetPreferences,
    exportSettings,
    importSettings,
    isOnline,
  };
};