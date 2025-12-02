import { API_BASE_URL } from '../config/constants';
import { Message, Conversation } from '../types/chat';
import { Device, DeviceRegistrationRequest, DeviceUpdateRequest, DeviceStats } from '../types/device';
import { UserPreferences } from '../types/settings';

export interface LoginRequest {
  email: string;
  password: string;
  deviceId?: string;
}

export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    tokens: {
      accessToken: string;
      refreshToken: string;
    };
    user: {
      id: string;
      email: string;
      name: string;
    };
  };
}

export interface ChatRequest {
  message: string;
  deviceContext?: {
    type: 'mobile' | 'desktop' | 'wearable';
    capabilities: string[];
  };
}

export interface ChatResponse {
  success: boolean;
  data: {
    response: string;
    messageId: string;
    processingTime: number;
  };
}

export interface VoiceRequest {
  audioUri: string;
  deviceContext?: {
    type: 'mobile' | 'desktop' | 'wearable';
    capabilities: string[];
  };
}

export interface ConversationHistoryResponse {
  success: boolean;
  data: {
    messages: Message[];
    hasMore: boolean;
  };
}

export interface ApiError {
  error: string;
  message: string;
  details?: any[];
}

export interface DevicesResponse {
  devices: Device[];
  total: number;
}

export interface DeviceResponse {
  device: Device;
  message?: string;
}

export interface DeviceStatsResponse extends DeviceStats {}

export interface UserPreferencesResponse {
  preferences: UserPreferences;
}

class ApiService {
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor() {
    this.baseUrl = API_BASE_URL || 'http://localhost:3000/api';
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    return data;
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const response = await fetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    return data;
  }

  async refreshToken(refreshToken: string): Promise<{ tokens: { accessToken: string; refreshToken: string } }> {
    const response = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Token refresh failed');
    }

    return data.data;
  }

  async logout(refreshToken: string): Promise<void> {
    await fetch(`${this.baseUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });
  }

  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/agent/chat`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to send message');
    }

    return data;
  }

  async sendVoiceMessage(request: VoiceRequest): Promise<ChatResponse> {
    const formData = new FormData();
    formData.append('audio', {
      uri: request.audioUri,
      type: 'audio/m4a',
      name: 'voice_message.m4a',
    } as any);

    if (request.deviceContext) {
      formData.append('deviceContext', JSON.stringify(request.deviceContext));
    }

    const response = await fetch(`${this.baseUrl}/agent/voice`, {
      method: 'POST',
      headers: {
        Authorization: this.accessToken ? `Bearer ${this.accessToken}` : '',
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to process voice message');
    }

    return data;
  }

  async getConversationHistory(limit = 50, offset = 0): Promise<ConversationHistoryResponse> {
    const response = await fetch(
      `${this.baseUrl}/agent/history?limit=${limit}&offset=${offset}`,
      {
        method: 'GET',
        headers: this.getAuthHeaders(),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch conversation history');
    }

    return data;
  }

  async deleteConversationHistory(messageId?: string): Promise<void> {
    const url = messageId 
      ? `${this.baseUrl}/agent/history/${messageId}`
      : `${this.baseUrl}/agent/history`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Failed to delete conversation history');
    }
  }

  // Device Management Methods
  async getDevices(): Promise<DevicesResponse> {
    const response = await fetch(`${this.baseUrl}/devices`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch devices');
    }

    return data;
  }

  async getActiveDevices(): Promise<DevicesResponse> {
    const response = await fetch(`${this.baseUrl}/devices/active`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch active devices');
    }

    return data;
  }

  async registerDevice(deviceData: DeviceRegistrationRequest): Promise<DeviceResponse> {
    const response = await fetch(`${this.baseUrl}/devices/register`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(deviceData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to register device');
    }

    return data;
  }

  async getDevice(deviceId: string): Promise<DeviceResponse> {
    const response = await fetch(`${this.baseUrl}/devices/${deviceId}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch device');
    }

    return data;
  }

  async updateDevice(deviceId: string, updateData: DeviceUpdateRequest): Promise<DeviceResponse> {
    const response = await fetch(`${this.baseUrl}/devices/${deviceId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(updateData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to update device');
    }

    return data;
  }

  async sendDeviceHeartbeat(deviceId: string, status?: Record<string, any>): Promise<void> {
    const response = await fetch(`${this.baseUrl}/devices/${deviceId}/heartbeat`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(status || {}),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Failed to send heartbeat');
    }
  }

  async deactivateDevice(deviceId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/devices/${deviceId}/deactivate`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Failed to deactivate device');
    }
  }

  async removeDevice(deviceId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/devices/${deviceId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Failed to remove device');
    }
  }

  async getDeviceStats(): Promise<DeviceStatsResponse> {
    const response = await fetch(`${this.baseUrl}/devices/stats`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch device stats');
    }

    return data;
  }

  // User Preferences Methods (placeholder - would need backend implementation)
  async getUserPreferences(): Promise<UserPreferencesResponse> {
    // For now, return default preferences since backend doesn't have this endpoint yet
    const defaultPreferences: UserPreferences = {
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
    return { preferences: defaultPreferences };
  }

  async updateUserPreferences(preferences: Partial<UserPreferences>): Promise<UserPreferencesResponse> {
    // For now, just return the updated preferences since backend doesn't have this endpoint yet
    const current = await this.getUserPreferences();
    return { preferences: { ...current.preferences, ...preferences } };
  }
}

export const apiService = new ApiService();