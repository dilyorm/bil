export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  deviceId?: string;
  metadata?: {
    inputMethod: 'voice' | 'text' | 'gesture';
    processingTime?: number;
    confidence?: number;
  };
}

export interface Conversation {
  id: string;
  messages: Message[];
  context?: {
    activeTopics: string[];
    userMood?: string;
    currentLocation?: string;
    recentActivities: string[];
    relevantFiles: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  isTyping: boolean;
  error: string | null;
}

export interface VoiceState {
  isRecording: boolean;
  isPlaying: boolean;
  isProcessing: boolean;
  transcript: string;
  error: string | null;
}