export interface Conversation {
  id: string;
  userId: string;
  messages: Message[];
  context: ConversationContext;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  deviceId: string;
  timestamp: Date;
  metadata: {
    inputMethod: 'voice' | 'text' | 'gesture';
    processingTime: number;
    confidence?: number;
  };
}

export interface ConversationContext {
  activeTopics: string[];
  userMood: string;
  currentLocation?: string;
  recentActivities: string[];
  relevantFiles: string[];
}