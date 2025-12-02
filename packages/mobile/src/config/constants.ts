// API Configuration
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000/api';

// Voice Configuration
export const VOICE_CONFIG = {
  WAKE_WORD: 'Hey BIL',
  RECORDING_OPTIONS: {
    android: {
      extension: '.m4a',
      outputFormat: 'mpeg_4',
      audioEncoder: 'aac',
      sampleRate: 44100,
      numberOfChannels: 2,
      bitRate: 128000,
    },
    ios: {
      extension: '.m4a',
      outputFormat: 'mpeg4aac',
      audioQuality: 'MAX',
      sampleRate: 44100,
      numberOfChannels: 2,
      bitRate: 128000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
  },
  TTS_OPTIONS: {
    language: 'en-US',
    pitch: 1.0,
    rate: 0.9,
  },
};

// Chat Configuration
export const CHAT_CONFIG = {
  MAX_MESSAGE_LENGTH: 1000,
  MAX_MESSAGES_HISTORY: 100,
  TYPING_INDICATOR_DELAY: 500,
  AUTO_SCROLL_DELAY: 100,
};

// Device Configuration
export const DEVICE_CONFIG = {
  TYPE: 'mobile' as const,
  CAPABILITIES: [
    'voice_input',
    'voice_output',
    'text_input',
    'haptic_feedback',
    'push_notifications',
  ],
};

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  BIOMETRIC_ENABLED: 'biometric_enabled',
};

// Validation Rules
export const VALIDATION_RULES = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
  EMAIL: {
    REQUIRED: 'Email is required',
    INVALID: 'Please enter a valid email address',
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  PASSWORD: {
    REQUIRED: 'Password is required',
    MIN_LENGTH: 'Password must be at least 8 characters',
    PATTERN: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
    PATTERN_MESSAGE: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  },
  NAME: {
    REQUIRED: 'Name is required',
    MIN_LENGTH: 'Name must be at least 2 characters',
    MAX_LENGTH: 'Name must be less than 50 characters',
  },
};

// Error Messages
export const ERROR_MESSAGES = {
  VOICE_PERMISSION_DENIED: 'Microphone permission is required for voice interaction',
  VOICE_RECORDING_FAILED: 'Failed to record voice message',
  VOICE_PLAYBACK_FAILED: 'Failed to play voice response',
  MESSAGE_SEND_FAILED: 'Failed to send message',
  NETWORK_ERROR: 'Network connection error',
  AUTH_REQUIRED: 'Authentication required',
  WAKE_WORD_DETECTION_FAILED: 'Wake word detection failed',
};