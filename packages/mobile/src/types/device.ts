export type DeviceType = 'mobile' | 'desktop' | 'wearable' | 'web';

export interface DeviceCapabilities {
  hasVoiceInput: boolean;
  hasVoiceOutput: boolean;
  hasHapticFeedback: boolean;
  hasFileAccess: boolean;
  hasCalendarAccess: boolean;
  supportsGestures: boolean;
  hasCamera: boolean;
  hasLocation: boolean;
  hasBluetooth: boolean;
}

export interface Device {
  id: string;
  user_id: string;
  type: DeviceType;
  name: string;
  capabilities: DeviceCapabilities;
  connection_info: Record<string, any>;
  is_active: boolean;
  last_seen: Date;
  created_at: Date;
  updated_at: Date;
  isConnected?: boolean;
}

export interface DeviceRegistrationRequest {
  type: DeviceType;
  name: string;
  capabilities?: DeviceCapabilities;
  connection_info?: Record<string, any>;
}

export interface DeviceUpdateRequest {
  name?: string;
  capabilities?: DeviceCapabilities;
  connection_info?: Record<string, any>;
  is_active?: boolean;
}

export interface DeviceStats {
  connectedDevices: number;
  roomSize: number;
  activeConversations: number;
  totalDevices: number;
  activeDevices: number;
  inactiveDevices: number;
  devices: Array<{
    deviceId: string;
    socketId: string;
    connectedAt: string;
  }>;
}