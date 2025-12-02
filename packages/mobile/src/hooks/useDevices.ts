import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { apiService } from '../services/api';
import { StorageService } from '../services/storage';
import { Device, DeviceRegistrationRequest, DeviceUpdateRequest, DeviceStats } from '../types/device';
import { useAuth } from './useAuth';

export interface UseDevicesReturn {
  devices: Device[];
  activeDevices: Device[];
  currentDevice: Device | null;
  stats: DeviceStats | null;
  isLoading: boolean;
  error: string | null;
  refreshDevices: () => Promise<void>;
  registerDevice: (deviceData: DeviceRegistrationRequest) => Promise<Device | null>;
  updateDevice: (deviceId: string, updateData: DeviceUpdateRequest) => Promise<Device | null>;
  removeDevice: (deviceId: string) => Promise<boolean>;
  deactivateDevice: (deviceId: string) => Promise<boolean>;
  sendHeartbeat: (deviceId: string, status?: Record<string, any>) => Promise<void>;
  isOnline: boolean;
}

export const useDevices = (): UseDevicesReturn => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [activeDevices, setActiveDevices] = useState<Device[]>([]);
  const [currentDevice, setCurrentDevice] = useState<Device | null>(null);
  const [stats, setStats] = useState<DeviceStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  
  const { isAuthenticated } = useAuth();

  // Load cached devices when offline
  const loadCachedDevices = useCallback(async () => {
    try {
      const cachedDevices = await StorageService.getCachedDevices();
      setDevices(cachedDevices);
      setActiveDevices(cachedDevices.filter(device => device.is_active));
    } catch (error) {
      console.error('Failed to load cached devices:', error);
    }
  }, []);

  // Refresh devices from API
  const refreshDevices = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      // Try to fetch from API
      const [devicesResponse, activeDevicesResponse, statsResponse] = await Promise.all([
        apiService.getDevices(),
        apiService.getActiveDevices(),
        apiService.getDeviceStats(),
      ]);

      setDevices(devicesResponse.devices);
      setActiveDevices(activeDevicesResponse.devices);
      setStats(statsResponse);
      setIsOnline(true);

      // Cache devices for offline use
      await StorageService.setCachedDevices(devicesResponse.devices);

      // Find current device
      const deviceInfo = await StorageService.getDeviceInfo();
      if (deviceInfo) {
        const current = devicesResponse.devices.find(d => d.id === deviceInfo.deviceId);
        setCurrentDevice(current || null);
      }
    } catch (error) {
      console.error('Failed to refresh devices:', error);
      setError(error instanceof Error ? error.message : 'Failed to load devices');
      setIsOnline(false);
      
      // Load cached devices as fallback
      await loadCachedDevices();
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, loadCachedDevices]);

  // Register a new device
  const registerDevice = useCallback(async (deviceData: DeviceRegistrationRequest): Promise<Device | null> => {
    if (!isAuthenticated) return null;

    try {
      setError(null);
      const response = await apiService.registerDevice(deviceData);
      
      // Update local state
      await refreshDevices();
      
      // Store device info for current device
      await StorageService.setDeviceInfo(response.device.id, response.device.name);
      setCurrentDevice(response.device);
      
      return response.device;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to register device';
      setError(errorMessage);
      Alert.alert('Registration Failed', errorMessage);
      return null;
    }
  }, [isAuthenticated, refreshDevices]);

  // Update device
  const updateDevice = useCallback(async (deviceId: string, updateData: DeviceUpdateRequest): Promise<Device | null> => {
    if (!isAuthenticated) return null;

    try {
      setError(null);
      const response = await apiService.updateDevice(deviceId, updateData);
      
      // Update local state
      await refreshDevices();
      
      return response.device;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update device';
      setError(errorMessage);
      Alert.alert('Update Failed', errorMessage);
      return null;
    }
  }, [isAuthenticated, refreshDevices]);

  // Remove device
  const removeDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    if (!isAuthenticated) return false;

    try {
      setError(null);
      
      // Show confirmation dialog
      return new Promise((resolve) => {
        Alert.alert(
          'Remove Device',
          'Are you sure you want to remove this device? This action cannot be undone.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: async () => {
                try {
                  await apiService.removeDevice(deviceId);
                  await refreshDevices();
                  resolve(true);
                } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : 'Failed to remove device';
                  setError(errorMessage);
                  Alert.alert('Removal Failed', errorMessage);
                  resolve(false);
                }
              },
            },
          ]
        );
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove device';
      setError(errorMessage);
      Alert.alert('Removal Failed', errorMessage);
      return false;
    }
  }, [isAuthenticated, refreshDevices]);

  // Deactivate device
  const deactivateDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    if (!isAuthenticated) return false;

    try {
      setError(null);
      await apiService.deactivateDevice(deviceId);
      await refreshDevices();
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to deactivate device';
      setError(errorMessage);
      Alert.alert('Deactivation Failed', errorMessage);
      return false;
    }
  }, [isAuthenticated, refreshDevices]);

  // Send heartbeat
  const sendHeartbeat = useCallback(async (deviceId: string, status?: Record<string, any>): Promise<void> => {
    if (!isAuthenticated) return;

    try {
      await apiService.sendDeviceHeartbeat(deviceId, status);
    } catch (error) {
      // Heartbeat failures are not critical, just log them
      console.warn('Failed to send heartbeat:', error);
    }
  }, [isAuthenticated]);

  // Load devices on mount and when authentication changes
  useEffect(() => {
    if (isAuthenticated) {
      refreshDevices();
    } else {
      setDevices([]);
      setActiveDevices([]);
      setCurrentDevice(null);
      setStats(null);
    }
  }, [isAuthenticated, refreshDevices]);

  // Set up heartbeat interval for current device
  useEffect(() => {
    if (!currentDevice || !isAuthenticated) return;

    const heartbeatInterval = setInterval(() => {
      sendHeartbeat(currentDevice.id, {
        timestamp: new Date().toISOString(),
        batteryLevel: 1.0, // Could be enhanced with actual battery info
        networkStatus: isOnline ? 'connected' : 'offline',
      });
    }, 30000); // Send heartbeat every 30 seconds

    return () => clearInterval(heartbeatInterval);
  }, [currentDevice, isAuthenticated, sendHeartbeat, isOnline]);

  return {
    devices,
    activeDevices,
    currentDevice,
    stats,
    isLoading,
    error,
    refreshDevices,
    registerDevice,
    updateDevice,
    removeDevice,
    deactivateDevice,
    sendHeartbeat,
    isOnline,
  };
};