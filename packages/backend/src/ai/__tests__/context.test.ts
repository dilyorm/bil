import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextManager } from '../context';
import { ConversationContext, DeviceContext, AIMessage } from '../types';

// Mock dependencies
vi.mock('../memory');
vi.mock('../../database/connection');

import { MemoryStore } from '../memory';
import { db } from '../../database/connection';

describe('ContextManager', () => {
  let contextManager: ContextManager;
  let mockMemoryStore: any;
  let mockDbClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Memory Store
    mockMemoryStore = {
      getConversationHistory: vi.fn(),
      storeMemoryEntry: vi.fn(),
      getRelevantMemories: vi.fn()
    };

    // Mock Database Client
    mockDbClient = {
      query: vi.fn(),
      release: vi.fn()
    };

    vi.mocked(MemoryStore).mockImplementation(() => mockMemoryStore);
    vi.mocked(db.getClient).mockResolvedValue(mockDbClient);

    contextManager = new ContextManager();
  });

  describe('getContext', () => {
    const userId = 'user-123';
    const conversationId = 'conv-123';

    it('should build basic context successfully', async () => {
      // Mock user preferences query
      mockDbClient.query
        .mockResolvedValueOnce({
          rows: [{
            preferences: {
              voiceSettings: { preferredVoice: 'alloy' },
              privacySettings: { dataRetentionDays: 30 }
            }
          }]
        })
        .mockResolvedValueOnce({
          rows: [
            { activity: 'calendar_management' },
            { activity: 'email_management' }
          ]
        });

      mockMemoryStore.getConversationHistory.mockResolvedValue([]);

      const result = await contextManager.getContext(userId, conversationId);

      expect(result).toMatchObject({
        userId,
        conversationId,
        activeTopics: [],
        recentActivities: ['calendar_management', 'email_management'],
        relevantFiles: []
      });
    });

    it('should include device context when provided', async () => {
      const deviceContext: DeviceContext = {
        deviceId: 'device-123',
        deviceType: 'mobile',
        capabilities: {
          hasVoiceInput: true,
          hasVoiceOutput: true,
          hasHapticFeedback: false,
          hasFileAccess: true,
          hasCalendarAccess: true,
          supportsGestures: false
        }
      };

      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ preferences: {} }] })
        .mockResolvedValueOnce({ rows: [] });

      mockMemoryStore.getConversationHistory.mockResolvedValue([]);

      const result = await contextManager.getContext(userId, conversationId, deviceContext);

      expect(result.deviceContext).toEqual(deviceContext);
    });

    it('should extract topics from conversation history', async () => {
      const mockMessages: AIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Can you help me schedule a meeting for work?',
          timestamp: new Date()
        },
        {
          id: 'msg-2',
          role: 'user',
          content: 'I need to check the weather for my travel plans',
          timestamp: new Date()
        }
      ];

      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ preferences: {} }] })
        .mockResolvedValueOnce({ rows: [] });

      mockMemoryStore.getConversationHistory.mockResolvedValue(mockMessages);

      const result = await contextManager.getContext(userId, conversationId);

      expect(result.activeTopics).toContain('work');
      expect(result.activeTopics).toContain('weather');
      expect(result.activeTopics).toContain('travel');
    });

    it('should detect user mood from recent messages', async () => {
      const positiveMessages: AIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'This is great! I\'m so happy with the results.',
          timestamp: new Date()
        },
        {
          id: 'msg-2',
          role: 'user',
          content: 'Awesome work, thanks!',
          timestamp: new Date()
        }
      ];

      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ preferences: {} }] })
        .mockResolvedValueOnce({ rows: [] });

      mockMemoryStore.getConversationHistory.mockResolvedValue(positiveMessages);

      const result = await contextManager.getContext(userId, conversationId);

      expect(result.userMood).toBe('positive');
    });

    it('should detect negative mood', async () => {
      const negativeMessages: AIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'This is terrible and frustrating',
          timestamp: new Date()
        },
        {
          id: 'msg-2',
          role: 'user',
          content: 'I\'m really angry about this problem',
          timestamp: new Date()
        }
      ];

      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ preferences: {} }] })
        .mockResolvedValueOnce({ rows: [] });

      mockMemoryStore.getConversationHistory.mockResolvedValue(negativeMessages);

      const result = await contextManager.getContext(userId, conversationId);

      expect(result.userMood).toBe('negative');
    });

    it('should default to neutral mood', async () => {
      const neutralMessages: AIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Can you help me with this task?',
          timestamp: new Date()
        }
      ];

      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ preferences: {} }] })
        .mockResolvedValueOnce({ rows: [] });

      mockMemoryStore.getConversationHistory.mockResolvedValue(neutralMessages);

      const result = await contextManager.getContext(userId, conversationId);

      expect(result.userMood).toBe('neutral');
    });

    it('should handle database errors gracefully', async () => {
      mockDbClient.query.mockRejectedValue(new Error('Database error'));

      const result = await contextManager.getContext(userId, conversationId);

      expect(result).toMatchObject({
        userId,
        conversationId,
        activeTopics: [],
        recentActivities: [],
        relevantFiles: []
      });
    });

    it('should work without conversation ID', async () => {
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ preferences: {} }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await contextManager.getContext(userId);

      expect(result).toMatchObject({
        userId,
        conversationId: '',
        activeTopics: [],
        recentActivities: [],
        relevantFiles: []
      });
    });
  });

  describe('updateContext', () => {
    it('should store context updates as memory entries', async () => {
      const userId = 'user-123';
      const conversationId = 'conv-123';
      const updates: Partial<ConversationContext> = {
        activeTopics: ['work', 'meeting'],
        userMood: 'positive'
      };

      mockMemoryStore.storeMemoryEntry.mockResolvedValue('memory-1');

      await contextManager.updateContext(userId, conversationId, updates);

      expect(mockMemoryStore.storeMemoryEntry).toHaveBeenCalledWith({
        userId,
        conversationId,
        content: 'Active topics: work, meeting',
        type: 'context',
        relevanceScore: 0.8
      });

      expect(mockMemoryStore.storeMemoryEntry).toHaveBeenCalledWith({
        userId,
        conversationId,
        content: 'User mood: positive',
        type: 'context',
        relevanceScore: 0.6
      });
    });

    it('should handle updates with only topics', async () => {
      const userId = 'user-123';
      const conversationId = 'conv-123';
      const updates: Partial<ConversationContext> = {
        activeTopics: ['health', 'exercise']
      };

      mockMemoryStore.storeMemoryEntry.mockResolvedValue('memory-1');

      await contextManager.updateContext(userId, conversationId, updates);

      expect(mockMemoryStore.storeMemoryEntry).toHaveBeenCalledTimes(1);
      expect(mockMemoryStore.storeMemoryEntry).toHaveBeenCalledWith({
        userId,
        conversationId,
        content: 'Active topics: health, exercise',
        type: 'context',
        relevanceScore: 0.8
      });
    });
  });

  describe('getRelevantContext', () => {
    it('should return relevant memories based on query', async () => {
      const userId = 'user-123';
      const query = 'meeting schedule';
      const mockMemories = [
        {
          id: 'mem-1',
          userId,
          conversationId: 'conv-1',
          content: 'User prefers morning meetings',
          type: 'preference',
          timestamp: new Date(),
          relevanceScore: 0.9
        },
        {
          id: 'mem-2',
          userId,
          conversationId: 'conv-2',
          content: 'Meeting scheduled for 2pm tomorrow',
          type: 'context',
          timestamp: new Date(),
          relevanceScore: 0.8
        }
      ];

      mockMemoryStore.getRelevantMemories.mockResolvedValue(mockMemories);

      const result = await contextManager.getRelevantContext(userId, query);

      expect(result).toEqual([
        'User prefers morning meetings',
        'Meeting scheduled for 2pm tomorrow'
      ]);

      expect(mockMemoryStore.getRelevantMemories).toHaveBeenCalledWith(userId, query, 3);
    });

    it('should return empty array when no relevant memories found', async () => {
      const userId = 'user-123';
      const query = 'unknown topic';

      mockMemoryStore.getRelevantMemories.mockResolvedValue([]);

      const result = await contextManager.getRelevantContext(userId, query);

      expect(result).toEqual([]);
    });
  });

  describe('topic extraction', () => {
    it('should limit topics to maximum of 5', async () => {
      const messagesWithManyTopics: AIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'I need help with work, family, health, travel, food, music, and shopping',
          timestamp: new Date()
        }
      ];

      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ preferences: {} }] })
        .mockResolvedValueOnce({ rows: [] });

      mockMemoryStore.getConversationHistory.mockResolvedValue(messagesWithManyTopics);

      const result = await contextManager.getContext('user-123', 'conv-123');

      expect(result.activeTopics.length).toBeLessThanOrEqual(5);
    });
  });

  describe('recent activities', () => {
    it('should categorize activities based on message content', async () => {
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ preferences: {} }] })
        .mockResolvedValueOnce({
          rows: [
            { activity: 'calendar_management' },
            { activity: 'file_management' },
            { activity: 'task_management' }
          ]
        });

      mockMemoryStore.getConversationHistory.mockResolvedValue([]);

      const result = await contextManager.getContext('user-123', 'conv-123');

      expect(result.recentActivities).toContain('calendar_management');
      expect(result.recentActivities).toContain('file_management');
      expect(result.recentActivities).toContain('task_management');
    });

    it('should handle database errors in activity retrieval', async () => {
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ preferences: {} }] })
        .mockRejectedValueOnce(new Error('Activity query failed'));

      mockMemoryStore.getConversationHistory.mockResolvedValue([]);

      const result = await contextManager.getContext('user-123', 'conv-123');

      expect(result.recentActivities).toEqual([]);
    });
  });
});