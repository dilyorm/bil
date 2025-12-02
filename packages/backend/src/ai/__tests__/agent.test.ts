import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIAgent } from '../agent';
import { ProcessMessageRequest, AIResponse } from '../types';

// Mock dependencies
vi.mock('../client');
vi.mock('../memory');
vi.mock('../context');
vi.mock('../conversation');

import { OpenAIClient } from '../client';
import { MemoryStore } from '../memory';
import { ContextManager } from '../context';
import { ConversationService } from '../conversation';

describe('AIAgent', () => {
  let agent: AIAgent;
  let mockOpenAIClient: any;
  let mockMemoryStore: any;
  let mockContextManager: any;
  let mockConversationService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock OpenAI Client
    mockOpenAIClient = {
      moderateContent: vi.fn(),
      generateResponse: vi.fn()
    };

    // Mock Memory Store
    mockMemoryStore = {
      createConversation: vi.fn(),
      getConversationHistory: vi.fn(),
      storeInteraction: vi.fn(),
      storeMemoryEntry: vi.fn(),
      getUserConversations: vi.fn()
    };

    // Mock Context Manager
    mockContextManager = {
      getContext: vi.fn()
    };

    // Mock Conversation Service
    mockConversationService = {
      getEnhancedContext: vi.fn()
    };

    vi.mocked(OpenAIClient).mockImplementation(() => mockOpenAIClient);
    vi.mocked(MemoryStore).mockImplementation(() => mockMemoryStore);
    vi.mocked(ContextManager).mockImplementation(() => mockContextManager);
    vi.mocked(ConversationService).mockImplementation(() => mockConversationService);

    agent = new AIAgent();
  });

  describe('processMessage', () => {
    const validRequest: ProcessMessageRequest = {
      userId: 'user-123',
      message: 'Hello, how are you?',
      conversationId: 'conv-123'
    };

    it('should process message successfully', async () => {
      // Setup mocks
      mockOpenAIClient.moderateContent.mockResolvedValue(false);
      mockConversationService.getEnhancedContext.mockResolvedValue({
        userId: 'user-123',
        conversationId: 'conv-123',
        activeTopics: ['greeting'],
        recentActivities: [],
        relevantFiles: []
      });
      mockMemoryStore.getConversationHistory.mockResolvedValue([
        {
          id: 'msg-1',
          role: 'user',
          content: 'Previous message',
          timestamp: new Date()
        }
      ]);
      mockOpenAIClient.generateResponse.mockResolvedValue('Hello! I\'m doing well, thank you for asking.');
      mockMemoryStore.storeInteraction.mockResolvedValue();

      const result = await agent.processMessage(validRequest);

      expect(result).toMatchObject({
        content: 'Hello! I\'m doing well, thank you for asking.',
        conversationId: 'conv-123',
        error: false
      });
      expect(result.messageId).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should create new conversation if none provided', async () => {
      const requestWithoutConversation: ProcessMessageRequest = {
        userId: validRequest.userId,
        message: validRequest.message
      };

      mockOpenAIClient.moderateContent.mockResolvedValue(false);
      mockMemoryStore.createConversation.mockResolvedValue('new-conv-123');
      mockConversationService.getEnhancedContext.mockResolvedValue({
        userId: 'user-123',
        conversationId: 'new-conv-123',
        activeTopics: [],
        recentActivities: [],
        relevantFiles: []
      });
      mockMemoryStore.getConversationHistory.mockResolvedValue([]);
      mockOpenAIClient.generateResponse.mockResolvedValue('Hello!');
      mockMemoryStore.storeInteraction.mockResolvedValue();

      const result = await agent.processMessage(requestWithoutConversation);

      expect(mockMemoryStore.createConversation).toHaveBeenCalledWith('user-123');
      expect(result.conversationId).toBe('new-conv-123');
    });

    it('should reject empty message', async () => {
      const invalidRequest = {
        ...validRequest,
        message: ''
      };

      const result = await agent.processMessage(invalidRequest);

      expect(result.error).toBe(true);
      expect(result.errorMessage).toBe('Message content is required');
    });

    it('should reject message without userId', async () => {
      const invalidRequest = {
        ...validRequest,
        userId: ''
      };

      const result = await agent.processMessage(invalidRequest);

      expect(result.error).toBe(true);
      expect(result.errorMessage).toBe('User ID is required');
    });

    it('should handle flagged content', async () => {
      mockOpenAIClient.moderateContent.mockResolvedValue(true);

      const result = await agent.processMessage(validRequest);

      expect(result.error).toBe(true);
      expect(result.content).toContain('can\'t help with that request');
      expect(result.errorMessage).toBe('Content flagged by moderation');
    });

    it('should handle OpenAI API errors gracefully', async () => {
      mockOpenAIClient.moderateContent.mockResolvedValue(false);
      mockConversationService.getEnhancedContext.mockResolvedValue({
        userId: 'user-123',
        conversationId: 'conv-123',
        activeTopics: [],
        recentActivities: [],
        relevantFiles: []
      });
      mockMemoryStore.getConversationHistory.mockResolvedValue([]);
      mockOpenAIClient.generateResponse.mockRejectedValue(new Error('Rate limit exceeded'));

      const result = await agent.processMessage(validRequest);

      expect(result.error).toBe(true);
      expect(result.content).toContain('high demand right now');
    });

    it('should include device context in system prompt', async () => {
      const requestWithDevice = {
        ...validRequest,
        deviceContext: {
          deviceId: 'device-123',
          deviceType: 'wearable' as const,
          capabilities: {
            hasVoiceInput: true,
            hasVoiceOutput: false,
            hasHapticFeedback: true,
            hasFileAccess: false,
            hasCalendarAccess: false,
            supportsGestures: true
          }
        }
      };

      mockOpenAIClient.moderateContent.mockResolvedValue(false);
      mockConversationService.getEnhancedContext.mockResolvedValue({
        userId: 'user-123',
        conversationId: 'conv-123',
        activeTopics: [],
        recentActivities: [],
        relevantFiles: [],
        deviceContext: requestWithDevice.deviceContext
      });
      mockMemoryStore.getConversationHistory.mockResolvedValue([]);
      mockOpenAIClient.generateResponse.mockResolvedValue('Brief response for wearable');
      mockMemoryStore.storeInteraction.mockResolvedValue();

      await agent.processMessage(requestWithDevice);

      // Verify that generateResponse was called with messages including device context
      expect(mockOpenAIClient.generateResponse).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('wearable device')
          })
        ]),
        expect.any(Object)
      );
    });

    it('should store user preferences when detected', async () => {
      const preferenceMessage = {
        ...validRequest,
        message: 'I prefer coffee over tea'
      };

      mockOpenAIClient.moderateContent.mockResolvedValue(false);
      mockConversationService.getEnhancedContext.mockResolvedValue({
        userId: 'user-123',
        conversationId: 'conv-123',
        activeTopics: [],
        recentActivities: [],
        relevantFiles: []
      });
      mockMemoryStore.getConversationHistory.mockResolvedValue([]);
      mockOpenAIClient.generateResponse.mockResolvedValue('Noted your preference for coffee!');
      mockMemoryStore.storeInteraction.mockResolvedValue();
      mockMemoryStore.storeMemoryEntry.mockResolvedValue();

      await agent.processMessage(preferenceMessage);

      expect(mockMemoryStore.storeMemoryEntry).toHaveBeenCalledWith({
        userId: 'user-123',
        conversationId: 'conv-123',
        content: 'User preference: I prefer coffee over tea',
        type: 'preference',
        relevanceScore: 0.9
      });
    });
  });

  describe('getConversationHistory', () => {
    it('should return conversation history', async () => {
      const mockHistory = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Hi there!',
          timestamp: new Date()
        }
      ];

      mockMemoryStore.getConversationHistory.mockResolvedValue(mockHistory);

      const result = await agent.getConversationHistory('conv-123');

      expect(result).toEqual(mockHistory);
      expect(mockMemoryStore.getConversationHistory).toHaveBeenCalledWith('conv-123');
    });
  });

  describe('getUserConversations', () => {
    it('should return user conversations', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          created_at: new Date(),
          last_message: 'Hello'
        },
        {
          id: 'conv-2',
          created_at: new Date(),
          last_message: 'How are you?'
        }
      ];

      mockMemoryStore.getUserConversations.mockResolvedValue(mockConversations);

      const result = await agent.getUserConversations('user-123');

      expect(result).toEqual(mockConversations);
      expect(mockMemoryStore.getUserConversations).toHaveBeenCalledWith('user-123');
    });
  });

  describe('error handling', () => {
    const testRequest: ProcessMessageRequest = {
      userId: 'user-123',
      message: 'Hello, how are you?',
      conversationId: 'conv-123'
    };

    it('should provide appropriate fallback for rate limit errors', async () => {
      mockOpenAIClient.moderateContent.mockResolvedValue(false);
      mockConversationService.getEnhancedContext.mockResolvedValue({
        userId: 'user-123',
        conversationId: 'conv-123',
        activeTopics: [],
        recentActivities: [],
        relevantFiles: []
      });
      mockMemoryStore.getConversationHistory.mockResolvedValue([]);
      mockOpenAIClient.generateResponse.mockRejectedValue(new Error('Rate limit exceeded'));

      const result = await agent.processMessage(testRequest);

      expect(result.content).toContain('high demand right now');
    });

    it('should provide appropriate fallback for API key errors', async () => {
      mockOpenAIClient.moderateContent.mockResolvedValue(false);
      mockConversationService.getEnhancedContext.mockResolvedValue({
        userId: 'user-123',
        conversationId: 'conv-123',
        activeTopics: [],
        recentActivities: [],
        relevantFiles: []
      });
      mockMemoryStore.getConversationHistory.mockResolvedValue([]);
      mockOpenAIClient.generateResponse.mockRejectedValue(new Error('API key invalid'));

      const result = await agent.processMessage(testRequest);

      expect(result.content).toContain('configuration issue');
    });

    it('should provide generic fallback for unknown errors', async () => {
      mockOpenAIClient.moderateContent.mockResolvedValue(false);
      mockConversationService.getEnhancedContext.mockResolvedValue({
        userId: 'user-123',
        conversationId: 'conv-123',
        activeTopics: [],
        recentActivities: [],
        relevantFiles: []
      });
      mockMemoryStore.getConversationHistory.mockResolvedValue([]);
      mockOpenAIClient.generateResponse.mockRejectedValue(new Error('Unknown error'));

      const result = await agent.processMessage(testRequest);

      expect(result.content).toContain('encountered an issue');
    });
  });
});