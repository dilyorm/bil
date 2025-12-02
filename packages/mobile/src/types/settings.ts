export interface VoiceSettings {
  preferredVoice: string;
  speechRate: number;
  wakeWordSensitivity: number;
  enableWakeWord: boolean;
  voiceVolume: number;
}

export interface PrivacySettings {
  dataRetentionDays: number;
  allowDataIntegration: boolean;
  permittedDataSources: string[];
  shareUsageData: boolean;
  enableLocationAccess: boolean;
  enableCameraAccess: boolean;
  enableMicrophoneAccess: boolean;
}

export interface AIPersonalitySettings {
  responseStyle: 'formal' | 'casual' | 'friendly';
  verbosity: 'concise' | 'detailed';
  proactiveness: number; // 1-10 scale
  learningEnabled: boolean;
  contextMemoryDays: number;
}

export interface UserPreferences {
  voiceSettings: VoiceSettings;
  privacySettings: PrivacySettings;
  aiPersonality: AIPersonalitySettings;
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    enabled: boolean;
    soundEnabled: boolean;
    vibrationEnabled: boolean;
  };
}

export interface OfflineSettings {
  enableOfflineMode: boolean;
  maxOfflineMessages: number;
  syncOnReconnect: boolean;
  cacheConversations: boolean;
  cacheDurationDays: number;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  voiceSettings: {
    preferredVoice: 'default',
    speechRate: 1.0,
    wakeWordSensitivity: 0.7,
    enableWakeWord: true,
    voiceVolume: 0.8,
  },
  privacySettings: {
    dataRetentionDays: 30,
    allowDataIntegration: false,
    permittedDataSources: [],
    shareUsageData: false,
    enableLocationAccess: false,
    enableCameraAccess: false,
    enableMicrophoneAccess: true,
  },
  aiPersonality: {
    responseStyle: 'friendly',
    verbosity: 'detailed',
    proactiveness: 5,
    learningEnabled: true,
    contextMemoryDays: 7,
  },
  theme: 'auto',
  notifications: {
    enabled: true,
    soundEnabled: true,
    vibrationEnabled: true,
  },
};

export const DEFAULT_OFFLINE_SETTINGS: OfflineSettings = {
  enableOfflineMode: true,
  maxOfflineMessages: 100,
  syncOnReconnect: true,
  cacheConversations: true,
  cacheDurationDays: 7,
};