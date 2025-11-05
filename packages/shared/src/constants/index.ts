export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
  },
  AGENT: {
    CHAT: '/agent/chat',
    VOICE: '/agent/voice',
    HISTORY: '/agent/history',
  },
  DEVICES: {
    LIST: '/devices',
    REGISTER: '/devices/register',
    SYNC: '/devices/:id/sync',
    DELETE: '/devices/:id',
  },
} as const;

export const DEVICE_TYPES = {
  MOBILE: 'mobile',
  DESKTOP: 'desktop',
  WEARABLE: 'wearable',
  WEB: 'web',
} as const;

export const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
} as const;