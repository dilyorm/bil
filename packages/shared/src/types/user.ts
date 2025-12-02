export interface User {
  id: string;
  email: string;
  name: string;
  preferences: UserPreferences;
  devices: Device[];
  createdAt: Date;
  lastActiveAt: Date;
}

export interface UserPreferences {
  voiceSettings: {
    preferredVoice: string;
    speechRate: number;
    wakeWordSensitivity: number;
  };
  privacySettings: {
    dataRetentionDays: number;
    allowDataIntegration: boolean;
    permittedDataSources: string[];
  };
  aiPersonality: {
    responseStyle: 'formal' | 'casual' | 'friendly';
    verbosity: 'concise' | 'detailed';
    proactiveness: number; // 1-10 scale
  };
}

export interface Device {
  id: string;
  userId: string;
  type: 'mobile' | 'desktop' | 'wearable' | 'web';
  name: string;
  capabilities: DeviceCapabilities;
  lastSeen: Date;
  isActive: boolean;
  connectionInfo: ConnectionInfo;
}

export interface DeviceCapabilities {
  hasVoiceInput: boolean;
  hasVoiceOutput: boolean;
  hasHapticFeedback: boolean;
  hasFileAccess: boolean;
  hasCalendarAccess: boolean;
  supportsGestures: boolean;
}

export interface ConnectionInfo {
  ipAddress?: string;
  userAgent?: string;
  platform?: string;
  version?: string;
}
