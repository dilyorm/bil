import axios, { AxiosInstance, AxiosResponse } from 'axios';

interface ApiConfig {
  baseURL: string;
  timeout: number;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface PlanRequest {
  message: string;
}

interface PlannedAction {
  type: 'open_url' | 'open_path' | 'run_script';
  url?: string;
  path?: string;
  language?: string;
  script?: string;
  args?: string[];
}

interface PlanResponse {
  success: boolean;
  data: { actions: PlannedAction[] };
}
interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

interface ChatMessage {
  message: string;
  deviceId: string;
  context?: any;
}

interface VoiceMessage {
  audio: Blob;
  deviceId: string;
}

interface DeviceRegistration {
  name: string;
  type: 'desktop';
  capabilities: {
    hasVoiceInput: boolean;
    hasVoiceOutput: boolean;
    hasFileAccess: boolean;
    hasCalendarAccess: boolean;
  };
}

class ApiService {
  private client: AxiosInstance;
  private config: ApiConfig;

  constructor() {
    const apiUrl =
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
      'http://localhost:3000/api';

    this.config = {
      baseURL: apiUrl,
      timeout: 30000,
    };

    console.log('[ApiService] Base URL:', apiUrl);

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getStoredToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = this.getStoredRefreshToken();
            if (refreshToken) {
              const response = await this.refreshToken(refreshToken);
              this.storeTokens(response.data);
              
              // Retry the original request with new token
              originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`;
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, clear tokens and surface error to UI (avoid full reload)
            this.clearTokens();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Auth methods
  async login(credentials: LoginRequest): Promise<AuthTokens> {
    const response = await this.client.post('/auth/login', credentials);
    const tokens = response.data?.data?.tokens || response.data?.tokens || response.data;
    this.storeTokens(tokens);
    return tokens;
  }

  async register(userData: RegisterRequest): Promise<AuthTokens> {
    const response = await this.client.post('/auth/register', userData);
    const tokens = response.data?.data?.tokens || response.data?.tokens || response.data;
    this.storeTokens(tokens);
    return tokens;
  }

  // Planner
  async plan(request: PlanRequest): Promise<PlanResponse> {
    const response = await this.client.post('/ai/plan', request);
    return response.data as PlanResponse;
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearTokens();
    }
  }

  private async refreshToken(refreshToken: string): Promise<AxiosResponse> {
    return this.client.post('/auth/refresh', { refreshToken });
  }

  // Device management
  async registerDevice(deviceData: DeviceRegistration): Promise<any> {
    const response = await this.client.post('/devices/register', deviceData);
    return response.data;
  }

  async getDevices(): Promise<any[]> {
    const response = await this.client.get('/devices');
    return response.data;
  }

  async syncDeviceState(deviceId: string, state: any): Promise<void> {
    await this.client.put(`/devices/${deviceId}/sync`, state);
  }

  async removeDevice(deviceId: string): Promise<void> {
    await this.client.delete(`/devices/${deviceId}`);
  }

  // AI Agent methods
  async sendChatMessage(messageData: ChatMessage): Promise<any> {
    const response = await this.client.post('/ai/chat', messageData);
    return response.data;
  }

  async sendVoiceMessage(voiceData: VoiceMessage): Promise<any> {
    const formData = new FormData();
    formData.append('audio', voiceData.audio);
    formData.append('deviceId', voiceData.deviceId);

    const response = await this.client.post('/ai/voice', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async getChatHistory(limit?: number): Promise<any[]> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());

    const response = await this.client.get(`/ai/messages/recent?${params}`);
    const payload = response.data;
    const list = payload?.data ?? payload;
    return Array.isArray(list) ? list : [];
  }

  async deleteChatHistory(messageId?: string): Promise<void> {
    if (messageId) {
      await this.client.delete(`/ai/conversations/${messageId}`);
    } else {
      console.warn('[ApiService] Bulk delete not implemented for conversations');
    }
  }

  // Data integration methods
  async getCalendarData(): Promise<any> {
    const response = await this.client.get('/data/calendar');
    return response.data;
  }

  async getFileData(filePath: string): Promise<any> {
    const response = await this.client.get('/data/files', {
      params: { path: filePath }
    });
    return response.data;
  }

  async updateDataPermissions(permissions: any): Promise<void> {
    await this.client.post('/data/permissions', permissions);
  }

  // Token management
  private storeTokens(tokens: AuthTokens): void {
    localStorage.setItem('auth_token', tokens.accessToken);
    localStorage.setItem('refresh_token', tokens.refreshToken);
  }

  private getStoredToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private getStoredRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  private clearTokens(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/health');
      return true;
    } catch (error) {
      return false;
    }
  }

  // Get current configuration
  getConfig(): ApiConfig {
    return { ...this.config };
  }

  // Update base URL (useful for switching environments)
  updateBaseURL(baseURL: string): void {
    this.config.baseURL = baseURL;
    this.client.defaults.baseURL = baseURL;
  }
}

// Create singleton instance
export const apiService = new ApiService();
export default apiService;