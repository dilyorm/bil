export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  deviceId?: string;
  metadata?: {
    inputMethod?: 'voice' | 'text' | 'gesture';
    processingTime?: number;
    confidence?: number;
  };
}

export interface ConversationContext {
  userId: string;
  conversationId: string;
  activeTopics: string[];
  userMood?: string;
  currentLocation?: string;
  recentActivities: string[];
  relevantFiles: string[];
  deviceContext?: DeviceContext;
}

export interface DeviceContext {
  deviceId: string;
  deviceType: 'mobile' | 'desktop' | 'wearable' | 'web';
  capabilities: {
    hasVoiceInput: boolean;
    hasVoiceOutput: boolean;
    hasHapticFeedback: boolean;
    hasFileAccess: boolean;
    hasCalendarAccess: boolean;
    supportsGestures: boolean;
  };
}

export interface AIResponse {
  content: string;
  conversationId: string;
  messageId: string;
  timestamp: Date;
  processingTime: number;
  error?: boolean;
  errorMessage?: string;
}

export interface ProcessMessageRequest {
  userId: string;
  message: string;
  conversationId?: string;
  deviceContext?: DeviceContext;
}

export interface MemoryEntry {
  id: string;
  userId: string;
  conversationId: string;
  content: string;
  type: 'message' | 'preference' | 'context';
  timestamp: Date;
  relevanceScore?: number;
}